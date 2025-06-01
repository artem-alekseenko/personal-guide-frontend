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
    <div v-if="isShowRecordText" class="flex flex-col gap-y-2 px-4">
      <p
        ref="textRef"
        class="border-primary-500 h-60 overflow-y-auto rounded-md border-2 border-solid p-4"
      >
        {{ tourStore.textForDisplay || "" }}
      </p>
      <div class="flex items-baseline justify-items-start gap-x-2">
        <USwitch v-model="isScrollingToHighlightTextEnabled" size="xs" />
        <p class="text-sm">{{ toggleScrollToHighlightSentenceText }}</p>
      </div>
    </div>

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
import { useRoute } from "vue-router";
import { useTourStore } from "#imports";
import { useTourSpeech } from "@/composables/useTourSpeech";
import type {
  ICoordinate,
  ICreatedTour,
  IGeoJSONFeature,
  TypeFrom,
} from "~/types";
import createPlacesMarkerElem from "~/utils/pages/createPlacesMarkerElem";
import { useGeolocationStore } from "~/stores/geolocationStore";
import BaseMap from "~/components/base/BaseMap.vue";

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

const textRef = ref<HTMLElement | null>(null);

const route = useRoute();
const router = useRouter();
const tourStore = useTourStore();
const geolocationStore = useGeolocationStore();

const formattedText = computed(() => {
  return tourStore.textForDisplay || "";
});

const isShowRecordText = computed(() => tourStore.textForDisplay);

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
  console.log('Map initialized');
  mapInstance = map;
  
  // Set initial map settings
  mapInstance.setPitch(MAP_PITCH);
  mapInstance.setBearing(0);

  // Add click handler for setting user marker
  mapInstance.on('click', (e) => {
    const coords: [number, number] = [e.lngLat.lng, e.lngLat.lat];
    addMarker(coords);
  });
  
  if (tourStore.tour) {
    console.log('Tour data:', tourStore.tour);
    initializeDirections();
    // Add a small delay before adding the route to ensure directions control is fully initialized
    setTimeout(() => {
      if (tourStore.tour) { // Double check that tour still exists
        addRouteToMap(tourStore.tour);
      }
    }, 500);
  } else {
    console.warn('No tour data available');
  }
};

const initializeDirections = () => {
  if (!mapInstance) {
    console.warn('Map instance not available');
    return;
  }

  console.log('Initializing directions');

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
  directions.on('route', (e: RouteEvent) => {
    console.log('Route loaded:', e);
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
          maxZoom: 15
        });
      }
    }
  });

  directions.on('error', (e: Error) => {
    console.error('Directions error:', e);
  });

  mapInstance.addControl(directions);
  console.log('Directions control added');
};

const decreaseWaypoints = (
  coordinates: [number, number][],
): [number, number][] => {
  return coordinates.slice(0, WAYPOINTS_MAX_COUNT);
};

const addRouteToMap = (tour: ICreatedTour) => {
  if (!mapInstance || !directions) {
    console.warn("Map or directions not initialized");
    return;
  }

  console.log("Adding route to map");
  console.log("Tour route points:", tour.route.points);

  const coordinates = tour.route.points.map(
    (p) => [Number(p.lng), Number(p.lat)] as [number, number],
  );

  console.log("Original coordinates:", coordinates);
  console.log("Original coordinates count:", coordinates.length);

  if (coordinates.length < 2) {
    console.warn("Not enough coordinates for route");
    return;
  }

  const trimmedCoordinates = decreaseWaypoints(coordinates);
  console.log("Trimmed coordinates:", trimmedCoordinates);
  console.log("Trimmed coordinates count:", trimmedCoordinates.length);

  const start = trimmedCoordinates[0];
  const finish = trimmedCoordinates.at(-1);
  const waypoints = trimmedCoordinates.slice(1, -1);

  console.log("Start point:", start);
  console.log("Finish point:", finish);
  console.log("Waypoints:", waypoints);

  if (!finish || !start || !start[0] || !start[1] || !finish[0] || !finish[1]) {
    console.warn("Invalid coordinates");
    return;
  }

  try {
    // Clear any existing route
    directions.removeRoutes();
    console.log("Existing routes removed");

    // Set new route
    directions.setOrigin([start[0], start[1]]);
    console.log("Origin set");

    waypoints.forEach((waypoint, index) => {
      directions!.addWaypoint(index, waypoint);
      console.log(`Waypoint ${index} added:`, waypoint);
    });

    directions.setDestination([finish[0], finish[1]]);
    console.log("Destination set");
  } catch (error) {
    console.error("Error while setting route:", error);
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
const isScrollingToHighlightTextEnabled = ref(true);
const audioElement = ref<HTMLAudioElement | null>(null);

const toggleScrollToHighlightSentenceText = computed(() => {
  return isScrollingToHighlightTextEnabled.value
    ? "Scroll to highlighted sentence enabled"
    : "Scroll to highlighted sentence disabled";
});

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

  // Convert base64 to blob
  const byteCharacters = atob(audioData);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "audio/mp3" });

  const audioUrl = URL.createObjectURL(blob);
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

function findCurrentSpokenSentence(
  charIndex: number,
  utterance: SpeechSynthesisUtterance,
): string {
  const sentences = utterance.text.match(/[^.!?]*[.!?][""]?/g) || [];
  let accumulatedLength = 0;

  for (const sentence of sentences) {
    accumulatedLength += sentence.length;
    if (charIndex < accumulatedLength) {
      return sentence.trim();
    }
  }
  return "";
}

// Highlighting the current spoken sentence
function highlightSentence(
  charIndex: number,
  utterance: SpeechSynthesisUtterance | null,
) {
  if (!textRef.value || !utterance) return;

  const spokenSentence = findCurrentSpokenSentence(charIndex, utterance);

  if (
    currentSpokenSentence.value &&
    currentSpokenSentence.value === spokenSentence
  )
    return;

  currentSpokenSentence.value = spokenSentence;

  const currentDisplayedSentences =
    formattedText.value?.match(/[^.!?]*[.!?][""]?/g)?.map((s) => s.trim()) ||
    [];

  const highlightedText = currentDisplayedSentences
    .map((sentence) =>
      sentence === currentSpokenSentence.value
        ? `<span class="bg-yellow-200 active-sentence">${sentence}</span> `
        : `${sentence} `,
    )
    .join("");

  textRef.value.innerHTML = highlightedText;

  if (isScrollingToHighlightTextEnabled.value) {
    scrollToHighlightedSentence();
  }
}

function scrollToHighlightedSentence() {
  const highlightedEl = textRef.value?.querySelector(".active-sentence");
  if (!highlightedEl) return;

  highlightedEl.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "nearest",
  });
}

function clearHighlights() {
  if (!textRef.value) return;
  textRef.value.innerHTML = formattedText.value;
}

function updateTextForSpeech() {
  const startIndexOfLastSpokenSentence = formattedText.value.indexOf(
    currentSpokenSentence.value,
  );
  if (startIndexOfLastSpokenSentence === -1) {
    console.warn("Sentence not found in textForSpeech");
    return;
  }

  const remainingSentences = formattedText.value.slice(
    startIndexOfLastSpokenSentence + currentSpokenSentence.value.length,
  );
  tourStore.setTextForSpeech(remainingSentences);
}

function updateTextForDisplay() {
  const startIndexOfLastSpokenSentence = formattedText.value.indexOf(
    currentSpokenSentence.value,
  );
  if (startIndexOfLastSpokenSentence === -1) {
    console.warn("Sentence not found in textForDisplay");
    return;
  }

  const truncatedText = formattedText.value.slice(
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
  if (!marker.value) {
    console.error("No marker found");
    return;
  }

  if (state.value === STATE.RECORD_PAUSED) {
    state.value = STATE.RECORD_LOADING_WHEN_PAUSED;
  } else {
    state.value = STATE.RECORD_LOADING;
  }
  const lngLat = marker.value.getLngLat();
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
    console.log("State: ", newState);
  },
  { immediate: true },
);

/* -------------------------------------------
   Lifecycle hooks
------------------------------------------- */
onMounted(async () => {
  await nextTick();
  if (!route.params.tourId || typeof route.params.tourId !== "string") {
    console.error("No tourId provided");
    return;
  }
  console.log("Fetching tour with ID:", route.params.tourId);
  await tourStore.fetchGetTour(route.params.tourId as string);
  console.log("Tour fetched:", tourStore.tour);
  window.addEventListener("beforeunload", stopAudio);
});

onBeforeUnmount(() => {
  stopSpeech();
  window.removeEventListener("beforeunload", stopAudio);
});
</script>
