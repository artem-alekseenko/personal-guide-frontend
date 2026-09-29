import type { Map, GeoJSONSource } from "mapbox-gl";
export const STORED_ROUTE_ID = "pg-stored-route";
/** Draw the provider's geometry without replacing it with a second route. */
export function renderStoredRoute(
  map: Map,
  coordinates: [number, number][],
): boolean {
  if (
    coordinates.length < 2 ||
    coordinates.some((p) => !p.every(Number.isFinite))
  )
    return false;
  const data: GeoJSON.Feature<GeoJSON.LineString> = {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates },
  };
  const source = map.getSource(STORED_ROUTE_ID) as GeoJSONSource | undefined;
  if (source) source.setData(data);
  else map.addSource(STORED_ROUTE_ID, { type: "geojson", data });
  if (!map.getLayer(STORED_ROUTE_ID))
    map.addLayer({
      id: STORED_ROUTE_ID,
      type: "line",
      source: STORED_ROUTE_ID,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#2563eb", "line-width": 5 },
    });
  const lngs = coordinates.map((p) => p[0]),
    lats = coordinates.map((p) => p[1]);
  map.fitBounds(
    [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ],
    { padding: 50, maxZoom: 16 },
  );
  return true;
}
export function clearStoredRoute(map: Map | null) {
  if (!map) return;
  if (map.getLayer(STORED_ROUTE_ID)) map.removeLayer(STORED_ROUTE_ID);
  if (map.getSource(STORED_ROUTE_ID)) map.removeSource(STORED_ROUTE_ID);
}
