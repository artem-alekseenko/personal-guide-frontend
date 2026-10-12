import { it, expect, vi } from "vitest";
import type {
  Map as MapboxMap,
  LineLayerSpecification,
  FitBoundsOptions,
} from "mapbox-gl";
import type { Feature, LineString, MultiLineString } from "geojson";
import {
  renderStoredRoute,
  fitMapRoute,
  clearStoredRoute,
} from "../app/utils/storedRoute";

function routeMap() {
  const layers = new Map<string, LineLayerSpecification>();
  type RouteData = Feature<LineString | MultiLineString>;
  interface RouteSource {
    data: RouteData;
    setData: (data: RouteData) => void;
  }
  const sources = new Map<string, RouteSource>();
  const map = {
    layers,
    sources,
    getContainer: () => ({ dataset: { pgMapTheme: "light" } }),
    getSource: (id: string) => sources.get(id),
    addSource: vi.fn((id: string, source: { data: RouteData }) => {
      const stored: RouteSource = {
        data: source.data,
        setData: vi.fn((data: RouteData) => {
          stored.data = data;
        }),
      };
      sources.set(id, stored);
    }),
    getLayer: (id: string) => layers.get(id),
    addLayer: vi.fn((layer: LineLayerSpecification) =>
      layers.set(layer.id, layer),
    ),
    setPaintProperty: vi.fn((id: string, name: "line-color", value: string) => {
      layers.get(id)!.paint![name] = value;
    }),
    removeLayer: vi.fn((id: string) => layers.delete(id)),
    removeSource: vi.fn((id: string) => sources.delete(id)),
    fitBounds: vi.fn(
      (
        _bounds: [[number, number], [number, number]],
        _options: FitBoundsOptions,
      ) => {},
    ),
  };
  // The fixture implements only the Mapbox surface used by this route utility.
  const instance = map as unknown as MapboxMap;
  return { ...map, instance };
}

it("renders every stored geometry point without simplifying or rerouting", () => {
  const map = routeMap();
  const points: [number, number][] = Array.from({ length: 47 }, (_, i) => [
    2 + i / 1000,
    1 + i / 1000,
  ]);
  expect(renderStoredRoute(map.instance, points)).toBe(true);
  expect(map.sources.get("pg-stored-route")!.data.geometry.coordinates).toBe(
    points,
  );
  expect(map.fitBounds).toHaveBeenCalledTimes(1);
  expect([...map.layers.values()]).toHaveLength(2);
  for (const layer of map.layers.values()) {
    expect(layer.slot).toBe("top");
    expect(layer.layout).toMatchObject({
      "line-join": "round",
      "line-cap": "round",
    });
    expect(layer.paint!["line-emissive-strength"]).toBe(1);
    expect(layer.paint!["line-width"]).toContainEqual(["zoom"]);
  }
});

it("fits exact geometry extrema, including bends outside the endpoints", () => {
  const map = routeMap();
  const coordinates = [
    [1, 2],
    [-3, 8],
    [4, -5],
    [2, 3],
  ] as const;
  expect(fitMapRoute(map.instance, coordinates, 400)).toBe(true);
  expect(map.fitBounds).toHaveBeenCalledWith(
    [
      [-3, -5],
      [4, 8],
    ],
    {
      padding: { top: 96, bottom: 48, left: 32, right: 32 },
      maxZoom: 16,
      duration: 400,
    },
  );
  map.fitBounds.mockClear();
  expect(fitMapRoute(map.instance, coordinates)).toBe(true);
  expect(map.fitBounds.mock.calls[0]![1].duration).toBe(0);
});

it("rejects unusable geometry without moving the camera and clears an invalid overlay", () => {
  const map = routeMap();
  const valid: [number, number][] = [
    [1, 2],
    [3, 4],
  ];
  expect(renderStoredRoute(map.instance, valid, false)).toBe(true);
  for (const invalid of [
    [],
    [[1, 2]],
    [
      [1, 2],
      [1, 2],
    ],
    [
      [NaN, 2],
      [3, 4],
    ],
    [
      [1, 91],
      [3, 4],
    ],
  ]) {
    expect(fitMapRoute(map.instance, invalid as [number, number][])).toBe(
      false,
    );
  }
  expect(
    renderStoredRoute(map.instance, [
      [1, 2],
      [NaN, 3],
    ]),
  ).toBe(false);
  expect(map.layers.size).toBe(0);
  expect(map.sources.size).toBe(0);
  expect(map.fitBounds).not.toHaveBeenCalled();
  clearStoredRoute(map.instance);
  expect(map.layers.size).toBe(0);
});

it("draws separate provider legs without a connector and keeps both legs in bounds", () => {
  const map = routeMap();
  const points: [number, number][] = [[0, 0], [0.001, 0], [0.004, 0.003], [0.005, 0.003]];
  expect(renderStoredRoute(map.instance, points, true, [0, 2])).toBe(true);
  expect(map.sources.get("pg-stored-route")!.data.geometry).toEqual({
    type: "MultiLineString",
    coordinates: [points.slice(0, 2), points.slice(2)],
  });
  expect(map.fitBounds.mock.calls[0]![0]).toEqual([[0, 0], [0.005, 0.003]]);
  expect(renderStoredRoute(map.instance, points, false, [0, 1, 2, 3])).toBe(false);
  expect(map.sources.size).toBe(0);
  expect(renderStoredRoute(map.instance, points, false, [2])).toBe(false);
});
