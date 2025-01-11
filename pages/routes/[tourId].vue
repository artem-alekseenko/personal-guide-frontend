<template>
  <main v-if="tourStore.tour" class="container mx-auto pb-8">
    <h1>Tour {{ tourStore.tour.name }}</h1>
    <div class="relative">
      <client-only>
        <div ref="mapContainerRef" class="h-[60vh] w-full"></div>
      </client-only>
    </div>
    <div>
      <PGButton
        :disabled="
          state === STATE.RECORD_LOADING || state === STATE.RECORD_FINISHED
        "
        :loading="state === STATE.RECORD_LOADING"
        class="mx-auto mb-6 mt-6 block"
        @click="handleTourButtonClick"
      >
        {{ mainButtonText }}
      </PGButton>
      <!--      <PGButton-->
      <!--        v-if="isShowForceStopButton"-->
      <!--        class="mx-auto mt-6 block"-->
      <!--        @click="forceStopPlayback"-->
      <!--      >-->
      <!--        Force stop playback-->
      <!--      </PGButton>-->
    </div>
    <p
      v-if="isShowRecordText"
      ref="textRef"
      class="border-primary-500 h-60 overflow-y-auto border-2 border-solid p-4"
    >
      {{ tourStore.allTourRecord || "" }}
    </p>
  </main>
</template>

<script lang="ts" setup>
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-directions/dist/mapbox-gl-directions.css";
import { onMounted, useRoute, useTourSpeech, useTourStore } from "#imports";
import type { ICreatedTour, ITourRecordRequest, TypeFrom } from "~/types";

const MAP_PITCH = 45;
const mabboxglAccessToken =
  "pk.eyJ1IjoiYXJ0ZW1zZW9zbW0iLCJhIjoiY20xcWt4Z3NlMDE0djJqcXpwNzIwaXVidiJ9.I2F3EIiTKyvuuR-pM1ZG_Q";
mapboxgl.accessToken = mabboxglAccessToken;

const STATE = {
  INITIAL: "INITIAL",
  RECORD_LOADING: "LOADING_RECORD",
  RECORD_ACTIVE: "RECORD_ACTIVE",
  RECORD_RECEIVED: "RECORD_RECEIVED",
  RECORD_PAUSED: "RECORD_PAUSED",
  RECORD_FINISHED: "RECORD_FINISHED",
  TOUR_FINISHED: "TOUR_FINISHED",
} as const;

type TState = TypeFrom<typeof STATE>;

const state = ref<TState>(STATE.INITIAL);
const textRef = ref<HTMLElement | null>(null);

const { speakMessage, pauseSpeech, resumeSpeech, stopSpeech } = useTourSpeech();
const lastSpokenIndex = ref(0);

const formattedText = computed(() => {
  if (!tourStore.allTourRecord) {
    return "";
  }
  return tourStore.allTourRecord;
});

// Подсветка текущего предложения
const highlightSentence = (charIndex: number) => {
  if (!textRef.value) return;

  const text = formattedText.value;
  const sentences = text.match(/[^.!?]*[.!?]/g) || [];
  let currentSentence = "";
  let accumulatedLength = 0;

  for (const sentence of sentences) {
    accumulatedLength += sentence.length;
    if (charIndex < accumulatedLength) {
      currentSentence = sentence;
      break;
    }
  }

  // Генерация HTML с подсветкой текущего предложения
  const highlightedText = sentences
    .map((sentence) =>
      sentence === currentSentence
        ? `<span class="bg-yellow-200 active-sentence">${sentence}</span>`
        : sentence,
    )
    .join("");

  textRef.value.innerHTML = highlightedText;

  scrollToHighlightedSentence();
};

// Очистка подсветки
const clearHighlights = () => {
  if (!textRef.value) return;
  textRef.value.innerHTML = formattedText.value;
};

const route = useRoute();
if (!route.params.tourId || typeof route.params.tourId !== "string") {
  console.error("No tourId provided");
}

const tourStore = useTourStore();
await tourStore.fetchGetTour(route.params.tourId as string);

const mapContainerRef = ref(null);
let mapInstance: mapboxgl.Map | null = null;
const marker = ref<mapboxgl.Marker | null>(null);

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
      imports: [
        {
          id: "basemap",
          url: "mapbox://styles/mapbox/standard",
        },
      ],
      layers: [],
    },
    zoom,
    bearing,
    pitch,
  });

  mapInstance.addControl(
    new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true,
      },
      trackUserLocation: true,
      showUserHeading: true,
    }),
  );

  mapInstance.on("style.load", () => {
    if (!mapInstance) {
      return;
    }
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

  // mapInstance.on("click", selectPoint);
};

const addLine = (coordinates: number[][]) => {
  if (!mapInstance) return;

  const map = mapInstance;

  mapInstance.on("load", () => {
    map.addSource("route", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: coordinates,
        },
      } as GeoJSON.Feature<GeoJSON.LineString>,
    });

    map.addLayer({
      id: "route",
      type: "line",
      source: "route",
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#22c55e",
        "line-width": 6,
      },
    });
  });
};

const getRouteCoords = (tour: ICreatedTour) => {
  return tour.route.points.map((point) => [
    Number(point.lng),
    Number(point.lat),
  ]);
};

const getInitialCoords = (tour: ICreatedTour): [number, number] => {
  if (!tour.route || !tour.route.points[0]) {
    throw new Error("Route or route points are not defined");
  }
  return [Number(tour.route.points[0].lng), Number(tour.route.points[0].lat)];
};

const addMarker = (coords: [number, number]) => {
  marker.value = new mapboxgl.Marker({
    draggable: true,
  })
    .setLngLat(coords)
    .addTo(mapInstance!);

  // @ts-ignore
  (marker.value as mapboxgl.Marker).on("dragend", getRecord);
};

const getRecord = async () => {
  if (!marker.value) {
    console.error("No marker found");
    return;
  }

  state.value = STATE.RECORD_LOADING;
  const lngLat = marker.value.getLngLat();

  const params: ITourRecordRequest = {
    duration: "100",
    point: {
      lat: String(lngLat.lat),
      lng: String(lngLat.lng),
    },
    user_text: "What are you see now?",
    pace: "1",
    type_llm: "SIMPLE",
  };

  await tourStore.fetchTourRecord(params);
};

const scrollToHighlightedSentence = () => {
  const highlightedEl = textRef.value?.querySelector(".active-sentence");
  if (!highlightedEl) return;

  highlightedEl.scrollIntoView({
    behavior: "smooth",
    block: "center",
    inline: "nearest",
  });
};

const playTour = () => {
  const newText = formattedText.value.slice(lastSpokenIndex.value);

  speakMessage({
    text: newText,
    offset: lastSpokenIndex.value,
    onBoundary: (globalCharIndex) => highlightSentence(globalCharIndex),
    onEnd: () => {
      lastSpokenIndex.value = formattedText.value.length;
      clearHighlights();
      state.value = STATE.RECORD_FINISHED;
    },
  });
  state.value = STATE.RECORD_ACTIVE;
};

const pauseTour = () => {
  state.value = STATE.RECORD_PAUSED;
  pauseSpeech();
};

const resumeTour = () => {
  state.value = STATE.RECORD_ACTIVE;
  resumeSpeech();
};

const forceStopPlayback = () => {
  stopSpeech();
  state.value = STATE.RECORD_FINISHED;
};

const handleTourButtonClick = () => {
  switch (state.value) {
    case STATE.INITIAL:
    case STATE.RECORD_FINISHED:
      getRecord();
      break;
    case STATE.RECORD_RECEIVED:
      playTour();
      break;
    case STATE.RECORD_ACTIVE:
      pauseTour();
      break;
    case STATE.RECORD_PAUSED:
      resumeTour();
      break;
  }
};

const mainButtonText = computed(() => {
  switch (state.value) {
    case STATE.INITIAL:
      return "Start tour";
    case STATE.RECORD_LOADING:
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

const isShowForceStopButton = computed(
  () =>
    state.value === STATE.RECORD_ACTIVE || state.value === STATE.RECORD_PAUSED,
);

const isShowRecordText = computed(() => tourStore.allTourRecord);

watch(
  () => tourStore.currentTourRecord,
  (newRecord) => {
    if (newRecord) {
      state.value = STATE.RECORD_RECEIVED;
    }
  },
);

watch(
  state,
  (newState) => {
    console.log("State: ", newState);
  },
  { immediate: true },
);

onMounted(async () => {
  await nextTick();
  await initializeMap();

  if (tourStore.tour) {
    addLine(getRouteCoords(tourStore.tour));
    addMarker(getInitialCoords(tourStore.tour));
  } else {
    console.error("No tour found");
  }

  window.addEventListener("beforeunload", stopSpeech);
});

onBeforeUnmount(() => {
  stopSpeech();
  window.removeEventListener("beforeunload", stopSpeech);
});
</script>
