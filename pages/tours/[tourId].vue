<template>
  <main
    v-if="tourStore.tour"
    class="container mx-auto flex grow flex-col gap-y-4 py-4"
  >
    <h1 class="prose px-4 text-2xl font-extrabold md:px-12">
      {{ tourStore.tour.name }}
    </h1>

    <!-- Map -->
    <div class="relative">
      <client-only>
        <BaseMap
          ref="baseMapRef"
          :show-user-location="true"
          @map-initialized="handleMapInitialized"
        />
      </client-only>
    </div>

    <!-- Play/pause/resume button -->
    <div>
      <PGButton
        :disabled="
          state === STATE.RECORD_LOADING ||
          state === STATE.RECORD_LOADING_WHEN_PAUSED ||
          state === STATE.RECORD_FINISHED
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
      :show="isShowRecordText"
      :text="tourStore.textForDisplay || ''"
      :highlightSentence="currentHighlightSentence"
      v-model:scrollToHighlightEnabled="isScrollingToHighlightTextEnabled"
    />

    <!-- Question input -->
    <div v-if="state !== STATE.INITIAL" class="mx-4">
      <UInput
        v-model="userText"
        class="w-full"
        placeholder="Enter your question..."
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
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  shallowRef,
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
import { 
  findCurrentSpokenSentence, 
  getSentenceIndex 
} from "~/utils/textUtils";
import type {
  ICoordinate,
  ICreatedTour,
  IGeoJSONFeature,
  TypeFrom,
} from "~/types";
import createPlacesMarkerElem from "~/utils/pages/createPlacesMarkerElem";
import { useGeolocationStore } from "~/stores/geolocationStore";
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

const MAP_PITCH = 45;
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
} as const;
type TState = TypeFrom<typeof STATE>;

const state = ref<TState>(STATE.INITIAL);
const userText = ref("");
const isScrollingToHighlightTextEnabled = ref(true);

const tourTextDisplayRef = ref<InstanceType<typeof TourTextDisplay> | null>(null);

const route = useRoute();
const router = useRouter();
const tourStore = useTourStore();
const geolocationStore = useGeolocationStore();
const logger = useLogger();

// Initialize text synchronization composable
const { 
  currentSpokenSentence, 
  highlightSentence, 
  updateTextForSpeech, 
  updateTextForDisplay 
} = useTourTextSync();

/* -------------------------------------------
   Map logic
------------------------------------------- */
const baseMapRef = ref<InstanceType<typeof BaseMap> | null>(null);
let mapInstance: mapboxgl.Map | null = null;
const marker = ref<mapboxgl.Marker | null>(null);
const placesMarkerElems: mapboxgl.Marker[] = [] as mapboxgl.Marker[];
const isMapFullyLoaded = ref(false);

// Initialize directions composable for tour viewing
const mapInstanceRef = shallowRef<mapboxgl.Map | null>(null);
const { initializeDirections, addRouteToMap, cleanup } = useMapboxDirections(mapInstanceRef, {
  enableBounds: true,
  interactive: false,
});

// Define marker type with event handling
type MarkerWithEvents = mapboxgl.Marker & {
  on(event: string, handler: () => void): void;
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

const isShowRecordText = computed<boolean>(() => Boolean(tourStore.textForDisplay));

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
  }
});

const handleMapInitialized = (map: mapboxgl.Map) => {
  logger.log("Map initialized");
  mapInstance = map;
  mapInstanceRef.value = map; // Sync with ref for composable

  // Set initial map settings
  mapInstance.setPitch(MAP_PITCH);
  mapInstance.setBearing(0);

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
  });

  // Add click handler for setting user marker
  mapInstance.on("click", (e) => {
    const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    addMarker(coords);
  });
};

const addMarker = (coords: [number, number]) => {
  // Remove existing marker if any
  if (marker.value) {
    marker.value.remove();
  }

  // Create new marker
  const newMarker = new mapboxgl.Marker({ draggable: true })
    .setLngLat(coords)
    .addTo(mapInstance!);

  // Add drag end handler
  (newMarker as MarkerWithEvents).on("dragend", getRecord);

  marker.value = newMarker;
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

/* -------------------------------------------
   Logic of text-to-speech
------------------------------------------- */
const { speakMessage, pauseSpeech, resumeSpeech, stopSpeech } = useTourSpeech();
const audioElement = ref<HTMLAudioElement | null>(null);
const currentAudioUrl = ref<string | null>(null);

function playAudio() {
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
      
      const progress = currentTime / totalDuration;
      const totalTextLength = tourStore.textForSpeech.length;
      
      if (totalTextLength <= 0) {
        logger.warn("Empty text for speech progress calculation");
        return;
      }
      
      const currentCharIndex = Math.floor(progress * totalTextLength);

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
  audioElement.value.play();
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

function playChunk() {
  if (!tourStore.textForSpeech.length) {
    state.value = STATE.RECORD_FINISHED;
    return;
  }

  playAudio();
  state.value = STATE.RECORD_ACTIVE;
}

function pauseTour() {
  state.value = STATE.RECORD_PAUSED;
  pauseAudio();
}

function resumeTour() {
  state.value = STATE.RECORD_ACTIVE;
  resumeAudio();
}

function forceStopPlayback() {
  stopAudio();
  state.value = STATE.RECORD_FINISHED;
}

/* -------------------------------------------
   Actions
------------------------------------------- */
async function getRecord() {
  // If no marker is set, automatically set it to user's current location or first route point
  if (!marker.value) {
    logger.log("No marker found, setting default marker position");
    
    let defaultCoords: [number, number] | null = null;
    
    // Try to use user's current location first
    if (geolocationStore.coordinates) {
      defaultCoords = geolocationStore.coordinates;
      logger.log("Using user's current location for marker:", defaultCoords);
    }
    // Fallback to first point of tour route
    else if (tourStore.tour?.route?.points && tourStore.tour.route.points.length > 0) {
      const firstPoint = tourStore.tour.route.points[0];
      if (firstPoint) {
        defaultCoords = [Number(firstPoint.lng), Number(firstPoint.lat)];
        logger.log("Using first tour route point for marker:", defaultCoords);
      }
    }
    
    if (defaultCoords) {
      addMarker(defaultCoords);
    } else {
      logger.error("Unable to set default marker position - no location data available");
      return;
    }
  }

  if (state.value === STATE.RECORD_PAUSED) {
    state.value = STATE.RECORD_LOADING_WHEN_PAUSED;
  } else {
    state.value = STATE.RECORD_LOADING;
  }
  
  const lngLat = marker.value!.getLngLat();
  const currentCoord: ICoordinate = {
    lat: String(lngLat.lat),
    lng: String(lngLat.lng),
  };
  await tourStore.fetchTourStep(currentCoord);
}

function handleTourButtonClick() {
  switch (state.value) {
    case STATE.INITIAL:
    case STATE.RECORD_FINISHED:
      getRecord();
      break;
    case STATE.RECORD_RECEIVED:
      playChunk();
      break;
    case STATE.RECORD_ACTIVE:
      pauseTour();
      break;
    case STATE.RECORD_PAUSED:
      resumeTour();
      break;
  }
}

function handleCompleteTour() {
  state.value = STATE.TOUR_FINISHED;
  tourStore.setUserText("");
  router.push({ name: "tours" });
}

async function addQuestion() {
  state.value = STATE.RECORD_PAUSED;
  pauseAudio();

  tourStore.setUserText(userText.value);
  userText.value = "";

  stopAudio();

  await getRecord();
}

/* -------------------------------------------
   Watchers
------------------------------------------- */
watch(
  () => tourStore.currentTourRecord,
  (newRecord) => {
    if (!newRecord) return;

    const isPaused = state.value === STATE.RECORD_LOADING_WHEN_PAUSED;
    state.value = isPaused ? STATE.RECORD_PAUSED : STATE.RECORD_RECEIVED;

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
  window.addEventListener("beforeunload", stopAudio);
});

onBeforeUnmount(() => {
  stopSpeech();

  // Cleanup audio URL to prevent memory leaks
  if (currentAudioUrl.value) {
    cleanupAudioUrl(currentAudioUrl.value);
    currentAudioUrl.value = null;
  }

  // Cleanup markers to prevent memory leaks
  marker.value?.remove();
  marker.value = null;
  
  // Cleanup all places markers
  placesMarkerElems.forEach((m) => m.remove());
  placesMarkerElems.length = 0;

  // Cleanup directions
  cleanup();

  window.removeEventListener("beforeunload", stopAudio);
});
</script>
