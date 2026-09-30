import { expect, it, vi } from "vitest";
import { useExperienceStore } from "../app/stores/experienceStore";
import { useTourRequestStore } from "../app/stores/tourRequestStore";
import { reconcileAfterCommand } from "../shared/utils/reconcileAfterCommand";

const api = vi.fn();
Object.assign(globalThis, { useNuxtApp: () => ({ $apiFetch: api }) });
const view = (
  revision = 0,
  preference = "guide",
  effective = "interactive",
) => ({
  revision,
  generation_id: null,
  personal_context: {
    interaction_mode: preference,
    interests: ["art"],
    step_free: true,
    note: "Keep this",
  },
  interaction_mode: effective,
  sources: [],
  stops: [],
  available_actions: ["ASK", "PHOTO", "BREAK"],
  cues: [],
  turns: [],
});

it("keeps effective mode distinct from personal context after forgetting", async () => {
  const store = useExperienceStore();
  api.mockResolvedValueOnce(view(2, "guide", "leading"));
  await store.load("tour", "owner");
  expect(store.view?.interaction_mode).toBe("leading");
  expect(store.view?.personal_context.interaction_mode).toBe("guide");
});

it("applies the full context with revision, generation and an operation key", async () => {
  const store = useExperienceStore();
  api.mockResolvedValueOnce(view(3));
  await store.load("tour", "owner");
  const context = {
    ...store.view!.personal_context,
    interaction_mode: "leading" as const,
  };
  api.mockResolvedValueOnce(view(4, "leading", "leading"));
  await store.act({ action: "UPDATE_CONTEXT", context });
  const [, options] = api.mock.calls.at(-1)!;
  expect(options.body).toEqual({
    action: "UPDATE_CONTEXT",
    context,
    expected_revision: 3,
    generation_id: null,
  });
  expect(options.headers["Idempotency-Key"]).toBeTruthy();
});

it("preserves uncertain actions through automatic reconciliation", async () => {
  const store = useExperienceStore();
  api.mockResolvedValueOnce(view());
  await store.load("tour", "owner");
  api.mockRejectedValueOnce(new Error("uncertain"));
  await expect(store.act({ action: "PHOTO" })).rejects.toThrow();
  const original = api.mock.calls.at(-1)![1];
  store.invalidate("tour");
  api.mockResolvedValueOnce(view(2, "leading", "leading"));
  await store.reconcile("tour");
  expect(store.hasPending).toBe(true);
  expect(store.needsReconciliation).toBe(false);
  api.mockResolvedValueOnce(view(2, "leading", "leading"));
  await store.retry();
  expect(api.mock.calls.at(-1)![1]).toEqual(original);
});

it("blocks mutations after a failed command refresh until a successful read", async () => {
  const store = useExperienceStore();
  api.mockResolvedValueOnce(view());
  await store.load("tour", "owner");
  store.invalidate("tour");
  api.mockRejectedValueOnce(new Error("offline"));
  await expect(store.reconcile()).rejects.toThrow("offline");
  await expect(store.act({ action: "PHOTO" })).rejects.toThrow();
  expect(store.needsReconciliation).toBe(true);
  api.mockResolvedValueOnce(view(1));
  await store.reconcile();
  api.mockResolvedValueOnce(view(2));
  await store.act({ action: "PHOTO" });
  expect(api.mock.calls.at(-1)![1].body.expected_revision).toBe(1);
});

it("captures the first-send revision after prior queued command reconciliation", async () => {
  const store = useExperienceStore();
  api.mockResolvedValueOnce(view());
  await store.load("tour", "owner");
  let release!: () => void;
  const previous = useTourRequestStore().run("tour", async () => {
    await new Promise<void>((done) => {
      release = done;
    });
    store.invalidate("tour");
    api.mockResolvedValueOnce(view(4, "leading", "leading"));
    await store.reconcile();
    api.mockResolvedValueOnce(view(5, "leading", "leading"));
  });
  await Promise.resolve();
  const queued = store.act({ action: "PHOTO" });
  release();
  await Promise.all([previous, queued]);
  expect(api.mock.calls.at(-1)![1].body.expected_revision).toBe(4);
});

it("ignores a command reconciliation after the active account/tour changes", async () => {
  const store = useExperienceStore();
  api.mockResolvedValueOnce(view());
  await store.load("tour", "owner");
  store.invalidate("tour");
  store.reset();
  const calls = api.mock.calls.length;
  await store.reconcile("tour");
  expect(api.mock.calls.length).toBe(calls);
  expect(store.view).toBeNull();
  expect(store.needsReconciliation).toBe(false);
});

it("does not move a queued action into a different generation", async () => {
  const store = useExperienceStore();
  api.mockResolvedValueOnce({ ...view(), generation_id: "old" });
  await store.load("tour", "owner");
  let release!: () => void;
  const previous = useTourRequestStore().run("tour", async () => {
    await new Promise<void>((done) => {
      release = done;
    });
    api.mockResolvedValueOnce({ ...view(1), generation_id: "new" });
    await store.reconcile();
  });
  await Promise.resolve();
  const queued = store.act({ action: "CONTINUE", stop_id: "old-stop" });
  const failure = expect(queued).rejects.toMatchObject({ statusCode: 409 });
  release();
  await previous;
  await failure;
  expect(
    api.mock.calls.filter(([, options]) => options?.method === "POST"),
  ).toEqual([]);
});

it("retains a stale marker if the final read fails despite a mid-command read", async () => {
  const store = useExperienceStore();
  api.mockResolvedValueOnce(view());
  await store.load("tour", "owner");
  await store.withCommand("tour", async () => {
    api.mockResolvedValueOnce(view());
    await store.reconcile();
    api.mockRejectedValueOnce(new Error("offline"));
    return "accepted";
  });
  expect(store.needsReconciliation).toBe(true);
});

it("cannot refresh a later tour from an older command completion", async () => {
  const store = useExperienceStore();
  api.mockResolvedValueOnce(view());
  await store.load("tour", "owner");
  let resolve!: () => void;
  const command = store.withCommand(
    "tour",
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  api.mockResolvedValueOnce(view(7, "interactive", "interactive"));
  await store.load("other-tour", "other-owner");
  const calls = api.mock.calls.length;
  resolve();
  await command;
  expect(api.mock.calls.length).toBe(calls);
  expect(store.view?.revision).toBe(7);
  expect(store.needsReconciliation).toBe(false);
});

it("reconciles a command even when its later operation fails, preserving the original error", async () => {
  const events: string[] = [];
  const failure = new Error("operation failed");
  await expect(
    reconcileAfterCommand(
      async () => {
        events.push("command");
        throw failure;
      },
      () => events.push("stale"),
      async () => {
        events.push("read");
        throw new Error("offline");
      },
    ),
  ).rejects.toBe(failure);
  expect(events).toEqual(["stale", "command", "read"]);
});
