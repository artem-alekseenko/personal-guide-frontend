import { beforeEach, expect, it, vi } from "vitest";
import { nextTick, reactive } from "vue";
import { mount } from "./helpers/render";
const fixtures = vi.hoisted(() => ({
  store: null as any,
  tour: null as any,
  native: vi.fn(),
  legacy: vi.fn(),
}));
vi.mock("../app/stores/tourStore", () => ({
  useTourStore: () => fixtures.store,
}));
vi.mock("../app/stores/userStore", () => ({
  useUserStore: () => ({ user: { uid: "owner" } }),
}));
vi.mock("vue-router", () => ({
  useRoute: () => ({ params: { tourId: "tour" }, fullPath: "/tours/tour" }),
}));
vi.mock("../app/composables/api/tours/useGetTour", () => ({
  useGetTour: async () => fixtures.tour,
}));
vi.mock("../app/components/tour/NativeTourWalk.vue", () => ({
  default: {
    setup() {
      fixtures.native();
    },
    template: '<div class="native-walk" />',
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
beforeEach(() => {
  Object.assign(globalThis, { definePageMeta: () => {} });
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
