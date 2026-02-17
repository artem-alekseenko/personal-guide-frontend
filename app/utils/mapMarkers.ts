import mapboxgl from "mapbox-gl";
import type { IGeoJSONFeature, IGeoJSON } from "~/types";
import createPlacesMarkerElem from "./pages/createPlacesMarkerElem";

/**
 * Create and add a marker element to the map for a specific feature
 * @param map - Mapbox map instance
 * @param markerElem - HTML element for the marker
 * @param feature - GeoJSON feature with coordinates and properties
 * @returns Created Mapbox marker or undefined if map not available
 */
export const addMarkerElemToMap = (
  map: mapboxgl.Map | null,
  markerElem: HTMLElement,
  feature: IGeoJSONFeature
): mapboxgl.Marker | undefined => {
  if (!map) return;

  const popupHTML = `<h3>${feature.properties.title}</h3><p>Description here!</p>`;
  const marker = new mapboxgl.Marker(markerElem)
    .setLngLat(feature.geometry.coordinates)
    .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupHTML))
    .addTo(map);

  return marker as mapboxgl.Marker;
};

/**
 * Add place markers to the map from GeoJSON features
 * @param map - Mapbox map instance
 * @param placesGeoJSON - GeoJSON object containing features with place data
 * @returns Array of created markers
 */
export const addPlaceMarkers = (
  map: mapboxgl.Map | null,
  placesGeoJSON?: IGeoJSON | null
): mapboxgl.Marker[] => {
  if (!map || !placesGeoJSON?.features) return [];

  const markers: mapboxgl.Marker[] = [];

  for (const feature of placesGeoJSON.features) {
    const markerElem = createPlacesMarkerElem();
    const addedMarker = addMarkerElemToMap(map, markerElem, feature);
    if (addedMarker) {
      markers.push(addedMarker);
    }
  }

  return markers;
};

/**
 * Remove all markers from the map
 * @param markers - Array of Mapbox markers to remove
 */
export const removePlaceMarkers = (markers: mapboxgl.Marker[]): void => {
  markers.forEach((marker) => marker.remove());
};
