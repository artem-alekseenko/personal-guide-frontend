import { beforeEach, expect, it, vi } from "vitest";
import { nextTick, reactive, shallowRef } from "vue";
import BaseMap from "../app/components/base/BaseMap.vue";
import { findAll, mount } from "./helpers/render";
import type { Mock } from "vitest";
import type * as VueUseCore from "@vueuse/core";

type Point = [number, number];
interface Camera {
  center: Point;
  zoom: number;
  bearing: number;
  pitch: number;
  duration?: number;
}
interface MapFixture {
  camera: Camera;
  handlers: Record<string, (event?: { originalEvent?: unknown }) => void>;
  config: Record<string, unknown>;
  flyTo: Mock<(options: Partial<Camera>) => Camera>;
  easeTo: Mock<(options: Partial<Camera>) => Camera>;
  fitBounds: Mock;
  remove: Mock<() => void>;
}
const fixture = vi.hoisted(() => ({
  maps: [] as MapFixture[],
  markers: [] as { point: Point }[],
  geo: { coordinates: null, error: null } as {
    coordinates: Point | null;
    error: { code: number } | null;
  },
  mode: { value: "light" },
  motion: { value: "no-preference" as "no-preference" | "reduce" },
}));
vi.mock("../app/stores/geolocationStore", () => ({
  useGeolocationStore: () => fixture.geo,
}));
vi.mock("../app/composables/utils/useLogger", () => ({
  useLogger: () => ({ log() {}, error() {}, warn() {} }),
}));
vi.mock("@vueuse/core", async (importOriginal) => ({
  ...(await importOriginal<typeof VueUseCore>()),
  usePreferredReducedMotion: () => fixture.motion,
}));
vi.mock("mapbox-gl", () => ({
  default: {
    Map: class {
      handlers: MapFixture["handlers"] = {};
      camera: Camera;
      config: Record<string, unknown>;
      container = { dataset: { pgMapTheme: "light" } };
      flyTo = vi.fn((options: Partial<Camera>) =>
        Object.assign(this.camera, options),
      );
      easeTo = vi.fn((options: Partial<Camera>) =>
        Object.assign(this.camera, options),
      );
      fitBounds = vi.fn();
      stop = vi.fn();
      remove = vi.fn();
      constructor(
        options: Camera & { config: { basemap: Record<string, unknown> } },
      ) {
        this.camera = {
          center: options.center,
          zoom: options.zoom,
          bearing: options.bearing,
          pitch: options.pitch,
        };
        this.config = { ...options.config.basemap };
        fixture.maps.push(this);
      }
      on(name: string, handler: MapFixture["handlers"][string]) {
        this.handlers[name] = handler;
        return this;
      }
      isStyleLoaded() {
        return true;
      }
      getContainer() {
        return this.container;
      }
      getConfigProperty(_: string, key: string) {
        return this.config[key];
      }
      setConfigProperty(_: string, key: string, value: unknown) {
        this.config[key] = value;
      }
      fire(name: string) {
        this.handlers[name]?.();
      }
      getPitch() {
        return this.camera.pitch;
      }
    },
    Marker: class {
      point: Point = [0, 0];
      constructor() {
        fixture.markers.push(this);
      }
      setLngLat(point: Point) {
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
  fixture.mode = reactive({ value: "light" });
  fixture.motion = shallowRef("no-preference");
  Object.assign(globalThis, {
    useRuntimeConfig: () => ({ public: { mapboxGlAccessToken: "fixture" } }),
    document: { createElement: () => ({}) },
    useI18n: () => ({ t: (key: string) => key }),
    useColorMode: () => fixture.mode,
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
  fixture.maps[0].handlers["style.load"]();
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

it("changes theme and explicit 3D mode without replacing the map or losing its camera and GPS marker", async () => {
  const app = mount(BaseMap, {
    showUserLocation: true,
    initialZoom: 15,
    initialBearing: 23,
  });
  const map = fixture.maps[0];
  map.handlers["style.load"]();
  await nextTick();
  const marker = fixture.markers[0];
  expect(map.camera.pitch).toBe(0);
  const explore = findAll(app.root, (node) => node.type === "button").at(-1)!;
  explore.props.onClick();
  await nextTick();
  expect(map.camera).toMatchObject({
    center: [19, 47],
    zoom: 15,
    bearing: 23,
    pitch: 40,
  });
  expect(map.config.show3dObjects).toBe(true);
  fixture.mode.value = "dark";
  await nextTick();
  expect(fixture.maps).toEqual([map]);
  expect(fixture.markers).toEqual([marker]);
  expect(map.camera).toMatchObject({
    center: [19, 47],
    zoom: 15,
    bearing: 23,
    pitch: 40,
  });
  expect(map.flyTo).not.toHaveBeenCalled();
  expect(map.fitBounds).not.toHaveBeenCalled();
  expect(map.easeTo).toHaveBeenCalledOnce();
  expect(map.config.lightPreset).toBe("night");
  explore.props.onClick();
  await nextTick();
  expect(map.camera.pitch).toBe(0);
  expect(map.config.show3dObjects).toBe(false);
  app.unmount();
  expect(map.remove).toHaveBeenCalledOnce();
});

it("an explicit whole-route view stops following GPS and disappears when the route is cleared", async () => {
  const points: [number, number][] = [
    [19, 47],
    [19.01, 47.006],
    [19.018, 47.007],
  ];
  const app = mount(BaseMap, {
    showUserLocation: true,
    routeCoordinates: points,
  });
  const map = fixture.maps[0];
  map.handlers["style.load"]();
  await nextTick();
  let buttons = findAll(app.root, (node) => node.type === "button");
  buttons[0]!.props.onClick();
  const wholeRouteHandler = buttons[1]!.props.onClick;
  buttons[1]!.props.onClick();
  await nextTick();
  expect(map.fitBounds).toHaveBeenCalledOnce();
  expect(buttons[0]!.props["aria-pressed"]).toBe(false);
  fixture.geo.coordinates = [19.03, 47.01];
  await nextTick();
  expect(map.flyTo).toHaveBeenCalledOnce();
  expect(fixture.markers[0].point).toEqual([19.03, 47.01]);
  app.props.routeCoordinates = [];
  await nextTick();
  buttons = findAll(app.root, (node) => node.type === "button");
  expect(buttons.some((node) => node.props.onClick === wholeRouteHandler)).toBe(
    false,
  );
  app.unmount();
});

it("keeps route and 3D controls available without GPS and avoids motion when requested", async () => {
  fixture.geo.coordinates = null;
  fixture.geo.error = { code: 1 };
  fixture.motion.value = "reduce";
  const app = mount(BaseMap, {
    showUserLocation: true,
    routeCoordinates: [
      [19, 47],
      [19.01, 47.006],
    ],
  });
  const map = fixture.maps[0];
  map.handlers["style.load"]();
  await nextTick();
  const buttons = findAll(app.root, (node) => node.type === "button");
  expect(buttons[0]!.props.disabled).toBe(true);
  expect(buttons[1]!.props.disabled).toBe(false);
  expect(buttons[2]!.props.disabled).toBe(false);
  buttons[1]!.props.onClick();
  buttons[2]!.props.onClick();
  await nextTick();
  expect(map.fitBounds.mock.calls[0][1].duration).toBe(0);
  expect(map.easeTo.mock.calls[0][0].duration).toBe(0);
  expect(fixture.markers).toEqual([]);
  app.unmount();
});
