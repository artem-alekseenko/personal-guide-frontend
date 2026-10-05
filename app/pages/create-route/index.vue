<template>
  <!-- Create Tour Page -->
  <section class="container mx-auto pt-4 pb-8">
    <fieldset
      class="min-w-0 border-0 p-0"
      :disabled="isCreating"
      :inert="isCreating"
      :aria-busy="isCreating"
    >
      <!-- Instructions -->
      <div v-if="!routeStore.routeSuggestion" class="prose px-4 pb-2">
        {{ $t("pages.createRoute.selectArea") }}
      </div>
      <div v-else-if="routeStore.canCreate" class="prose px-4 pb-2">
        {{ $t("pages.createRoute.routeBuilt") }}
      </div>

      <div class="mx-4 mb-4 grid min-w-0 gap-3">
        <h2 class="font-medium">{{ $t("pages.createRoute.startLocation") }}</h2>
        <button
          type="button"
          class="min-h-11 rounded border px-3 py-2"
          :disabled="isCreating || !currentLocation"
          @click="useCurrentLocation"
        >
          {{ $t("pages.createRoute.useCurrentLocation") }}
        </button>
        <p v-if="!currentLocation" class="text-sm">
          {{ $t("pages.createRoute.locationUnavailable") }}
        </p>
        <form
          class="grid min-w-0 grid-cols-2 gap-3"
          @submit.prevent="applyStartLocation"
        >
          <label for="start-latitude" class="grid min-w-0 gap-1 text-sm">
            {{ $t("pages.createRoute.latitude") }}
            <input
              id="start-latitude"
              type="number"
              inputmode="decimal"
              min="-90"
              max="90"
              step="any"
              required
              :value="startLatitude"
              class="min-h-11 w-full min-w-0 rounded border p-2"
              @input="startLatitude = ($event.target as HTMLInputElement).value"
            />
          </label>
          <label for="start-longitude" class="grid min-w-0 gap-1 text-sm">
            {{ $t("pages.createRoute.longitude") }}
            <input
              id="start-longitude"
              type="number"
              inputmode="decimal"
              min="-180"
              max="180"
              step="any"
              required
              :value="startLongitude"
              class="min-h-11 w-full min-w-0 rounded border p-2"
              @input="
                startLongitude = ($event.target as HTMLInputElement).value
              "
            />
          </label>
          <p v-if="startLocationError" role="alert" class="col-span-2 text-sm">
            {{ $t("pages.createRoute.invalidStartLocation") }}
          </p>
          <button
            type="submit"
            class="col-span-2 min-h-11 rounded border px-3 py-2"
          >
            {{ $t("pages.createRoute.applyStartLocation") }}
          </button>
        </form>
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
      <div v-if="isShowDescription" class="prose p-4">
        {{ routeStore.routeSuggestion?.description }}
      </div>

      <div v-if="routeStore.routeSuggestion" class="mx-4 space-y-2">
        <label v-if="routeStore.canCreate" for="route-variant">{{
          $t("experience.routeVariant")
        }}</label>
        <select
          v-if="routeStore.canCreate"
          id="route-variant"
          :value="routeStore.selectedRouteIndex"
          class="w-full rounded border p-2"
          @change="
            routeStore.selectRoute(
              Number(($event.target as HTMLSelectElement).value),
            )
          "
        >
          <option
            v-for="(route, index) in routeStore.routeSuggestion.routes"
            :key="index"
            :value="index"
          >
            {{ route.name }}
          </option>
        </select>
        <RoutePreview
          v-if="routeStore.selectedRoute"
          :route="routeStore.selectedRoute"
          :context="routeStore.effectiveContext"
        />
        <p v-if="!routeStore.canCreate" role="status">
          {{ $t("experience.noRoute") }}
        </p>
      </div>
      <PersonalContextForm
        v-model="routeStore.personalContext"
        :guide-mode="guidesStore.selectedGuide?.interaction_mode"
        :show-interests="false"
        class="m-4"
      />
      <!-- Chips -->
      <div v-if="isShowChips" class="px-4 py-4">
        <p class="mb-4">{{ $t("pages.createRoute.selectTopics") }}</p>
        <PGChip
          v-for="chip in chips"
          :key="chip.name"
          :isSelected="chip.is_selected"
          class="mr-2 mb-2"
          @click="() => toggleChip(chip.name)"
        >
          {{
            $t(
              `experience.topics.${chip.name.toLowerCase().replaceAll(" ", "_")}`,
            )
          }}
        </PGChip>
      </div>

      <!-- Duration Selector -->
      <div class="m-4">
        <div class="mb-4">
          <label for="tour-duration" class="prose mb-2 block px-4 text-sm">
            {{ $t("pages.createRoute.durationLabel") }}
          </label>
          <div class="duration gap-2 px-4">
            <input
              id="tour-duration"
              type="range"
              :value="duration"
              :max="MAX_DURATION_TOUR_MINUTES"
              :min="MIN_DURATION_TOUR_MINUTES"
              :aria-valuetext="formattedTime"
              class="range-line min-h-11 w-full cursor-pointer accent-lime-600"
              @input="
                duration = Number(($event.target as HTMLInputElement).value)
              "
            />
            <div class="initial-duration">
              {{ $t("pages.createRoute.minDuration") }}
            </div>
            <div class="current-duration">{{ formattedTime }}</div>
            <div class="max-duration">
              {{ $t("pages.createRoute.maxDuration") }}
            </div>
          </div>
        </div>
      </div>
    </fieldset>
    <!-- Main Button -->
    <PGButton
      :disabled="isMainButtonDisabled"
      :loading="isButtonLoading"
      class="mx-auto mt-6 flex"
      @click="handleMainButtonClick"
    >
      {{ mainButtonText }}
    </PGButton>

    <!-- Guide Information -->
    <div class="my-6 flex justify-center gap-8">
      <p class="flex flex-col">
        <span>{{ $t("pages.createRoute.yourGuide") }}</span
        ><span>{{ guidesStore.selectedGuide?.name }}</span>
      </p>
      <div
        v-if="!guidesStore.selectedGuide?.avatar"
        class="flex h-24 w-24 items-center justify-center rounded-full bg-slate-200"
      >
        <span class="text-3xl font-bold text-gray-600">
          {{ guidesStore.selectedGuide?.name?.charAt(0).toUpperCase() }}
        </span>
      </div>
      <img
        v-else
        :alt="guidesStore.selectedGuide?.name"
        :src="guidesStore.selectedGuide?.avatar"
        class="h-24 w-24 rounded-full object-cover"
      />
    </div>
  </section>
</template>

<script lang="ts" setup>
import PersonalContextForm from "~/components/tour/PersonalContextForm.vue";
import RoutePreview from "~/components/tour/RoutePreview.vue";
import { useNotification } from "~/composables/ui/useNotification";
import type { ICoordinate } from "~/types";
import { useGeolocationStore } from "~/stores/geolocationStore";
import PGMap from "~/components/PGMap.vue";
import { definePageMeta, useGuidesStore } from "#imports";
import { getMainButtonText } from "~/utils/pages/create-route/mainButtonText";

definePageMeta({});

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

// Stores
const guidesStore = useGuidesStore();
const routeStore = useRouteStore();
const geo = useGeolocationStore();
const router = useRouter();
const { t } = useI18n();
const isSuggesting = ref(false);
const isCreating = ref(false);
let pageAlive = true;
onBeforeUnmount(() => {
  pageAlive = false;
});
const selectedArea = computed<ICoordinate | null>({
  get: () => routeStore.startPoint,
  set: (point) => {
    if (point && !isCreating.value) routeStore.setStartPoint(point);
  },
});
const duration = computed({
  get: () => Number(routeStore.duration),
  set: (minutes) => {
    if (!isCreating.value) routeStore.setDuration(String(minutes));
  },
});
const startLatitude = ref(""),
  startLongitude = ref(""),
  startLocationError = ref(false);
watch(
  () => routeStore.startPoint,
  (point) => {
    startLatitude.value = point?.lat ?? "";
    startLongitude.value = point?.lng ?? "";
    startLocationError.value = false;
  },
  { immediate: true },
);
function validStartPoint(lat: string, lng: string) {
  return (
    !!lat.trim() &&
    !!lng.trim() &&
    Number.isFinite(Number(lat)) &&
    Number.isFinite(Number(lng)) &&
    Math.abs(Number(lat)) <= 90 &&
    Math.abs(Number(lng)) <= 180
  );
}
const currentLocation = computed<ICoordinate | null>(() => {
  if (!geo.coordinates || geo.error) return null;
  const point = {
    lat: String(geo.coordinates[1]),
    lng: String(geo.coordinates[0]),
  };
  return validStartPoint(point.lat, point.lng) ? point : null;
});
function useCurrentLocation() {
  if (isCreating.value || !currentLocation.value) return;
  routeStore.setStartPoint(currentLocation.value);
}
function applyStartLocation() {
  if (isCreating.value) return;
  startLocationError.value = !validStartPoint(
    startLatitude.value,
    startLongitude.value,
  );
  if (!startLocationError.value)
    routeStore.setStartPoint({
      lat: startLatitude.value.trim(),
      lng: startLongitude.value.trim(),
    });
}
const state = computed(() =>
  isCreating.value
    ? STATE.TOUR_APPROVING
    : isSuggesting.value
      ? STATE.ROUTE_REQUESTING
      : routeStore.routeSuggestion
        ? STATE.ROUTE_RECEIVED
        : routeStore.startPoint
          ? STATE.DATA_ENTRY_COMPLETED
          : STATE.INITIAL,
);
onMounted(() => {
  if (!guidesStore.selectedGuide) void navigateTo("/guides");
  else void routeStore.initializePersonalContext();
});

// Computed
const formattedTime = computed(() =>
  t("common.timeFormat.minutes", { count: duration.value }),
);
const mainButtonText = computed<string>(() => getMainButtonText(state.value));
const isMainButtonDisabled = computed(
  () =>
    state.value === STATE.INITIAL ||
    state.value === STATE.ROUTE_REQUESTING ||
    state.value === STATE.TOUR_APPROVING ||
    (state.value === STATE.ROUTE_RECEIVED && !routeStore.canCreate),
);
const isButtonLoading = computed(
  () =>
    state.value === STATE.ROUTE_REQUESTING ||
    state.value === STATE.TOUR_APPROVING,
);
const isShowDescription = computed(
  () =>
    state.value === STATE.ROUTE_RECEIVED &&
    routeStore.routeSuggestion?.description,
);
const chips = computed(() =>
  routeStore.tags.map((tag) => ({
    ...tag,
    is_selected: routeStore.effectiveContext.interests.includes(
      tag.name.toLowerCase().replaceAll(" ", "_"),
    ),
  })),
);
const isShowChips = computed(() => routeStore.personalContext.enabled);

// Methods
const getRouteSuggestions = async () => {
  if (isSuggesting.value || isCreating.value) return;
  isSuggesting.value = true;

  try {
    await routeStore.fetchRoutesSuggestions();
  } catch (error) {
    useNotification().showApiError(error, "Could not plan the route");
  } finally {
    isSuggesting.value = false;
  }
};

const approveRoute = async () => {
  if (isCreating.value || isSuggesting.value) return;
  isCreating.value = true;
  try {
    const created = await routeStore.fetchCreateRoute();
    if (created && pageAlive) await router.push({ name: "tours" });
  } catch (error) {
    useNotification().showApiError(error, "Could not create the tour");
  } finally {
    isCreating.value = false;
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
  if (isCreating.value) return;
  routeStore.toggleInterest(chip.toLowerCase().replaceAll(" ", "_"));
};
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
