<template>
  <!-- Create Tour Page -->
  <section class="container mx-auto pb-8">
    <h1 class="prose p-4 text-2xl font-extrabold md:p-12">Create Route</h1>
    <!-- Instructions -->
    <div v-if="!routeStore.routeSuggestion" class="prose px-4 pb-2">
      Please indicate the area you wish to explore
    </div>
    <div v-else class="prose px-4 pb-2">
      The excursion route has been built:
    </div>

    <!-- Map -->
    <div class="relative">
      <client-only>
        <PGMap v-model:selected-area="selectedArea" />
      </client-only>
      <div
        v-if="state === STATE.ROUTE_REQUESTING"
        class="absolute inset-0 flex w-full items-center justify-center bg-neutral-600 opacity-80"
      >
        <UIcon
          class="size-48 text-neutral-50"
          name="svg-spinners:6-dots-scale"
        />
      </div>
    </div>

    <!-- Description -->
    <div v-if="isShowDescription" class="prose p-4"></div>

    <!-- Chips -->
    <div v-if="isShowChips" class="px-4 py-4">
      <p class="mb-4">Choose the topics you are interested in:</p>
      <PGChip
        v-for="chip in chips"
        :key="chip.name"
        :isSelected="chip.is_selected"
        class="mr-2 mb-2"
        @click="() => toggleChip(chip.name)"
      >
        {{ chip.name }}
      </PGChip>
    </div>

    <!-- Duration Selector -->
    <div v-if="!routeStore.routeSuggestion" class="m-4">
      <div class="mb-4">
        <div class="prose px-4 text-sm">
          Please indicate the desired duration of the excursion
        </div>
        <div class="duration gap-2 px-4">
          <USlider
            v-model="duration"
            :max="MAX_DURATION_TOUR_MINUTES"
            :min="MIN_DURATION_TOUR_MINUTES"
            class="range-line w-full cursor-pointer appearance-none rounded-lg"
          />
          <div class="initial-duration">5 min</div>
          <div class="current-duration">{{ formattedTime }}</div>
          <div class="max-duration">{{ MAX_DURATION_TOUR_MINUTES }} min</div>
        </div>
      </div>
    </div>

    <!-- Main Button -->
    <PGButton
      :disabled="isMainButtonDisabled"
      :loading="isButtonLoading"
      class="mx-auto mt-6 block"
      @click="handleMainButtonClick"
    >
      {{ mainButtonText }}
    </PGButton>

    <!-- Guide Information -->
    <div class="my-6 flex justify-center gap-8">
      <p class="flex flex-col">
        <span>Your Guide:</span
        ><span>{{ guidesStore.selectedGuide?.name }}</span>
      </p>
      <UAvatar
        :alt="guidesStore.selectedGuide?.name"
        :src="guidesStore.selectedGuide?.avatar"
        size="3xl"
      />
    </div>
  </section>
</template>

<script lang="ts" setup>
import formatMinToHours from "~/utils/formatMinToHours";
import type { ICoordinate, TypeFrom } from "~/types";
import PGMap from "~/components/PGMap.vue";
import { definePageMeta, useGuidesStore } from "#imports";
import { getMainButtonText } from "~/utils/pages/create-route/mainButtonText";

definePageMeta({
  title: "Create route",
  middleware: ["auth"],
});

// Constants
const MIN_DURATION_TOUR_MINUTES = 5;
const MAX_DURATION_TOUR_MINUTES = 60;
const STATE = {
  INITIAL: "INITIAL",
  DATA_ENTRY_COMPLETED: "DATA_ENTRY_COMPLETED",
  ROUTE_REQUESTING: "ROUTE_REQUESTING",
  ROUTE_RECEIVED: "ROUTE_RECEIVED",
  TOUR_APPROVING: "TOUR_APPROVING",
} as const;

type TState = TypeFrom<typeof STATE>;

// State
const state = ref<TState>(STATE.INITIAL);
const selectedArea = ref<ICoordinate | null>(null);
const duration = ref(MIN_DURATION_TOUR_MINUTES);

// Stores
const guidesStore = useGuidesStore();
const routeStore = useRouteStore();

// Computed
const formattedTime = computed(() => formatMinToHours(duration.value));
const mainButtonText = computed<string>(() => getMainButtonText(state.value));
const isMainButtonDisabled = computed(
  () => state.value === STATE.INITIAL || state.value === STATE.ROUTE_REQUESTING || state.value === STATE.TOUR_APPROVING,
);
const isButtonLoading = computed(
  () => state.value === STATE.ROUTE_REQUESTING || state.value === STATE.TOUR_APPROVING,
);
const isShowDescription = computed(
  () =>
    state.value === STATE.ROUTE_RECEIVED &&
    routeStore.routeSuggestion?.description,
);
const chips = computed(() => routeStore.tags || []);
const isShowChips = computed(() => state.value === STATE.ROUTE_RECEIVED);

// Methods
const getRouteSuggestions = async () => {
  state.value = STATE.ROUTE_REQUESTING;

  await routeStore.fetchRoutesSuggestions();
};

const approveRoute = async () => {
  try {
    state.value = STATE.TOUR_APPROVING;
    await routeStore.fetchCreateRoute();
  } catch (error) {
    // Reset state on error so user can try again
    state.value = STATE.ROUTE_RECEIVED;
    console.error('Failed to approve tour:', error);
  }
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

const toggleChip = (chip: string) => {
  const newTags = unref(chips).map((tag) =>
    tag.name == chip ? { ...tag, is_selected: !tag.is_selected } : tag,
  );
  routeStore.setTags(newTags);
};

// Watchers
watchEffect(() => {
  if (selectedArea.value) {
    routeStore.setStartPoint(selectedArea.value);
  }
});

watchEffect(() => {
  routeStore.setDuration(String(duration.value));
});

watch(
  () => routeStore.routeSuggestion,
  (newRouteSuggestion) => {
    if (newRouteSuggestion) {
      state.value = STATE.ROUTE_RECEIVED;
    }
  },
);

watch(
  () => routeStore.actualTour,
  (newTour) => {
    if (newTour) {
      const router = useRouter();
      router.push({ name: "tours" });
    }
  },
);

watch(
  [() => routeStore.startPoint, () => routeStore.duration],
  ([newStartPoint, newDuration]: [ICoordinate | null, string]) => {
    if (newStartPoint?.lng && newStartPoint?.lat && newDuration) {
      state.value = STATE.DATA_ENTRY_COMPLETED;
    }
  },
);
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
