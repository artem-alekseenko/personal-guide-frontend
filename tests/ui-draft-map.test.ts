import { expect, it, vi } from "vitest";
import * as Vue from "vue";
import { useRouteStore } from "../app/stores/routeStore";
import { mount } from "./helpers/render";
import PGMap from "../app/components/PGMap.vue";
const fixture = vi.hoisted(() => ({
  addMarker: vi.fn(),
  marker: {
    setDraggable: vi.fn(),
    on: vi.fn(),
    getLngLat: () => ({ lng: 19.002, lat: 47.002 }),
  },
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
    props: ["onMapClick", "showUserLocation"],
    setup(props: any, { emit }: any) {
      Vue.onMounted(() => emit("map-initialized", fixture.map));
      return () =>
        Vue.h("div", {
          onClick: props.onMapClick,
          "data-show-location": props.showUserLocation,
        });
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
  fixture.addMarker.mockReturnValue(fixture.marker);
  store.setStartPoint({ lat: "47", lng: "19" });
  const app = mount(PGMap);
  await Vue.nextTick();
  expect(fixture.addMarker).toHaveBeenCalledWith(47, 19);
  expect(fixture.marker.setDraggable).toHaveBeenCalledWith(true);
  expect(fixture.map.flyTo).toHaveBeenCalledWith({
    center: [19, 47],
    duration: 0,
  });
  app.unmount();
});

it("selects the route start on map click and marker drag without GPS", async () => {
  const store = useRouteStore();
  localStorage.setItem("tour-position-mode", "manual");
  fixture.addMarker.mockReturnValue(fixture.marker);
  const app = mount(PGMap, {
    selectedArea: null,
    "onUpdate:selectedArea": (point: { lat: string; lng: string }) =>
      store.setStartPoint(point),
  });
  await Vue.nextTick();
  const map = app.root.children[0]!;
  expect(map.props["data-show-location"]).toBe(false);
  map.props.onClick({ lngLat: { lng: 19.001, lat: 47.001 } });
  await Vue.nextTick();
  expect(store.startPoint).toEqual({ lng: "19.001", lat: "47.001" });
  expect(fixture.addMarker).toHaveBeenCalledWith(47.001, 19.001);
  const onDragEnd = fixture.marker.on.mock.calls.find(
    ([event]) => event === "dragend",
  )?.[1];
  expect(onDragEnd).toBeTypeOf("function");
  onDragEnd();
  await Vue.nextTick();
  expect(store.startPoint).toEqual({ lng: "19.002", lat: "47.002" });
  app.unmount();
});
