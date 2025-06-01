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
import MapboxDirections from "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions";

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { useTourStore } from "#imports";
import { useTourSpeech } from "@/composables/useTourSpeech";
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
const WAYPOINTS_MAX_COUNT = 25;
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
const currentSpokenSentence = ref("");
const isScrollingToHighlightTextEnabled = ref(true);

const tourTextDisplayRef = ref<InstanceType<typeof TourTextDisplay> | null>(null);

const route = useRoute();
const router = useRouter();
const tourStore = useTourStore();
const geolocationStore = useGeolocationStore();
const logger = useLogger();

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

/* -------------------------------------------
   Map logic
------------------------------------------- */
const baseMapRef = ref<InstanceType<typeof BaseMap> | null>(null);
let mapInstance: mapboxgl.Map | null = null;
let directions: MapboxDirections | null = null;
const marker = ref<mapboxgl.Marker | null>(null);
const placesMarkerElems: mapboxgl.Marker[] = [] as mapboxgl.Marker[];

// Define marker type with event handling
type MarkerWithEvents = mapboxgl.Marker & {
  on(event: string, handler: () => void): void;
};

interface RouteEvent {
  route: Array<{
    geometry: {
      coordinates: [number, number][];
    };
  }>;
}

const handleMapInitialized = (map: mapboxgl.Map) => {
  logger.log("Map initialized");
  mapInstance = map;

  // Set initial map settings
  mapInstance.setPitch(MAP_PITCH);
  mapInstance.setBearing(0);

  // Add click handler for setting user marker
  mapInstance.on("click", (e) => {
    const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    addMarker(coords);
  });

  if (tourStore.tour) {
    logger.log("Tour data:", tourStore.tour);
    initializeDirections();
    // Add a small delay before adding the route to ensure directions control is fully initialized
    setTimeout(() => {
      if (tourStore.tour) {
        // Double check that tour still exists
        addRouteToMap(tourStore.tour);
      }
    }, 500);
  } else {
    logger.warn("No tour data available");
  }
};

const initializeDirections = () => {
  if (!mapInstance) {
    logger.warn("Map instance not available");
    return;
  }

  logger.log("Initializing directions");

  directions = new MapboxDirections({
    accessToken: mapbox_gl_access_token,
    unit: "metric",
    profile: "mapbox/walking",
    controls: {
      inputs: false,
      instructions: false,
      profileSwitcher: false,
    },
    interactive: false,
  });

  // Add event listener for route loading
  directions.on("route", (e: RouteEvent) => {
    logger.log("Route loaded:", e);
    if (mapInstance && e.route && Array.isArray(e.route)) {
      // Fit bounds to show the entire route
      const bounds = new mapboxgl.LngLatBounds();
      e.route.forEach((leg) => {
        if (leg.geometry && Array.isArray(leg.geometry.coordinates)) {
          leg.geometry.coordinates.forEach((coord) => {
            if (Array.isArray(coord) && coord.length === 2) {
              bounds.extend(coord);
            }
          });
        }
      });

      if (!bounds.isEmpty()) {
        mapInstance.fitBounds(bounds, {
          padding: 50,
          maxZoom: 15,
        });
      }
    }
  });

  directions.on("error", (e: Error) => {
    logger.error("Directions error:", e);
  });

  mapInstance.addControl(directions);
  logger.log("Directions control added");
};

const decreaseWaypoints = (
  coordinates: [number, number][],
): [number, number][] => {
  return coordinates.slice(0, WAYPOINTS_MAX_COUNT);
};

const addRouteToMap = (tour: ICreatedTour) => {
  if (!mapInstance || !directions) {
    logger.warn("Map or directions not initialized");
    return;
  }

  logger.log("Adding route to map");
  logger.log("Tour route points:", tour.route.points);

  const coordinates = tour.route.points.map(
    (p) => [Number(p.lng), Number(p.lat)] as [number, number],
  );

  logger.log("Original coordinates:", coordinates);
  logger.log("Original coordinates count:", coordinates.length);

  if (coordinates.length < 2) {
    logger.warn("Not enough coordinates for route");
    return;
  }

  const trimmedCoordinates = decreaseWaypoints(coordinates);
  logger.log("Trimmed coordinates:", trimmedCoordinates);
  logger.log("Trimmed coordinates count:", trimmedCoordinates.length);

  const start = trimmedCoordinates[0];
  const finish = trimmedCoordinates.at(-1);
  const waypoints = trimmedCoordinates.slice(1, -1);

  logger.log("Start point:", start);
  logger.log("Finish point:", finish);
  logger.log("Waypoints:", waypoints);

  if (!finish || !start || !start[0] || !start[1] || !finish[0] || !finish[1]) {
    logger.warn("Invalid coordinates");
    return;
  }

  try {
    // Clear any existing route
    directions.removeRoutes();
    logger.log("Existing routes removed");

    // Set new route
    directions.setOrigin([start[0], start[1]]);
    logger.log("Origin set");

    waypoints.forEach((waypoint, index) => {
      directions!.addWaypoint(index, waypoint);
      logger.log(`Waypoint ${index} added:`, waypoint);
    });

    directions.setDestination([finish[0], finish[1]]);
    logger.log("Destination set");
  } catch (error) {
    logger.error("Error while setting route:", error);
  }
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
      const progress = currentTime / totalDuration;

      const totalTextLength = tourStore.textForSpeech.length;
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

// Highlighting the current spoken sentence
function highlightSentence(
  charIndex: number,
  utterance: SpeechSynthesisUtterance | null,
) {
  if (!utterance) return;

  const spokenSentence = findCurrentSpokenSentence(charIndex, utterance.text);

  if (
    currentSpokenSentence.value &&
    currentSpokenSentence.value === spokenSentence
  )
    return;

  currentSpokenSentence.value = spokenSentence;
}

function updateTextForSpeech() {
  const text = tourStore.textForDisplay || "";
  const startIndexOfLastSpokenSentence = getSentenceIndex(
    text,
    currentSpokenSentence.value,
  );
  if (startIndexOfLastSpokenSentence === -1) {
    logger.warn("Sentence not found in textForSpeech");
    return;
  }

  const remainingSentences = text.slice(
    startIndexOfLastSpokenSentence + currentSpokenSentence.value.length,
  );
  tourStore.setTextForSpeech(remainingSentences);
}

function updateTextForDisplay() {
  const text = tourStore.textForDisplay || "";
  const startIndexOfLastSpokenSentence = getSentenceIndex(
    text,
    currentSpokenSentence.value,
  );
  if (startIndexOfLastSpokenSentence === -1) {
    logger.warn("Sentence not found in textForDisplay");
    return;
  }

  const truncatedText = text.slice(
    0,
    startIndexOfLastSpokenSentence + currentSpokenSentence.value.length,
  );
  tourStore.setTextForDisplay(truncatedText);
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

  window.removeEventListener("beforeunload", stopAudio);
});
</script>
