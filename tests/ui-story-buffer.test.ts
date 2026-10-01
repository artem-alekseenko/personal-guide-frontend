import { expect, it } from "vitest";
import { createStoryBufferController } from "../shared/utils/storyBuffer";
import type { StoryBufferView } from "../shared/types/storyBuffer";

const prepared: StoryBufferView = {
  status: "prepared",
  buffer_id: "buffer",
  generation_id: "gen",
  stop_id: "museum",
  expires_at: "2026-09-30T12:03:00Z",
  reason: null,
  text: null,
  segment_id: null,
  content_refs: [],
  discussion_focus: null,
};
const activated: StoryBufferView = {
  ...prepared,
  status: "activated",
  text: "The next supported story.",
  segment_id: "buffer",
  content_refs: ["existing-recording"],
  discussion_focus: {
    object_id: "museum",
    turn_id: "buffer",
    point: { lat: "47", lng: "19" },
  },
};
function fixture() {
  const requests: { action: string; body: any; key?: string; id?: string }[] =
    [];
  const shown: { view: StoryBufferView; recovered: boolean }[] = [];
  let snapshot = {
    generationId: "gen",
    segmentId: "current",
    stopId: "museum",
    started: true,
    enabled: true,
    playing: true,
    visible: true,
    finished: false,
    waiting: false,
    point: { lat: "47", lng: "19" },
    stopPoint: { lat: "47", lng: "19" },
    accuracy: 5 as number | null,
    recordedAt: "2026-09-30T12:00:00Z",
    remainingSeconds: 50,
  };
  let reply = prepared;
  let resolvePrepare: ((view: StoryBufferView) => void) | null = null;
  let delay = false,
    failure = false,
    cancelFailure = false,
    current = true;
  let failureStatus: number | undefined;
  let callbackWait: Promise<void> | null = null;
  let callbackRelease: (() => void) | null = null;
  const permitted: boolean[] = [];
  let saved: unknown = null;
  let stateWait: Promise<void> | null = null;
  let stateRelease: (() => void) | null = null;
  let stateReply = {
    generation_id: "gen",
    active_segment_id: "buffer",
    active_delivery_state: "GENERATED" as "GENERATED" | "STARTED",
    paused: false,
    prepared: null as StoryBufferView | null,
    last_activation: activated as StoryBufferView | null,
    prepare_requested_for_current_segment: false,
  };
  const controller = createStoryBufferController({
    current: () => current,
    canRequest: () => true,
    persist: (value) => {
      saved = value;
    },
    now: () => Date.parse("2026-09-30T12:00:10Z"),
    read: () => snapshot,
    transport: {
      prepare: async (body, key) => {
        requests.push({ action: "prepare", body, key });
        if (failure)
          throw Object.assign(new Error("Response lost"), {
            statusCode: failureStatus,
          });
        if (delay)
          return new Promise<StoryBufferView>((resolve) => {
            resolvePrepare = resolve;
          });
        return reply;
      },
      activate: async (id, body, key) => {
        requests.push({ action: "activate", id, body, key });
        if (failure) throw new Error("Response lost");
        return {
          ...activated,
          buffer_id: id,
          segment_id: id,
          discussion_focus: { ...activated.discussion_focus!, turn_id: id },
          status:
            reply.status === "already_consumed"
              ? "already_consumed"
              : "activated",
        };
      },
      cancel: async (body) => {
        requests.push({ action: "cancel", body });
        if (cancelFailure) throw new Error("Cancellation lost");
        return { ...prepared, status: "cancelled" };
      },
      state: async () => {
        if (stateWait) await stateWait;
        return stateReply;
      },
    },
    activated: async (view, _point, recovered, mayContinue) => {
      if (callbackWait) await callbackWait;
      shown.push({ view, recovered });
      permitted.push(mayContinue());
    },
  });
  return {
    controller,
    requests,
    shown,
    change: (value: Partial<typeof snapshot>) => {
      snapshot = { ...snapshot, ...value };
    },
    reply: (value: StoryBufferView) => {
      reply = value;
    },
    delay: () => {
      delay = true;
    },
    resolve: () => resolvePrepare?.(prepared),
    fail: (value: boolean) => {
      failure = value;
    },
    failStatus: (value: number) => {
      failure = true;
      failureStatus = value;
    },
    state: (value: Partial<typeof stateReply>) => {
      stateReply = { ...stateReply, ...value };
    },
    failCancel: (value: boolean) => {
      cancelFailure = value;
    },
    unmount: () => {
      current = false;
    },
    saved: () => saved,
    delayCallback: () => {
      callbackWait = new Promise<void>((resolve) => {
        callbackRelease = resolve;
      });
    },
    releaseCallback: () => callbackRelease?.(),
    permitted,
    delayState: () => {
      stateWait = new Promise<void>((resolve) => {
        stateRelease = resolve;
      });
    },
    releaseState: () => stateRelease?.(),
  };
}
it("prepares once within 40 seconds and leaves the current story visible until completion", async () => {
  const f = fixture();
  await f.controller.observe();
  expect(f.requests).toEqual([]);
  f.change({ remainingSeconds: 40 });
  await f.controller.observe();
  await f.controller.observe();
  expect(f.requests).toHaveLength(1);
  expect(f.requests[0]!.body).toEqual({
    generation_id: "gen",
    current_segment_id: "current",
    stop_id: "museum",
    point: { lat: "47", lng: "19" },
    accuracy: 5,
    recorded_at: "2026-09-30T12:00:00Z",
    remaining_seconds: 40,
  });
  expect(f.shown).toEqual([]);
  f.change({ playing: false, recordedAt: "2026-09-30T12:00:08Z" });
  expect(await f.controller.complete()).toBe(true);
  expect(f.requests[1]!.body).toEqual({
    generation_id: "gen",
    current_segment_id: "current",
    stop_id: "museum",
    completed_segment_id: "current",
    point: { lat: "47", lng: "19" },
    accuracy: 5,
    recorded_at: "2026-09-30T12:00:08Z",
  });
  expect(f.shown).toEqual([{ view: activated, recovered: false }]);
});
it("prepares successive started stories at 40 seconds and stops the chain on pause", async () => {
  const f = fixture();
  f.change({ remainingSeconds: 40 });
  await f.controller.observe();
  f.change({ playing: false, remainingSeconds: 0 });
  expect(await f.controller.complete()).toBe(true);

  f.change({ segmentId: "buffer", playing: true, remainingSeconds: 80 });
  f.reply({ ...prepared, buffer_id: "second-buffer" });
  await f.controller.observe();
  expect(f.requests.map((r) => r.action)).toEqual(["prepare", "activate"]);
  f.change({ remainingSeconds: 40 });
  await f.controller.observe();
  f.change({ playing: false, remainingSeconds: 0 });
  expect(await f.controller.complete()).toBe(true);

  f.change({ segmentId: "second-buffer", playing: true, remainingSeconds: 40 });
  f.reply({ ...prepared, buffer_id: "third-buffer" });
  await f.controller.observe();
  f.change({ playing: false, waiting: true });
  await f.controller.suspend("pause");
  await f.controller.observe();
  expect(await f.controller.complete()).toBe(false);
  expect(f.requests.map((r) => r.action)).toEqual([
    "prepare",
    "activate",
    "prepare",
    "activate",
    "prepare",
    "cancel",
  ]);
  expect(
    f.requests
      .filter((r) => r.action === "prepare")
      .map((r) => r.body.current_segment_id),
  ).toEqual(["current", "buffer", "second-buffer"]);
  expect(f.shown.map((story) => story.view.segment_id)).toEqual([
    "buffer",
    "second-buffer",
  ]);
  expect(f.requests.at(-1)?.body.reason).toBe("pause");
});

it.each([
  { started: false },
  { enabled: false },
  { waiting: true },
  { visible: false },
  { finished: true },
  { accuracy: null },
  { accuracy: 51 },
  { recordedAt: "2026-09-30T11:00:00Z" },
  { recordedAt: "2026-09-30T12:01:00Z" },
  { point: { lat: "47.001", lng: "19" } },
])(
  "withholds automatic requests when eligibility is missing: %j",
  async (change) => {
    const f = fixture();
    f.change({ remainingSeconds: 20, ...change });
    await f.controller.observe();
    expect(f.requests).toEqual([]);
  },
);
it("cancels a prepared story immediately on movement and never activates it", async () => {
  const f = fixture();
  f.change({ remainingSeconds: 30 });
  await f.controller.observe();
  f.change({ point: { lat: "47.01", lng: "19" } });
  await f.controller.observe();
  expect(f.requests.map((r) => r.action)).toEqual(["prepare", "cancel"]);
  expect(await f.controller.complete()).toBe(false);
  expect(f.shown).toEqual([]);
});
it("cancels a late prepare response after a visitor question", async () => {
  const f = fixture();
  f.delay();
  f.change({ remainingSeconds: 30 });
  const pending = f.controller.observe();
  await Promise.resolve();
  const cancellation = f.controller.suspend("question");
  f.resolve();
  await pending;
  await cancellation;
  expect(f.requests.map((r) => r.action)).toEqual(["prepare", "cancel"]);
  expect(await f.controller.complete()).toBe(false);
  expect(f.shown).toEqual([]);
});
it("does not poll an exhausted segment again", async () => {
  const f = fixture();
  f.reply({ ...prepared, status: "exhausted", buffer_id: null });
  f.change({ remainingSeconds: 30 });
  await f.controller.observe();
  await f.controller.observe();
  expect(f.requests).toHaveLength(1);
  expect(f.controller.status).toBe("exhausted");
});
it("can prepare again after an exhausted segment is replaced by a new started segment", async () => {
  const f = fixture();
  f.reply({ ...prepared, status: "exhausted", buffer_id: null });
  f.change({ remainingSeconds: 30 });
  await f.controller.observe();
  f.change({ segmentId: "next-segment" });
  f.reply(prepared);
  await f.controller.observe();
  expect(f.requests).toHaveLength(2);
  expect(f.requests[1]!.body.current_segment_id).toBe("next-segment");
});
it("reconciles an exhausted prepare without repeating the automatic request", async () => {
  const f = fixture();
  f.fail(true);
  f.change({ remainingSeconds: 30 });
  await f.controller.observe();
  f.fail(false);
  f.state({
    active_segment_id: "current",
    prepared: null,
    last_activation: null,
    prepare_requested_for_current_segment: true,
  });
  await f.controller.reconcile();
  expect(f.controller.status).toBe("exhausted");
  await f.controller.observe();
  expect(f.requests).toHaveLength(1);
});
it("reports a backend without the contract as unavailable without retaining a blocking mutation", async () => {
  const f = fixture();
  f.failStatus(404);
  f.change({ remainingSeconds: 30 });
  await f.controller.observe();
  expect(f.controller.status).toBe("unavailable");
  expect(f.saved()).toBeNull();
});
it("explicitly retries an uncommitted prepare with its original payload and operation key", async () => {
  const f = fixture();
  f.fail(true);
  f.change({ remainingSeconds: 30 });
  await f.controller.observe();
  f.fail(false);
  f.state({
    active_segment_id: "current",
    active_delivery_state: "STARTED",
    last_activation: null,
  });
  f.change({ recordedAt: "2026-09-30T12:00:08Z" });
  await f.controller.reconcile();
  expect(f.requests).toHaveLength(2);
  expect(f.requests[1]).toEqual(f.requests[0]);
  expect(f.controller.status).toBe("prepared");
});
it("does not replay a consumed activation during response-loss reconciliation", async () => {
  const f = fixture();
  f.change({ remainingSeconds: 30 });
  await f.controller.observe();
  f.fail(true);
  await f.controller.complete();
  f.fail(false);
  f.state({ active_delivery_state: "STARTED", last_activation: null });
  await f.controller.reconcile();
  expect(f.shown).toEqual([]);
  expect(f.controller.status).toBe("consumed");
});
it("retains failed cancellation identity and retries it during explicit reconciliation", async () => {
  const f = fixture();
  f.change({ remainingSeconds: 30 });
  await f.controller.observe();
  f.failCancel(true);
  await f.controller.suspend("pause");
  expect(f.controller.status).toBe("uncertain");
  expect(f.saved()).toMatchObject({
    kind: "cancel",
    body: { buffer_id: "buffer", reason: "pause" },
  });
  f.failCancel(false);
  await f.controller.reconcile();
  expect(f.requests.filter((r) => r.action === "cancel")).toHaveLength(2);
  expect(f.saved()).toBeNull();
});
it("cancels a late prepared response even when the page has unmounted", async () => {
  const f = fixture();
  f.delay();
  f.change({ remainingSeconds: 30 });
  const preparing = f.controller.observe();
  await Promise.resolve();
  const cancelling = f.controller.suspend("visitor_cancel");
  f.unmount();
  f.resolve();
  await preparing;
  await cancelling;
  expect(f.requests.map((r) => r.action)).toEqual(["prepare", "cancel"]);
});
it("revokes continuation permission when a visitor action occurs during activation handoff", async () => {
  const f = fixture();
  f.change({ remainingSeconds: 30 });
  await f.controller.observe();
  f.delayCallback();
  const completing = f.controller.complete();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  const cancelling = f.controller.suspend("question");
  f.releaseCallback();
  await completing;
  await cancelling;
  expect(f.permitted).toEqual([false]);
});
it("does not revive continuation after moving away and returning during activation handoff", async () => {
  const f = fixture();
  f.change({ remainingSeconds: 30 });
  await f.controller.observe();
  f.delayCallback();
  const completing = f.controller.complete();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  f.change({ point: { lat: "47.01", lng: "19" } });
  const moving = f.controller.observe();
  f.change({ point: { lat: "47", lng: "19" } });
  f.releaseCallback();
  await completing;
  await moving;
  expect(f.permitted).toEqual([false]);
});
it("keeps visitor controls available during an optional metadata read", async () => {
  const f = fixture();
  f.state({ prepared });
  f.delayState();
  const reading = f.controller.reconcile();
  let suspended = false;
  const cancelling = f.controller.suspend("question").then(() => {
    suspended = true;
  });
  for (let i = 0; i < 8; i++) await Promise.resolve();
  const availableBeforeRead = suspended;
  f.releaseState();
  await Promise.all([reading, cancelling]);
  expect(availableBeforeRead).toBe(true);
  expect(f.requests.map((request) => request.action)).toEqual(["cancel"]);
  expect(f.shown).toEqual([]);
});

it("serializes concurrent response-loss reconciliation", async () => {
  const f = fixture();
  f.change({ remainingSeconds: 30 });
  await f.controller.observe();
  f.fail(true);
  await f.controller.complete();
  f.fail(false);
  f.delayCallback();
  const first = f.controller.reconcile(),
    second = f.controller.reconcile();
  await Promise.resolve();
  f.releaseCallback();
  await first;
  await second;
  expect(f.shown).toHaveLength(1);
});
it("does not resurrect prepared metadata when a visitor cancels during reconciliation", async () => {
  const f = fixture();
  f.fail(true);
  f.change({ remainingSeconds: 30 });
  await f.controller.observe();
  f.fail(false);
  f.state({
    active_segment_id: "current",
    active_delivery_state: "STARTED",
    prepared,
    last_activation: null,
  });
  f.delayState();
  const reconciling = f.controller.reconcile();
  await Promise.resolve();
  const cancelling = f.controller.suspend("question");
  f.releaseState();
  await reconciling;
  await cancelling;
  expect(f.requests.map((r) => r.action)).toEqual(["prepare", "cancel"]);
  expect(await f.controller.complete()).toBe(false);
});
it("never installs an already-consumed activation", async () => {
  const f = fixture();
  f.change({ remainingSeconds: 30 });
  await f.controller.observe();
  f.reply({ ...activated, status: "already_consumed" });
  await f.controller.complete();
  expect(f.shown).toEqual([]);
});
it("reconciles response loss without automatically presenting it as a fresh story", async () => {
  const f = fixture();
  f.change({ remainingSeconds: 30 });
  await f.controller.observe();
  f.fail(true);
  await f.controller.complete();
  expect(f.controller.status).toBe("uncertain");
  expect(f.shown).toEqual([]);
  f.fail(false);
  await f.controller.reconcile();
  expect(f.shown).toEqual([{ view: activated, recovered: true }]);
});
it("recovers conclusive generated metadata from GET while the backend is paused", async () => {
  const f = fixture();
  f.change({ remainingSeconds: 30 });
  await f.controller.observe();
  f.fail(true);
  await f.controller.complete();
  f.state({ paused: true });
  await f.controller.reconcile();
  expect(f.shown).toEqual([{ view: activated, recovered: true }]);
  expect(f.controller.status).toBe("idle");
});
