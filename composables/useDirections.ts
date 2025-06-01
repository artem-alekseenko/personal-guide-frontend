import mapboxgl from "mapbox-gl";
import MapboxDirections from "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions";
import type { ShallowRef } from 'vue';
import { useLogger } from "~/composables/useLogger";

export const useDirections = (mapInstance: ShallowRef<mapboxgl.Map | null>) => {
  const logger = useLogger();
  let directions: MapboxDirections | null = null;

  const initializeDirections = (): MapboxDirections | null => {
    if (directions) {
      logger.warn("Directions already initialized");
      return directions;
    }
    
    if (!mapInstance.value) {
      logger.error("Map instance not available for directions initialization");
      return null;
    }

    logger.log("Initializing MapboxDirections...");
    const { map_config } = useAppConfig();
    const accessToken = unref(map_config.mapbox_gl_access_token);

    directions = new MapboxDirections({
      accessToken,
      unit: "metric",
      profile: "mapbox/walking",
      controls: {
        inputs: false,
        instructions: false,
        profileSwitcher: false,
      },
    });

    mapInstance.value.addControl(directions);
    logger.log("MapboxDirections initialized and added to map");
    return directions;
  };

  const clearDirections = (): void => {
    if (directions) {
      logger.log("Clearing directions routes");
      directions.removeRoutes();
    } else {
      logger.warn("Attempted to clear directions but none initialized");
    }
  };

  const removeDirections = (): void => {
    if (directions && mapInstance.value) {
      logger.log("Removing directions control from map");
      mapInstance.value.removeControl(directions);
      directions = null;
      logger.log("Directions control removed and cleaned up");
    } else {
      logger.warn("Attempted to remove directions but none found or map not available");
    }
  };

  const setRoute = (coordinates: [number, number][]): boolean => {
    logger.log("Setting route with coordinates:", coordinates.length, "points");
    
    if (!directions) {
      logger.error("Cannot set route: directions not initialized");
      return false;
    }
    
    if (coordinates.length < 2) {
      logger.error("Cannot set route: insufficient coordinates", coordinates.length);
      return false;
    }

    const start = coordinates[0]!; // Safe because length >= 2
    const finish = coordinates[coordinates.length - 1]!; // Safe because length >= 2
    const waypoints = coordinates.slice(1, -1);

    logger.log("Route details:", {
      start,
      finish,
      waypoints: waypoints.length
    });

    try {
      clearDirections();
      
      directions.setOrigin([start[0], start[1]]);
      logger.log("Origin set:", start);

      waypoints.forEach((waypoint: [number, number], index: number) => {
        directions!.addWaypoint(index, waypoint);
      });
      
      if (waypoints.length > 0) {
        logger.log("Waypoints added:", waypoints.length);
      }

      directions.setDestination([finish[0], finish[1]]);
      logger.log("Destination set:", finish);
      
      logger.log("Route successfully set");
      return true;
    } catch (error) {
      logger.error('Error setting route:', error);
      return false;
    }
  };

  const getDirections = (): MapboxDirections | null => directions;

  const isInitialized = (): boolean => {
    return directions !== null;
  };

  return {
    initializeDirections,
    clearDirections,
    removeDirections,
    setRoute,
    getDirections,
    isInitialized,
  };
}; 