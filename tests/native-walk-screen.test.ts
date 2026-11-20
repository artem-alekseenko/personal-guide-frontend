import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, reactive } from "vue";
import type { User } from "firebase/auth";
import { useUserStore } from "../app/stores/userStore";
import { useNativeWalkStore } from "../app/stores/nativeWalkStore";
import NativeTourWalk from "../app/components/tour/NativeTourWalk.vue";
import { findAll, mount, type TestNode } from "./helpers/render";

// This renderer has no DOM inputs. Exercise the real view/store lifecycle;
// form directive behavior is covered separately in the browser smoke.
vi.mock("vue", async (original) => ({
  ...(await original<typeof import("vue")>()),
  vModelText: {},
  vModelCheckbox: {},
  vModelSelect: {},
  vModelRadio: {},
}));
vi.mock("../app/stores/geolocationStore", () => ({
  useGeolocationStore: () =>
    reactive({
      coordinates: null,
      recordedAt: null,
      accuracy: null,
      error: null,
      refresh: vi.fn(async () => {}),
    }),
}));
vi.mock("../app/composables/ui/useNotification", () => ({
  useNotification: () => ({ showApiError: vi.fn() }),
}));
vi.mock("../app/composables/ui/useToastNotifications", () => ({
  useToastNotifications: () => ({ showInfo: vi.fn() }),
}));
vi.mock("../app/components/tour/NativeWalkMap.vue", () => ({
  default: defineComponent({ setup: () => () => h("div", "Map") }),
}));
vi.mock("../app/components/tour/NativeWalkPreparation.vue", () => ({
  default: defineComponent({ setup: () => () => h("div", "Prepared") }),
}));
const text = (root: TestNode) =>
  findAll(root, () => true)
    .map((n) => n.text)
    .join(" ");
const view = {
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
const tour = {
  id: "tour",
  user_id: "backend-owner",
  name: "Saved walk",
  status: "GENERATED",
  latest_generation_id: "generation",
  playback_generation_id: "generation",
  route: {
    walking_plan: {
      id: "route",
      revision: "revision",
      intent: { language: "en" },
      duration_seconds: 600,
      distance_meters: 800,
      instructions: [],
    },
  },
};
async function flush() {
  for (let i = 0; i < 16; i++) await Promise.resolve();
  await nextTick();
}
beforeEach(() => {
  useUserStore().user = { uid: "firebase-owner" } as User;
  vi.stubGlobal("useI18n", () => ({ t: (key: string) => key }));
  vi.stubGlobal("navigator", {
    locks: {
      request: vi.fn((_name, _options, callback) => callback({ name: "lock" })),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

it("opens a published walk without starting it and shows only walking controls", async () => {
  const response = Promise.withResolvers<typeof view>();
  const api = vi.fn((path: string, options?: { body?: { action: string } }) =>
    path.endsWith("/knowledge")
      ? Promise.resolve({
          generation_id: "generation",
          route_revision: "revision",
          language: "en",
          subjects: [
            { id: "bridge", name: "Old Bridge", kind: "building" },
            { id: "tower", name: "North Tower", kind: "building" },
          ],
          coverage: [
            { subject_id: "bridge", status: "accepted", claim_ids: ["claim"] },
            { subject_id: "tower", status: "unavailable", claim_ids: [] },
          ],
        })
      : options?.body?.action === "START"
        ? Promise.resolve({ ...view, revision: 1, started: true })
        : response.promise,
  );
  vi.stubGlobal("useNuxtApp", () => ({ $apiFetch: api }));
  const app = mount(
    NativeTourWalk,
    {
      tour: {
        ...tour,
        description: "A walk along the river.",
        image: "/tour-cover.png",
      },
      walking: false,
      onOpen: () => {
        app.props.walking = true;
      },
    },
    {
      PGButton: defineComponent({
        props: ["disabled"],
        setup:
          (props, { slots }) =>
          () =>
            h("button", { disabled: props.disabled }, slots.default?.()),
      }),
      NuxtLink: defineComponent({
        setup:
          (_props, { slots }) =>
          () =>
            h("a", slots.default?.()),
      }),
    },
  );
  try {
    expect(text(app.root)).toContain("common.loading");
    expect(text(app.root)).toContain("A walk along the river.");
    expect(text(app.root)).toContain("nativeWalk.estimate");
    expect(findAll(app.root, (n) => n.type === "img")[0]?.props.src).toBe(
      "/tour-cover.png",
    );
    expect(text(app.root)).not.toContain("Map");
    expect(text(app.root)).not.toContain("nativeWalk.start");
    app.props.walking = true;
    await nextTick();
    expect(text(app.root)).not.toContain("Map");
    app.props.walking = false;
    const loadedTour = app.props.tour;
    app.props.tour = { ...loadedTour, playback_generation_id: "previous" };
    response.resolve(view);
    await flush();
    expect(useNativeWalkStore().view?.generation_id).toBe("generation");
    expect(
      findAll(
        app.root,
        (node) =>
          node.type === "button" &&
          text(node).includes("tourGeneration.statuses.READY"),
      ),
    ).toHaveLength(0);
    app.props.tour = loadedTour;
    await flush();
    expect(text(app.root)).not.toContain("common.loading");
    expect(text(app.root)).toContain("Old Bridge");
    expect(text(app.root)).not.toContain("North Tower");
    const ready = findAll(
      app.root,
      (n) =>
        n.type === "button" &&
        text(n).includes("tourGeneration.statuses.READY"),
    )[0];
    expect(ready?.props.disabled).toBe(false);
    ready!.props.onClick();
    await flush();
    expect(app.props.walking).toBe(true);
    expect(text(app.root)).toContain("Map");
    expect(text(app.root)).not.toContain("Prepared");
    expect(text(app.root)).not.toContain("nativeWalk.finish");
    expect(findAll(app.root, (n) => n.type === "textarea")).toHaveLength(1);
    expect(api.mock.calls.every((call) => call.length === 1)).toBe(true);
    const start = findAll(
      app.root,
      (n) => n.type === "button" && text(n).includes("nativeWalk.start"),
    )[0];
    expect(start).toBeDefined();
    expect(start!.props.disabled).toBe(false);
    expect(api.mock.calls.every((call) => call.length === 1)).toBe(true);
    expect(text(app.root)).not.toContain("nativeWalk.automatic");
    expect(text(app.root)).not.toContain("nativeWalk.finish");
    start!.props.onClick();
    await flush();
    expect(app.props.walking).toBe(true);
    expect(text(app.root)).toContain("Map");
    expect(text(app.root)).not.toContain("A walk along the river.");
    expect(text(app.root)).toContain("nativeWalk.nextStep");
    expect(text(app.root)).toContain("nativeWalk.finish");
    expect(text(app.root)).not.toContain("nativeWalk.automatic");
    expect(text(app.root)).not.toContain("navigation.backToTours");
    expect(findAll(app.root, (n) => n.type === "details")).toHaveLength(0);
    expect(text(app.root)).not.toContain("nativeWalk.start");
    useUserStore().user = { uid: "another-account" } as User;
    await flush();
    expect(text(app.root)).not.toContain("nativeWalk.start");
    expect(useNativeWalkStore().view).toBeNull();
  } finally {
    app.unmount();
  }
});
