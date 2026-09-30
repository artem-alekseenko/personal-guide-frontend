import { shallowRef } from "vue";
import mapboxgl from "mapbox-gl";
import { useLogger } from "~/composables/utils/useLogger";
import { usePositionMode } from "./usePositionMode";
import { createPositionMarker } from "~/utils/positionMarker";

type MarkerWithEvents = mapboxgl.Marker & {
  on(event: string, handler: () => void): void;
};

export interface SimulationMarkerOptions {
  onDragEnd?: () => void;
  label?: string;
}

/**
 * Composable for managing simulation marker on the map
 * Handles marker creation, removal, dragging, and position tracking
 */
export function useSimulationMarker(options: SimulationMarkerOptions = {}) {
  const logger = useLogger();
  const { positionMode } = usePositionMode();

  const simulationMarker = shallowRef<mapboxgl.Marker | null>(null);
  let mapInstance: mapboxgl.Map | null = null;
  let dragEndCallback = options.onDragEnd;
  let moveStartCallback: (() => void) | undefined;
  let mapGestureCallback: (() => void) | undefined;
  let clickMap: mapboxgl.Map | null = null;
  const onMapClick = (e: mapboxgl.MapMouseEvent) => {
    if (positionMode.value === "manual") {
      moveStartCallback?.();
      addSimulationMarker([e.lngLat.lng, e.lngLat.lat]);
    }
  };
  const onMapGesture = (event: { originalEvent?: unknown }) => {
    if (event.originalEvent) mapGestureCallback?.();
  };

  /**
   * Add or update simulation marker at specified coordinates
   * @param coords - Coordinates [lng, lat] where to place the marker
   */
  const addSimulationMarker = (coords: [number, number]): void => {
    if (!mapInstance) {
      logger.error("Cannot add simulation marker: map not initialized");
      return;
    }

    // Keep the same marker while animating; replacing it causes visible flicker.
    if (simulationMarker.value) {
      simulationMarker.value.setLngLat(coords);
      return;
    }

    try {
      const newMarker = new mapboxgl.Marker({
        draggable: true,
        element: createPositionMarker(
          "simulation",
          options.label ?? "Simulation",
        ),
      })
        .setLngLat(coords)
        .addTo(mapInstance);

      (newMarker as MarkerWithEvents).on("dragstart", () =>
        moveStartCallback?.(),
      );
      (newMarker as MarkerWithEvents).on("dragend", () => {
        logger.log("Simulation marker dragged to new position");
        dragEndCallback?.();
      });

      simulationMarker.value = newMarker;
      logger.log("Simulation marker successfully added to map at:", coords);
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
    if (clickMap) {
      clickMap.off("click", onMapClick);
      clickMap.off("movestart", onMapGesture);
    }
    clickMap = map;
    map.on("click", onMapClick);
    map.on("movestart", onMapGesture);
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
    setMoveStartCallback: (callback: () => void) => {
      moveStartCallback = callback;
    },
    setMapGestureCallback: (callback: () => void) => {
      mapGestureCallback = callback;
    },
    cleanup: () => {
      if (clickMap) {
        clickMap.off("click", onMapClick);
        clickMap.off("movestart", onMapGesture);
      }
      clickMap = null;
      removeSimulationMarker();
      mapInstance = null;
    },
  };
}
