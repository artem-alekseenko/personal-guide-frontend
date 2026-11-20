import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, reactive, ref, watch } from "vue";
import type { User } from "firebase/auth";
import type { WalkView, WalkRequest } from "../shared/types/nativeWalk";
import { useNativeWalkPosition } from "../app/composables/tour/useNativeWalkPosition";
import { useNativeWalk } from "../app/composables/tour/useNativeWalk";
import { useUserStore } from "../app/stores/userStore";
import { mount } from "./helpers/render";

const fixture = vi.hoisted(() => ({ gps: null as any }));
vi.mock("../app/stores/geolocationStore", () => ({
  useGeolocationStore: () => fixture.gps,
}));
let visible = "visible";
let visibilityChanged: () => void;
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-05T12:00:00Z"));
  useUserStore().user = { uid: "owner" } as User;
  fixture.gps = reactive({
    coordinates: [0, 0],
    recordedAt: new Date().toISOString(),
    accuracy: 5,
    error: null,
    refresh: vi.fn(async () => {}),
  });
  visible = "visible";
  vi.stubGlobal("document", {
    get visibilityState() {
      return visible;
    },
    addEventListener: (_name: string, listener: () => void) => {
      visibilityChanged = listener;
    },
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("navigator", {
    locks: {
      request: vi.fn((_name, _options, callback) => callback({ name: "lock" })),
    },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
async function flush() {
  for (let i = 0; i < 32; i++) await Promise.resolve();
  await nextTick();
}

function journey(holdContinue?: Promise<void>, simulated = false) {
  let state: WalkView = {
    contract_version: 3,
    session_id: "session",
    generation_id: "generation",
    route_id: "route",
    route_revision: "revision",
    language: "en",
    revision: 0,
    control_revision: 0,
    scheduling_mode: "automatic",
    paused: false,
    started: false,
    elapsed_active_seconds: 0,
    remaining_seconds: 600,
    progress: null,
    context: {
      geographic_subject_ids: [],
      discussion_subject_id: null,
      eligible_claim_ids: [],
      delivered_claim_ids: [],
    },
    eligible_action: null,
    active_delivery: null,
    offered_delivery: null,
    research_gaps: [],
    finished: false,
    completion_reason: null,
    silence_reason: null,
  };
  const writes: WalkRequest[] = [];
  let next = 1;
  let available = 2;
  const eligible = () => {
    state.eligible_action =
      state.scheduling_mode === "automatic" &&
      next <= available &&
      !state.active_delivery
        ? {
            id: `eligible-${next}`,
            operation_id: `activate-${next}`,
            generation_id: "generation",
            route_revision: "revision",
            language: "en",
            control_revision: 0,
            location_revision: writes.length,
            subject_id: "place",
            claim_ids: [`claim-${next}`],
            expires_at: new Date(Date.now() + 45000).toISOString(),
          }
        : null;
  };
  const api = vi.fn(async (path: string, options?: { body?: WalkRequest }) => {
    // Text-only fixture: no media is rendered, downloaded or played.
    if (path.endsWith("/audio")) return null;
    const request = options?.body;
    if (!request) return structuredClone(state);
    writes.push(structuredClone(request));
    if (request.action === "CONTINUE" && holdContinue) await holdContinue;
    state.offered_delivery = null;
    state.eligible_action = null;
    state.silence_reason = null;
    state.revision++;
    if (request.action === "START") state.started = true;
    if (request.action === "REOPEN") {
      state.finished = false;
      state.continued_after_finish = true;
      state.paused = false;
    }
    if (request.action === "LOCATION_UPDATE") {
      state.position_mode = request.position_mode ?? "gps";
      state.progress = {
        ...request,
        point: request.point!,
        recorded_at: request.recorded_at!,
        reliable: request.accuracy_meters! <= 50,
        reason:
          request.accuracy_meters! <= 50 ? null : "inaccurate_observation",
        ambiguous: false,
        distance_meters: 0,
        furthest_meters: 0,
        completed: false,
      } as any;
      eligible();
    }
    if (request.action === "SET_MODE")
      state.scheduling_mode = request.scheduling_mode!;
    if (request.action === "ACKNOWLEDGE") {
      expect(request.delivery_id).toBe(state.active_delivery?.id);
      if (request.delivery_state === "completed") {
        state.context.delivered_claim_ids.push(
          ...state.active_delivery!.claim_ids,
        );
        state.active_delivery = null;
        eligible();
      }
    }
    if (["CONTINUE", "ACTIVATE"].includes(request.action)) {
      if (next <= available) {
        state.active_delivery = {
          id: `delivery-${next}`,
          kind: "story",
          subject_id: "place",
          text: `Passage ${next} with saved local history.`,
          claim_ids: [`claim-${next}`],
          source_ids: ["source"],
          unverified_claim_ids: [],
          evidence_status: "verified",
          state: "offered",
          created_at: new Date().toISOString(),
        };
        state.offered_delivery = state.active_delivery;
        next++;
      } else state.silence_reason = "no_unused_supported_evidence";
    }
    if (request.action === "FINISH") {
      state.finished = true;
      state.active_delivery = null;
    }
    return structuredClone(state);
  });
  vi.stubGlobal("useNuxtApp", () => ({ $apiFetch: api }));
  let walk!: ReturnType<typeof useNativeWalk>;
  let position: ReturnType<typeof useNativeWalkPosition> | undefined;
  const app = mount(
    defineComponent({
      setup() {
        if (simulated)
          position = useNativeWalkPosition(ref({ lat: 0, lng: 0 }));
        walk = useNativeWalk("tour", position?.source);
        if (position)
          watch(
            walk.view,
            (view) => {
              if (view) position!.initialize(view);
            },
            { immediate: true },
          );
        return () =>
          h("p", walk.view.value?.active_delivery?.text ?? "Loading");
      },
    }),
  );
  return {
    app,
    walk,
    writes,
    api,
    position,
    addPassage: () => {
      available++;
    },
  };
}

it("Start displays text; automatic reading completion advances until silence, then GPS can resume it", async () => {
  const j = journey();
  try {
    await flush();
    expect(j.writes).toHaveLength(0);
    await j.walk.start();
    await flush();
    expect(j.walk.view.value?.active_delivery?.text).toContain("Passage 1");
    await vi.advanceTimersByTimeAsync(7999);
    expect(j.writes.filter((r) => r.action === "ACKNOWLEDGE")).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(j.walk.view.value?.active_delivery?.text).toContain("Passage 2");
    expect(j.writes.find((r) => r.action === "ACTIVATE")).toMatchObject({
      operation_id: "activate-2",
      eligible_action_id: "eligible-2",
    });
    await vi.advanceTimersByTimeAsync(8000);
    await flush();
    expect(j.walk.view.value?.active_delivery).toBeNull();
    const quietWrites = j.writes.length;
    await vi.advanceTimersByTimeAsync(10000);
    expect(j.writes).toHaveLength(quietWrites);
    j.addPassage();
    fixture.gps.coordinates = [0.001, 0];
    fixture.gps.recordedAt = new Date().toISOString();
    await flush();
    expect(j.walk.view.value?.active_delivery?.text).toContain("Passage 3");
    expect(
      j.writes.filter((r) => r.action === "LOCATION_UPDATE").at(-1)?.point,
    ).toEqual({ lng: 0.001, lat: 0 });
  } finally {
    j.app.unmount();
  }
});

it("manual mode waits for Next step and Finish cancels outstanding reading continuation", async () => {
  const j = journey();
  try {
    await flush();
    await j.walk.setMode(false);
    await j.walk.start();
    await flush();
    await vi.advanceTimersByTimeAsync(8000);
    await flush();
    expect(j.walk.view.value?.active_delivery).toBeNull();
    expect(j.writes.some((r) => r.action === "ACTIVATE")).toBe(false);
    await j.walk.nextStep();
    expect(j.walk.view.value?.active_delivery?.text).toContain("Passage 2");
    await j.walk.finish();
    const count = j.writes.length;
    await vi.advanceTimersByTimeAsync(30000);
    expect(j.writes).toHaveLength(count);
    expect(j.walk.view.value?.finished).toBe(true);
  } finally {
    j.app.unmount();
  }
});

it("hidden-page time and a changed account never complete a reading passage", async () => {
  const j = journey();
  try {
    await flush();
    await j.walk.start();
    await flush();
    visible = "hidden";
    visibilityChanged();
    await vi.advanceTimersByTimeAsync(20000);
    expect(j.writes.some((r) => r.action === "ACKNOWLEDGE")).toBe(false);
    visible = "visible";
    visibilityChanged();
    await vi.advanceTimersByTimeAsync(4000);
    useUserStore().user = { uid: "another-owner" } as User;
    await flush();
    await vi.advanceTimersByTimeAsync(20000);
    expect(j.writes.some((r) => r.action === "ACKNOWLEDGE")).toBe(false);
  } finally {
    j.app.unmount();
  }
});

it("uses the newest GPS fix received while starting without replacing the active passage", async () => {
  const pending = Promise.withResolvers<void>();
  const j = journey(pending.promise);
  try {
    await flush();
    const starting = j.walk.start();
    await flush();
    fixture.gps.coordinates = [0.001, 0];
    fixture.gps.recordedAt = new Date(Date.now() + 1000).toISOString();
    await flush();
    fixture.gps.coordinates = [0.002, 0];
    fixture.gps.recordedAt = new Date(Date.now() + 2000).toISOString();
    pending.resolve();
    await starting;
    await flush();
    const locations = j.writes.filter((r) => r.action === "LOCATION_UPDATE");
    expect(locations).toHaveLength(2);
    expect(locations.at(-1)?.point).toEqual({ lng: 0.002, lat: 0 });
    expect(j.walk.view.value?.active_delivery?.text).toContain("Passage 1");
    expect(j.writes.some((r) => r.action === "ACKNOWLEDGE")).toBe(false);
  } finally {
    j.app.unmount();
  }
});

it("unchecking automatic guidance during a passage prevents its next automatic activation", async () => {
  const j = journey();
  try {
    await flush();
    await j.walk.start();
    await flush();
    await vi.advanceTimersByTimeAsync(4000);
    await j.walk.setMode(false);
    await vi.advanceTimersByTimeAsync(4000);
    await flush();
    expect(j.walk.view.value?.active_delivery).toBeNull();
    expect(j.writes.some((r) => r.action === "ACTIVATE")).toBe(false);
    await j.walk.nextStep();
    expect(j.walk.view.value?.active_delivery?.text).toContain("Passage 2");
  } finally {
    j.app.unmount();
  }
});

it("Next step retries an inaccurate location and explains why no passage can start", async () => {
  fixture.gps.accuracy = 106;
  const j = journey();
  try {
    await flush();
    await j.walk.start();
    await j.walk.nextStep();
    expect(fixture.gps.refresh).toHaveBeenCalledTimes(2);
    expect(j.walk.stepStatus.value).toBe("location_inaccurate");
    expect(j.writes.some((r) => r.action === "CONTINUE")).toBe(false);
    fixture.gps.refresh.mockImplementation(async () => {
      vi.setSystemTime(Date.now() + 1000);
      fixture.gps.accuracy = 5;
      fixture.gps.recordedAt = new Date().toISOString();
    });
    await j.walk.nextStep();
    await flush();
    expect(j.walk.stepStatus.value).toBeNull();
    expect(j.walk.view.value?.active_delivery?.text).toContain("Passage 1");
  } finally {
    j.app.unmount();
  }
});

it("Next step explains backend silence when the nearby stories are exhausted", async () => {
  const j = journey();
  try {
    await flush();
    await j.walk.setMode(false);
    await j.walk.start();
    await j.walk.nextStep();
    await j.walk.nextStep();
    expect(j.walk.view.value?.active_delivery).toBeNull();
    expect(j.walk.stepStatus.value).toBe("no_story");
    expect(j.writes.filter((r) => r.action === "CONTINUE")).toHaveLength(3);
  } finally {
    j.app.unmount();
  }
});

it("simulation drives Start, map movement and Next without device GPS; returning to GPS restores the device source", async () => {
  fixture.gps.coordinates = null;
  fixture.gps.recordedAt = null;
  fixture.gps.error = "Location denied";
  const j = journey(undefined, true);
  try {
    await flush();
    const position = j.position!;
    position.isManualMode.value = true;
    await j.walk.start();
    await flush();
    expect(j.walk.view.value?.active_delivery?.text).toContain("Passage 1");
    expect(j.writes.find((r) => r.action === "LOCATION_UPDATE")).toMatchObject({
      position_mode: "simulation",
      point: { lat: 0, lng: 0 },
    });
    vi.setSystemTime(Date.now() + 1000);
    position.move({ lat: 0, lng: 0.008 });
    await flush();
    expect(
      j.writes.filter((r) => r.action === "LOCATION_UPDATE").at(-1),
    ).toMatchObject({
      position_mode: "simulation",
      point: { lat: 0, lng: 0.008 },
    });
    expect(j.walk.view.value?.active_delivery?.text).toContain("Passage 1");
    expect(fixture.gps.coordinates).toBeNull();
    expect(fixture.gps.refresh).not.toHaveBeenCalled();
    // Reading a long passage must not expire the explicitly selected position.
    vi.setSystemTime(Date.now() + 90000);
    await j.walk.nextStep();
    await flush();
    expect(j.walk.view.value?.active_delivery?.text).toContain("Passage 2");
    expect(j.walk.stepStatus.value).toBeNull();
    fixture.gps.coordinates = [0.001, 0];
    fixture.gps.recordedAt = new Date().toISOString();
    fixture.gps.error = null;
    position.isManualMode.value = false;
    await flush();
    expect(
      j.writes.filter((r) => r.action === "LOCATION_UPDATE").at(-1),
    ).toMatchObject({
      position_mode: "gps",
      point: { lat: 0, lng: 0.001 },
    });
  } finally {
    j.app.unmount();
  }
});

it("Continue walk reopens the finished session and requests the next passage without clearing memory", async () => {
  const j = journey(undefined, true);
  try {
    await flush();
    j.position!.isManualMode.value = true;
    await j.walk.start();
    await flush();
    await vi.advanceTimersByTimeAsync(8000);
    await flush();
    await j.walk.finish();
    expect(j.walk.view.value?.finished).toBe(true);
    const heard = [...j.walk.view.value!.context.delivered_claim_ids];
    expect(heard).toEqual(["claim-1"]);
    j.addPassage();
    await j.walk.reopen();
    await flush();
    expect(j.walk.view.value?.finished).toBe(false);
    expect(j.walk.view.value?.context.delivered_claim_ids).toEqual(heard);
    expect(j.walk.view.value?.active_delivery?.text).toContain("Passage 3");
    expect(
      j.writes
        .slice(j.writes.findIndex((r) => r.action === "REOPEN"))
        .map((r) => r.action),
    ).toEqual(["REOPEN", "LOCATION_UPDATE", "CONTINUE"]);
    await j.walk.finish();
    expect(j.walk.view.value?.finished).toBe(true);
  } finally {
    j.app.unmount();
  }
});

it("retrying a lost reopen response keeps its operation ID and completes continuation", async () => {
  const j = journey(undefined, true);
  try {
    await flush();
    j.position!.isManualMode.value = true;
    await j.walk.start();
    await flush();
    await j.walk.finish();
    const original = j.api.getMockImplementation()!;
    let lost = false;
    j.api.mockImplementation(async (path, options) => {
      const response = await original(path, options);
      if (options?.body?.action === "REOPEN" && !lost) {
        lost = true;
        throw new Error("Response lost after commit");
      }
      return response;
    });
    await expect(j.walk.reopen()).rejects.toThrow("Response lost");
    expect(j.walk.uncertain.value).toBe(true);
    await j.walk.retry();
    await flush();
    const reopenings = j.writes.filter((r) => r.action === "REOPEN");
    expect(reopenings).toHaveLength(2);
    expect(reopenings[0]).toEqual(reopenings[1]);
    expect(j.walk.view.value?.finished).toBe(false);
    expect(j.walk.view.value?.active_delivery?.text).toContain("Passage 2");
    expect(j.walk.uncertain.value).toBe(false);
  } finally {
    j.app.unmount();
  }
});

it("background refresh and simulated position updates keep controls ready, while an explicit Next step blocks duplicates", async () => {
  const j = journey(undefined, true);
  try {
    await flush();
    j.position!.isManualMode.value = true;
    await j.walk.setMode(false);
    await j.walk.start();
    await flush();
    const original = j.api.getMockImplementation()!;
    const poll = Promise.withResolvers<void>();
    j.api.mockImplementation(async (path, options) => {
      if (!options?.body && path.endsWith("/tour")) await poll.promise;
      return original(path, options);
    });
    await vi.advanceTimersByTimeAsync(10000);
    expect(j.walk.busy.value).toBe(true);
    expect(j.walk.ready.value).toBe(true);
    poll.resolve();
    await flush();
    const movement = Promise.withResolvers<void>();
    const next = Promise.withResolvers<void>();
    j.api.mockImplementation(async (path, options) => {
      if (options?.body?.action === "LOCATION_UPDATE") await movement.promise;
      if (options?.body?.action === "CONTINUE") await next.promise;
      return original(path, options);
    });
    j.position!.move({ lat: 0, lng: 0.008 });
    await flush();
    expect(j.walk.busy.value).toBe(true);
    expect(j.walk.ready.value).toBe(true);
    const stepping = j.walk.nextStep();
    await flush();
    expect(j.walk.ready.value).toBe(false);
    movement.resolve();
    next.resolve();
    await stepping;
    await flush();
    expect(j.walk.ready.value).toBe(true);
  } finally {
    j.app.unmount();
  }
});

it("missing local research has different feedback from stories already heard and clears after moving", async () => {
  const j = journey(undefined, true);
  try {
    await flush();
    j.position!.isManualMode.value = true;
    await j.walk.setMode(false);
    await j.walk.start();
    await j.walk.nextStep();
    const original = j.api.getMockImplementation()!;
    j.api.mockImplementation(async (path, options) => {
      const response = await original(path, options);
      if (options?.body?.action === "CONTINUE")
        response!.silence_reason = "no_local_evidence";
      return response;
    });
    await j.walk.nextStep();
    expect(j.walk.stepStatus.value).toBe("no_local_research");
    vi.setSystemTime(Date.now() + 1000);
    j.position!.move({ lat: 0, lng: 0.008 });
    await flush();
    expect(j.walk.stepStatus.value).toBeNull();
  } finally {
    j.app.unmount();
  }
});
