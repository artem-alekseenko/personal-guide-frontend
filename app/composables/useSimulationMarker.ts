import { ref, type Ref } from "vue";
import mapboxgl from "mapbox-gl";
import { useLogger } from "./useLogger";
import { usePositionMode } from "./usePositionMode";

type MarkerWithEvents = mapboxgl.Marker & {
  on(event: string, handler: () => void): void;
};

export interface SimulationMarkerOptions {
  onDragEnd?: () => void;
}

/**
 * Composable for managing simulation marker on the map
 * Handles marker creation, removal, dragging, and position tracking
 */
export function useSimulationMarker(options: SimulationMarkerOptions = {}) {
  const logger = useLogger();
  const { positionMode } = usePositionMode();

  const simulationMarker = ref<mapboxgl.Marker | null>(null);
  let mapInstance: mapboxgl.Map | null = null;
  let dragEndCallback = options.onDragEnd;

  /**
   * Add or update simulation marker at specified coordinates
   * @param coords - Coordinates [lng, lat] where to place the marker
   */
  const addSimulationMarker = (coords: [number, number]): void => {
    if (!mapInstance) {
      logger.error("Cannot add simulation marker: map not initialized");
      return;
    }

    logger.log(
      "Creating simulation marker at coordinates:",
      coords,
      "[lng, lat]",
    );
    logger.log("Map center before adding marker:", [
      mapInstance.getCenter().lng,
      mapInstance.getCenter().lat,
    ]);

    // Remove existing marker if present
    if (simulationMarker.value) {
      logger.log("Removing existing simulation marker");
      simulationMarker.value.remove();
      simulationMarker.value = null;
    }

    logger.log("Creating standard Mapbox marker (SVG teardrop)");

    try {
      const newMarker = new mapboxgl.Marker({
        draggable: true,
      })
        .setLngLat(coords)
        .addTo(mapInstance);

      // Setup dragend event handler if callback provided
      if (dragEndCallback) {
        (newMarker as MarkerWithEvents).on("dragend", () => {
          logger.log("Simulation marker dragged to new position");
          dragEndCallback?.();
        });
      }

      simulationMarker.value = newMarker;
      logger.log("Simulation marker successfully added to map at:", coords);

      // Verification after short delay
      setTimeout(() => {
        const markerLngLat = newMarker.getLngLat();
        logger.log("Marker verification - position:", [
          markerLngLat.lng,
          markerLngLat.lat,
        ]);
        logger.log("Standard Mapbox marker created successfully");
      }, 100);
    } catch (error) {
      logger.error("Error creating simulation marker:", error);
    }
  };

  /**
   * Remove simulation marker from the map
   */
  const removeSimulationMarker = (): void => {
    if (simulationMarker.value) {
      logger.log("Removing simulation marker");
      simulationMarker.value.remove();
      simulationMarker.value = null;
    }
  };

  /**
   * Get current marker position
   * @returns Current marker coordinates [lng, lat] or null if marker not set
   */
  const getMarkerPosition = (): [number, number] | null => {
    if (simulationMarker.value) {
      const lngLat = simulationMarker.value.getLngLat();
      return [lngLat.lng, lngLat.lat];
    }
    return null;
  };

  /**
   * Setup map click handler to add marker in manual mode
   * @param map - Mapbox map instance
   */
  const setupMapClickHandler = (map: mapboxgl.Map): void => {
    mapInstance = map;

    map.on("click", (e) => {
      if (positionMode.value === "manual") {
        const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
        addSimulationMarker(coords);
      }
    });
  };

  /**
   * Initialize the composable with a map instance
   * @param map - Mapbox map instance
   */
  const initialize = (map: mapboxgl.Map): void => {
    mapInstance = map;
  };

  /**
   * Set drag end callback
   * @param callback - Callback function to call when marker drag ends
   */
  const setDragEndCallback = (callback: () => void): void => {
    dragEndCallback = callback;
  };

  return {
    simulationMarker,
    addSimulationMarker,
    removeSimulationMarker,
    getMarkerPosition,
    setupMapClickHandler,
    initialize,
    setDragEndCallback,
  };
}
