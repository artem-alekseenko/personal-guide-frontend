<template>
  <BaseMap
    ref="baseMapRef"
    :show-user-location="true"
    :on-map-click="selectPoint"
    @map-initialized="handleMapInitialized"
  />
</template>

<script lang="ts" setup>
import mapboxgl from "mapbox-gl";
import { ref, shallowRef, watch, onBeforeUnmount, nextTick } from "#imports";
import { useGeolocationStore } from "~/stores/geolocationStore";
import { useRouteStore } from "~/stores/routeStore";
import BaseMap from "~/components/base/BaseMap.vue";
import { useMapboxDirections } from "~/composables/map/useMapboxDirections";
import { useMarkers } from "~/composables/map/useMarkers";
import { useLogger } from "@/composables/utils/useLogger";

const routeStore = useRouteStore();
const geolocationStore = useGeolocationStore();
const logger = useLogger();

const selectedInitialArea = defineModel("selectedArea", {});

const baseMapRef = ref<InstanceType<typeof BaseMap> | null>(null);
const mapInstance = shallowRef<mapboxgl.Map | null>(null);

// Initialize composables with route creation configuration
const {
  initializeDirections,
  clearDirections,
  cleanup,
  setRoute,
  isInitialized,
} = useMapboxDirections(mapInstance, {
  enableBounds: true,
  interactive: false,
});

const { addMarker, addHighPlacesToMap, addWaypointMarkers, clearAllMarkers } =
  useMarkers(mapInstance);

const handleMapInitialized = (map: mapboxgl.Map) => {
  map.once("load", () => {
    mapInstance.value = map;
    const start = routeStore.startPoint;
    if (start && !routeStore.routeSuggestion?.coordinates?.length)
      map.flyTo({
        center: [Number(start.lng), Number(start.lat)],
        duration: 0,
      });
  });
};

const selectPoint = (e: mapboxgl.MapMouseEvent) => {
  selectedInitialArea.value = {
    lng: String(e.lngLat.lng),
    lat: String(e.lngLat.lat),
  };
};

// Cleanup on component unmount
onBeforeUnmount(() => {
  logger.log("Component unmounting, cleaning up map...");

  try {
    // Check if map instance is still valid before cleanup
    if (mapInstance.value && mapInstance.value.getContainer()) {
      cleanup();
    } else {
      logger.log("Map instance already destroyed, skipping directions cleanup");
    }
  } catch (error) {
    logger.warn("Error during directions cleanup:", error);
  }

  try {
    clearAllMarkers();
  } catch (error) {
    logger.warn("Error during markers cleanup:", error);
  }

  // Clear references
  mapInstance.value = null;
});

watch(
  () =>
    [
      routeStore.routeSuggestion?.coordinates,
      mapInstance.value,
      routeStore.startPoint,
    ] as const,
  async ([newCoords]) => {
    if (!mapInstance.value) return;
    if (!newCoords?.length) {
      clearDirections();
      clearAllMarkers();
      const start = routeStore.startPoint;
      if (start) addMarker(Number(start.lat), Number(start.lng));
      return;
    }

    const directions = await initializeDirections();
    if (!directions) return;

    // Clear previous routes and markers
    clearDirections();
    clearAllMarkers();

    // Set the route using directions composable
    const routeSet = setRoute(newCoords);

    if (routeSet) {
      // Add high places markers
      const highPlaces = routeStore.routeSuggestion?.high_places;
      if (highPlaces?.length) {
        addHighPlacesToMap(highPlaces);
      }

      // Add waypoint markers
      addWaypointMarkers(
        (routeStore.selectedRoute?.stops ?? []).map(
          (stop) =>
            [Number(stop.point.lng), Number(stop.point.lat)] as [
              number,
              number,
            ],
        ),
      );
    }
  },
  { flush: "post" },
);
</script>

<style>
.waypoint-marker {
  width: 24px;
  height: 24px;
  background-color: #22c55e;
  border-radius: 50%;
  border: 2px solid white;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 12px;
}
</style>
