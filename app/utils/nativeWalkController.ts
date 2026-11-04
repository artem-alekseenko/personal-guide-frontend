import type {
  WalkAction,
  WalkRequest,
  WalkView,
} from "#shared/types/nativeWalk";

export interface WalkTransport {
  read(): Promise<WalkView>;
  write(request: WalkRequest): Promise<WalkView>;
}
/** Original payload/key survive uncertain failures; a read alone never speaks. */
export class NativeWalkController {
  view: WalkView | null = null;
  pending: WalkRequest | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(
    private transport: WalkTransport,
    private current: () => boolean,
    private changed: () => void = () => {},
  ) {}

  private accept(next: WalkView) {
    if (!this.current()) throw new Error("Walking session changed");
    if (
      this.view &&
      (next.generation_id !== this.view.generation_id ||
        next.route_revision !== this.view.route_revision ||
        next.language !== this.view.language)
    )
      throw new Error("Walking generation changed; reload the tour");
    if (!this.view || next.revision >= this.view.revision) this.view = next;
    this.changed();
    return next;
  }
  async load(reconcile = false) {
    const result = await this.transport.read();
    this.accept(result);
    if (reconcile) {
      this.pending = null;
      this.changed();
    }
    return result;
  }
  send(action: WalkAction, fields: Partial<WalkRequest> = {}) {
    const task = this.queue.then(async () => {
      if (!this.current() || !this.view)
        throw new Error("Walking view is unavailable");
      if (this.pending)
        throw new Error("Reconcile or retry the pending walking action first");
      const request: WalkRequest = structuredClone({
        ...fields,
        action,
        operation_id: fields.operation_id ?? crypto.randomUUID(),
        expected_generation_id: this.view.generation_id,
        expected_route_revision: this.view.route_revision,
        language: this.view.language,
      });
      this.pending = request;
      this.changed();
      return this.dispatch(request);
    });
    this.queue = task.catch(() => {});
    return task;
  }
  retry() {
    const task = this.queue.then(() => {
      if (!this.pending) throw new Error("No pending walking action");
      return this.dispatch(this.pending);
    });
    this.queue = task.catch(() => {});
    return task;
  }
  private async dispatch(request: WalkRequest) {
    try {
      if (!this.current()) throw new Error("Walking session changed");
      const response = await this.transport.write(structuredClone(request));
      this.accept(response);
      this.pending = null;
      this.changed();
      return response;
    } catch (error) {
      const status =
        (error as { statusCode?: number; status?: number }).statusCode ??
        (error as { status?: number }).status;
      // Definite client/domain rejection did not produce an activation receipt.
      if (status && status >= 400 && status < 500) this.pending = null;
      this.changed();
      throw error;
    }
  }
}
