import { afterEach, expect, it, vi } from "vitest";
import { effectScope, ref, shallowRef } from "vue";
import providerDefaultStyles from "@mapbox/mapbox-gl-directions/src/directions_style.js";
import type {
  Map as MapboxMap,
  LayerSpecification,
  FitBoundsOptions,
} from "mapbox-gl";
import type { Feature, LineString, MultiLineString } from "geojson";
import type { ICreatedTour } from "../app/types";
import { useMapboxDirections } from "../app/composables/map/useMapboxDirections";
import { MAP_APPEARANCES } from "../app/utils/mapAppearance";
import { decodeRouteGeometry } from "../shared/utils/routeMovement";
import type { MapPoint } from "../shared/utils/routeMovement";

type Geometry = string | { coordinates: MapPoint[] };
interface DirectionsFixture {
  emit: (event: string, payload?: { route: { geometry: Geometry }[] }) => void;
  attach: (map: { addLayer: (layer: LayerSpecification) => void }) => void;
  detach: (map: { removeLayer: (id: string) => void }) => void;
  setOrigin: (point: MapPoint) => void;
  setDestination: (point: MapPoint) => void;
  addWaypoint: (index: number, point: MapPoint) => void;
}

vi.mock("@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions", () => {
  return {
    default: class {
      handlers = new Map<string, ((payload: unknown) => void)[]>();
      constructor(public options: { styles: LayerSpecification[] }) {}
      on(event: string, callback: (payload: unknown) => void) {
        this.handlers.set(event, [
          ...(this.handlers.get(event) ?? []),
          callback,
        ]);
      }
      emit(event: string, payload: unknown) {
        this.handlers.get(event)?.forEach((callback) => callback(payload));
      }
      attach(map: { addLayer: (layer: LayerSpecification) => void }) {
        // Emulate the installed plugin's supported override-by-ID behavior.
        for (const layer of providerDefaultStyles) {
          map.addLayer(
            this.options.styles.find((style) => style.id === layer.id) ?? layer,
          );
        }
      }
      detach(map: { removeLayer: (id: string) => void }) {
        for (const layer of providerDefaultStyles) map.removeLayer(layer.id);
      }
      removeRoutes = vi.fn(() => this.emit("clear", undefined));
      setOrigin = vi.fn();
      addWaypoint = vi.fn();
      setDestination = vi.fn();
    },
  };
});

afterEach(() => vi.unstubAllGlobals());

function mapFixture() {
  const layers = new Map<string, LayerSpecification>();
  const sources = new Map<
    string,
    {
      data: Feature<LineString | MultiLineString>;
      setData: (data: Feature<LineString | MultiLineString>) => void;
    }
  >();
  const handlers = new Map<string, Set<() => void>>();
  const container = { dataset: { pgMapTheme: "light" } };
  const camera = { center: [3, 4], zoom: 13, pitch: 32, bearing: 17 };
  const map = {
    layers,
    sources,
    handlers,
    container,
    camera,
    styleLoaded: true,
    getContainer: () => container,
    isStyleLoaded: () => map.styleLoaded,
    on(event: string, callback: () => void) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(callback);
    },
    off(event: string, callback: () => void) {
      handlers.get(event)?.delete(callback);
    },
    fire(event: string) {
      handlers.get(event)?.forEach((callback) => callback());
    },
    getSource: (id: string) => sources.get(id),
    addSource: vi.fn(
      (id: string, source: { data: Feature<LineString | MultiLineString> }) => {
        const stored = {
          data: source.data,
          setData: vi.fn((data: Feature<LineString | MultiLineString>) => {
            stored.data = data;
          }),
        };
        sources.set(id, stored);
      },
    ),
    getLayer: (id: string) => layers.get(id),
    addLayer: vi.fn((layer: LayerSpecification) => layers.set(layer.id, layer)),
    removeLayer: vi.fn((id: string) => layers.delete(id)),
    removeSource: vi.fn((id: string) => sources.delete(id)),
    setPaintProperty: vi.fn(
      (id: string, property: "line-color", value: string) => {
        const layer = layers.get(id)!;
        if (layer.type === "line") layer.paint![property] = value;
      },
    ),
    fitBounds: vi.fn(
      (
        bounds: [[number, number], [number, number]],
        options: FitBoundsOptions,
      ) => {
        camera.center = [
          (bounds[0][0] + bounds[1][0]) / 2,
          (bounds[0][1] + bounds[1][1]) / 2,
        ];
        camera.zoom = options.maxZoom!;
      },
    ),
    addControl: vi.fn((client: DirectionsFixture) => client.attach(map)),
    removeControl: vi.fn((client: DirectionsFixture) => client.detach(map)),
  };
  // This isolated fixture implements only the map surface owned by route rendering.
  const instance = map as unknown as MapboxMap;
  return { ...map, instance };
}

function setup(enableBounds = true) {
  vi.stubGlobal("useRuntimeConfig", () => ({
    public: { mapboxGlAccessToken: "test" },
  }));
  const map = mapFixture();
  const mapRef = shallowRef<MapboxMap | null>(map.instance);
  const scope = effectScope();
  const api = scope.run(() => useMapboxDirections(mapRef, { enableBounds }))!;
  api.initializeDirections();
  // The mocked provider exposes emit/attach only for exercising public route events.
  const provider = api.getDirections() as unknown as DirectionsFixture;
  return { map, mapRef, scope, api, provider };
}

const exactPath: MapPoint[] = Array.from({ length: 47 }, (_, index) => [
  2 + index / 1000,
  48 + Math.sin(index) / 1000,
]);
function tour(geometry?: { lng: string; lat: string }[]) {
  // Routing consumes only route geometry/points from this focused tour fixture.
  return {
    route: {
      geometry,
      points: [
        { lng: "2", lat: "48" },
        { lng: "2.1", lat: "48.1" },
      ],
    },
  } as unknown as ICreatedTour;
}
function visibleLayers(map: { layers: Map<string, LayerSpecification> }) {
  return [...map.layers.values()].filter(
    (layer) => layer.layout?.visibility !== "none",
  );
}

it("changes stored-route paint without changing geometry or a user-adjusted camera", () => {
  const f = setup();
  expect(f.api.setRoute(exactPath)).toBe(true);
  const data = f.map.sources.get("pg-stored-route")!.data;
  f.map.camera.center = [2.04, 48.03];
  f.map.camera.zoom = 17;
  const camera = structuredClone(f.map.camera);
  f.map.fitBounds.mockClear();
  f.map.addSource.mockClear();
  f.map.container.dataset.pgMapTheme = "dark";
  f.map.fire("pg:appearance");
  expect(f.map.sources.get("pg-stored-route")!.data).toBe(data);
  expect(data.geometry.coordinates).toEqual(exactPath);
  expect(f.api.routeCoordinates.value).toEqual(exactPath);
  expect(f.map.camera).toEqual(camera);
  expect(f.map.fitBounds).not.toHaveBeenCalled();
  expect(f.map.addSource).not.toHaveBeenCalled();
  const line = f.map.layers.get("pg-stored-route")!;
  expect(line.type === "line" && line.paint?.["line-color"]).toBe(
    MAP_APPEARANCES.dark.route,
  );
  expect(f.provider.setOrigin).not.toHaveBeenCalled();
  expect(f.provider.setDestination).not.toHaveBeenCalled();
  f.scope.stop();
});

it("restores stored geometry after style reload, waiting for idle without camera jumps", () => {
  const f = setup();
  f.api.setRoute(exactPath);
  f.map.camera.center = [2.04, 48.03];
  f.map.camera.zoom = 17;
  const camera = structuredClone(f.map.camera);
  f.map.fitBounds.mockClear();
  f.map.layers.clear();
  f.map.sources.clear();
  f.map.instance.isStyleLoaded = () => false;
  f.map.fire("style.load");
  expect(f.map.sources.size).toBe(0);
  f.map.container.dataset.pgMapTheme = "dark";
  f.map.instance.isStyleLoaded = () => true;
  f.map.fire("idle");
  expect(
    f.map.sources.get("pg-stored-route")!.data.geometry.coordinates,
  ).toEqual(exactPath);
  expect(visibleLayers(f.map)).toHaveLength(2);
  expect(f.map.camera).toEqual(camera);
  expect(f.map.fitBounds).not.toHaveBeenCalled();
  expect(f.provider.setDestination).not.toHaveBeenCalled();
  f.map.addSource.mockClear();
  f.map.fire("idle");
  expect(f.map.addSource).not.toHaveBeenCalled();
  f.scope.stop();
});

it("uses the same visible overlay for decoded legacy geometry and never requeries on appearance/reload", () => {
  const f = setup();
  f.api.addRouteToMap(tour(), ref(true));
  const encoded = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
  f.provider.emit("route", { route: [{ geometry: encoded }] });
  const decoded = decodeRouteGeometry(encoded);
  expect(f.api.routeCoordinates.value).toEqual(decoded);
  expect(
    f.map.sources.get("pg-stored-route")!.data.geometry.coordinates,
  ).toEqual(decoded);
  expect(visibleLayers(f.map).map((layer) => layer.type)).toEqual([
    "line",
    "line",
  ]);
  const appearance = structuredClone(
    visibleLayers(f.map).map((layer) => ({
      layout: layer.layout,
      paint: "paint" in layer ? layer.paint : undefined,
    })),
  );
  const camera = structuredClone(f.map.camera);
  f.map.fitBounds.mockClear();
  f.map.container.dataset.pgMapTheme = "dark";
  f.map.fire("pg:appearance");
  f.map.layers.clear();
  f.map.sources.clear();
  f.map.fire("style.load");
  expect(
    f.map.sources.get("pg-stored-route")!.data.geometry.coordinates,
  ).toEqual(decoded);
  expect(f.map.camera).toEqual(camera);
  expect(f.map.fitBounds).not.toHaveBeenCalled();
  expect(f.provider.setOrigin).toHaveBeenCalledTimes(1);
  expect(f.provider.setDestination).toHaveBeenCalledTimes(1);
  expect(f.provider.addWaypoint).not.toHaveBeenCalled();
  const stored = setup();
  stored.api.setRoute(decoded);
  expect(
    visibleLayers(stored.map).map((layer) => ({
      layout: layer.layout,
      paint: "paint" in layer ? layer.paint : undefined,
    })),
  ).toEqual(appearance);
  f.scope.stop();
  stored.scope.stop();
});

it("routes serialized legacy empty geometry through Directions", () => {
  const f = setup();
  const legacyTour = JSON.parse(JSON.stringify(tour([]))) as ICreatedTour;
  f.api.addRouteToMap(legacyTour, ref(true));
  expect(f.provider.setOrigin).toHaveBeenCalledWith([2, 48]);
  expect(f.provider.setDestination).toHaveBeenCalledWith([2.1, 48.1]);
  f.provider.emit("route", {
    route: [{ geometry: { coordinates: exactPath } }],
  });
  expect(f.api.routeCoordinates.value).toEqual(exactPath);
  expect(
    f.map.sources.get("pg-stored-route")!.data.geometry.coordinates,
  ).toEqual(exactPath);
  expect(f.map.fitBounds).toHaveBeenCalledTimes(1);
  f.scope.stop();
});

it("uses nonempty stored geometry instead of routing through legacy stops", () => {
  const f = setup();
  const storedTour = JSON.parse(
    JSON.stringify(
      tour(
        exactPath.map(([lng, lat]) => ({ lng: String(lng), lat: String(lat) })),
      ),
    ),
  ) as ICreatedTour;
  f.api.addRouteToMap(storedTour, ref(true));
  expect(f.api.routeCoordinates.value).toEqual(exactPath);
  expect(
    f.map.sources.get("pg-stored-route")!.data.geometry.coordinates,
  ).toEqual(exactPath);
  expect(f.provider.setOrigin).not.toHaveBeenCalled();
  expect(f.provider.setDestination).not.toHaveBeenCalled();
  f.scope.stop();
});

it.each(["stored", "legacy"])(
  "fits a newly supplied %s path once after source loading, not on subsequent restoration",
  (kind) => {
    const f = setup();
    f.map.instance.isStyleLoaded = () => false;
    if (kind === "stored") expect(f.api.setRoute(exactPath)).toBe(true);
    else {
      f.api.addRouteToMap(tour([]), ref(true));
      f.provider.emit("route", {
        route: [{ geometry: { coordinates: exactPath } }],
      });
    }
    expect(f.api.routeCoordinates.value).toEqual(exactPath);
    expect(f.map.sources.size).toBe(0);
    expect(f.map.fitBounds).not.toHaveBeenCalled();
    f.map.fire("style.load");
    f.map.fire("idle");
    expect(f.map.fitBounds).not.toHaveBeenCalled();
    f.map.instance.isStyleLoaded = () => true;
    f.map.fire("idle");
    expect(
      f.map.sources.get("pg-stored-route")!.data.geometry.coordinates,
    ).toEqual(exactPath);
    expect(f.map.fitBounds).toHaveBeenCalledTimes(1);
    f.map.camera.center = [2.04, 48.03];
    f.map.camera.zoom = 17;
    const camera = structuredClone(f.map.camera);
    f.map.fire("idle");
    f.map.container.dataset.pgMapTheme = "dark";
    f.map.fire("pg:appearance");
    f.map.layers.clear();
    f.map.sources.clear();
    f.map.fire("style.load");
    f.map.fire("idle");
    expect(f.map.fitBounds).toHaveBeenCalledTimes(1);
    expect(f.map.camera).toEqual(camera);
    f.scope.stop();
  },
);

it.each(["stored", "legacy"])(
  "does not fit a delayed %s path when automatic bounds are disabled",
  (kind) => {
    const f = setup(false);
    const camera = structuredClone(f.map.camera);
    f.map.instance.isStyleLoaded = () => false;
    if (kind === "stored") f.api.setRoute(exactPath);
    else {
      f.api.addRouteToMap(tour([]), ref(true));
      f.provider.emit("route", {
        route: [{ geometry: { coordinates: exactPath } }],
      });
    }
    f.map.instance.isStyleLoaded = () => true;
    f.map.fire("idle");
    expect(
      f.map.sources.get("pg-stored-route")!.data.geometry.coordinates,
    ).toEqual(exactPath);
    expect(f.map.fitBounds).not.toHaveBeenCalled();
    expect(f.map.camera).toEqual(camera);
    f.scope.stop();
  },
);

it.each(["clear", "invalid", "dispose", "provider clear", "provider error"])(
  "cancels a delayed initial fit after %s",
  (action) => {
    const f = setup();
    const camera = structuredClone(f.map.camera);
    f.map.instance.isStyleLoaded = () => false;
    f.api.addRouteToMap(tour([]), ref(true));
    f.provider.emit("route", {
      route: [{ geometry: { coordinates: exactPath } }],
    });
    if (action === "clear") f.api.clearDirections();
    else if (action === "invalid") expect(f.api.setRoute([])).toBe(false);
    else if (action === "dispose") f.scope.stop();
    else f.provider.emit(action === "provider clear" ? "clear" : "error");
    f.map.instance.isStyleLoaded = () => true;
    f.map.fire("idle");
    f.map.fire("style.load");
    expect(f.api.routeCoordinates.value).toEqual([]);
    expect(f.map.sources.size).toBe(0);
    expect(f.map.fitBounds).not.toHaveBeenCalled();
    expect(f.map.camera).toEqual(camera);
    f.scope.stop();
  },
);

it("cancels the old map's pending fit when restoring its path onto a replacement map", () => {
  const f = setup();
  f.map.instance.isStyleLoaded = () => false;
  f.api.setRoute(exactPath);
  const replacement = mapFixture();
  replacement.instance.isStyleLoaded = () => false;
  const oldCamera = structuredClone(f.map.camera);
  const replacementCamera = structuredClone(replacement.camera);
  f.mapRef.value = replacement.instance;
  f.map.instance.isStyleLoaded = () => true;
  f.map.fire("idle");
  f.map.fire("style.load");
  expect(f.map.sources.size).toBe(0);
  expect(f.map.fitBounds).not.toHaveBeenCalled();
  expect(f.map.camera).toEqual(oldCamera);
  replacement.instance.isStyleLoaded = () => true;
  replacement.fire("idle");
  expect(
    replacement.sources.get("pg-stored-route")!.data.geometry.coordinates,
  ).toEqual(exactPath);
  expect(replacement.fitBounds).not.toHaveBeenCalled();
  expect(replacement.camera).toEqual(replacementCamera);
  f.scope.stop();
});

it.each(["stored", "legacy"])(
  "respects disabled automatic bounds for %s geometry",
  (kind) => {
    const f = setup(false);
    if (kind === "stored") f.api.setRoute(exactPath);
    else {
      f.api.addRouteToMap(tour(), ref(true));
      f.provider.emit("route", {
        route: [{ geometry: { coordinates: exactPath } }],
      });
    }
    expect(f.api.routeCoordinates.value).toEqual(exactPath);
    expect(
      f.map.sources.get("pg-stored-route")!.data.geometry.coordinates,
    ).toEqual(exactPath);
    expect(f.map.fitBounds).not.toHaveBeenCalled();
    f.scope.stop();
  },
);

it("invalidates displayed routes without a provider fallback or resurrection on style reload", () => {
  const f = setup();
  f.api.setRoute(exactPath);
  const malformedTour = JSON.parse(
    JSON.stringify(
      tour([
        { lng: "2", lat: "48" },
        { lng: "invalid", lat: "48" },
      ]),
    ),
  ) as ICreatedTour;
  f.api.addRouteToMap(malformedTour, ref(true));
  expect(f.api.routeCoordinates.value).toEqual([]);
  expect(visibleLayers(f.map)).toEqual([]);
  expect(f.map.sources.size).toBe(0);
  expect(f.provider.setOrigin).not.toHaveBeenCalled();
  expect(f.provider.setDestination).not.toHaveBeenCalled();
  f.provider.emit("route", {
    route: [{ geometry: { coordinates: exactPath } }],
  });
  f.map.fire("style.load");
  expect(f.api.routeCoordinates.value).toEqual([]);
  expect(f.map.sources.size).toBe(0);
  f.api.addRouteToMap(tour(), ref(true));
  f.provider.emit("route", {
    route: [{ geometry: { coordinates: exactPath } }],
  });
  f.provider.emit("route", { route: [{ geometry: "?" }] });
  expect(f.api.routeCoordinates.value).toEqual([]);
  expect(visibleLayers(f.map)).toEqual([]);
  f.map.fire("style.load");
  expect(f.map.sources.size).toBe(0);
  f.scope.stop();
});

it("fences replaced maps/clients and removes all route subscriptions and overlays on disposal", () => {
  const f = setup();
  f.api.setRoute(exactPath);
  const replacement = mapFixture();
  const replacementCamera = structuredClone(replacement.camera);
  f.mapRef.value = replacement.instance;
  expect(
    [...f.map.handlers.values()].every((listeners) => listeners.size === 0),
  ).toBe(true);
  expect(f.map.sources.size).toBe(0);
  expect(f.map.layers.size).toBe(0);
  expect(
    replacement.sources.get("pg-stored-route")!.data.geometry.coordinates,
  ).toEqual(exactPath);
  expect(replacement.camera).toEqual(replacementCamera);
  expect(replacement.fitBounds).not.toHaveBeenCalled();
  f.provider.emit("route", { route: [{ geometry: "?" }] });
  f.map.fire("pg:appearance");
  expect(f.api.routeCoordinates.value).toEqual(exactPath);
  f.scope.stop();
  f.api.cleanup();
  expect(
    [...replacement.handlers.values()].every(
      (listeners) => listeners.size === 0,
    ),
  ).toBe(true);
  expect(replacement.sources.size).toBe(0);
  expect(replacement.layers.size).toBe(0);
  expect(f.api.routeCoordinates.value).toEqual([]);
  replacement.fire("style.load");
  expect(replacement.sources.size).toBe(0);
  const nextMap = mapFixture();
  f.mapRef.value = nextMap.instance;
  expect(nextMap.handlers.size).toBe(0);
});

it("retains provider leg boundaries through style restoration and map replacement", () => {
  const f = setup();
  const points: MapPoint[] = [
    [0, 0],
    [0.001, 0],
    [0.004, 0.003],
    [0.005, 0.003],
  ];
  const stored = tour(
    points.map(([lng, lat]) => ({ lng: String(lng), lat: String(lat) })),
  );
  stored.route.geometry_leg_starts = [0, 2];
  f.api.addRouteToMap(stored, ref(true));
  const expected = {
    type: "MultiLineString",
    coordinates: [points.slice(0, 2), points.slice(2)],
  };
  expect(f.map.sources.get("pg-stored-route")!.data.geometry).toEqual(expected);
  expect(f.api.routeLegStarts.value).toEqual([0, 2]);
  f.map.sources.clear();
  f.map.layers.clear();
  f.map.fire("style.load");
  expect(f.map.sources.get("pg-stored-route")!.data.geometry).toEqual(expected);
  const replacement = mapFixture();
  f.mapRef.value = replacement.instance;
  expect(replacement.sources.get("pg-stored-route")!.data.geometry).toEqual(
    expected,
  );
  expect(replacement.fitBounds).not.toHaveBeenCalled();
  f.scope.stop();
});
