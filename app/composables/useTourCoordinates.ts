import { usePositionMode } from "./usePositionMode";
import { useGeolocationStore } from "~/stores/geolocationStore";
import { useTourStore } from "~/stores/tourStore";
import { useLogger } from "./useLogger";

export interface TourCoordinatesOptions {
  getSimulationMarkerPosition: () => [number, number] | null;
}

/**
 * Composable for managing tour coordinates based on position mode
 * Handles GPS and simulation mode coordinate retrieval with fallback logic
 */
export function useTourCoordinates(options: TourCoordinatesOptions) {
  const { getSimulationMarkerPosition } = options;
  const { positionMode } = usePositionMode();
  const geolocationStore = useGeolocationStore();
  const tourStore = useTourStore();
  const logger = useLogger();

  /**
   * Get current coordinates based on active position mode
   * @returns Current coordinates [lng, lat] or null if unavailable
   */
  const getCurrentCoordinates = (): [number, number] | null => {
    if (positionMode.value === "gps") {
      if (geolocationStore.coordinates) {
        return geolocationStore.coordinates;
      }
      logger.warn("GPS coordinates not available");
      return null;
    } else {
      const coords = getSimulationMarkerPosition();
      if (!coords) {
        logger.warn("Simulation marker not set");
      }
      return coords;
    }
  };

  /**
   * Get fallback coordinates when primary coordinates are unavailable
   * First tries geolocation store, then falls back to first tour route point
   * @returns Fallback coordinates [lng, lat] or null if no fallback available
   */
  const getFallbackCoordinates = (): [number, number] | null => {
    // Try geolocation store first (for GPS mode)
    if (positionMode.value === "gps" && geolocationStore.coordinates) {
      logger.log("Using geolocation fallback coordinates:", geolocationStore.coordinates);
      return geolocationStore.coordinates;
    }

    // Try first point from tour route
    if (tourStore.tour?.route?.points && tourStore.tour.route.points.length > 0) {
      const firstPoint = tourStore.tour.route.points[0];
      if (firstPoint) {
        const coords: [number, number] = [Number(firstPoint.lng), Number(firstPoint.lat)];
        logger.log("Using tour route fallback coordinates:", coords);
        return coords;
      }
    }

    logger.error("No fallback coordinates available");
    return null;
  };

  /**
   * Get coordinates with automatic fallback handling
   * @returns Coordinates [lng, lat] or null if all methods fail
   */
  const getCoordinatesWithFallback = (): [number, number] | null => {
    let coords = getCurrentCoordinates();

    if (!coords) {
      logger.warn(
        "No coordinates available for current position mode, trying fallback"
      );
      coords = getFallbackCoordinates();
    }

    return coords;
  };

  return {
    getCurrentCoordinates,
    getFallbackCoordinates,
    getCoordinatesWithFallback,
  };
}
