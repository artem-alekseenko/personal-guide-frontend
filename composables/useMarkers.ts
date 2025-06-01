import mapboxgl, { type LngLatLike } from "mapbox-gl";
import createHighPlacesMarkerElem from "~/utils/pages/createHighPlacesMarkerElem";
import type { ShallowRef } from 'vue';
import { useLogger } from "~/composables/useLogger";

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
    marker = new mapboxgl.Marker().setLngLat(coordinates).addTo(mapInstance.value);
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
    logger.log("Adding high places markers:", highPlaces?.length || 0, "places");
    
    if (!mapInstance.value) {
      logger.error("Cannot add high places: map instance not available");
      return [];
    }
    
    if (!highPlaces?.length) {
      logger.warn("No high places provided for markers");
      return [];
    }

    clearHighPlacesMarkers();

    const geojson = {
      type: "FeatureCollection",
      features: highPlaces.map((place) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [Number(place.point.lng), Number(place.point.lat)],
        },
        properties: {
          title: place.name,
        },
      })),
    };

    geojson.features.forEach((markerData, index) => {
      logger.log(`Creating high place marker ${index + 1}:`, markerData.properties.title);
      
      const el = createHighPlacesMarkerElem(markerData.properties.title);

      const mapMarker = new mapboxgl.Marker(el)
        .setLngLat(markerData.geometry.coordinates as LngLatLike)
        .addTo(mapInstance.value!);
      
      highPlacesMarkers.push(mapMarker);
    });

    logger.log("High places markers successfully added:", highPlacesMarkers.length);
    return highPlacesMarkers;
  };

  const clearHighPlacesMarkers = () => {
    if (highPlacesMarkers.length > 0) {
      logger.log("Clearing high places markers:", highPlacesMarkers.length);
      highPlacesMarkers.forEach(m => m.remove());
      highPlacesMarkers = [];
      logger.log("High places markers cleared");
    }
  };

  const addWaypointMarkers = (coordinates: [number, number][]) => {
    logger.log("Adding waypoint markers:", coordinates?.length || 0, "points");
    
    if (!mapInstance.value) {
      logger.error("Cannot add waypoint markers: map instance not available");
      return [];
    }
    
    if (!coordinates?.length) {
      logger.warn("No coordinates provided for waypoint markers");
      return [];
    }

    clearWaypointMarkers();

    const geojson = {
      type: "FeatureCollection",
      features: coordinates.map((coordinate) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [coordinate[0], coordinate[1]],
        },
      })),
    };

    geojson.features.forEach((feature, index: number) => {
      logger.log(`Creating waypoint marker ${index + 1} at:`, feature.geometry.coordinates);
      
      const el = document.createElement("div");
      el.className = "waypoint-marker";
      el.innerHTML = `<span><b>${index + 1}</b></span>`;
      
      const mapMarker = new mapboxgl.Marker(el)
        .setLngLat(feature.geometry.coordinates as LngLatLike)
        .addTo(mapInstance.value!);
      
      waypointMarkers.push(mapMarker);
    });

    logger.log("Waypoint markers successfully added:", waypointMarkers.length);
    return waypointMarkers;
  };

  const clearWaypointMarkers = () => {
    if (waypointMarkers.length > 0) {
      logger.log("Clearing waypoint markers:", waypointMarkers.length);
      waypointMarkers.forEach(m => m.remove());
      waypointMarkers = [];
      
      // Additional cleanup: remove any remaining waypoint-marker DOM elements
      const existingWaypointMarkers = mapInstance.value?.getContainer().querySelectorAll(".waypoint-marker");
      if (existingWaypointMarkers?.length) {
        logger.log("Removing remaining waypoint marker DOM elements:", existingWaypointMarkers.length);
        existingWaypointMarkers.forEach(el => el.remove());
      }
      
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
      waypointsCount: waypointMarkers.length
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