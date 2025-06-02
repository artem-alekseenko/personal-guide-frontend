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
import { ref, shallowRef, watch, onUnmounted } from "#imports";
import { useGeolocationStore } from "~/stores/geolocationStore";
import { useRouteStore } from "~/stores/routeStore";
import BaseMap from "~/components/base/BaseMap.vue";
import { useMapboxDirections } from "~/composables/useMapboxDirections";

const WAYPOINTS_MAX_COUNT = 25;

const routeStore = useRouteStore();
const geolocationStore = useGeolocationStore();

const selectedInitialArea = defineModel("selectedArea", {});

const baseMapRef = ref<InstanceType<typeof BaseMap> | null>(null);
const mapInstance = shallowRef<mapboxgl.Map | null>(null);

// Initialize composables with route creation configuration
const { 
  initializeDirections, 
  clearDirections,
  cleanup,
  setRoute,
  isInitialized
} = useMapboxDirections(mapInstance, {
  enableBounds: true,
  interactive: false,
});

const { 
  addMarker, 
  addHighPlacesToMap, 
  addWaypointMarkers, 
  clearAllMarkers 
} = useMarkers(mapInstance);

const handleMapInitialized = (map: mapboxgl.Map) => {
  mapInstance.value = map;
};

const selectPoint = (e: mapboxgl.MapMouseEvent) => {
  selectedInitialArea.value = { lng: e.lngLat.lng, lat: e.lngLat.lat };
  addMarker(e.lngLat.lat, e.lngLat.lng);
};

const limitWaypoints = (
  coordinates: [number, number][],
): [number, number][] => {
  return coordinates.slice(0, WAYPOINTS_MAX_COUNT);
};

// Cleanup on component unmount
onUnmounted(() => {
  cleanup();
  clearAllMarkers();
});

watch(
  () => routeStore.routeSuggestion?.coordinates,
  async (newCoords) => {
    if (!newCoords?.length || !mapInstance.value) return;

    const directions = await initializeDirections();
    if (!directions) return;

    // Clear previous routes and markers
    clearDirections();
    clearAllMarkers();

    const trimmedCoordinates = limitWaypoints(newCoords);

    // Set the route using directions composable
    const routeSet = setRoute(trimmedCoordinates);
    
    if (routeSet) {
      // Add high places markers
      const highPlaces = routeStore.routeSuggestion?.high_places;
      if (highPlaces?.length) {
        addHighPlacesToMap(highPlaces);
      }
      
      // Add waypoint markers
      addWaypointMarkers(trimmedCoordinates);
    }
  },
  { flush: 'post' }
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
