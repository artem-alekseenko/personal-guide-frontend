import mapboxgl from "mapbox-gl";
import type { IGeoJSONFeature, IGeoJSON } from "~/types";
import createPlacesMarkerElem from "./pages/createPlacesMarkerElem";
import { escapeHtml } from "./safeText";

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
  feature: IGeoJSONFeature,
): mapboxgl.Marker | undefined => {
  if (!map) return;

  const popupHTML = `<h3>${escapeHtml(feature.properties.title)}</h3>`;
  const popup = new mapboxgl.Popup({
    offset: 22,
    focusAfterOpen: false,
  }).setHTML(popupHTML);
  const marker = new mapboxgl.Marker(markerElem)
    .setLngLat(feature.geometry.coordinates)
    .setPopup(popup)
    .addTo(map);

  // Stable listener identity avoids stacking handlers when the popup reopens.
  const stopPopupClick = (event: MouseEvent) => event.stopPropagation();
  markerElem.ariaExpanded = "false";
  popup.on("open", () => {
    markerElem.classList.toggle("pg-place-marker--selected", true);
    markerElem.ariaExpanded = "true";
    // Popup controls are also inside the clickable simulation map.
    popup.getElement()?.addEventListener("click", stopPopupClick);
  });
  popup.on("close", () => {
    markerElem.classList.toggle("pg-place-marker--selected", false);
    markerElem.ariaExpanded = "false";
  });
  markerElem.addEventListener("click", (event) => {
    event.stopPropagation();
    marker.togglePopup();
  });
  markerElem.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      marker.togglePopup();
    } else if (event.key === "Escape" && popup.isOpen()) {
      event.stopPropagation();
      popup.remove();
    }
  });
  // Suppress Mapbox's legacy keypress toggle after our button keydown handler.
  markerElem.addEventListener(
    "keypress",
    (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );

  return marker;
};

/**
 * Add place markers to the map from GeoJSON features
 * @param map - Mapbox map instance
 * @param placesGeoJSON - GeoJSON object containing features with place data
 * @returns Array of created markers
 */
export const addPlaceMarkers = (
  map: mapboxgl.Map | null,
  placesGeoJSON?: IGeoJSON | null,
  numberedStops = false,
): mapboxgl.Marker[] => {
  if (!map || !placesGeoJSON?.features) return [];

  const markers: mapboxgl.Marker[] = [];

  for (const [index, feature] of placesGeoJSON.features.entries()) {
    const [lng, lat] = feature.geometry.coordinates;
    if (
      ![lng, lat].every(Number.isFinite) ||
      Math.abs(lng) > 180 ||
      Math.abs(lat) > 90
    )
      continue;
    const markerElem = createPlacesMarkerElem(
      feature.properties.title,
      numberedStops ? index + 1 : undefined,
    );
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
