<template>
  <div ref="mapContainerRef" class="h-[60vh] w-full"></div>
</template>

<script lang="ts" setup>
import mapboxgl from "mapbox-gl";
import { onMounted, onUnmounted, readonly, ref, watch } from "vue";
import { useGeolocationStore } from "~/stores/geolocationStore";
import { useLogger } from "~/composables/useLogger";

const props = defineProps<{
  initialCenter?: [number, number];
  initialZoom?: number;
  initialBearing?: number;
  initialPitch?: number;
  showUserLocation?: boolean;
  onMapClick?: (e: mapboxgl.MapMouseEvent) => void;
}>();

const emit = defineEmits<{
  (e: "map-initialized", map: mapboxgl.Map): void;
}>();

const MAP_PITCH = 45;
const DEFAULT_ZOOM = 16;
const DEFAULT_BEARING = 0;
const DEFAULT_CENTER: [number, number] = [-79.3832, 43.6532];

const { map_config } = useAppConfig();
const mapboxglAccessToken = unref(map_config.mapbox_gl_access_token);
mapboxgl.accessToken = mapboxglAccessToken;

const geolocationStore = useGeolocationStore();
const logger = useLogger();
const mapContainerRef = ref<HTMLElement | null>(null);
let mapInstance: mapboxgl.Map | null = null;
let userMarker: mapboxgl.Marker | null = null;

const addUserMarker = (lat: number, lng: number) => {
  logger.log("Adding user marker at:", lat, lng);
  if (!mapInstance) return;

  // Prevent unnecessary re-renders: check if coordinates changed
  if (userMarker?.getLngLat().lat === lat && userMarker.getLngLat().lng === lng)
    return;

  userMarker?.remove();
  const coordinates: [number, number] = [lng, lat];

  // Create a custom marker element
  const el = document.createElement("div");
  el.className = "user-marker";

  userMarker = new mapboxgl.Marker(el)
    .setLngLat(coordinates)
    .addTo(mapInstance);
};

const initializeMap = async () => {
  logger.log("Starting map initialization...");
  if (!mapContainerRef.value) {
    logger.error("Map container not found");
    return;
  }

  // Wait for geolocation to be ready
  if (!geolocationStore.isReady) {
    logger.log("Waiting for geolocation...");
    await new Promise<void>((resolve) => {
      const unwatch = watch(
        () => geolocationStore.isReady,
        (isReady) => {
          logger.log("Geolocation ready state changed:", isReady);
          if (isReady) {
            unwatch();
            resolve();
          }
        },
      );
    });
  }

  logger.log("Geolocation coordinates:", geolocationStore.coordinates);
  const coordinates = geolocationStore.coordinates;

  // Use provided center, user coordinates, or default
  const [lng, lat] = props.initialCenter ?? coordinates ?? DEFAULT_CENTER;
  logger.log("Map center coordinates:", [lng, lat]);

  try {
    logger.log("Creating map instance...");
    mapInstance = new mapboxgl.Map({
      container: mapContainerRef.value,
      center: [lng, lat],
      style: "mapbox://styles/mapbox/standard",
      zoom: DEFAULT_ZOOM,
      bearing: DEFAULT_BEARING,
      pitch: MAP_PITCH,
    });

    if (props.showUserLocation) {
      // mapInstance.addControl(
      //   new mapboxgl.GeolocateControl({
      //     positionOptions: { enableHighAccuracy: true },
      //     trackUserLocation: true,
      //     showUserHeading: true,
      //   }),
      // );
    }

    mapInstance.on("style.load", () => {
      logger.log("Map style loaded, configuring...");
      if (!mapInstance) return;
      mapInstance.setConfigProperty("basemap", "showRoadLabels", false);
      mapInstance.setConfigProperty("basemap", "showTransitLabels", false);
      mapInstance.setConfigProperty("basemap", "theme", "faded");
      mapInstance.setConfigProperty(
        "basemap",
        "showPointOfInterestLabels",
        false,
      );
      logger.log("Map configuration applied");
    });

    mapInstance.on("load", () => {
      logger.log("Map loaded successfully");
    });

    mapInstance.on("error", (e) => {
      logger.error("Map error:", e);
    });

    mapInstance.on("moveend", () => {
      if (!mapInstance) return;
      const currentPitch = mapInstance.getPitch();
      if (currentPitch !== MAP_PITCH) {
        mapInstance.easeTo({
          pitch: MAP_PITCH,
          duration: 1000,
        });
      }
    });

    if (props.onMapClick) {
      mapInstance.on("click", props.onMapClick);
    }

    // Watch for coordinate changes and update map center and user marker
    watch(
      () => geolocationStore.coordinates,
      (newCoordinates) => {
        logger.log("Geolocation coordinates changed:", newCoordinates);
        if (newCoordinates && mapInstance && props.showUserLocation) {
          const [lng, lat] = newCoordinates;

          mapInstance.flyTo({
            center: [lng, lat],
            pitch: MAP_PITCH,
            bearing: DEFAULT_BEARING,
            essential: true,
          });
          addUserMarker(lat, lng);
        }
      },
    );

    // Watch for showUserLocation prop changes
    watch(
      () => props.showUserLocation,
      (shouldShow) => {
        logger.log("showUserLocation changed:", shouldShow);
        if (!mapInstance) return;
        
        if (shouldShow) {
          // Show user marker if coordinates are available
          if (geolocationStore.coordinates) {
            const [lng, lat] = geolocationStore.coordinates;
            addUserMarker(lat, lng);
          }
        } else {
          // Hide user marker
          if (userMarker) {
            userMarker.remove();
            userMarker = null;
            logger.log("User marker removed");
          }
        }
      },
    );

    // Add initial user marker if coordinates are available and showUserLocation is true
    if (coordinates && props.showUserLocation) {
      const [lng, lat] = coordinates;
      addUserMarker(lat, lng);
    }

    emit("map-initialized", mapInstance);
    logger.log("Map initialization completed");
  } catch (error) {
    logger.error("Failed to initialize map:", error);
  }
};

// Cleanup on component unmount
onUnmounted(() => {
  logger.log("Component unmounting, cleaning up map...");
  if (mapInstance) {
    mapInstance.remove();
    mapInstance = null;
  }
  if (userMarker) {
    userMarker.remove();
    userMarker = null;
  }
});

onMounted(() => {
  logger.log("Component mounted, initializing map...");
  initializeMap();
});

// Expose map instance and user marker functions to parent components
defineExpose({
  getMap: () => (mapInstance ? readonly(mapInstance) : null),
  addUserMarker,
});
</script>

<style>
.user-marker {
  width: 20px;
  height: 20px;
  background-color: #3b82f6;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 0 0 2px #3b82f6;
}
</style>
