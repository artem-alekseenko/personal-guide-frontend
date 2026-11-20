import { beforeEach, expect, it, vi } from "vitest";
import { h, nextTick, reactive } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { findAll, mount } from "./helpers/render";
const fixtures = vi.hoisted(() => ({
  store: null as any,
  tour: null as any,
  route: null as any,
  native: vi.fn(),
  legacy: vi.fn(),
}));
vi.mock("../app/stores/tourStore", () => ({
  useTourStore: () => fixtures.store,
}));
vi.mock("../app/stores/userStore", () => ({
  useUserStore: () => ({ user: { uid: "owner" } }),
}));
vi.mock("vue-router", async (original) => ({
  ...(await original<typeof import("vue-router")>()),
  useRoute: () => fixtures.route,
}));
vi.mock("../app/composables/api/tours/useGetTour", () => ({
  useGetTour: async () => fixtures.tour,
}));
vi.mock("../app/components/tour/NativeTourWalk.vue", () => ({
  default: {
    props: ["walking"],
    emits: ["open"],
    setup(
      props: { walking: boolean },
      { emit }: { emit: (event: "open") => void },
    ) {
      fixtures.native();
      return () =>
        h(
          "button",
          { onClick: () => emit("open") },
          props.walking ? "Walking" : "Start",
        );
    },
  },
}));
vi.mock("../app/components/tour/LegacyTourWalk.vue", () => ({
  default: {
    setup() {
      fixtures.legacy();
    },
    template: '<div class="legacy-walk" />',
  },
}));
import TourDetail from "../app/pages/tours/[tourId].vue";
beforeEach(async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/tours/:tourId",
        alias: "/tours/:tourId/walk",
        component: TourDetail,
      },
    ],
  });
  await router.push("/tours/tour");
  fixtures.route = reactive({
    params: { tourId: "tour" },
    get path() {
      return router.currentRoute.value.path;
    },
  });
  Object.assign(globalThis, {
    definePageMeta: () => {},
    navigateTo: router.replace,
  });
  fixtures.store = reactive({
    tour: null,
    setTour(tour: unknown) {
      fixtures.store.tour = tour;
    },
  });
});
it.each([true, false])(
  "mounts one native=%s delivery path, with no second scheduler",
  async (native) => {
    fixtures.tour = {
      id: "tour",
      route: native ? { walking_plan: { id: "plan" } } : {},
    };
    const app = mount(TourDetail, {}, {}, (key) => key);
    await Promise.resolve();
    await nextTick();
    await nextTick();
    expect(fixtures.native).toHaveBeenCalledTimes(native ? 1 : 0);
    expect(fixtures.legacy).toHaveBeenCalledTimes(native ? 0 : 1);
    app.unmount();
  },
);

it("opens the walking URL without remounting the native controller", async () => {
  fixtures.tour = { id: "tour", route: { walking_plan: { id: "plan" } } };
  const app = mount(TourDetail);
  try {
    await Promise.resolve();
    await nextTick();
    await nextTick();
    const button = () =>
      findAll(app.root, (node) => node.type === "button")[0]!;
    expect(button().text).toBe("Start");
    button().props.onClick();
    await vi.waitFor(() =>
      expect(fixtures.route.path).toBe("/tours/tour/walk"),
    );
    expect(button().text).toBe("Walking");
    expect(fixtures.native).toHaveBeenCalledTimes(1);
  } finally {
    app.unmount();
  }
});

it("adopts the saved tour name and cover as soon as they are published", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("document", {
    visibilityState: "visible",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  const route = { walking_plan: { id: "plan" } };
  fixtures.tour = {
    id: "tour",
    name: "15-minute walk",
    status: "GENERATED",
    playback_generation_id: "generation",
    route,
  };
  const app = mount(TourDetail);
  try {
    await vi.advanceTimersByTimeAsync(0);
    expect(fixtures.store.tour.name).toBe("15-minute walk");
    fixtures.tour = {
      ...fixtures.tour,
      name: "The Riverside Walk",
      description: "Follow the river",
      image: "/riverside.jpg",
    };
    await vi.advanceTimersByTimeAsync(2000);
    expect(fixtures.store.tour.name).toBe("The Riverside Walk");
    expect(fixtures.store.tour.image).toBe("/riverside.jpg");
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    app.unmount();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  }
});
