import { beforeEach, expect, it, vi } from "vitest";
import { nextTick, reactive } from "vue";
import BaseMap from "../app/components/base/BaseMap.vue";
import { findAll, mount } from "./helpers/render";
const fixture = vi.hoisted(() => ({
  maps: [] as any[],
  markers: [] as any[],
  geo: {} as any,
}));
vi.mock("../app/stores/geolocationStore", () => ({
  useGeolocationStore: () => fixture.geo,
}));
vi.mock("../app/composables/utils/useLogger", () => ({
  useLogger: () => ({ log() {}, error() {}, warn() {} }),
}));
vi.mock("mapbox-gl", () => ({
  default: {
    Map: class {
      handlers: Record<string, Function> = {};
      flyTo = vi.fn();
      easeTo = vi.fn();
      remove = vi.fn();
      constructor() {
        fixture.maps.push(this);
      }
      on(name: string, handler: Function) {
        this.handlers[name] = handler;
        return this;
      }
      setConfigProperty() {}
      getPitch() {
        return 0;
      }
    },
    Marker: class {
      point: any;
      constructor() {
        fixture.markers.push(this);
      }
      setLngLat(point: any) {
        this.point = point;
        return this;
      }
      addTo() {
        return this;
      }
      remove() {}
      getLngLat() {
        return { lng: this.point[0], lat: this.point[1] };
      }
    },
  },
}));
beforeEach(() => {
  fixture.maps.length = fixture.markers.length = 0;
  fixture.geo = reactive({ coordinates: [19, 47], error: null });
  Object.assign(globalThis, {
    useRuntimeConfig: () => ({ public: { mapboxGlAccessToken: "fixture" } }),
    document: { createElement: () => ({}) },
    useI18n: () => ({ t: (key: string) => key }),
  });
});
it("updates the location marker without taking control of the visitor's map", async () => {
  const app = mount(BaseMap, { showUserLocation: true });
  fixture.geo.coordinates = [19.001, 47.001];
  await nextTick();
  expect(fixture.maps[0].flyTo).not.toHaveBeenCalled();
  expect(fixture.markers.at(-1).point).toEqual([19.001, 47.001]);
  expect(fixture.markers).toHaveLength(1);
  app.unmount();
  expect(fixture.maps[0].remove).toHaveBeenCalledOnce();
});
it("follows only on request and stops following after a user gesture", async () => {
  const app = mount(BaseMap, { showUserLocation: true });
  const button = findAll(app.root, (node) => node.type === "button")[0];
  expect(button).toBeDefined();
  button.props.onClick();
  await nextTick();
  const map = fixture.maps[0];
  expect(map.flyTo).toHaveBeenCalledOnce();
  expect(map.flyTo.mock.calls[0][0]).not.toHaveProperty("bearing");
  map.handlers.movestart({ originalEvent: {} });
  fixture.geo.coordinates = [19.002, 47.002];
  await nextTick();
  expect(map.flyTo).toHaveBeenCalledOnce();
  expect(button.props["aria-pressed"]).toBe(false);
  app.unmount();
});
