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
        <div ref="mapContainerRef" class="h-[60vh] w-full"></div>
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

useHead({
  link: [
    {
      rel: "stylesheet",
      href: "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css",
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
const currentSpokenSentence = ref("");

const textRef = ref<HTMLElement | null>(null);

const route = useRoute();
const router = useRouter();
const tourStore = useTourStore();

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
let mapInstance: mapboxgl.Map | null = null;
const mapContainerRef = ref(null);
const marker = ref<mapboxgl.Marker | null>(null);
const placesMarkerElems: mapboxgl.Marker[] = [] as mapboxgl.Marker[];

const initializeMap = async () => {
  if (!mapContainerRef.value) return;

  const { lng, lat, zoom, bearing, pitch } = {
    lng: -79.3832,
    lat: 43.6532,
    bearing: 0,
    pitch: MAP_PITCH,
    zoom: 16,
  };

  mapInstance = new mapboxgl.Map({
    container: mapContainerRef.value,
    center: [lng, lat],
    style: {
      version: 8,
      sources: {},
      imports: [{ id: "basemap", url: "mapbox://styles/mapbox/standard" }],
      layers: [],
    },
    zoom,
    bearing,
    pitch,
  });

  mapInstance.addControl(
    new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    }),
  );

  mapInstance.on("style.load", () => {
    if (!mapInstance) return;
    mapInstance.setConfigProperty("basemap", "showRoadLabels", false);
    mapInstance.setConfigProperty("basemap", "showTransitLabels", false);
    mapInstance.setConfigProperty("basemap", "theme", "faded");
    mapInstance.setConfigProperty(
      "basemap",
      "showPointOfInterestLabels",
      false,
    );
    mapInstance.setConfigProperty("basemap", "showTransitLabels", false);
  });
};

const addLine = (coordinates: number[][]) => {
  if (!mapInstance) return;
  mapInstance.on("load", () => {
    mapInstance?.addSource("route", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates,
        },
      },
    });
    mapInstance?.addLayer({
      id: "route",
      type: "line",
      source: "route",
      layout: { "line-join": "round", "line-cap": "round" },
      paint: { "line-color": "#22c55e", "line-width": 6 },
    });
  });
};

const getRouteCoords = (tour: ICreatedTour) => {
  return tour.route.points.map((p) => [Number(p.lng), Number(p.lat)]);
};

const getInitialCoords = (tour: ICreatedTour): [number, number] => {
  if (!tour.route || !tour.route.points[0]) {
    throw new Error("Route or route points are not defined");
  }
  return [Number(tour.route.points[0].lng), Number(tour.route.points[0].lat)];
};

const addMarker = (coords: [number, number]) => {
  marker.value = new mapboxgl.Marker({ draggable: true })
    .setLngLat(coords)
    .addTo(mapInstance!);

  // @ts-ignore
  marker.value.on("dragend", getRecord);
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
  const sentences = utterance.text.match(/[^.!?]*[.!?]["”]?/g) || [];
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
    formattedText.value?.match(/[^.!?]*[.!?]["”]?/g)?.map((s) => s.trim()) ||
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
if (!route.params.tourId || typeof route.params.tourId !== "string") {
  console.error("No tourId provided");
}
await tourStore.fetchGetTour(route.params.tourId as string);

onMounted(async () => {
  await nextTick();
  await initializeMap();
  if (tourStore.tour) {
    addLine(getRouteCoords(tourStore.tour));
    addMarker(getInitialCoords(tourStore.tour));
  } else {
    console.error("No tour found");
  }
  window.addEventListener("beforeunload", stopAudio);
});

onBeforeUnmount(() => {
  stopSpeech();
  window.removeEventListener("beforeunload", stopAudio);
});
</script>
