<template>
  <div ref="mapContainerRef" class="h-[60vh] w-full"></div>
</template>

<script lang="ts" setup>
import mapboxgl from "mapbox-gl";
import { onMounted, onUnmounted, ref, watch, readonly } from "vue";
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
  
  // Защита от лишних перерисовок: проверяем, изменились ли координаты
  if (userMarker?.getLngLat().lat === lat && userMarker.getLngLat().lng === lng) return;
  
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
  const { zoom, bearing, pitch } = {
    bearing: props.initialBearing ?? 0,
    pitch: props.initialPitch ?? MAP_PITCH,
    zoom: props.initialZoom ?? DEFAULT_ZOOM,
  };

  // Use provided center, user coordinates, or default
  const [lng, lat] = props.initialCenter ?? coordinates ?? DEFAULT_CENTER;
  logger.log("Map center coordinates:", [lng, lat]);

  try {
    logger.log("Creating map instance...");
    mapInstance = new mapboxgl.Map({
      container: mapContainerRef.value,
      center: [lng, lat],
      style: "mapbox://styles/mapbox/standard",
      zoom,
      bearing,
      pitch,
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

    if (props.onMapClick) {
      mapInstance.on("click", props.onMapClick);
    }

    // Watch for coordinate changes and update map center and user marker
    watch(
      () => geolocationStore.coordinates,
      (newCoordinates) => {
        logger.log("Geolocation coordinates changed:", newCoordinates);
        if (newCoordinates && mapInstance) {
          const [lng, lat] = newCoordinates;
          
          // Preserve current pitch and bearing when flying to new location
          const currentPitch = mapInstance.getPitch();
          const currentBearing = mapInstance.getBearing();
          
          mapInstance.flyTo({
            center: [lng, lat],
            pitch: currentPitch,
            bearing: currentBearing,
            essential: true,
          });
          addUserMarker(lat, lng);
        }
      },
    );

    // Add initial user marker if coordinates are available
    if (coordinates) {
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
  getMap: () => mapInstance ? readonly(mapInstance) : null,
  addUserMarker,
  preserveMapSettings: () => {
    if (!mapInstance) return null;
    return {
      pitch: mapInstance.getPitch(),
      bearing: mapInstance.getBearing(),
      zoom: mapInstance.getZoom(),
    };
  },
  restoreMapSettings: (settings: { pitch?: number; bearing?: number; zoom?: number }) => {
    if (!mapInstance || !settings) return;
    const currentCenter = mapInstance.getCenter();
    mapInstance.flyTo({
      center: [currentCenter.lng, currentCenter.lat],
      pitch: settings.pitch ?? mapInstance.getPitch(),
      bearing: settings.bearing ?? mapInstance.getBearing(),
      zoom: settings.zoom ?? mapInstance.getZoom(),
      essential: true,
    });
  },
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
