<template>
  <div
    v-if="tourLoading"
    role="status"
    class="w-full p-6 text-center"
    aria-busy="true"
  >
    {{ $t("common.loading") }}
  </div>
  <div
    v-else-if="tourLoadFailed"
    role="alert"
    class="grid w-full gap-3 p-6 text-center"
  >
    <p>{{ $t("common.loadFailed") }}</p>
    <PGButton @click="loadTour">{{ $t("buttons.tryAgain") }}</PGButton>
    <NuxtLink to="/tours" class="underline">{{
      $t("navigation.backToTours")
    }}</NuxtLink>
  </div>
  <div
    v-else-if="tourStore.tour"
    class="container mx-auto flex grow flex-col gap-y-4 py-4"
  >
    <!-- Map -->
    <div class="relative mx-4">
      <client-only>
        <BaseMap
          ref="baseMapRef"
          :show-user-location="positionMode === 'gps'"
          :initial-pitch="0"
          @map-initialized="handleMapInitialized"
        />
      </client-only>
      <div
        class="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-neutral-600 dark:text-neutral-300"
        :aria-label="$t('components.map.legend')"
      >
        <span class="flex items-center gap-1.5"
          ><span
            aria-hidden="true"
            class="h-2.5 w-2.5 rounded-full bg-blue-600"
          ></span
          >{{ $t("components.map.yourLocation") }}</span
        >
        <span class="flex items-center gap-1.5"
          ><span
            aria-hidden="true"
            class="h-2.5 w-2.5 rounded bg-violet-600"
          ></span
          >{{ $t("components.map.simulatedWalker") }}</span
        >
        <span class="flex items-center gap-1.5"
          ><span
            aria-hidden="true"
            class="h-2.5 w-2.5 rounded-full bg-green-700"
          ></span
          >{{ $t("components.map.tourStops") }}</span
        >
      </div>
    </div>

    <!-- Position Mode Toggle -->
    <div class="mx-4">
      <div
        class="position-toggle-container flex items-center justify-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ $t("components.tourPage.realGeolocation") }}
        </span>

        <PGSwitch
          v-model="isManualMode"
          :label="$t('components.tourPage.geolocationSimulation')"
          size="lg"
        />

        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
          {{ $t("components.tourPage.geolocationSimulation") }}
        </span>
      </div>

      <!-- Mode description -->
      <div class="mt-2 text-center text-xs text-gray-600 dark:text-gray-400">
        <span v-if="positionMode === 'gps'">
          {{ $t("components.tourPage.usingRealLocation") }}
        </span>
        <span v-else> {{ $t("components.tourPage.clickToSimulate") }} </span>
      </div>
    </div>

    <!-- Play/pause/resume button -->
    <div
      class="sticky top-0 z-20 flex flex-wrap justify-center gap-3 bg-white px-4 py-3 dark:bg-gray-900"
    >
      <PGButton
        :disabled="
          (requests.isBusy(tourId) && state !== STATE.RECORD_ACTIVE) ||
          actions.isBusy.value ||
          state === STATE.RECORD_LOADING ||
          state === STATE.RECORD_LOADING_WHEN_PAUSED
        "
        :loading="
          (requests.isBusy(tourId) && state !== STATE.RECORD_ACTIVE) ||
          actions.isBusy.value ||
          state === STATE.RECORD_LOADING ||
          state === STATE.RECORD_LOADING_WHEN_PAUSED
        "
        @click="handleTourButtonClick"
      >
        {{ mainButtonText }}
      </PGButton>
      <PGButton
        v-if="isDevelopment"
        color="neutral"
        :disabled="
          requests.isBusy(tourId) ||
          actions.isBusy.value ||
          state === STATE.TOUR_FINISHED
        "
        @click="requestNextStep"
      >
        {{ $t("buttons.devNextStep") }}
      </PGButton>
      <PGButton
        v-if="isDevelopment"
        variant="outline"
        :disabled="!walking.moving.value && !walking.canMove.value"
        :aria-pressed="walking.moving.value"
        @click="walking.moving.value ? walking.cancel() : walking.move()"
      >
        {{
          $t(walking.moving.value ? "buttons.stopMoving" : "buttons.move300m")
        }}
      </PGButton>
      <p
        v-if="isDevelopment"
        class="basis-full text-center text-xs text-neutral-600 dark:text-neutral-300"
        role="status"
      >
        {{
          $t(
            !isManualMode
              ? "components.map.enableSimulation"
              : walking.atEnd.value
                ? "components.map.routeEnd"
                : !routeCoordinates.length
                  ? "components.map.waitForRoute"
                  : "components.map.simulationHint",
          )
        }}
      </p>
    </div>

    <TourReadingPanel
      v-if="isDevelopment"
      :text="devGuideText"
      :progress="tourProgress"
    />
    <TourProgressSummary v-else-if="tourProgress" :progress="tourProgress" />

    <CurrentStopExperience
      v-if="publicConfig.textExperienceEnabled"
      :tour-id="tourId"
      :guide-mode="tourStore.tour?.guide?.interaction_mode"
      :request-busy="actions.isBusy.value"
    />

    <!-- Text block -->
    <TourTextDisplay
      v-if="!isDevelopment"
      ref="tourTextDisplayRef"
      v-model:scrollToHighlightEnabled="isScrollingToHighlightTextEnabled"
      :highlightSentence="currentHighlightSentence"
      :show="isShowRecordText"
      :text="tourStore.textForDisplay || ''"
    />

    <!-- Question input -->
    <details
      v-if="state !== STATE.INITIAL"
      class="mx-4"
      :open="!publicConfig.textExperienceEnabled"
    >
      <summary v-if="publicConfig.textExperienceEnabled" class="mb-2">
        {{ $t("experience.audioQuestion") }}
      </summary>
      <input
        v-model="userText"
        :placeholder="$t('components.tourPage.enterQuestion')"
        class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        maxlength="4000"
        type="text"
      />
      <PGButton
        :disabled="
          requests.isBusy(tourId) || actions.isBusy.value || !userText.trim()
        "
        class="mx-auto mt-3 block"
        @click="addQuestion"
      >
        {{ $t("components.tourPage.sendQuestion") }}
      </PGButton>
    </details>

    <!-- Complete the tour button -->
    <div class="flex grow items-end">
      <PGButton
        class="prose mx-auto flex ring-green-400"
        color="neutral"
        :disabled="requests.isBusy(tourId) || actions.isBusy.value"
        @click="handleCompleteTour"
      >
        {{ $t("components.tourPage.completeTour") }}
      </PGButton>
    </div>
  </div>
</template>

<script lang="ts" setup>
definePageMeta({ key: (route) => route.fullPath });

import { useNotification } from "~/composables/ui/useNotification";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  type Ref,
  shallowRef,
  watch,
} from "vue";
import { useRoute } from "vue-router";
import { useTourStore } from "#imports";
import { useTourState } from "@/composables/tour/useTourState";
import { useMapboxDirections } from "@/composables/map/useMapboxDirections";
import { useTourTextSync } from "@/composables/tour/useTourTextSync";
import { useLogger } from "@/composables/utils/useLogger";
import { useGeolocationStore } from "~/stores/geolocationStore";
import { usePositionMode } from "~/composables/map/usePositionMode";
import { useSimulationMarker } from "~/composables/map/useSimulationMarker";
import { useTourCoordinates } from "~/composables/tour/useTourCoordinates";
import { useTourAudioPlayer } from "~/composables/tour/useTourAudioPlayer";
import { useTourActions } from "~/composables/tour/useTourActions";
import { addPlaceMarkers, removePlaceMarkers } from "~/utils/mapMarkers";
import type { TypeFrom, IGeoJSON } from "~/types";
import BaseMap from "~/components/base/BaseMap.vue";
import CurrentStopExperience from "~/components/tour/CurrentStopExperience.vue";
import { useTourRequestStore } from "~/stores/tourRequestStore";
import TourTextDisplay from "~/components/tour/TourTextDisplay.vue";
import { useTourLoader } from "~/composables/tour/useTourLoader";
import { useTourProgress } from "~/composables/tour/useTourProgress";
import { useExperienceStore } from "~/stores/experienceStore";
import { useUserStore } from "~/stores/userStore";
import TourProgressSummary from "~/components/tour/TourProgressSummary.vue";
import TourReadingPanel from "~/components/tour/TourReadingPanel.vue";
import { useRouteWalk } from "~/composables/map/useRouteWalk";
import type { MapPoint } from "#shared/utils/routeMovement";

const { public: publicConfig } = useRuntimeConfig();
const isDevelopment = import.meta.dev;
mapboxgl.accessToken = publicConfig.mapboxGlAccessToken;

/* -------------------------------------------
   Setup and initialization
------------------------------------------- */
const route = useRoute();
const tourStore = useTourStore();
const requests = useTourRequestStore();
const geolocationStore = useGeolocationStore();
const logger = useLogger();
const { t } = useI18n();

const tourId = route.params.tourId as string;
const experiences = useExperienceStore();
const users = useUserStore();
const tourProgress = useTourProgress({
  tour: computed(() => tourStore.tour),
  record: computed(() => tourStore.currentTourRecord),
  liveExperience: {
    firebaseUid: computed(() =>
      publicConfig.textExperienceEnabled ? (users.user?.uid ?? null) : null,
    ),
    viewFor: experiences.viewFor,
  },
});
let tourPageAlive = true;
const {
  loading: tourLoading,
  failed: tourLoadFailed,
  load: loadTour,
  dispose: disposeLoader,
} = useTourLoader(
  () => tourStore.fetchGetTour(tourId),
  () => tourStore.tour?.id === tourId,
);

// State management
const {
  state,
  setState,
  clearSavedState,
  shouldRestoreState,
  getSavedAudioPosition,
} = useTourState(tourId);

const { positionMode, isManualMode } = usePositionMode();

// Simulation marker (callback will be set after actions are created)
const simulationMarker = useSimulationMarker({
  label: t("components.map.simulatedWalker"),
});

// Coordinates management
const coordinates = useTourCoordinates({
  getSimulationMarkerPosition: () => simulationMarker.getMarkerPosition(),
});

// Audio player
const audioPlayer = useTourAudioPlayer({
  getSavedAudioPosition,
  onEnded: () => {
    void actions.onAudioEnded();
  },
  onError: (error) => {
    setState("ERROR");
    useNotification().showApiError(error, "Audio playback failed");
  },
});

// Tour actions
const actions = useTourActions({
  state,
  setState,
  clearSavedState,
  getSavedAudioPosition,
  audioPlayer,
  coordinates,
  simulationMarker,
});

simulationMarker.setDragEndCallback(() => {
  if (state.value === STATE.RECORD_FINISHED) {
    actions.getRecord();
  }
});

const STATE = actions.STATE;
type TState = TypeFrom<typeof STATE>;

const userText = ref("");
const isScrollingToHighlightTextEnabled = ref(true);

const { currentSpokenSentence } = useTourTextSync();

const tourTextDisplayRef = ref<InstanceType<typeof TourTextDisplay> | null>(
  null,
);

/* -------------------------------------------
   Map logic
------------------------------------------- */
const baseMapRef = ref<InstanceType<typeof BaseMap> | null>(null);
let mapInstance: mapboxgl.Map | null = null;
const placesMarkers: Ref<mapboxgl.Marker[]> = ref([]);
let stopMarkers: mapboxgl.Marker[] = [];
const isMapFullyLoaded = ref(false);

const mapInstanceRef = shallowRef<mapboxgl.Map | null>(null);
const { initializeDirections, addRouteToMap, cleanup, routeCoordinates } =
  useMapboxDirections(mapInstanceRef, {
    enableBounds: true,
    interactive: false,
  });
const walking = useRouteWalk({
  enabled: computed(
    () =>
      isDevelopment &&
      isManualMode.value &&
      isMapFullyLoaded.value &&
      state.value !== STATE.TOUR_FINISHED,
  ),
  busy: computed(() => requests.isBusy(tourId) || actions.isBusy.value),
  geometry: computed(() =>
    routeCoordinates.value.map((point) => [point[0], point[1]] as MapPoint),
  ),
  getPosition: simulationMarker.getMarkerPosition,
  setPosition: simulationMarker.addSimulationMarker,
});
simulationMarker.setMoveStartCallback(walking.reset);
simulationMarker.setMapGestureCallback(walking.cancel);
const requestNextStep = () => {
  walking.cancel();
  return actions.getRecord(true);
};
const devGuideText = computed(
  () => tourProgress.value?.latestText || tourStore.textForDisplay || "",
);
function updateStopMarkers() {
  removePlaceMarkers(stopMarkers);
  const features: IGeoJSON["features"] = (
    tourStore.tour?.route.points ?? []
  ).map((point, index) => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [Number(point.lng), Number(point.lat)],
    },
    properties: {
      title:
        point.name || t("tourProgress.stopNumber", { position: index + 1 }),
    },
  }));
  stopMarkers = addPlaceMarkers(
    mapInstance,
    { type: "FeatureCollection", features },
    true,
  );
}

let routeTimer: ReturnType<typeof setInterval> | undefined;
function tryAddRouteWithCheck(retries = 5, delay = 100) {
  if (!mapInstance || !tourStore.tour || !isMapFullyLoaded.value) {
    logger.warn("Prerequisites not met for route addition");
    return;
  }

  let attempts = retries;
  if (routeTimer) clearInterval(routeTimer);
  const interval = (routeTimer = setInterval(() => {
    if (mapInstance && tourStore.tour && isMapFullyLoaded.value) {
      logger.log(`Adding route, attempt ${retries - attempts + 1}`);
      addRouteToMap(tourStore.tour, isMapFullyLoaded);
      updateStopMarkers();
      clearInterval(interval);
    } else if (--attempts <= 0) {
      clearInterval(interval);
      logger.warn("Unable to add route after multiple attempts");
    }
  }, delay));
}

function tryAddRouteWithDelay(delay = 100) {
  tryAddRouteWithCheck(1, delay);
}

const isShowRecordText = computed<boolean>(() =>
  Boolean(tourStore.textForDisplay),
);

const currentHighlightSentence = computed(() => currentSpokenSentence.value);

const mainButtonText = computed(() => {
  switch (state.value) {
    case STATE.INITIAL:
      return t("buttons.startTour");
    case STATE.RECORD_LOADING:
    case STATE.RECORD_LOADING_WHEN_PAUSED:
      return t("common.loading");
    case STATE.RECORD_RECEIVED:
      return t("buttons.play");
    case STATE.RECORD_ACTIVE:
      return t("buttons.pause");
    case STATE.RECORD_PAUSED:
      return t("buttons.resume");
    case STATE.RECORD_FINISHED:
      return t("buttons.goToNextPoint");
    case STATE.ERROR:
      return t("buttons.tryAgain");
  }
});

const handleMapInitialized = (map: mapboxgl.Map) => {
  logger.log("Map initialized");
  mapInstance = map;
  mapInstanceRef.value = map;

  simulationMarker.initialize(map);

  mapInstance.on("load", () => {
    logger.log("Map fully loaded, ready for route");
    isMapFullyLoaded.value = true;

    try {
      initializeDirections();

      if (tourStore.tour) {
        logger.log("Adding route after map load");
        tryAddRouteWithCheck();
      }
    } catch (error) {
      logger.error("Failed to initialize directions:", error);
    }

    if (positionMode.value === "manual" && geolocationStore.coordinates) {
      logger.log(
        "Map loaded - simulation mode already active, creating marker at GPS position",
      );
      simulationMarker.addSimulationMarker(geolocationStore.coordinates);
    }
  });

  simulationMarker.setupMapClickHandler(map);
};

/* -------------------------------------------
   Speech cleanup
------------------------------------------- */

/* -------------------------------------------
   Actions (delegated to useTourActions)
------------------------------------------- */
const handleTourButtonClick = () => actions.handleTourButtonClick();
const handleCompleteTour = () => actions.handleCompleteTour();

async function addQuestion() {
  await actions.addQuestion(userText.value);
  if (state.value !== STATE.ERROR) userText.value = "";
}

/* -------------------------------------------
   Watchers
------------------------------------------- */
// Watch for position mode changes to manage simulation marker
watch(positionMode, (newMode, oldMode) => {
  logger.log(`Position mode changed from ${oldMode} to: ${newMode}`);

  if (!mapInstance) {
    logger.warn("Map not yet initialized, marker update skipped");
    return;
  }

  if (newMode === "manual") {
    logger.log("Switching to simulation mode");

    if (geolocationStore.coordinates) {
      const coords = geolocationStore.coordinates;
      logger.log(
        "Using GPS coordinates for simulation marker:",
        coords,
        "(lng, lat)",
      );
      simulationMarker.addSimulationMarker(coords);

      mapInstance.flyTo({
        center: coords,
        duration: 1000,
      });
    } else {
      const center = mapInstance.getCenter();
      const fallbackCoords: [number, number] = [center.lng, center.lat];
      logger.log(
        "Using map center for simulation marker:",
        fallbackCoords,
        "(lng, lat)",
      );
      simulationMarker.addSimulationMarker(fallbackCoords);
    }
  } else if (newMode === "gps") {
    logger.log("Switching to GPS mode - removing simulation marker");
    simulationMarker.removeSimulationMarker();
  }
});

// Watch for new tour records to update places and start playback
watch(
  () => tourStore.currentTourRecord,
  (newRecord) => {
    if (!newRecord) return;

    removePlaceMarkers(placesMarkers.value);
    placesMarkers.value = addPlaceMarkers(
      mapInstance,
      tourStore.currentPlacesGeoJSON,
    );
  },
);

watch(
  () => tourStore.tour,
  (newTour) => {
    if (newTour && isMapFullyLoaded.value && mapInstance) {
      logger.log("Tour data loaded, adding route to fully loaded map");
      tryAddRouteWithDelay();
    }
  },
);

watch(
  state,
  (newState) => {
    logger.log("State: ", newState);
  },
  { immediate: true },
);

/* -------------------------------------------
   Lifecycle hooks
------------------------------------------- */
onMounted(async () => {
  await nextTick();
  if (!route.params.tourId || typeof route.params.tourId !== "string") {
    logger.error("No tourId provided");
    return;
  }
  logger.log("Fetching tour with ID:", route.params.tourId);
  await loadTour();
  if (!tourPageAlive) return;
  logger.log("Tour loaded");

  if (shouldRestoreState.value && tourStore.textForDisplay) {
    logger.log("Restoring tour state:", state.value);
  }

  window.addEventListener("beforeunload", audioPlayer.stopAudio);
});

onBeforeUnmount(() => {
  tourPageAlive = false;
  disposeLoader();
  if (routeTimer) clearInterval(routeTimer);
  walking.cancel();
  actions.dispose();

  audioPlayer.cleanup();

  simulationMarker.cleanup();
  removePlaceMarkers(stopMarkers);
  stopMarkers = [];

  removePlaceMarkers(placesMarkers.value);
  placesMarkers.value = [];

  cleanup();

  window.removeEventListener("beforeunload", audioPlayer.stopAudio);
});
</script>

<style scoped>
.simulation-marker {
  width: 20px;
  height: 20px;
  background-color: #3b82f6;
  border-radius: 50%;
  border: 2px solid white;
  box-shadow: 0 0 0 2px #3b82f6;
  cursor: grab;
}

.simulation-marker:hover {
  transform: scale(1.1);
}

.simulation-marker:active {
  cursor: grabbing;
  transform: scale(0.95);
}

.position-toggle-container {
  transition: all 0.3s ease;
}

.position-mode-label {
  transition: all 0.2s ease;
}
</style>
