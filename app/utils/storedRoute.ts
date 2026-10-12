import type { Feature, LineString, MultiLineString } from "geojson";
import type { Map, GeoJSONSource, ExpressionSpecification } from "mapbox-gl";
import { getMapAppearance } from "~/utils/mapAppearance";
import { routeLegRanges } from "#shared/utils/routeMovement";

export const STORED_ROUTE_ID = "pg-stored-route";
const ROUTE_OUTLINE_ID = `${STORED_ROUTE_ID}-outline`;
const ROUTE_WIDTH: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  10,
  3,
  14,
  5,
  18,
  7,
];
const OUTLINE_WIDTH: ExpressionSpecification = [
  "interpolate",
  ["linear"],
  ["zoom"],
  10,
  6,
  14,
  9,
  18,
  11,
];

function routeBounds(coordinates: readonly (readonly [number, number])[]) {
  if (coordinates.length < 2) return null;
  let west = Infinity,
    south = Infinity,
    east = -Infinity,
    north = -Infinity;
  for (const [lng, lat] of coordinates) {
    if (
      !Number.isFinite(lng) ||
      !Number.isFinite(lat) ||
      Math.abs(lng) > 180 ||
      Math.abs(lat) > 90
    )
      return null;
    west = Math.min(west, lng);
    south = Math.min(south, lat);
    east = Math.max(east, lng);
    north = Math.max(north, lat);
  }
  if (west === east && south === north) return null;
  return [
    [west, south],
    [east, north],
  ] as [[number, number], [number, number]];
}

/** Explicit whole-route camera action, using every displayed geometry point. */
export function fitMapRoute(
  map: Map,
  coordinates: readonly (readonly [number, number])[],
  duration = 0,
): boolean {
  const bounds = routeBounds(coordinates);
  if (!bounds) return false;
  map.fitBounds(bounds, {
    padding: { top: 96, bottom: 48, left: 32, right: 32 },
    maxZoom: 16,
    duration,
  });
  return true;
}

/** Theme changes touch paint only, leaving geometry and camera untouched. */
export function updateStoredRouteAppearance(map: Map): void {
  const palette = getMapAppearance(map);
  if (map.getLayer(ROUTE_OUTLINE_ID))
    map.setPaintProperty(ROUTE_OUTLINE_ID, "line-color", palette.routeOutline);
  if (map.getLayer(STORED_ROUTE_ID))
    map.setPaintProperty(STORED_ROUTE_ID, "line-color", palette.route);
}

/** Draw the provider's geometry without replacing it with a second route. */
export function renderStoredRoute(
  map: Map,
  coordinates: [number, number][],
  fit = true,
  legStarts: readonly number[] = [],
): boolean {
  const ranges = routeLegRanges(coordinates.length, legStarts);
  const legs = ranges?.filter(([start, end]) => end - start >= 2);
  if (!routeBounds(coordinates) || !legs?.length) {
    clearStoredRoute(map);
    return false;
  }
  const palette = getMapAppearance(map);
  const data: Feature<LineString | MultiLineString> = {
    type: "Feature",
    properties: {},
    geometry: legs.length === 1
      ? { type: "LineString", coordinates: legs[0]![0] === 0 && legs[0]![1] === coordinates.length
        ? coordinates : coordinates.slice(...legs[0]!) }
      : { type: "MultiLineString", coordinates: legs.map(([start, end]) => coordinates.slice(start, end)) },
  };
  const source = map.getSource(STORED_ROUTE_ID) as GeoJSONSource | undefined;
  if (source) source.setData(data);
  else map.addSource(STORED_ROUTE_ID, { type: "geojson", data });
  if (!map.getLayer(ROUTE_OUTLINE_ID))
    map.addLayer({
      id: ROUTE_OUTLINE_ID,
      type: "line",
      source: STORED_ROUTE_ID,
      slot: "top",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": palette.routeOutline,
        "line-width": OUTLINE_WIDTH,
        "line-opacity": 0.95,
        "line-emissive-strength": 1,
      },
    });
  if (!map.getLayer(STORED_ROUTE_ID))
    map.addLayer({
      id: STORED_ROUTE_ID,
      type: "line",
      source: STORED_ROUTE_ID,
      slot: "top",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": palette.route,
        "line-width": ROUTE_WIDTH,
        "line-emissive-strength": 1,
      },
    });
  updateStoredRouteAppearance(map);
  if (fit) fitMapRoute(map, coordinates);
  return true;
}
export function clearStoredRoute(map: Map | null) {
  if (!map) return;
  if (map.getLayer(STORED_ROUTE_ID)) map.removeLayer(STORED_ROUTE_ID);
  if (map.getLayer(ROUTE_OUTLINE_ID)) map.removeLayer(ROUTE_OUTLINE_ID);
  if (map.getSource(STORED_ROUTE_ID)) map.removeSource(STORED_ROUTE_ID);
}
