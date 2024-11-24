<template>
  <!-- <CreateRoute> -->
  <section class="container mx-auto pb-8">
    <h1 class="prose p-4 text-2xl font-extrabold md:p-12">Create Route</h1>
    <div v-if="!routes" class="prose px-4 pb-2">
      Please indicate the area you wish to explore
    </div>
    <div v-else class="prose px-4 pb-2">
      The excursion route has been built:
    </div>
    <div class="relative">
      <client-only>
        <PGMap
          v-model:selected-area="selectedArea"
          :coordinates="routes?.coordinates"
        />
      </client-only>
      <div
        v-if="state === STATE.ROUTE_REQUESTING"
        class="absolute inset-0 flex w-full items-center justify-center bg-gray-600 opacity-80"
      >
        <UIcon class="size-48 text-gray-50" name="svg-spinners:6-dots-scale" />
      </div>
    </div>
    <div v-if="isShowDescription" class="prose p-4"></div>
    <div v-if="!routes" class="my-4">
      <div class="prose p-4">
        Please indicate the desired duration of the excursion
      </div>
      <div class="duration gap-2 px-4">
        <input
          v-model="duration"
          :max="MAX_DURATION_TOUR_MINUTES"
          :min="MIN_DURATION_TOUR_MINUTES"
          class="range-line w-full cursor-pointer appearance-none rounded-lg"
          type="range"
        />
        <div class="initial-duration">5 min</div>
        <div class="current-duration">{{ formattedTime }}</div>
        <div class="max-duration">{{ MAX_DURATION_TOUR_MINUTES }} min</div>
      </div>
    </div>
    <PGButton
      :disabled="isMainButtonDisabled"
      class="mx-auto mt-6 block"
      @click="handleMainButtonClick"
      >{{ mainButtonText }}</PGButton
    >
    <div class="my-6 flex justify-center gap-8">
      <p class="flex flex-col">
        <span>Your Guide:</span><span> {{ guide?.name }}</span>
      </p>
      <UAvatar :alt="guide?.name" :src="guide?.avatar" size="3xl" />
    </div>
  </section>
  <!-- </CreateRoute> -->
</template>

<script lang="ts" setup>
import formatMinToHours from "~/utils/formatMinToHours";
import { useTourSuggestions } from "~/composables/useTourSuggestions";
import type { IRouteSuggestionsResponseExtended } from "~/types/route-suggestions";
import PGMap from "~/components/PGMap.vue";
import { useSelectedGuide } from "~/stores/selectedGuideStore";
import { definePageMeta } from "#imports";

definePageMeta({
  title: "Create route",
  middleware: ["auth"],
});

const MIN_DURATION_TOUR_MINUTES = 5;
const MAX_DURATION_TOUR_MINUTES = 60;
const DEFAULT_GUIDE_ID = "66ddd98bf124c17bff59e1b2";

enum STATE {
  INITIAL = "initial",
  DATA_ENTRY_COMPLETED = "data_entry_completed",
  ROUTE_REQUESTING = "route_requesting",
  ROUTE_RECEIVED = "route_received",
}

const state = ref(STATE.INITIAL);

const { guide } = useSelectedGuide();

const routes = ref<IRouteSuggestionsResponseExtended | null>(null);
const selectedArea = ref<{ lat: number; lng: number } | null>(null);
const duration = ref(MIN_DURATION_TOUR_MINUTES);

const formattedTime = computed(() => formatMinToHours(duration.value));

const BUTTON_TEXT = {
  GET_TOUR_ROUTE: "Get the tour route",
  GETTING_ROUTE: "Getting the route...",
  APPROVE_ROUTE: "Approve route",
};

const getButtonDefaultText = (): string => BUTTON_TEXT.GET_TOUR_ROUTE;

const getButtonText = (currentState: STATE): string => {
  const stateTextMap: Record<STATE, string> = {
    [STATE.INITIAL]: BUTTON_TEXT.GET_TOUR_ROUTE,
    [STATE.DATA_ENTRY_COMPLETED]: BUTTON_TEXT.GET_TOUR_ROUTE,
    [STATE.ROUTE_REQUESTING]: BUTTON_TEXT.GETTING_ROUTE,
    [STATE.ROUTE_RECEIVED]: BUTTON_TEXT.APPROVE_ROUTE,
  };
  return stateTextMap[currentState] || getButtonDefaultText();
};

const mainButtonText = computed<string>(() => getButtonText(state.value));

const isMainButtonDisabled = computed(() => {
  return (
    state.value === STATE.INITIAL || state.value === STATE.ROUTE_REQUESTING
  );
});

const getPreparedParams = () => {
  return {
    lng: selectedArea.value ? selectedArea.value.lng.toString() : "0",
    lat: selectedArea.value ? selectedArea.value.lat.toString() : "0",
    duration: duration.value.toString(),
    guideId: guide?.id.toString() || DEFAULT_GUIDE_ID,
  };
};

const getRouteSuggestions = async () => {
  state.value = STATE.ROUTE_REQUESTING;

  const params = getPreparedParams();

  routes.value = await useTourSuggestions(params);

  state.value = STATE.ROUTE_RECEIVED;
};

const approveRoute = async () => {
  console.log("I'd like this route))");
};

const handleMainButtonClick = async () => {
  if (state.value === STATE.DATA_ENTRY_COMPLETED) {
    await getRouteSuggestions();
    return;
  }
  if (state.value === STATE.ROUTE_RECEIVED) {
    await approveRoute();
    return;
  }
};

const isShowDescription = computed(
  () => state.value === STATE.ROUTE_RECEIVED && routes.value?.description,
);

watch([selectedArea, duration], ([newSelectedArea, newDuration]) => {
  if (newSelectedArea?.lng && newSelectedArea?.lat && newDuration) {
    state.value = STATE.DATA_ENTRY_COMPLETED;
  }
});
</script>

<style scoped>
.duration {
  display: grid;
  grid-template-areas:
    "range range range"
    "initial current finish";
}

.range-line {
  grid-area: range;
}

.initial-duration {
  grid-area: initial;
}

.current-duration {
  grid-area: current;
  justify-self: center;
}

.max-duration {
  grid-area: finish;
  justify-self: end;
}
</style>
