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
    class="container mx-auto flex min-w-0 grow flex-col gap-y-3 py-4"
  >
    <div v-if="tourStore.tour.research_preview" class="mx-4">
      <TourResearchPreviewWarning
        :preview="tourStore.tour.research_preview"
        :stops="tourStore.tour.route.points"
      />
    </div>
    <div v-if="showPreparationStatus" class="mx-4">
      <TourPreparationProgress
        v-if="preparationProgress"
        :progress="preparationProgress"
        :refreshing="preparationRefreshing"
        :refresh-failed="preparationRefreshFailed"
        :caption-uncertain="preparationCaptionUncertain"
        @refresh="refreshPreparation"
      />
      <template v-else>
        <p
          v-if="
            !tourStore.tour.preparation_error &&
            (preparationRefreshing || tourStore.tour.status === 'GENERATING')
          "
          role="status"
          class="border-default bg-elevated text-default flex items-center gap-2 rounded-lg border p-3 text-sm"
        >
          <span
            aria-hidden="true"
            class="border-primary/30 border-t-primary size-5 shrink-0 animate-spin rounded-full border-2 motion-reduce:animate-none"
          />
          {{ $t("preparationProgress.waitingForSnapshot") }}
        </p>
        <p
          v-if="tourStore.tour.preparation_error"
          role="alert"
          class="text-error break-words"
        >
          {{ tourStore.tour.preparation_error }}
        </p>
        <p
          v-if="preparationRefreshFailed"
          class="text-warning mt-2 text-sm"
          role="status"
        >
          {{ $t("preparationProgress.refreshFailed") }}
        </p>
      </template>
    </div>
    <!-- Map -->
    <div class="relative mx-4">
      <client-only>
        <BaseMap
          ref="baseMapRef"
          :show-user-location="positionMode === 'gps'"
          :initial-pitch="0"
          :route-coordinates="routeCoordinates"
          @map-initialized="handleMapInitialized"
        >
          <ul class="pg-map-legend" :aria-label="$t('components.map.legend')">
            <li v-if="positionMode === 'gps'" class="pg-map-legend__item">
              <span
                aria-hidden="true"
                class="pg-map-legend__swatch pg-map-legend__swatch--gps"
              ></span>
              {{ $t("components.map.yourLocation") }}
            </li>
            <li v-if="isManualMode" class="pg-map-legend__item">
              <span
                aria-hidden="true"
                class="pg-map-legend__swatch pg-map-legend__swatch--simulation"
              ></span>
              {{ $t("components.map.simulatedWalker") }}
            </li>
            <li class="pg-map-legend__item">
              <span
                aria-hidden="true"
                class="pg-map-legend__swatch pg-map-legend__swatch--stop"
              ></span>
              {{ $t("components.map.tourStops") }}
            </li>
            <li
              v-if="routePlaces.places.value.length"
              class="pg-map-legend__item"
            >
              <span
                aria-hidden="true"
                class="pg-map-legend__swatch pg-map-legend__swatch--lead"
              ></span>
              {{ $t("routePlaces.mapLabel") }}
            </li>
            <li v-if="guideObjects.length" class="pg-map-legend__item">
              <span
                aria-hidden="true"
                class="pg-map-legend__swatch pg-map-legend__swatch--discussed"
              ></span>
              {{ $t("components.map.guideDiscussing") }}
            </li>
          </ul>
          <p v-if="guideObjects.length" class="pg-map-caption">
            {{
              $t("components.map.discussedObjects", {
                names: guideObjects.map((object) => object.name).join(", "),
              })
            }}
          </p>
        </BaseMap>
      </client-only>
    </div>

    <!-- Play/pause/resume button -->
    <div
      class="bg-default sticky top-0 z-20 flex flex-wrap justify-center gap-3 px-4 py-3"
    >
      <PGButton
        :disabled="mainButtonBlocked"
        :loading="mainButtonBlocked"
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
        v-if="isDevelopment && isManualMode"
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
        v-if="isDevelopment && isManualMode"
        class="basis-full text-center text-xs text-neutral-600 dark:text-neutral-300"
        role="status"
      >
        {{
          $t(
            walking.atEnd.value
              ? "components.map.routeEnd"
              : !routeCoordinates.length
                ? "components.map.waitForRoute"
                : "components.map.simulationHint",
          )
        }}
      </p>
    </div>

    <p
      v-if="waitHint"
      class="mx-4 rounded-lg bg-neutral-100 p-3 text-sm text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
      role="status"
    >
      {{ $t(`components.tourPage.${waitHint}`) }}
    </p>

    <TourReadingPanel
      v-if="isDevelopment"
      :text="devGuideText"
      :progress="tourProgress"
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

    <CurrentStopExperience
      v-if="publicConfig.textExperienceEnabled"
      :tour-id="tourId"
      :generation-id="tourStore.tour.playback_generation_id ?? null"
      :request-busy="actions.isBusy.value"
      :before-visitor-action="() => continuation.suspend('question')"
    />

    <!-- Question input -->
    <details
      v-if="state !== STATE.INITIAL"
      class="tour-tools mx-4"
      :open="!publicConfig.textExperienceEnabled"
    >
      <summary v-if="publicConfig.textExperienceEnabled">
        {{ $t("experience.audioQuestion") }}
      </summary>
      <div class="grid gap-2 p-3">
        <label for="tour-audio-question" class="sr-only">
          {{ $t("components.tourPage.enterQuestion") }}
        </label>
        <input
          id="tour-audio-question"
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
      </div>
    </details>
    <details v-if="!isDevelopment && tourProgress" class="tour-tools mx-4">
      <summary>{{ $t("tourProgress.title") }}</summary>
      <TourProgressSummary :progress="tourProgress" class="my-3" />
    </details>

    <details v-if="!tourStore.tour.research_preview" class="tour-tools mx-4">
      <summary>{{ $t("researchControls.title") }}</summary>
      <div class="grid gap-3 px-3 py-3">
        <TourResearchControls
          :tour-id="tourId"
          :latest-generation-id="
            tourStore.tour.latest_generation_id ||
            preparationProgress?.generation_id ||
            tourStore.tour.active_generation_id
          "
          :preparation-progress="preparationProgress"
          :status="tourStore.tour.status"
          :preparation-error="tourStore.tour.preparation_error"
          @updated="routeStore.fetchListTours()"
        />
        <TourPreparationProgress
          v-if="preparationProgress && !showPreparationStatus"
          :progress="preparationProgress"
          :refreshing="preparationRefreshing"
          :refresh-failed="preparationRefreshFailed"
          :caption-uncertain="preparationCaptionUncertain"
          @refresh="refreshPreparation"
        />
      </div>
    </details>

    <details v-if="!publicConfig.textExperienceEnabled" class="tour-tools mx-4">
      <summary>{{ $t("routePlaces.title") }}</summary>
      <RoutePlacesPanel
        class="mx-3 my-3"
        :places="routePlaces.places.value"
        :discovery="routePlaces.discovery.value"
        :busy="routePlaces.busy.value"
        :failed="routePlaces.failed.value"
        :pending="routePlaces.pending.value"
        @retry="retryRoutePlaces"
        @reconcile="reconcileRoutePlaces"
      />
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
import { useRouteStore } from "~/stores/routeStore";
import { useStoryContinuation } from "~/composables/tour/useStoryContinuation";
import { usePositionMode } from "~/composables/map/usePositionMode";
import { useSimulationMarker } from "~/composables/map/useSimulationMarker";
import { useTourCoordinates } from "~/composables/tour/useTourCoordinates";
import { useTourAudioPlayer } from "~/composables/tour/useTourAudioPlayer";
import { useTourActions } from "~/composables/tour/useTourActions";
import { createGuideMapMarkers } from "~/utils/guideMapMarkers";
import type { TypeFrom } from "~/types";
import BaseMap from "~/components/base/BaseMap.vue";
import CurrentStopExperience from "~/components/tour/CurrentStopExperience.vue";
import { useTourRequestStore } from "~/stores/tourRequestStore";
import TourTextDisplay from "~/components/tour/TourTextDisplay.vue";
import { useTourLoader } from "~/composables/tour/useTourLoader";
import { useTourProgress } from "~/composables/tour/useTourProgress";
import { tourWaitHint } from "#shared/utils/tourNarration";
import { useExperienceStore } from "~/stores/experienceStore";
import { useUserStore } from "~/stores/userStore";
import TourProgressSummary from "~/components/tour/TourProgressSummary.vue";
import TourPreparationProgress from "~/components/tour/TourPreparationProgress.vue";
import TourResearchControls from "~/components/tour/TourResearchControls.vue";
import TourResearchPreviewWarning from "~/components/tour/TourResearchPreviewWarning.vue";
import { useTourPreparationProgress } from "~/composables/tour/useTourPreparationProgress";
import TourReadingPanel from "~/components/tour/TourReadingPanel.vue";
import { useRouteWalk } from "~/composables/map/useRouteWalk";
import type { MapPoint } from "#shared/utils/routeMovement";
import { isTourButtonBlocked } from "~/utils/tourControls";
import { useRoutePlaces } from "~/composables/tour/useRoutePlaces";
import RoutePlacesPanel from "~/components/tour/RoutePlacesPanel.vue";

const { public: publicConfig } = useRuntimeConfig();
const isDevelopment = import.meta.dev;
mapboxgl.accessToken = publicConfig.mapboxGlAccessToken;

/* -------------------------------------------
   Setup and initialization
------------------------------------------- */
const route = useRoute();
const tourStore = useTourStore();
const requests = useTourRequestStore();
const routeStore = useRouteStore();
const geolocationStore = useGeolocationStore();
const logger = useLogger();
const { t } = useI18n();

const tourId = route.params.tourId as string;
const experiences = useExperienceStore();
const users = useUserStore();
const {
  progress: preparationProgress,
  refreshFailed: preparationRefreshFailed,
  refreshing: preparationRefreshing,
  captionUncertain: preparationCaptionUncertain,
  refresh: refreshPreparation,
} = useTourPreparationProgress(
  computed(() => (tourStore.tour?.id === tourId ? tourStore.tour : null)),
  computed(() => users.user?.uid ?? null),
);
const showPreparationStatus = computed(
  () =>
    !tourStore.tour?.research_preview &&
    (tourStore.tour?.status === "GENERATING" ||
      !!tourStore.tour?.preparation_error ||
      preparationProgress.value?.status === "PENDING" ||
      preparationProgress.value?.status === "RUNNING"),
);
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
const guideObjects = computed(() => tourProgress.value?.guideObjects ?? []);
const routePlaces = useRoutePlaces({
  tour: computed(() => (tourStore.tour?.id === tourId ? tourStore.tour : null)),
  ownerId: computed(() => users.user?.uid ?? null),
  language: computed(() => users.userPreferences.language),
  experience: computed(() =>
    experiences.viewFor(tourId, users.user?.uid ?? ""),
  ),
});
const mapTour = computed(() => {
  const tour = tourStore.tour;
  const discovery = routePlaces.discovery.value;
  if (!tour || tour.id !== tourId) return null;
  // Use only the accepted provider corridor; do not alter stops, visits or saved geometry.
  return discovery?.geometry_provider && discovery.geometry.length >= 2
    ? {
        ...tour,
        route: {
          ...tour.route,
          geometry: discovery.geometry,
          geometry_leg_starts: discovery.geometry_leg_starts ?? [],
        },
      }
    : tour;
});
async function retryRoutePlaces() {
  try {
    await routePlaces.retry();
  } catch (error) {
    useNotification().showApiError(error, t("routePlaces.failed"));
  }
}
async function reconcileRoutePlaces() {
  try {
    await routePlaces.reconcile();
  } catch (error) {
    useNotification().showApiError(error, t("routePlaces.failed"));
  }
}
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
const waitHint = computed(() =>
  state.value === STATE.RECORD_FINISHED
    ? tourWaitHint(tourStore.currentTourRecord?.guidance)
    : null,
);

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
  completeBufferedStory: () => continuation.complete(),
  onStoryCompleted: () => continuation.afterCompletion(),
  state,
  setState,
  clearSavedState,
  getSavedAudioPosition,
  audioPlayer,
  coordinates,
  simulationMarker,
});

const continuation = useStoryContinuation({
  tourId,
  featureEnabled: publicConfig.storyBufferEnabled,
  state,
  setState,
  remainingSeconds: () => {
    const audio = audioPlayer.audioElement.value;
    return audio ? audio.duration - audio.currentTime : NaN;
  },
  play: () => actions.playChunk(),
  requestNext: () => actions.getRecord(true),
});

simulationMarker.setDragEndCallback(() => {
  if (state.value === STATE.RECORD_FINISHED) {
    void cancelContinuation("movement").then((cancelled) => {
      if (cancelled) return actions.getRecord();
    });
  }
});

const STATE = actions.STATE;
const mainButtonBlocked = computed(() =>
  isTourButtonBlocked(
    state.value,
    actions.isBusy.value,
    requests.isBusy(tourId),
  ),
);
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
const guideMapMarkers = createGuideMapMarkers();
const isMapFullyLoaded = ref(false);

const mapInstanceRef = shallowRef<mapboxgl.Map | null>(null);
const {
  initializeDirections,
  addRouteToMap,
  cleanup,
  routeCoordinates,
  routeLegStarts,
} = useMapboxDirections(mapInstanceRef, {
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
  legStarts: routeLegStarts,
  getPosition: simulationMarker.getMarkerPosition,
  setPosition: simulationMarker.addSimulationMarker,
});
simulationMarker.setMoveStartCallback(walking.reset);
simulationMarker.setMapGestureCallback(walking.cancel);
const requestNextStep = async () => {
  walking.cancel();
  if (!(await cancelContinuation("visitor_cancel"))) return;
  return actions.getRecord(true);
};
const devGuideText = computed(
  () => tourProgress.value?.latestText || tourStore.textForDisplay || "",
);

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
      if (mapTour.value) addRouteToMap(mapTour.value, isMapFullyLoaded);
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
async function cancelContinuation(
  reason: import("#shared/types/storyBuffer").CancelReason,
) {
  try {
    await continuation.suspend(reason);
    return true;
  } catch (error) {
    useNotification().showApiError(error, t("storyBuffer.uncertain"));
    return false;
  }
}
const handleTourButtonClick = async () => {
  const pausing = state.value === STATE.RECORD_ACTIVE;
  if (pausing) {
    audioPlayer.pauseAudio();
    setState(STATE.RECORD_PAUSED, undefined, audioPlayer.getCurrentPosition());
  }
  if (!(await cancelContinuation(pausing ? "pause" : "visitor_cancel"))) return;
  if (pausing) return actions.pauseTour();
  return actions.handleTourButtonClick();
};
const handleCompleteTour = async () => {
  audioPlayer.stopAudio();
  if (!(await cancelContinuation("completion"))) return;
  return actions.handleCompleteTour();
};

async function addQuestion() {
  audioPlayer.stopAudio();
  if (!(await cancelContinuation("question"))) return;
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

// Discussion markers follow the displayed guide message, including cached reloads.
watch(
  [
    mapInstanceRef,
    isMapFullyLoaded,
    () => tourStore.tour?.route.points,
    guideObjects,
    () => t("components.map.guideDiscussing"),
    routePlaces.places,
    () => t("routePlaces.mapLabel"),
  ],
  () => {
    if (!isMapFullyLoaded.value || tourStore.tour?.id !== tourId) {
      guideMapMarkers.clear();
      return;
    }
    guideMapMarkers.update(
      mapInstanceRef.value,
      (tourStore.tour?.route.points ?? []).map((point, index) => ({
        ...point,
        name:
          point.name || t("tourProgress.stopNumber", { position: index + 1 }),
      })),
      guideObjects.value,
      t("components.map.guideDiscussing"),
      routePlaces.places.value,
      t("routePlaces.mapLabel"),
    );
  },
  { immediate: true },
);

watch(mapTour, (newTour) => {
  if (newTour && isMapFullyLoaded.value && mapInstance) {
    logger.log("Tour data loaded, adding route to fully loaded map");
    tryAddRouteWithDelay();
  }
});

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
  guideMapMarkers.clear();

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

.tour-tools {
  min-width: 0;
  border: 1px solid var(--ui-border);
  border-radius: 0.75rem;
  overflow-wrap: anywhere;
}

.tour-tools > summary {
  min-height: 44px;
  padding: 0.75rem 1rem;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
}

.tour-tools > summary:hover {
  color: var(--ui-primary);
}

.tour-tools > summary:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
  border-radius: 0.75rem;
}
</style>
