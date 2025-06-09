<template>
  <main
    v-if="tourStore.tour"
    class="container mx-auto flex grow flex-col gap-y-4 py-4"
  >
    <!-- Map -->
    <div class="relative">
      <client-only>
        <BaseMap
          ref="baseMapRef"
          :show-user-location="positionMode === 'gps'"
          @map-initialized="handleMapInitialized"
        />
      </client-only>
    </div>

    <!-- Position Mode Toggle -->
    <div class="mx-4">
      <div
        class="position-toggle-container flex items-center justify-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
      >
        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
          📍 Real Geolocation
        </span>

        <!-- USwitch toggle -->
        <USwitch v-model="isManualMode" size="lg" />

        <span class="text-sm font-medium text-gray-700 dark:text-gray-300">
          🎯 Geolocation Simulation
        </span>
      </div>

      <!-- Mode description -->
      <div class="mt-2 text-center text-xs text-gray-600 dark:text-gray-400">
        <span v-if="positionMode === 'gps'"> Using your real location </span>
        <span v-else> Click on map or drag marker to simulate position </span>
      </div>
    </div>

    <!-- Play/pause/resume button -->
    <div>
      <PGButton
        :disabled="
          state === STATE.RECORD_LOADING ||
          state === STATE.RECORD_LOADING_WHEN_PAUSED
        "
        :loading="
          state === STATE.RECORD_LOADING ||
          state === STATE.RECORD_LOADING_WHEN_PAUSED
        "
        class="mx-auto flex"
        @click="handleTourButtonClick"
      >
        {{ mainButtonText }}
      </PGButton>
    </div>

    <!-- Text block -->
    <TourTextDisplay
      ref="tourTextDisplayRef"
      v-model:scrollToHighlightEnabled="isScrollingToHighlightTextEnabled"
      :highlightSentence="currentHighlightSentence"
      :show="isShowRecordText"
      :text="tourStore.textForDisplay || ''"
    />

    <!-- Question input -->
    <div v-if="state !== STATE.INITIAL" class="mx-4">
      <input
        v-model="userText"
        class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        placeholder="Enter your question..."
        type="text"
      />
      <PGButton class="mx-auto mt-3 block" @click="addQuestion">
        Send question
      </PGButton>
    </div>

    <!-- Complete the tour button -->
    <div class="flex grow items-end">
      <PGButton
        class="prose mx-auto flex ring-green-400"
        color="neutral"
        @click="handleCompleteTour"
      >
        Complete the tour
      </PGButton>
    </div>

  </main>
</template>

<script lang="ts" setup>
definePageMeta({
  middleware: ["auth"],
});

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
import { useRoute, useRouter } from "vue-router";
import { useTourStore } from "#imports";
import { useTourSpeech } from "@/composables/useTourSpeech";
import { useMapboxDirections } from "@/composables/useMapboxDirections";
import { useTourTextSync } from "@/composables/useTourTextSync";
import { useLogger } from "@/composables/useLogger";
import {
  base64ToAudioBlob,
  cleanupAudioUrl,
  createAudioUrl,
} from "~/utils/audioUtils";
import type { ICoordinate, IGeoJSONFeature, TypeFrom } from "~/types";
import createPlacesMarkerElem from "~/utils/pages/createPlacesMarkerElem";
import { useGeolocationStore } from "~/stores/geolocationStore";
import { usePositionMode } from "~/composables/usePositionMode";
import BaseMap from "~/components/base/BaseMap.vue";
import TourTextDisplay from "~/components/tour/TourTextDisplay.vue";

useHead({
  link: [
    {
      rel: "stylesheet",
      href: "https://api.mapbox.com/mapbox-gl-js/v3.12.0/mapbox-gl.css",
      type: "text/css",
    },
    {
      rel: "stylesheet",
      href: "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-directions/v4.3.1/mapbox-gl-directions.css",
      type: "text/css",
    },
  ],
});

const {
  map_config: { mapbox_gl_access_token },
} = useAppConfig();
mapboxgl.accessToken = mapbox_gl_access_token as string;

const STATE = {
  INITIAL: "INITIAL",
  RECORD_LOADING: "LOADING_RECORD",
  RECORD_LOADING_WHEN_PAUSED: "LOADING_RECORD_WHEN_PAUSED",
  RECORD_RECEIVED: "RECORD_RECEIVED",
  RECORD_ACTIVE: "RECORD_ACTIVE",
  RECORD_PAUSED: "RECORD_PAUSED",
  RECORD_FINISHED: "RECORD_FINISHED",
  TOUR_FINISHED: "TOUR_FINISHED",
  ERROR: "ERROR",
} as const;
type TState = TypeFrom<typeof STATE>;

const userText = ref("");
const isScrollingToHighlightTextEnabled = ref(true);

// Position mode state with persistence
const { positionMode, isManualMode } = usePositionMode();

// Watch for position mode changes and manage markers
watch(positionMode, (newMode, oldMode) => {
  logger.log(`Position mode changed from ${oldMode} to: ${newMode}`);

  if (!mapInstance) {
    logger.warn("Map not yet initialized, marker update skipped");
    return;
  }

  if (newMode === "manual") {
    // Switching to simulation mode
    logger.log("Switching to simulation mode");

    // Add simulation marker at current GPS position if available
    if (geolocationStore.coordinates) {
      const coords = geolocationStore.coordinates;
      logger.log(
        "Using GPS coordinates for simulation marker:",
        coords,
        "(lng, lat)",
      );
      addSimulationMarker(coords);

      // Center map on the marker position
      mapInstance.flyTo({
        center: coords,
        duration: 1000,
      });
    } else {
      // Fallback to center of map or default coordinates
      const center = mapInstance.getCenter();
      const fallbackCoords: [number, number] = [center.lng, center.lat];
      logger.log(
        "Using map center for simulation marker:",
        fallbackCoords,
        "(lng, lat)",
      );
      addSimulationMarker(fallbackCoords);
    }
  } else if (newMode === "gps") {
    // Switching to GPS mode
    logger.log("Switching to GPS mode - removing simulation marker");

    // Remove simulation marker
    if (simulationMarker.value) {
      simulationMarker.value.remove();
      simulationMarker.value = null;
    }
  }
});

const tourTextDisplayRef = ref<InstanceType<typeof TourTextDisplay> | null>(
  null,
);

const route = useRoute();
const router = useRouter();
const tourStore = useTourStore();
const geolocationStore = useGeolocationStore();
const logger = useLogger();

// Use persistent tour state (after route is available)
const tourId = route.params.tourId as string;
const { state, setState, clearSavedState, shouldRestoreState, getSavedAudioPosition } = useTourState(tourId);

// Audio resume constants
const AUDIO_REWIND_SECONDS = 5; // Seconds to rewind when resuming
const AUDIO_SYNC_DELAY_SECONDS = 2; // Delay to compensate for text highlighting being ahead

// Initialize text synchronization composable
const { currentSpokenSentence, highlightSentence } = useTourTextSync();

/* -------------------------------------------
   Map logic
------------------------------------------- */
const baseMapRef = ref<InstanceType<typeof BaseMap> | null>(null);
let mapInstance: mapboxgl.Map | null = null;
const simulationMarker = ref<mapboxgl.Marker | null>(null); // Marker for position simulation mode
const placesMarkerElems: mapboxgl.Marker[] = [] as mapboxgl.Marker[];
const isMapFullyLoaded = ref(false);

// Initialize directions composable for tour viewing
const mapInstanceRef = shallowRef<mapboxgl.Map | null>(null);
const { initializeDirections, addRouteToMap, cleanup } = useMapboxDirections(
  mapInstanceRef,
  {
    enableBounds: true,
    interactive: false,
  },
);

// Define marker type with event handling
type MarkerWithEvents = mapboxgl.Marker & {
  on(event: string, handler: () => void): void;
};

// Helper function to get current coordinates based on position mode
const getCurrentCoordinates = (): [number, number] | null => {
  if (positionMode.value === "gps") {
    // Use real geolocation
    if (geolocationStore.coordinates) {
      return geolocationStore.coordinates;
    }
    logger.warn("GPS coordinates not available");
    return null;
  } else {
    // Use simulation marker coordinates
    if (simulationMarker.value) {
      const lngLat = simulationMarker.value.getLngLat();
      return [lngLat.lng, lngLat.lat];
    }
    logger.warn("Simulation marker not set");
    return null;
  }
};

// Helper function to add route with intelligent retry logic
function tryAddRouteWithCheck(retries = 5, delay = 100) {
  if (!mapInstance || !tourStore.tour || !isMapFullyLoaded.value) {
    logger.warn("Prerequisites not met for route addition");
    return;
  }

  let attempts = retries;
  const interval = setInterval(() => {
    if (mapInstance && tourStore.tour && isMapFullyLoaded.value) {
      logger.log(`Adding route, attempt ${retries - attempts + 1}`);
      addRouteToMap(tourStore.tour, isMapFullyLoaded);
      clearInterval(interval);
    } else if (--attempts <= 0) {
      clearInterval(interval);
      logger.warn("Unable to add route after multiple attempts");
    }
  }, delay);
}

// Backward compatibility - simple version for quick calls
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
      return "Start tour";
    case STATE.RECORD_LOADING:
    case STATE.RECORD_LOADING_WHEN_PAUSED:
      return "Loading...";
    case STATE.RECORD_RECEIVED:
      return "Play";
    case STATE.RECORD_ACTIVE:
      return "Pause";
    case STATE.RECORD_PAUSED:
      return "Resume";
    case STATE.RECORD_FINISHED:
      return "Go to next point";
    case STATE.ERROR:
      return "Try Again";
  }
});

const handleMapInitialized = (map: mapboxgl.Map) => {
  logger.log("Map initialized");
  mapInstance = map;
  mapInstanceRef.value = map; // Sync with ref for composable

  // Wait for map to be fully loaded before adding route
  mapInstance.on("load", () => {
    logger.log("Map fully loaded, ready for route");
    isMapFullyLoaded.value = true;

    // Initialize directions after map is loaded
    try {
      initializeDirections();

      // Add route if tour data is available
      if (tourStore.tour) {
        logger.log("Adding route after map load");
        tryAddRouteWithCheck(); // Use smart retry logic for initial load
      }
    } catch (error) {
      logger.error("Failed to initialize directions:", error);
    }

    // Check if simulation mode is already active and create marker if needed
    if (positionMode.value === "manual" && geolocationStore.coordinates) {
      logger.log("Map loaded - simulation mode already active, creating marker at GPS position");
      addSimulationMarker(geolocationStore.coordinates);
    }
  });

  // Add click handler for setting simulation marker (only in simulation mode)
  mapInstance.on("click", (e) => {
    if (positionMode.value === "manual") {
      const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
      addSimulationMarker(coords);
    }
  });
};

const addSimulationMarker = (coords: [number, number]) => {
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

  // Remove existing simulation marker if any
  if (simulationMarker.value) {
    logger.log("Removing existing simulation marker");
    simulationMarker.value.remove();
    simulationMarker.value = null;
  }

  // Create simulation marker using same approach as in useMarkers (standard SVG teardrop)
  logger.log("Creating standard Mapbox marker (SVG teardrop)");

  try {
    const newMarker = new mapboxgl.Marker({
      draggable: true,
    })
      .setLngLat(coords)
      .addTo(mapInstance);

    // Add drag end handler
    (newMarker as MarkerWithEvents).on("dragend", () => {
      logger.log("Simulation marker dragged to new position");
      // Auto-fetch new record when marker position changes
      if (
        state.value !== STATE.RECORD_LOADING &&
        state.value !== STATE.RECORD_LOADING_WHEN_PAUSED
      ) {
        getRecord();
      }
    });

    simulationMarker.value = newMarker;
    logger.log("Simulation marker successfully added to map at:", coords);

    // Verify marker is actually on the map
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

const addMarkerElemToMap = (
  markerElem: HTMLElement,
  feature: IGeoJSONFeature,
): mapboxgl.Marker | undefined => {
  if (!mapInstance) return;

  const popupHTML = `<h3>${feature.properties.title}</h3><p>Description here!</p>`;
  const marker = new mapboxgl.Marker(markerElem)
    .setLngLat(feature.geometry.coordinates)
    .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupHTML))
    .addTo(mapInstance);

  return marker as mapboxgl.Marker;
};

const addPlaces = () => {
  if (!mapInstance || !tourStore.currentPlacesGeoJSON?.features) return;

  for (const feature of tourStore.currentPlacesGeoJSON.features) {
    const markerElem = createPlacesMarkerElem();
    const addedMarker = addMarkerElemToMap(markerElem, feature);
    if (addedMarker) {
      placesMarkerElems.push(addedMarker);
    }
  }
};

const removePlaces = () => {
  placesMarkerElems.forEach((m) => m.remove());
};

// Watch for position mode changes
watch(positionMode, (newMode, oldMode) => {
  logger.log(`Position mode changed from ${oldMode} to ${newMode}`);

  if (newMode === "manual") {
    // Switching to simulation mode
    if (!simulationMarker.value && geolocationStore.coordinates) {
      // Create simulation marker at current real GPS position
      logger.log("Creating simulation marker at real GPS position");
      addSimulationMarker(geolocationStore.coordinates);
    }
  } else {
    // Switching to real geolocation mode
    if (simulationMarker.value) {
      // Remove simulation marker
      logger.log("Removing simulation marker");
      simulationMarker.value.remove();
      simulationMarker.value = null;
    }
  }
});

/* -------------------------------------------
   Logic of text-to-speech
------------------------------------------- */
const { speakMessage, pauseSpeech, resumeSpeech, stopSpeech } = useTourSpeech();
const audioElement = ref<HTMLAudioElement | null>(null);
const currentAudioUrl = ref<string | null>(null);

function playAudio(startFromPosition?: number) {
  if (!tourStore.currentTourRecord) return;

  const audioData = tourStore.currentTourRecord.audio_data;

  if (!audioData) return;

  if (!audioElement.value) {
    audioElement.value = new Audio();

    // Add event listener for timeupdate
    audioElement.value.addEventListener("timeupdate", () => {
      if (!audioElement.value) return;

      // Calculate current character index based on audio progress
      const totalDuration = audioElement.value.duration;
      const currentTime = audioElement.value.currentTime;

      if (!totalDuration || totalDuration <= 0) {
        logger.warn("Invalid audio duration for progress calculation");
        return;
      }

      // Apply sync delay to compensate for text highlighting being ahead
      const adjustedTime = Math.max(0, currentTime - AUDIO_SYNC_DELAY_SECONDS);
      const progress = adjustedTime / totalDuration;
      
      // Clean text from HTML tags, paragraph markers, and normalize whitespace for accurate character counting
      const cleanText = tourStore.textForSpeech
        .replace(/<[^>]*>/g, '') // Remove HTML tags
        .replace(/\n\n/g, ' ') // Replace paragraph breaks with single space
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      const totalTextLength = cleanText.length;

      if (totalTextLength <= 0) {
        logger.warn("Empty text for speech progress calculation");
        return;
      }

      const currentCharIndex = Math.floor(progress * totalTextLength);

      // Debug logging for sync analysis
      if (Math.floor(currentTime) % 5 === 0 && currentTime % 1 < 0.1) { // Log every 5 seconds
        logger.log(`Sync Debug: Time=${currentTime.toFixed(1)}s/${totalDuration.toFixed(1)}s (${(progress*100).toFixed(1)}%), CharIndex=${currentCharIndex}/${totalTextLength}, AdjustedTime=${adjustedTime.toFixed(1)}s, Text="${cleanText.substring(currentCharIndex-10, currentCharIndex+10)}"`);
      }

      // Create a temporary utterance to pass to highlightSentence
      const utterance = new SpeechSynthesisUtterance(tourStore.textForSpeech);
      highlightSentence(currentCharIndex, utterance);
    });
  }

  // Convert base64 to blob using utility
  const blob = base64ToAudioBlob(audioData);
  const audioUrl = createAudioUrl(blob, currentAudioUrl.value ?? undefined);

  currentAudioUrl.value = audioUrl;
  audioElement.value.src = audioUrl;

  // If we need to start from a specific position, wait for audio to load
  if (startFromPosition !== undefined) {
    const setPositionAndPlay = () => {
      if (audioElement.value) {
        audioElement.value.currentTime = startFromPosition;
        audioElement.value.play();
      }
    };

    // Use loadeddata event for more reliable position setting
    audioElement.value.addEventListener('loadeddata', setPositionAndPlay, { once: true });
    
    // Fallback timeout in case event doesn't fire
    setTimeout(() => {
      if (audioElement.value && audioElement.value.currentTime === 0) {
        setPositionAndPlay();
      }
    }, 200);
    
    // Start loading the audio
    audioElement.value.load();
  } else {
    // Normal playback from the beginning
    audioElement.value.play();
  }
}

function pauseAudio() {
  if (audioElement.value) {
    audioElement.value.pause();
  }
}

function resumeAudio() {
  if (audioElement.value) {
    audioElement.value.play();
  }
}

function stopAudio() {
  if (audioElement.value) {
    audioElement.value.pause();
    audioElement.value.currentTime = 0;
  }
}

function canResumeAudio(): boolean {
  // Check if audio element exists and has valid source
  return !!(
    audioElement.value && 
    audioElement.value.src && 
    audioElement.value.readyState >= 2 // HAVE_CURRENT_DATA or higher
  );
}

function resumeAudioFromSavedPosition() {
  if (!audioElement.value) return;
  
  const savedPosition = getSavedAudioPosition();
  
  if (savedPosition !== null) {
    // Calculate rewind position (but don't go below 0)
    const rewindPosition = Math.max(0, savedPosition - AUDIO_REWIND_SECONDS);
    audioElement.value.currentTime = rewindPosition;
  }
  
  audioElement.value.play();
}

function playChunk() {
  if (!tourStore.textForSpeech.length) {
    setState(STATE.RECORD_FINISHED);
    return;
  }

  playAudio();
  setState(STATE.RECORD_ACTIVE);
}

function playChunkFromSavedPosition() {
  if (!tourStore.textForSpeech.length) {
    setState(STATE.RECORD_FINISHED);
    return;
  }

  // Get saved position and calculate rewind position
  const savedPosition = getSavedAudioPosition();
  if (savedPosition !== null) {
    const rewindPosition = Math.max(0, savedPosition - AUDIO_REWIND_SECONDS);
    
    // Use the enhanced playAudio with position
    playAudio(rewindPosition);
  } else {
    // No saved position, play normally
    playAudio();
  }
  
  setState(STATE.RECORD_ACTIVE);
}

function pauseTour() {
  // Save current audio position before pausing
  const currentPosition = audioElement.value?.currentTime ?? 0;
  setState(STATE.RECORD_PAUSED, undefined, currentPosition);
  pauseAudio();
}

function resumeTour() {
  setState(STATE.RECORD_ACTIVE);
  resumeAudioFromSavedPosition();
}

function forceStopPlayback() {
  stopAudio();
  setState(STATE.RECORD_FINISHED);
}

/* -------------------------------------------
   Actions
------------------------------------------- */
async function getRecord() {
  let coords = getCurrentCoordinates();

  if (!coords) {
    logger.warn(
      "No coordinates available for current position mode, trying fallback",
    );

    // Fallback: try to set default coordinates
    let fallbackCoords: [number, number] | null = null;

    if (positionMode.value === "gps" && geolocationStore.coordinates) {
      fallbackCoords = geolocationStore.coordinates;
      logger.log("Using geolocation fallback coordinates:", fallbackCoords);
    } else if (
      tourStore.tour?.route?.points &&
      tourStore.tour.route.points.length > 0
    ) {
      const firstPoint = tourStore.tour.route.points[0];
      if (firstPoint) {
        fallbackCoords = [Number(firstPoint.lng), Number(firstPoint.lat)];
        logger.log("Using tour route fallback coordinates:", fallbackCoords);
      }
    }

    if (fallbackCoords) {
      if (positionMode.value === "manual") {
        addSimulationMarker(fallbackCoords);
        // After creating simulation marker, get its coordinates
        coords = getCurrentCoordinates();
      } else {
        // For GPS mode, use the fallback coordinates directly
        coords = fallbackCoords;
      }
    } else {
      logger.error("No fallback coordinates available");
      return;
    }
  }

  if (!coords) {
    logger.error("Still unable to get coordinates after fallback");
    return;
  }

  if (state.value === STATE.RECORD_PAUSED) {
    setState(STATE.RECORD_LOADING_WHEN_PAUSED);
  } else {
    setState(STATE.RECORD_LOADING);
  }

  const currentCoord: ICoordinate = {
    lat: String(coords[1]),
    lng: String(coords[0]),
  };

  logger.log(
    `Getting record for ${positionMode.value} position:`,
    currentCoord,
  );

  try {
    await tourStore.fetchTourStep(currentCoord);
  } catch (error) {
    // Error is already handled in tourStore, just set the ERROR state
    setState(STATE.ERROR);
    logger.error("Tour step fetch failed, state set to ERROR");
  }
}

function handleTourButtonClick() {
  switch (state.value) {
    case STATE.INITIAL:
    case STATE.RECORD_FINISHED:
    case STATE.ERROR:
      getRecord();
      break;
    case STATE.RECORD_RECEIVED:
      playChunk();
      break;
    case STATE.RECORD_ACTIVE:
      pauseTour();
      break;
    case STATE.RECORD_PAUSED:
      // Check if audio is available to resume, otherwise start fresh
      if (tourStore.textForSpeech?.length && canResumeAudio()) {
        resumeTour();
      } else {
        // Audio not available, but we might have saved position
        // Start fresh but set position after audio loads
        playChunkFromSavedPosition();
      }
      break;
  }
}

function handleCompleteTour() {
  setState(STATE.TOUR_FINISHED);
  clearSavedState(); // Clear saved state when tour is completed
  tourStore.setUserText("");
  router.push({ name: "tours" });
}

async function addQuestion() {
  // Save current audio position before pausing
  const currentPosition = audioElement.value?.currentTime ?? 0;
  setState(STATE.RECORD_PAUSED, undefined, currentPosition);
  pauseAudio();

  tourStore.setUserText(userText.value);
  userText.value = "";

  stopAudio();

  try {
    await getRecord();
  } catch (error) {
    // Error handling is already done in getRecord
    logger.error("Failed to add question:", error);
  }
}



/* -------------------------------------------
   Watchers
------------------------------------------- */
watch(
  () => tourStore.currentTourRecord,
  (newRecord) => {
    if (!newRecord) return;

    const isPaused = state.value === STATE.RECORD_LOADING_WHEN_PAUSED;
    setState(isPaused ? STATE.RECORD_PAUSED : STATE.RECORD_RECEIVED);

    removePlaces();
    addPlaces();

    if (!isPaused) playChunk();
  },
);

// Watch for tour data changes and add route when both map and tour are ready
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
  await tourStore.fetchGetTour(route.params.tourId as string);
  logger.log("Tour fetched:", tourStore.tour);
  
  // Check if we should restore the tour state after fetching tour data
  if (shouldRestoreState.value && tourStore.textForDisplay) {
    logger.log("Restoring tour state:", state.value);
    // The state is already restored from localStorage in the composable
    // We just need to ensure the UI reflects the current state
  }
  
  window.addEventListener("beforeunload", stopAudio);
});

onBeforeUnmount(() => {
  stopSpeech();

  // Cleanup audio URL to prevent memory leaks
  if (currentAudioUrl.value) {
    cleanupAudioUrl(currentAudioUrl.value);
    currentAudioUrl.value = null;
  }

  // Cleanup simulation marker to prevent memory leaks
  simulationMarker.value?.remove();
  simulationMarker.value = null;

  // Cleanup all places markers
  placesMarkerElems.forEach((m) => m.remove());
  placesMarkerElems.length = 0;

  // Cleanup directions
  cleanup();

  window.removeEventListener("beforeunload", stopAudio);
});
</script>

<style scoped>
/* Simulation marker - exactly same style as user marker */
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

/* Position mode toggle animations */
.position-toggle-container {
  transition: all 0.3s ease;
}

.position-mode-label {
  transition: all 0.2s ease;
}
</style>
