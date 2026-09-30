import type { Map as MapboxMap, Marker } from "mapbox-gl";
import type { GuideMapObject } from "#shared/utils/guideMapObjects";
import type { ProgressPoint } from "#shared/utils/tourProgress";
import createPlacesMarkerElem, {
  setPlaceMarkerHighlight,
} from "./pages/createPlacesMarkerElem";
import { addMarkerElemToMap } from "./mapMarkers";

/** Own one map's markers; changing discussion preserves stop elements and keyboard focus. */
export function createGuideMapMarkers() {
  let currentMap: MapboxMap | null = null;
  const entries = new Map<
    string,
    { marker: Marker; element: HTMLElement; name: string; coords: string }
  >();
  const clear = () => {
    for (const entry of entries.values()) entry.marker.remove();
    entries.clear();
    currentMap = null;
  };
  const update = (
    map: MapboxMap | null,
    stops: readonly ProgressPoint[],
    objects: readonly GuideMapObject[],
    label: string,
  ) => {
    if (map !== currentMap) {
      clear();
      currentMap = map;
    }
    if (!map) return;
    const desired = stops
      .map((point, i) => ({
        key: `stop:${i}`,
        name: point.name?.trim() ?? "",
        number: i + 1,
        coordinates: [Number(point.lng), Number(point.lat)] as [number, number],
        highlighted: objects.some((object) => object.stopPosition === i + 1),
        valid: !!point.lat?.trim() && !!point.lng?.trim(),
      }))
      .concat(
        objects
          .filter((object) => object.stopPosition === null)
          .map((object) => ({
            key: `place:${JSON.stringify([object.coordinates, object.name])}`,
            name: object.name,
            number: 0,
            coordinates: object.coordinates,
            highlighted: true,
            valid: true,
          })),
      );
    const retained = new Set<string>();
    for (const object of desired) {
      const [lng, lat] = object.coordinates;
      if (
        !object.valid ||
        !object.name ||
        ![lng, lat].every(Number.isFinite) ||
        Math.abs(lng) > 180 ||
        Math.abs(lat) > 90
      )
        continue;
      retained.add(object.key);
      const coords = object.coordinates.join(",");
      let entry = entries.get(object.key);
      if (entry && (entry.coords !== coords || entry.name !== object.name)) {
        entry.marker.remove();
        entries.delete(object.key);
        entry = undefined;
      }
      if (!entry) {
        const element = createPlacesMarkerElem(
          object.name,
          object.number || undefined,
        );
        const marker = addMarkerElemToMap(map, element, {
          type: "Feature",
          properties: { title: object.name },
          geometry: { type: "Point", coordinates: object.coordinates },
        });
        if (!marker) continue;
        entry = { marker, element, name: object.name, coords };
        entries.set(object.key, entry);
      }
      setPlaceMarkerHighlight(entry.element, object.name, {
        highlighted: object.highlighted,
        label,
      });
    }
    for (const [key, entry] of entries) {
      if (!retained.has(key)) {
        entry.marker.remove();
        entries.delete(key);
      }
    }
  };
  return { update, clear };
}
