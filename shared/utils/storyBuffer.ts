import type {
  ActivateStory,
  CancelReason,
  CancelStory,
  PrepareStory,
  StoryBufferState,
  StoryBufferView,
  StoryPoint,
  StoryPosition,
} from "../types/storyBuffer";

export interface StoryObservation {
  generationId: string | null;
  segmentId: string | null;
  stopId: string | null;
  started: boolean;
  enabled: boolean;
  playing: boolean;
  visible: boolean;
  finished: boolean;
  waiting: boolean;
  point: StoryPoint | null;
  stopPoint: StoryPoint | null;
  accuracy: number | null;
  recordedAt: string | null;
  remainingSeconds: number;
}
export type StoryBufferOperation =
  | { kind: "prepare"; key: string; body: PrepareStory }
  | { kind: "activate"; key: string; body: ActivateStory; bufferId: string }
  | { kind: "cancel"; key: string; body: CancelStory };
export interface StoryBufferTransport {
  prepare: (body: PrepareStory, key: string) => Promise<StoryBufferView>;
  activate: (
    id: string,
    body: ActivateStory,
    key: string,
  ) => Promise<StoryBufferView>;
  cancel: (body: CancelStory) => Promise<StoryBufferView>;
  state: () => Promise<StoryBufferState>;
}

/** Shared physical evidence policy; requesting detail never creates GPS evidence. */
export function isStoryFixAtStop(
  value: {
    point: StoryPoint | null;
    stopPoint: StoryPoint | null;
    accuracy: number | null;
    recordedAt: string | null;
  },
  now: number,
): boolean {
  if (
    !value.point ||
    !value.stopPoint ||
    value.accuracy === null ||
    !Number.isFinite(value.accuracy) ||
    value.accuracy < 0 ||
    value.accuracy > 50 ||
    !value.recordedAt
  )
    return false;
  const age = now - Date.parse(value.recordedAt);
  if (!Number.isFinite(age) || age < -30_000 || age > 90_000) return false;
  const values = [
    value.point.lat,
    value.point.lng,
    value.stopPoint.lat,
    value.stopPoint.lng,
  ];
  if (values.some((v) => !v.trim() || !Number.isFinite(Number(v))))
    return false;
  const [lat, lng, stopLat, stopLng] = values.map(Number) as [
    number,
    number,
    number,
    number,
  ];
  if (
    Math.abs(lat) > 90 ||
    Math.abs(stopLat) > 90 ||
    Math.abs(lng) > 180 ||
    Math.abs(stopLng) > 180
  )
    return false;
  const radians = Math.PI / 180;
  const a =
    Math.sin(((stopLat - lat) * radians) / 2) ** 2 +
    Math.cos(lat * radians) *
      Math.cos(stopLat * radians) *
      Math.sin(((stopLng - lng) * radians) / 2) ** 2;
  const distance =
    6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return distance + value.accuracy <= 40;
}

/** Same conservative fix/proximity policy as backend story-buffer activation. */
export function storyPosition(
  value: StoryObservation,
  now: number,
): StoryPosition | null {
  if (
    !value.enabled ||
    !value.visible ||
    value.finished ||
    value.waiting ||
    !value.started ||
    !value.generationId ||
    !value.segmentId ||
    !value.stopId ||
    !value.point ||
    value.accuracy === null ||
    !value.recordedAt ||
    !isStoryFixAtStop(value, now)
  )
    return null;
  return {
    generation_id: value.generationId,
    current_segment_id: value.segmentId,
    stop_id: value.stopId,
    point: { ...value.point },
    accuracy: value.accuracy,
    recorded_at: value.recordedAt,
  };
}

/** Pure metadata/control coordinator. Timing, media and UI are owned by the browser adapter. */
export function createStoryBufferController(options: {
  read: () => StoryObservation;
  transport: StoryBufferTransport;
  activated: (
    view: StoryBufferView,
    point: StoryPoint,
    recovered: boolean,
    mayContinue: () => boolean,
  ) => Promise<void>;
  now?: () => number;
  changed?: () => void;
  persist?: (operation: StoryBufferOperation | null) => void;
  recovery?: StoryBufferOperation | null;
  current?: () => boolean;
  canRequest?: () => boolean;
}) {
  const now = options.now ?? Date.now;
  const current = options.current ?? (() => true);
  const canRequest = options.canRequest ?? current;
  const attempted = new Set<string>();
  let prepared: StoryBufferView | null = null;
  let pending = options.recovery ?? null;
  let work: Promise<void> | null = null;
  let epoch = 0;
  let status = pending ? "uncertain" : "idle";
  let anchor: StoryPosition | null =
    pending && pending.kind !== "cancel" ? pending.body : null;
  const update = (value: string) => {
    status = value;
    options.changed?.();
  };
  const save = (value: StoryBufferOperation | null) => {
    pending = value;
    options.persist?.(value);
  };
  const matches = (view: StoryBufferView, identity: StoryPosition) =>
    view.generation_id === identity.generation_id &&
    view.stop_id === identity.stop_id;
  const run = (task: () => Promise<void>) => {
    if (work) return work;
    const promise = Promise.resolve()
      .then(task)
      .finally(() => {
        if (work === promise) work = null;
      });
    work = promise;
    return promise;
  };
  const settleCancel = async (
    operation: Extract<StoryBufferOperation, { kind: "cancel" }>,
  ) => {
    if (!canRequest()) return;
    try {
      await options.transport.cancel(operation.body);
      save(null);
      update("suspended");
    } catch {
      update("uncertain");
    }
  };
  const cancel = async (view: StoryBufferView, reason: CancelReason) => {
    if (!view.buffer_id || !view.generation_id) return;
    const operation: StoryBufferOperation = {
      kind: "cancel",
      key: crypto.randomUUID(),
      body: {
        generation_id: view.generation_id,
        buffer_id: view.buffer_id,
        reason,
      },
    };
    save(operation);
    await settleCancel(operation);
  };
  let cancellationReason: CancelReason = "visitor_cancel";
  async function suspend(reason: CancelReason) {
    cancellationReason = reason;
    epoch++;
    const buffer = prepared;
    prepared = null;
    if (anchor) attempted.add(anchor.current_segment_id);
    if (status !== "uncertain") update("suspended");
    // An optional read has no delivery side effects. Fence its late result without
    // delaying visitor controls; uncertain mutations still require reconciliation.
    if (work && !pending && !buffer) return;
    await work;
    if (buffer) await run(() => cancel(buffer, reason));
    const late = prepared as StoryBufferView | null;
    if (late) {
      prepared = null;
      await run(() => cancel(late, reason));
    }
    // A lost prepare is resolved before an explicit visitor action supersedes it.
    if (pending?.kind === "prepare" && canRequest())
      await run(async () => {
        try {
          const operation = pending;
          if (operation?.kind !== "prepare") return;
          const state = await options.transport.state();
          if (
            state.generation_id === operation.body.generation_id &&
            state.prepared &&
            matches(state.prepared, operation.body)
          )
            await cancel(state.prepared, reason);
          else {
            save(null);
            update("suspended");
          }
        } catch {
          update("uncertain");
        }
      });
  }
  async function observe() {
    if (!current()) return;
    const observation = options.read();
    const identity = storyPosition(observation, now());
    if (work && pending?.kind === "activate") {
      // The adapter can install the new GENERATED checkpoint before its handoff finishes.
      const fix = storyPosition({ ...observation, started: true }, now());
      if (
        !fix ||
        fix.generation_id !== pending.body.generation_id ||
        fix.stop_id !== pending.body.stop_id ||
        ![pending.body.current_segment_id, pending.bufferId].includes(
          fix.current_segment_id,
        )
      )
        await suspend("movement");
      return;
    }
    if (
      anchor &&
      (!identity ||
        identity.current_segment_id !== anchor.current_segment_id ||
        identity.generation_id !== anchor.generation_id ||
        identity.stop_id !== anchor.stop_id)
    ) {
      if (prepared || work)
        await suspend(
          observation.finished
            ? "completion"
            : !observation.enabled || !observation.visible
              ? "visitor_cancel"
              : "movement",
        );
      if (!identity || prepared || work || pending) return;
      anchor = null;
    }
    if (
      work ||
      pending ||
      !identity ||
      !observation.playing ||
      attempted.has(identity.current_segment_id) ||
      !Number.isFinite(observation.remainingSeconds) ||
      observation.remainingSeconds <= 0 ||
      observation.remainingSeconds > 40
    )
      return;
    anchor = identity;
    attempted.add(identity.current_segment_id);
    const operation: StoryBufferOperation = {
      kind: "prepare",
      key: crypto.randomUUID(),
      body: { ...identity, remaining_seconds: observation.remainingSeconds },
    };
    save(operation);
    update("preparing");
    const requestEpoch = epoch;
    await run(async () => {
      try {
        const view = await options.transport.prepare(
          operation.body as PrepareStory,
          operation.key,
        );
        if (requestEpoch !== epoch || !current()) {
          await cancel(view, cancellationReason);
          return;
        }
        save(null);
        if (
          view.status === "prepared" &&
          view.buffer_id &&
          matches(view, identity) &&
          Date.parse(view.expires_at ?? "") > now()
        ) {
          prepared = view;
          update("prepared");
        } else
          update(view.status === "exhausted" ? "exhausted" : "unavailable");
      } catch (error) {
        if (!current()) return;
        const code =
          (error as { statusCode?: number; status?: number }).statusCode ??
          (error as { status?: number }).status;
        if (code && [400, 401, 403, 404, 409, 422].includes(code)) {
          save(null);
          update("unavailable");
        } else update("uncertain");
      }
    });
  }
  async function complete(): Promise<boolean> {
    if (work && !pending && !prepared) return false;
    await work;
    if (!current()) return false;
    if (pending?.kind === "activate") return true;
    const identity = storyPosition(options.read(), now());
    const buffer = prepared;
    if (
      !buffer ||
      !anchor ||
      !identity ||
      !matches(buffer, identity) ||
      identity.current_segment_id !== anchor.current_segment_id ||
      Date.parse(buffer.expires_at ?? "") <= now()
    ) {
      if (buffer) await suspend("movement");
      return false;
    }
    prepared = null;
    const operation: StoryBufferOperation = {
      kind: "activate",
      key: crypto.randomUUID(),
      bufferId: buffer.buffer_id!,
      body: { ...identity, completed_segment_id: identity.current_segment_id },
    };
    save(operation);
    update("activating");
    const requestEpoch = epoch;
    await run(async () => {
      try {
        const view = await options.transport.activate(
          operation.bufferId!,
          operation.body as ActivateStory,
          operation.key,
        );
        if (!current()) return;
        if (
          view.status === "activated" &&
          view.segment_id === operation.bufferId &&
          matches(view, identity) &&
          view.text?.trim() &&
          view.content_refs.length === 1
        ) {
          const mayContinue = () => {
            const latest = storyPosition(
              { ...options.read(), started: true },
              now(),
            );
            return (
              current() &&
              requestEpoch === epoch &&
              !!latest &&
              latest.generation_id === identity.generation_id &&
              latest.stop_id === identity.stop_id
            );
          };
          await options.activated(
            view,
            identity.point,
            !mayContinue(),
            mayContinue,
          );
          save(null);
          anchor = null;
          update("idle");
        } else if (view.status === "already_consumed") {
          save(null);
          anchor = null;
          update("consumed");
        } else update("uncertain");
      } catch {
        if (current()) update("uncertain");
      }
    });
    return true;
  }
  async function reconcile() {
    if (work) {
      await work;
      return;
    }
    if (!current()) return;
    const operation = pending;
    const requestEpoch = epoch;
    const requestedGeneration = options.read().generationId;
    update("reconciling");
    await run(async () => {
      try {
        if (operation?.kind === "cancel") {
          await settleCancel(operation);
          return;
        }
        const state = await options.transport.state();
        if (!current()) {
          if (state.prepared && state.generation_id === requestedGeneration)
            await cancel(state.prepared, cancellationReason);
          return;
        }
        if (
          !operation &&
          state.prepared &&
          state.generation_id === options.read().generationId
        ) {
          await cancel(state.prepared, "visitor_cancel");
          return;
        }
        const view = state.last_activation;
        if (
          operation?.kind === "activate" &&
          view?.status === "activated" &&
          view.buffer_id === operation.bufferId &&
          view.segment_id === state.active_segment_id &&
          state.active_delivery_state === "GENERATED" &&
          matches(view, operation.body) &&
          view.text?.trim() &&
          view.content_refs.length === 1
        ) {
          // Retry the same activation when its original fix remains valid, repairing history publication.
          const age = now() - Date.parse(operation.body.recorded_at);
          const recovered =
            !state.paused && age >= -30_000 && age <= 90_000
              ? await options.transport.activate(
                  operation.bufferId,
                  operation.body,
                  operation.key,
                )
              : view;
          if (recovered.status !== "activated") {
            save(null);
            anchor = null;
            update("consumed");
            return;
          }
          await options.activated(
            recovered,
            operation.body.point,
            true,
            () => false,
          );
          save(null);
          anchor = null;
          update("idle");
        } else if (
          operation &&
          state.generation_id === operation.body.generation_id &&
          state.active_segment_id === operation.body.current_segment_id &&
          state.prepared &&
          matches(state.prepared, operation.body) &&
          !state.paused
        ) {
          if (requestEpoch !== epoch) {
            await cancel(state.prepared, cancellationReason);
            return;
          }
          prepared = state.prepared;
          anchor = operation.body;
          save(null);
          update("prepared");
          const identity = storyPosition(options.read(), now());
          if (
            !identity ||
            identity.current_segment_id !== operation.body.current_segment_id
          ) {
            const buffer = prepared;
            prepared = null;
            await cancel(buffer, cancellationReason);
          }
        } else if (
          operation?.kind === "prepare" &&
          state.generation_id === operation.body.generation_id &&
          state.active_segment_id === operation.body.current_segment_id &&
          state.prepare_requested_for_current_segment
        ) {
          save(null);
          update("exhausted");
        } else if (
          operation?.kind === "prepare" &&
          state.active_segment_id === operation.body.current_segment_id &&
          state.active_delivery_state === "STARTED" &&
          !state.paused
        ) {
          const age = now() - Date.parse(operation.body.recorded_at);
          const identity = storyPosition(options.read(), now());
          if (!identity || age < -30_000 || age > 90_000) {
            save(null);
            update("suspended");
            return;
          }
          const retry = await options.transport.prepare(
            operation.body,
            operation.key,
          );
          if (requestEpoch !== epoch || !current()) {
            await cancel(retry, cancellationReason);
            return;
          }
          if (retry.status === "prepared" && matches(retry, operation.body)) {
            prepared = retry;
            anchor = operation.body;
            save(null);
            update("prepared");
          } else {
            save(null);
            update(retry.status === "exhausted" ? "exhausted" : "unavailable");
          }
        } else if (
          operation?.kind === "activate" &&
          state.active_segment_id !== operation.body.current_segment_id
        ) {
          save(null);
          anchor = null;
          update("consumed");
        } else {
          // No automatic retry of an uncertain mutation; an explicit new step can recover it.
          save(null);
          anchor = null;
          update(operation ? "unavailable" : "idle");
        }
      } catch (error) {
        const code =
          (error as { statusCode?: number; status?: number }).statusCode ??
          (error as { status?: number }).status;
        update(!pending && code === 404 ? "unavailable" : "uncertain");
      }
    });
  }
  return {
    observe,
    complete,
    suspend,
    reconcile,
    get status() {
      return status;
    },
    get hasPending() {
      return !!pending;
    },
  };
}
