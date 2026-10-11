import { beforeEach, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import type { User } from "firebase/auth";
import type * as VueRouter from "vue-router";
import TourDetail from "../app/pages/tours/[tourId].vue";
import PGButton from "../app/components/ui/PGButton.vue";
import { useTourStore } from "../app/stores/tourStore";
import { useUserStore } from "../app/stores/userStore";
import { findAll, mount, type TestNode } from "./helpers/render";
import en from "../i18n/locales/en.json";

const fixture = vi.hoisted(() => ({
  route: { params: { tourId: "source" }, fullPath: "/tours/source" },
  api: vi.fn(),
  navigate: vi.fn(),
  narration: vi.fn(),
  media: vi.fn(),
}));
vi.mock("#imports", () => ({
  // Deferred lookup avoids the hoisted mock factory's import initialization.
  useTourStore: () => useTourStore(),
}));
vi.mock("vue-router", async (original) => ({
  ...(await original<typeof VueRouter>()),
  useRoute: () => fixture.route,
}));
vi.mock("mapbox-gl", () => ({ default: { accessToken: "" } }));
vi.mock("../app/components/base/BaseMap.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("../app/components/tour/CurrentStopExperience.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("../app/components/tour/TourTextDisplay.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("../app/composables/tour/useTourProgress", () => ({
  useTourProgress: () => ref(null),
}));
vi.mock("../app/composables/tour/useTourTextSync", () => ({
  useTourTextSync: () => ({ currentSpokenSentence: ref("") }),
}));
vi.mock("../app/composables/utils/useLogger", () => ({
  useLogger: () => ({ log: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("../app/composables/tour/useTourAudioPlayer", () => ({
  useTourAudioPlayer: () => ({
    audioElement: ref(null),
    playAudio: fixture.media,
    pauseAudio: fixture.media,
    stopAudio: vi.fn(),
    cleanup: vi.fn(),
    getCurrentPosition: () => 0,
  }),
}));
vi.mock("../app/composables/tour/useTourActions", () => ({
  useTourActions: () => ({
    STATE: {
      INITIAL: "INITIAL",
      RECORD_FINISHED: "RECORD_FINISHED",
      TOUR_FINISHED: "TOUR_FINISHED",
    },
    isBusy: ref(false),
    playChunk: fixture.narration,
    getRecord: fixture.narration,
    handleTourButtonClick: fixture.narration,
    pauseTour: fixture.narration,
    handleCompleteTour: fixture.narration,
    addQuestion: fixture.narration,
    dispose: vi.fn(),
  }),
}));
vi.mock("../app/composables/tour/useStoryContinuation", () => ({
  useStoryContinuation: () => ({
    suspend: vi.fn(),
    complete: fixture.narration,
    afterCompletion: fixture.narration,
  }),
}));
vi.mock("../app/composables/tour/useTourCoordinates", () => ({
  useTourCoordinates: () => ({}),
}));
vi.mock("../app/composables/map/useMapboxDirections", () => ({
  useMapboxDirections: () => ({
    initializeDirections: vi.fn(),
    addRouteToMap: vi.fn(),
    cleanup: vi.fn(),
    routeCoordinates: ref([]),
  }),
}));
vi.mock("../app/composables/map/useSimulationMarker", () => ({
  useSimulationMarker: () => ({
    setDragEndCallback: vi.fn(),
    setMoveStartCallback: vi.fn(),
    setMapGestureCallback: vi.fn(),
    getMarkerPosition: vi.fn(),
    addSimulationMarker: vi.fn(),
    cleanup: vi.fn(),
  }),
}));
vi.mock("../app/composables/map/useRouteWalk", () => ({
  useRouteWalk: () => ({
    moving: ref(false),
    canMove: ref(false),
    atEnd: ref(false),
    cancel: vi.fn(),
    reset: vi.fn(),
  }),
}));

const t = (key: string, params: Record<string, unknown> = {}) => {
  let value: unknown = en;
  for (const part of key.split(".")) {
    value =
      value && typeof value === "object" && part in value
        ? Reflect.get(value, part)
        : undefined;
  }
  return String(value ?? key).replace(/\{(\w+)\}/g, (_, name) =>
    String(params[name] ?? ""),
  );
};
const text = (root: TestNode): string =>
  [root.text, ...root.children.map(text)].join(" ");
const button = (root: TestNode, label: string) =>
  findAll(
    root,
    (node) => node.type === "button" && text(node).includes(label),
  )[0]!;
const metadata = {
  source_tour_id: "source",
  source_generation_id: "generation-1",
  unverified: true as const,
  available_stop_ids: ["clock"],
  missing_stop_ids: ["park"],
  captured_at: "2026-10-11T12:00:00Z",
};
const source = (
  status = "GENERATING",
  researchStatus = "FAILED",
  preview = false,
) => ({
  id: preview ? "draft" : "source",
  status,
  name: "Fixture walk",
  description: "",
  image: "",
  user_id: "backend-owner",
  guide: null,
  latest_generation_id: "generation-1",
  history: [],
  route: {
    points: [
      { id: "clock", name: "Clock", lat: "47", lng: "19" },
      { id: "park", name: "Park", lat: "47.001", lng: "19.001" },
    ],
  },
  research_preview: preview ? metadata : null,
  preparation_progress: preview
    ? null
    : {
        generation_id: "generation-1",
        status: researchStatus,
        phase: "RESEARCH",
        active_researchers: 0,
        completed_stops: 0,
        total_stops: 2,
        turns_started: 0,
        turns_completed: 0,
        tool_calls_completed: 0,
        sources_count: 0,
        source_bytes: 0,
        claims_count: 0,
        word_count: 0,
        archive_bytes: 0,
        error: null,
        updated_at: null,
        stops: [],
      },
});
async function flush() {
  for (let i = 0; i < 16; i++) await Promise.resolve();
  await nextTick();
}
function render() {
  return mount(
    TourDetail,
    {},
    {
      PGButton,
      PGSwitch: { template: "<div />" },
      NuxtLink: { template: "<a><slot /></a>" },
      ClientOnly: { template: "<slot />" },
    },
    t,
  );
}
beforeEach(() => {
  fixture.route.params.tourId = "source";
  fixture.route.fullPath = "/tours/source";
  fixture.api.mockReset();
  fixture.navigate.mockReset();
  fixture.narration.mockReset();
  fixture.media.mockReset();
  Object.assign(globalThis, {
    definePageMeta: () => {},
    useTourStore,
    navigateTo: fixture.navigate,
    useNuxtApp: () => ({ $apiFetch: fixture.api }),
    useI18n: () => ({ t }),
    useRuntimeConfig: () => ({
      public: {
        textExperienceEnabled: false,
        storyBufferEnabled: false,
        mapboxGlAccessToken: "",
      },
    }),
    window: {
      localStorage,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
  useUserStore().user = { uid: "fixture-owner" } as User;
});

it.each([
  ["GENERATING", "RUNNING"],
  ["GENERATING", "FAILED"],
  ["GENERATING", "CANCELLED"],
  ["GENERATED", "READY"],
  ["STARTED", "RUNNING"],
  ["FINISHED", "READY"],
])(
  "opens a separate draft from the actual %s/%s detail surface without requesting a turn",
  async (status, researchStatus) => {
    fixture.api.mockImplementation(async (path: string) => {
      if (path === "/api/get-tour/source")
        return source(status, researchStatus);
      if (path === "/api/research-preview/source")
        return source("GENERATED", "READY", true);
      throw new Error(`Unexpected fixture request: ${path}`);
    });
    const app = render();
    await flush();
    const stopping = researchStatus === "RUNNING";
    const trigger = button(
      app.root,
      stopping ? en.researchPreview.stopAndTry : en.researchPreview.trySaved,
    );
    expect(trigger.props.disabled).toBe(false);
    trigger.props.onClick();
    await flush();
    expect(fixture.api).toHaveBeenCalledTimes(1);
    expect(text(app.root)).toContain(en.researchPreview.noAutomaticPlayback);
    button(app.root, en.researchPreview.confirm).props.onClick();
    await flush();
    expect(fixture.navigate).toHaveBeenCalledWith("/tours/draft");
    expect(fixture.api.mock.calls.map(([path]) => path)).toEqual([
      "/api/get-tour/source",
      "/api/research-preview/source",
    ]);
    expect(fixture.narration).not.toHaveBeenCalled();
    expect(fixture.media).not.toHaveBeenCalled();
    app.unmount();
  },
);

it("retains preview warnings after a fresh detail load and never offers a recursive draft", async () => {
  fixture.route.params.tourId = "draft";
  fixture.route.fullPath = "/tours/draft";
  fixture.api.mockResolvedValue(source("GENERATED", "READY", true));
  const app = render();
  await flush();
  expect(text(app.root)).toContain(en.researchPreview.warning);
  expect(text(app.root)).toContain(en.researchPreview.originalPreserved);
  expect(text(app.root)).toContain("Park");
  expect(button(app.root, en.buttons.startTour).props.disabled).toBe(false);
  expect(text(app.root)).not.toContain(en.researchPreview.trySaved);
  expect(text(app.root)).not.toContain(en.researchPreview.stopAndTry);
  expect(fixture.api.mock.calls.map(([path]) => path)).toEqual([
    "/api/get-tour/draft",
  ]);
  expect(fixture.narration).not.toHaveBeenCalled();
  expect(fixture.media).not.toHaveBeenCalled();
  app.unmount();
});
