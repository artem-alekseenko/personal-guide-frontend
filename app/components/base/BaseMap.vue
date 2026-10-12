<template>
  <div class="base-map" :style="MAP_APPEARANCE_VARS[mapTheme]">
    <div class="base-map__viewport">
      <div
        ref="mapContainerRef"
        class="base-map__canvas"
        :data-pg-map-theme="mapTheme"
      ></div>
      <div
        class="base-map__controls"
        role="group"
        :aria-label="$t('components.map.controls')"
      >
        <button
          v-if="showUserLocation"
          type="button"
          class="base-map__control"
          :disabled="
            !mapReady ||
            !geolocationStore.coordinates ||
            !!geolocationStore.error
          "
          :aria-pressed="following"
          :aria-label="
            $t(
              following
                ? 'components.map.stopFollowing'
                : 'components.map.followLocation',
            )
          "
          @click="toggleFollowing"
        >
          {{
            $t(
              following
                ? "components.map.stopFollowingShort"
                : "components.map.followShort",
            )
          }}
        </button>
        <button
          v-if="routeCoordinates && routeCoordinates.length > 1"
          type="button"
          class="base-map__control"
          :disabled="!mapReady"
          @click="showWholeRoute"
        >
          {{ $t("components.map.wholeRoute") }}
        </button>
        <button
          type="button"
          class="base-map__control"
          :disabled="!mapReady"
          :aria-pressed="exploring"
          @click="toggleExploration"
        >
          {{
            $t(
              exploring
                ? "components.map.flatView"
                : "components.map.explore3d",
            )
          }}
        </button>
      </div>
      <p v-if="mapError" role="alert" class="base-map__error">
        {{ $t("components.map.unavailable") }}
      </p>
    </div>
    <slot />
  </div>
</template>

<script lang="ts" setup>
import mapboxgl from "mapbox-gl";
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from "vue";
import { usePreferredReducedMotion } from "@vueuse/core";
import { useGeolocationStore } from "~/stores/geolocationStore";
import { useLogger } from "~/composables/utils/useLogger";
import { createPositionMarker } from "~/utils/positionMarker";
import { MAP_APPEARANCE_VARS, standardMapConfig } from "~/utils/mapAppearance";
import type { MapTheme } from "~/utils/mapAppearance";
import { fitMapRoute } from "~/utils/storedRoute";

const props = defineProps<{
  initialCenter?: [number, number];
  initialZoom?: number;
  initialBearing?: number;
  initialPitch?: number;
  showUserLocation?: boolean;
  onMapClick?: (e: mapboxgl.MapMouseEvent) => void;
  routeCoordinates?: readonly (readonly [number, number])[];
}>();

const emit = defineEmits<{
  (e: "map-initialized", map: mapboxgl.Map): void;
}>();

const MAP_PITCH = 0;
const DEFAULT_ZOOM = 16;
const DEFAULT_BEARING = 0;
const DEFAULT_CENTER: [number, number] = [-79.3832, 43.6532];

const { public: publicConfig } = useRuntimeConfig();
mapboxgl.accessToken = publicConfig.mapboxGlAccessToken;

const geolocationStore = useGeolocationStore();
const logger = useLogger();
const { t } = useI18n();
const colorMode = useColorMode();
const reducedMotion = usePreferredReducedMotion();
const mapTheme = computed<MapTheme>(() =>
  colorMode.value === "dark" ? "dark" : "light",
);
const exploring = shallowRef(false);
const mapReady = shallowRef(false);
let appearancePending = true;

function applyAppearance() {
  if (!mapInstance || !mapInstance.isStyleLoaded()) return;
  mapInstance.getContainer().dataset.pgMapTheme = mapTheme.value;
  for (const [key, value] of Object.entries(
    standardMapConfig(mapTheme.value, exploring.value),
  )) {
    if (mapInstance.getConfigProperty("basemap", key) !== value)
      mapInstance.setConfigProperty("basemap", key, value);
  }
  appearancePending = false;
  mapInstance.fire("pg:appearance");
}
watch(
  [mapTheme, exploring],
  () => {
    appearancePending = true;
    applyAppearance();
  },
  { flush: "post" },
);

function showWholeRoute() {
  if (!mapInstance || !mapReady.value || !props.routeCoordinates) return;
  following.value = false;
  mapInstance.stop();
  fitMapRoute(
    mapInstance,
    props.routeCoordinates,
    reducedMotion.value === "reduce" ? 0 : 400,
  );
}
function toggleExploration() {
  if (!mapInstance || !mapReady.value) return;
  exploring.value = !exploring.value;
  mapInstance.stop();
  mapInstance.easeTo({
    pitch: exploring.value ? 40 : 0,
    duration: reducedMotion.value === "reduce" ? 0 : 400,
  });
}
const mapContainerRef = ref<HTMLElement | null>(null);
let mapInstance: mapboxgl.Map | null = null;
let userMarker: mapboxgl.Marker | null = null;
const following = ref(false);
const mapError = ref(false);
const followLocation = () => {
  if (
    mapInstance &&
    props.showUserLocation &&
    following.value &&
    geolocationStore.coordinates &&
    !geolocationStore.error
  ) {
    mapInstance.flyTo({
      center: geolocationStore.coordinates,
      duration: reducedMotion.value === "reduce" ? 0 : 500,
    });
  }
};
const toggleFollowing = () => {
  following.value = !following.value;
  followLocation();
};

const addUserMarker = (lat: number, lng: number) => {
  logger.log("Adding user marker at:", lat, lng);
  if (!mapInstance) return;

  // Prevent unnecessary re-renders: check if coordinates changed
  if (userMarker?.getLngLat().lat === lat && userMarker.getLngLat().lng === lng)
    return;

  const coordinates: [number, number] = [lng, lat];
  if (userMarker) {
    userMarker.setLngLat(coordinates);
    return;
  }

  // Create a custom marker element
  const el = createPositionMarker("gps", t("components.map.yourLocation"));

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

  // Render immediately; denied GPS must still allow manual map use.
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
      zoom: props.initialZoom ?? DEFAULT_ZOOM,
      bearing: props.initialBearing ?? DEFAULT_BEARING,
      pitch: props.initialPitch ?? MAP_PITCH,
      config: { basemap: standardMapConfig(mapTheme.value, false) },
      pitchWithRotate: false,
      touchPitch: false,
    });

    mapInstance.on("style.load", () => {
      mapReady.value = true;
      appearancePending = true;
      applyAppearance();
    });
    mapInstance.on("idle", () => {
      if (appearancePending) applyAppearance();
    });

    mapInstance.on("load", () => {
      logger.log("Map loaded successfully");
    });

    mapInstance.on("error", (e) => {
      mapError.value = true;
      logger.error("Map error:", e);
    });

    mapInstance.on("movestart", (event) => {
      if (event.originalEvent) following.value = false;
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

          followLocation();
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
          following.value = false;
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
    mapError.value = true;
    logger.error("Failed to initialize map:", error);
  }
};

// Cleanup on component unmount
onUnmounted(() => {
  logger.log("Component unmounting, cleaning up map...");
  if (mapInstance) {
    mapReady.value = false;
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
  getMap: () => mapInstance,
  addUserMarker,
});
</script>

<style>
.base-map {
  position: relative;
  inline-size: 100%;
  overflow: hidden;
  border-radius: 1rem;
  border: 1px solid var(--pg-map-border);
  background: var(--pg-map-surface);
  color: var(--pg-map-text);
}
.base-map__viewport {
  position: relative;
}
.base-map__canvas {
  inline-size: 100%;
  block-size: clamp(16rem, 42dvh, 25rem);
}
.base-map__controls {
  position: absolute;
  inset-block-start: max(0.75rem, env(safe-area-inset-top));
  inset-inline: 0.75rem;
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: 0.375rem;
  z-index: 2;
}
.base-map__control {
  min-inline-size: 0;
  min-block-size: 2.75rem;
  padding: 0.5rem;
  border: 1px solid var(--pg-map-border);
  border-radius: 0.75rem;
  background: var(--pg-map-surface);
  color: var(--pg-map-text);
  box-shadow: 0 2px 8px var(--pg-map-shadow);
  font:
    600 0.75rem/1.35 Inter,
    system-ui,
    sans-serif;
  text-wrap: balance;
  cursor: pointer;
  touch-action: manipulation;
  transition:
    border-color 150ms,
    box-shadow 150ms;
}
.base-map__control:hover:not(:disabled),
.base-map__control[aria-pressed="true"] {
  border-color: var(--pg-map-route);
  box-shadow: 0 0 0 1px var(--pg-map-route);
}
.base-map__control:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
.base-map__control:focus-visible {
  outline: 3px solid var(--pg-map-route);
  outline-offset: 2px;
}
@media (prefers-reduced-motion: reduce) {
  .base-map__control {
    transition: none;
  }
}
.base-map__error {
  position: absolute;
  inset-inline: 0.75rem;
  inset-block-end: 0.75rem;
  padding: 0.75rem;
  border-radius: 0.5rem;
  background: var(--pg-map-surface);
  color: var(--pg-map-text);
}
</style>
