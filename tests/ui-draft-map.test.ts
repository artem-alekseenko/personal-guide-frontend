import { expect, it, vi } from "vitest";
import * as Vue from "vue";
import { useRouteStore } from "../app/stores/routeStore";
import { mount } from "./helpers/render";
import PGMap from "../app/components/PGMap.vue";
const fixture = vi.hoisted(() => ({
  addMarker: vi.fn(),
  map: {
    once: (_: string, callback: () => void) => callback(),
    flyTo: vi.fn(),
    getContainer: () => ({}),
  },
}));
vi.mock("#imports", async () => await import("vue"));
vi.mock("../app/components/base/BaseMap.vue", () => ({
  default: {
    emits: ["map-initialized"],
    setup(_: any, { emit }: any) {
      Vue.onMounted(() => emit("map-initialized", fixture.map));
      return () => Vue.h("div");
    },
  },
}));
vi.mock("../app/composables/map/useMapboxDirections", () => ({
  useMapboxDirections: () => ({
    initializeDirections: vi.fn(),
    clearDirections: vi.fn(),
    cleanup: vi.fn(),
    setRoute: vi.fn(),
  }),
}));
vi.mock("../app/composables/map/useMarkers", () => ({
  useMarkers: () => ({
    addMarker: fixture.addMarker,
    clearAllMarkers: vi.fn(),
    addHighPlacesToMap: vi.fn(),
    addWaypointMarkers: vi.fn(),
  }),
}));
it("restores the saved start marker and center before any route is suggested", async () => {
  const store = useRouteStore();
  store.setStartPoint({ lat: "47", lng: "19" });
  const app = mount(PGMap);
  await Vue.nextTick();
  expect(fixture.addMarker).toHaveBeenCalledWith(47, 19);
  expect(fixture.map.flyTo).toHaveBeenCalledWith({
    center: [19, 47],
    duration: 0,
  });
  app.unmount();
});
