import mapboxgl from "mapbox-gl";
import createHighPlacesMarkerElem from "~/utils/pages/createHighPlacesMarkerElem";
import createPlacesMarkerElem from "~/utils/pages/createPlacesMarkerElem";
import { addMarkerElemToMap } from "~/utils/mapMarkers";
import type { ShallowRef } from "vue";
import { useLogger } from "~/composables/utils/useLogger";

export interface HighPlace {
  name: string;
  point: {
    lat: string | number;
    lng: string | number;
  };
}

export const useMarkers = (mapInstance: ShallowRef<mapboxgl.Map | null>) => {
  const logger = useLogger();
  let marker: mapboxgl.Marker | null = null;
  let highPlacesMarkers: mapboxgl.Marker[] = [];
  let waypointMarkers: mapboxgl.Marker[] = [];

  const addMarker = (lat: number, lng: number) => {
    logger.log("Adding marker at coordinates:", { lat, lng });

    if (!mapInstance.value) {
      logger.error("Cannot add marker: map instance not available");
      return null;
    }

    removeMarker();
    const coordinates: [number, number] = [lng, lat];
    const element = document.createElement("div");
    element.className = "pg-position-marker";
    element.role = "img";
    element.ariaLabel = `${lat}, ${lng}`;
    const dot = document.createElement("span");
    dot.className = "pg-position-marker__dot";
    dot.ariaHidden = "true";
    element.appendChild(dot);
    marker = new mapboxgl.Marker(element)
      .setLngLat(coordinates)
      .addTo(mapInstance.value);
    logger.log("Marker successfully added");
    return marker;
  };

  const removeMarker = () => {
    if (marker) {
      logger.log("Removing existing marker");
      marker.remove();
      marker = null;
    }
  };

  const addHighPlacesToMap = (highPlaces: HighPlace[]) => {
    logger.log(
      "Adding high places markers:",
      highPlaces?.length || 0,
      "places",
    );

    if (!mapInstance.value) {
      logger.error("Cannot add high places: map instance not available");
      return [];
    }

    clearHighPlacesMarkers();
    if (!highPlaces?.length) {
      logger.warn("No high places provided for markers");
      return [];
    }

    highPlaces.forEach((place, index) => {
      const coordinates: [number, number] = [
        Number(place.point.lng),
        Number(place.point.lat),
      ];
      if (
        !coordinates.every(Number.isFinite) ||
        Math.abs(coordinates[0]) > 180 ||
        Math.abs(coordinates[1]) > 90
      )
        return;
      logger.log(`Creating high place marker ${index + 1}:`, place.name);
      const element = createHighPlacesMarkerElem(place.name);
      const mapMarker = addMarkerElemToMap(mapInstance.value, element, {
        type: "Feature",
        properties: { title: place.name },
        geometry: { type: "Point", coordinates },
      });
      if (mapMarker) highPlacesMarkers.push(mapMarker);
    });

    logger.log(
      "High places markers successfully added:",
      highPlacesMarkers.length,
    );
    return highPlacesMarkers;
  };

  const clearHighPlacesMarkers = () => {
    if (highPlacesMarkers.length > 0) {
      logger.log("Clearing high places markers:", highPlacesMarkers.length);
      highPlacesMarkers.forEach((m) => m.remove());
      highPlacesMarkers = [];
      logger.log("High places markers cleared");
    }
  };

  const addWaypointMarkers = (
    coordinates: readonly [number, number][],
    titles: readonly string[] = [],
  ) => {
    logger.log("Adding waypoint markers:", coordinates?.length || 0, "points");

    if (!mapInstance.value) {
      logger.error("Cannot add waypoint markers: map instance not available");
      return [];
    }

    clearWaypointMarkers();
    if (!coordinates?.length) {
      logger.warn("No coordinates provided for waypoint markers");
      return [];
    }

    coordinates.forEach((coordinate, index) => {
      if (
        !coordinate.every(Number.isFinite) ||
        Math.abs(coordinate[0]) > 180 ||
        Math.abs(coordinate[1]) > 90
      )
        return;
      const title = titles[index] ?? "";
      const element = createPlacesMarkerElem(title, index + 1);
      const mapMarker = addMarkerElemToMap(mapInstance.value, element, {
        type: "Feature",
        properties: { title },
        geometry: { type: "Point", coordinates: coordinate },
      });
      if (mapMarker) waypointMarkers.push(mapMarker);
    });

    logger.log("Waypoint markers successfully added:", waypointMarkers.length);
    return waypointMarkers;
  };

  const clearWaypointMarkers = () => {
    if (waypointMarkers.length > 0) {
      logger.log("Clearing waypoint markers:", waypointMarkers.length);
      waypointMarkers.forEach((m) => m.remove());
      waypointMarkers = [];

      logger.log("Waypoint markers cleared");
    }
  };

  const clearAllMarkers = () => {
    logger.log("Clearing all markers");
    removeMarker();
    clearHighPlacesMarkers();
    clearWaypointMarkers();
    logger.log("All markers cleared");
  };

  const getMarkers = () => {
    const markers = {
      marker,
      highPlacesMarkers: [...highPlacesMarkers],
      waypointMarkers: [...waypointMarkers],
    };

    logger.log("Current markers state:", {
      marker: !!marker,
      highPlacesCount: highPlacesMarkers.length,
      waypointsCount: waypointMarkers.length,
    });

    return markers;
  };

  return {
    addMarker,
    removeMarker,
    addHighPlacesToMap,
    clearHighPlacesMarkers,
    addWaypointMarkers,
    clearWaypointMarkers,
    clearAllMarkers,
    getMarkers,
  };
};
