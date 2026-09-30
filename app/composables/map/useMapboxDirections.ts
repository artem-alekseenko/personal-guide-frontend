import { renderStoredRoute, clearStoredRoute } from "~/utils/storedRoute";
import mapboxgl from "mapbox-gl";
import MapboxDirections from "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions";
import { ref, readonly, type Ref, type ShallowRef } from "vue";
import { useLogger } from "@/composables/utils/useLogger";
import type { ICreatedTour } from "~/types";
import {
  decodeRouteGeometry,
  type MapPoint,
} from "#shared/utils/routeMovement";

interface RouteEvent {
  route: Array<{
    geometry:
      | string
      | {
          coordinates: [number, number][];
        };
  }>;
}

interface MapboxDirectionsOptions {
  enableBounds?: boolean;
  interactive?: boolean;
  profile?:
    | "mapbox/driving-traffic"
    | "mapbox/driving"
    | "mapbox/walking"
    | "mapbox/cycling";
  controls?: {
    inputs?: boolean;
    instructions?: boolean;
    profileSwitcher?: boolean;
  };
}

const WAYPOINTS_MAX_COUNT = 25;

export function useMapboxDirections(
  mapInstance: ShallowRef<mapboxgl.Map | null> | Ref<mapboxgl.Map | null>,
  options: MapboxDirectionsOptions = {},
) {
  const logger = useLogger();
  const { public: publicConfig } = useRuntimeConfig();
  const mapboxGlAccessToken = publicConfig.mapboxGlAccessToken;

  const defaultOptions: MapboxDirectionsOptions = {
    enableBounds: true,
    interactive: false,
    profile: "mapbox/walking",
    controls: {
      inputs: false,
      instructions: false,
      profileSwitcher: false,
    },
  };

  const config = { ...defaultOptions, ...options };

  let directions: MapboxDirections | null = null;
  const isDirectionsReady = ref(false);
  const routeCoordinates = ref<MapPoint[]>([]);

  const initializeDirections = (): MapboxDirections | null => {
    if (directions) {
      logger.warn("Directions already initialized");
      return directions;
    }

    if (!mapInstance.value) {
      logger.error("Map instance not available for directions initialization");
      return null;
    }

    try {
      logger.log("Initializing MapboxDirections...");

      directions = new MapboxDirections({
        accessToken: mapboxGlAccessToken,
        unit: "metric",
        profile: config.profile,
        controls: config.controls,
        interactive: config.interactive,
      });

      // Keep the actual displayed path for local walking simulation, including legacy tours.
      directions.on("route", (e: RouteEvent) => {
        routeCoordinates.value = e.route?.[0]?.geometry
          ? decodeRouteGeometry(e.route[0].geometry)
          : [];
        logger.log("Route loaded:", e);
        if (
          config.enableBounds &&
          mapInstance.value &&
          routeCoordinates.value.length
        ) {
          const bounds = new mapboxgl.LngLatBounds();
          routeCoordinates.value.forEach((coord) => bounds.extend(coord));

          if (!bounds.isEmpty()) {
            mapInstance.value.fitBounds(bounds, {
              padding: 50,
              maxZoom: 15,
            });
          }
        }
      });

      directions.on("error", (e: Error) => {
        logger.error("Directions error:", e);
      });

      mapInstance.value.addControl(directions);
      isDirectionsReady.value = true;
      logger.log("MapboxDirections initialized and added to map");
      return directions;
    } catch (error) {
      logger.error("Error initializing MapboxDirections:", error);
      directions = null;
      isDirectionsReady.value = false;
      return null;
    }
  };

  const clearDirections = (): void => {
    routeCoordinates.value = [];
    clearStoredRoute(mapInstance.value);
    if (!directions) {
      logger.warn("Attempted to clear directions but none initialized");
      return;
    }

    try {
      logger.log("Clearing directions routes");
      directions.removeRoutes();
    } catch (error) {
      logger.error("Error clearing directions routes:", error);
    }
  };

  const removeDirections = (): void => {
    routeCoordinates.value = [];
    if (!directions) {
      logger.warn("Attempted to remove directions but none initialized");
      return;
    }

    if (!mapInstance.value) {
      logger.warn("Map instance not available for directions removal");
      directions = null;
      isDirectionsReady.value = false;
      return;
    }

    try {
      logger.log("Removing directions control from map");

      // First try to clear routes safely
      try {
        directions.removeRoutes();
      } catch (routeError) {
        // Silently handle route clearing errors
      }

      // Try to remove the control, but handle DOM errors gracefully
      try {
        mapInstance.value.removeControl(directions);
        logger.log("Directions control successfully removed");
      } catch (controlError) {
        // Check if this is the known removeChild error during component unmounting
        const errorMessage = (controlError as Error)?.message || "";
        if (
          errorMessage.includes("removeChild") ||
          errorMessage.includes("null")
        ) {
          // This is a known DOM cleanup race condition, silently ignore it
          logger.log(
            "Directions control cleanup completed (DOM already removed)",
          );
        } else {
          // Log other unexpected errors
          logger.warn(
            "Unexpected error removing directions control:",
            controlError,
          );
        }
      }

      directions = null;
      isDirectionsReady.value = false;
      logger.log("Directions control removed and cleaned up");
    } catch (error) {
      logger.error("Error removing directions control:", error);
      // Force cleanup even if removal failed completely
      directions = null;
      isDirectionsReady.value = false;
    }
  };

  const decreaseWaypoints = (
    coordinates: [number, number][],
  ): [number, number][] => {
    return coordinates.length <= WAYPOINTS_MAX_COUNT
      ? coordinates
      : [
          ...coordinates.slice(0, WAYPOINTS_MAX_COUNT - 1),
          coordinates[coordinates.length - 1]!,
        ];
  };

  // Method for simple coordinate-based route setting (used in route creation)
  const setRoute = (coordinates: [number, number][]): boolean => {
    if (mapInstance.value) {
      directions?.removeRoutes();
      routeCoordinates.value = coordinates;
      return renderStoredRoute(mapInstance.value, coordinates);
    }
    logger.log("Setting route with coordinates:", coordinates.length, "points");

    if (!directions) {
      logger.error("Cannot set route: directions not initialized");
      return false;
    }

    if (coordinates.length < 2) {
      logger.error(
        "Cannot set route: insufficient coordinates",
        coordinates.length,
      );
      return false;
    }

    const trimmedCoordinates = decreaseWaypoints(coordinates);
    const start = trimmedCoordinates[0]!;
    const finish = trimmedCoordinates[trimmedCoordinates.length - 1]!;
    const waypoints = trimmedCoordinates.slice(1, -1);

    logger.log("Route details:", {
      start,
      finish,
      waypoints: waypoints.length,
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
      logger.error("Error setting route:", error);
      return false;
    }
  };

  // Method for tour-based route setting (used in tour viewing)
  const addRouteToMap = (
    tour: ICreatedTour,
    isMapFullyLoaded: Ref<boolean>,
  ): void => {
    if (
      mapInstance.value &&
      isMapFullyLoaded.value &&
      tour.route.geometry?.length
    ) {
      directions?.removeRoutes();
      routeCoordinates.value = tour.route.geometry.map((p) => [
        Number(p.lng),
        Number(p.lat),
      ]);
      renderStoredRoute(mapInstance.value, routeCoordinates.value);
      return;
    }
    if (!mapInstance.value || !directions) {
      logger.warn("Map or directions not initialized");
      logger.log(
        "mapInstance:",
        !!mapInstance.value,
        "directions:",
        !!directions,
      );
      return;
    }

    if (!isMapFullyLoaded.value) {
      logger.warn("Map not fully loaded yet, skipping route addition");
      return;
    }

    if (!isDirectionsReady.value) {
      logger.warn("Directions not ready yet");
      return;
    }

    logger.log("Adding route to map");
    logger.log("Tour route points:", tour.route.points);

    const coordinates = tour.route.points.map(
      (p) => [Number(p.lng), Number(p.lat)] as [number, number],
    );

    logger.log("Original coordinates:", coordinates);
    logger.log("Original coordinates count:", coordinates.length);

    if (coordinates.length < 2) {
      logger.warn("Not enough coordinates for route");
      return;
    }

    const trimmedCoordinates = decreaseWaypoints(coordinates);
    logger.log("Trimmed coordinates:", trimmedCoordinates);
    logger.log("Trimmed coordinates count:", trimmedCoordinates.length);

    const start = trimmedCoordinates[0];
    const finish = trimmedCoordinates.at(-1);
    const waypoints = trimmedCoordinates.slice(1, -1);

    logger.log("Start point:", start);
    logger.log("Finish point:", finish);
    logger.log("Waypoints:", waypoints);

    if (!finish || !start || ![...start, ...finish].every(Number.isFinite)) {
      logger.warn("Invalid coordinates");
      return;
    }

    try {
      // Clear any existing route
      directions.removeRoutes();
      logger.log("Existing routes removed");

      // Set new route
      directions.setOrigin([start[0], start[1]]);
      logger.log("Origin set");

      waypoints.forEach((waypoint, index) => {
        directions!.addWaypoint(index, waypoint);
        logger.log(`Waypoint ${index} added:`, waypoint);
      });

      directions.setDestination([finish[0], finish[1]]);
      logger.log("Destination set");
    } catch (error) {
      logger.error("Error while setting route:", error);
    }
  };

  const getDirections = (): MapboxDirections | null => directions;

  const isInitialized = (): boolean => {
    return directions !== null;
  };

  // Unified cleanup method
  const cleanup = (): void => {
    clearStoredRoute(mapInstance.value);
    removeDirections();
  };

  return {
    // State
    routeCoordinates: readonly(routeCoordinates),
    directions: readonly(ref(directions)),
    isDirectionsReady: readonly(isDirectionsReady),

    // Core methods
    initializeDirections,
    clearDirections,
    removeDirections,
    cleanup,
    getDirections,
    isInitialized,

    // Route setting methods
    setRoute, // For coordinate arrays
    addRouteToMap, // For tour objects
  };
}
