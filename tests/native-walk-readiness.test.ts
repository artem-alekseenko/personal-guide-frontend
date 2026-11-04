import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, reactive } from "vue";
import { mount } from "./helpers/render";
import type { WalkView } from "../shared/types/nativeWalk";
const fixtures = vi.hoisted(() => ({
  store: null as any,
  users: null as any,
  gps: null as any,
}));
vi.mock("../app/stores/nativeWalkStore", () => ({
  useNativeWalkStore: () => fixtures.store,
}));
vi.mock("../app/stores/userStore", () => ({
  useUserStore: () => fixtures.users,
}));
vi.mock("../app/stores/geolocationStore", () => ({
  useGeolocationStore: () => fixtures.gps,
}));
import { useNativeWalk } from "../app/composables/tour/useNativeWalk";
function snapshot(): WalkView {
  return {
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
}
async function flush() {
  for (let index = 0; index < 8; index++) await Promise.resolve();
  await nextTick();
}
beforeEach(() => {
  vi.useFakeTimers();
  fixtures.users = reactive({ user: { uid: "owner" } });
  fixtures.gps = reactive({
    coordinates: null,
    recordedAt: null,
    accuracy: null,
    error: null,
  });
  fixtures.store = reactive({
    view: null,
    pending: null,
    busy: false,
    uncertain: false,
    attach: vi.fn(() => vi.fn()),
    isScope: () => true,
    load: vi.fn(),
    send: vi.fn(async (action: string) => {
      fixtures.store.view = {
        ...snapshot(),
        started: action === "START",
        revision: 1,
      };
      return fixtures.store.view;
    }),
  });
  vi.stubGlobal("useNuxtApp", () => ({ $apiFetch: vi.fn() }));
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
it("recovers from initial unpublished research without remounting or starting automatically", async () => {
  fixtures.store.load
    .mockRejectedValueOnce({
      statusCode: 409,
      data: {
        data: {
          detail: "Walking research is not yet published",
          code: "conflict",
        },
      },
    })
    .mockImplementation(async () => {
      fixtures.store.view = snapshot();
      return fixtures.store.view;
    });
  let walk!: ReturnType<typeof useNativeWalk>;
  const app = mount(
    defineComponent({
      setup() {
        walk = useNativeWalk("tour");
        return () => h("div");
      },
    }),
  );
  try {
    await flush();
    expect(walk.preparing.value).toBe(true);
    expect(walk.failed.value).toBe(false);
    expect(walk.canControl.value).toBe(true);
    expect(walk.ready.value).toBe(false);
    await vi.advanceTimersByTimeAsync(10000);
    await flush();
    expect(walk.preparing.value).toBe(false);
    expect(walk.ready.value).toBe(true);
    expect(fixtures.store.send).not.toHaveBeenCalled();
    await walk.start();
    expect(fixtures.store.send).toHaveBeenCalledExactlyOnceWith("START", {});
  } finally {
    app.unmount();
  }
});
it("keeps an ownership failure visible rather than calling it preparation", async () => {
  fixtures.store.load.mockRejectedValue({
    statusCode: 403,
    data: { detail: "Forbidden" },
  });
  let walk!: ReturnType<typeof useNativeWalk>;
  const app = mount(
    defineComponent({
      setup() {
        walk = useNativeWalk("tour");
        return () => h("div");
      },
    }),
  );
  try {
    await flush();
    expect(walk.preparing.value).toBe(false);
    expect(walk.failed.value).toBe(true);
    expect(fixtures.store.send).not.toHaveBeenCalled();
  } finally {
    app.unmount();
  }
});
