<template>
  <section class="route-setup">
    <WalkSetupHeader
      :step="2"
      :title="$t('pages.createRoute.heroTitle')"
      :description="$t('pages.createRoute.heroDescription')"
    />
    <fieldset
      class="route-setup__fields"
      :disabled="isCreating"
      :inert="isCreating"
      :aria-busy="isCreating"
    >
      <RouteGuideSummary
        v-if="guidesStore.selectedGuide"
        :key="`${guidesStore.selectedGuide.id}:${guidesStore.selectedGuide.avatar}`"
        :guide="guidesStore.selectedGuide"
      />

      <section class="route-setup__section" aria-labelledby="route-start-title">
        <div class="route-setup__heading">
          <span class="route-setup__number" aria-hidden="true">01</span>
          <h2 id="route-start-title">
            {{ $t("pages.createRoute.startTitle") }}
          </h2>
        </div>
        <div
          id="route-start-hint"
          role="status"
          class="route-setup__hint"
          :class="{ 'route-setup__hint--missing': !selectedArea }"
        >
          <UIcon
            :name="selectedArea ? 'i-lucide-circle-check' : 'i-lucide-map-pin'"
            class="mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          />
          <span>{{
            $t(
              routeStore.canCreate
                ? "pages.createRoute.routeBuilt"
                : selectedArea
                  ? "pages.createRoute.startSelected"
                  : "pages.createRoute.selectArea",
            )
          }}</span>
        </div>
        <div class="route-setup__map" :aria-busy="isSuggesting">
          <client-only>
            <PGMap v-model:selected-area="selectedArea" />
          </client-only>
          <div
            v-if="state === STATE.ROUTE_REQUESTING"
            class="route-setup__map-loading"
            role="status"
          >
            <span class="route-setup__spinner" aria-hidden="true" />
            <span>{{ $t("pages.createRoute.planningRoute") }}</span>
          </div>
        </div>
      </section>

      <section
        class="route-setup__section route-setup__section--surface"
        aria-labelledby="route-duration-title"
      >
        <div class="route-setup__heading">
          <span class="route-setup__number" aria-hidden="true">02</span>
          <h2 id="route-duration-title">
            {{ $t("pages.createRoute.durationTitle") }}
          </h2>
        </div>
        <RouteDurationControl
          v-model="duration"
          :min="MIN_DURATION_TOUR_MINUTES"
          :max="MAX_DURATION_TOUR_MINUTES"
        />
      </section>

      <section
        class="route-setup__section"
        aria-labelledby="route-preferences-title"
      >
        <div class="route-setup__heading">
          <span class="route-setup__number" aria-hidden="true">03</span>
          <h2 id="route-preferences-title">
            {{ $t("pages.createRoute.preferencesTitle") }}
          </h2>
          <span class="route-setup__optional">{{
            $t("pages.createRoute.optional")
          }}</span>
        </div>
        <PersonalContextForm
          v-model="routeStore.personalContext"
          :guide-mode="guidesStore.selectedGuide?.interaction_mode"
          :show-interests="false"
        />
        <div v-if="isShowChips" class="route-setup__interests">
          <p class="route-setup__label">
            {{ $t("pages.createRoute.selectTopics") }}
          </p>
          <div class="route-setup__chips">
            <PGChip
              v-for="chip in chips"
              :key="chip.name"
              :isSelected="chip.is_selected"
              @click="() => toggleChip(chip.name)"
            >
              {{
                $t(
                  `experience.topics.${chip.name.toLowerCase().replaceAll(" ", "_")}`,
                )
              }}
            </PGChip>
          </div>
        </div>
      </section>

      <section
        v-if="routeStore.routeSuggestion"
        class="route-setup__section route-setup__options"
        aria-labelledby="route-options-title"
      >
        <div class="route-setup__heading">
          <span class="route-setup__ready-icon" aria-hidden="true"
            ><UIcon name="i-lucide-route" class="size-5"
          /></span>
          <h2 id="route-options-title">
            {{ $t("pages.createRoute.reviewTitle") }}
          </h2>
        </div>
        <p v-if="isShowDescription" class="route-setup__description">
          {{ routeStore.routeSuggestion.description }}
        </p>
        <div v-if="routeStore.canCreate" class="route-setup__variant">
          <label for="route-variant" class="route-setup__label">{{
            $t("experience.routeVariant")
          }}</label>
          <select
            id="route-variant"
            :value="routeStore.selectedRouteIndex"
            class="route-setup__select"
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
        </div>
        <RoutePreview
          v-if="routeStore.selectedRoute"
          :route="routeStore.selectedRoute"
          :context="routeStore.effectiveContext"
        />
        <p
          v-if="!routeStore.canCreate"
          role="status"
          class="route-setup__description"
        >
          {{ $t("experience.noRoute") }}
        </p>
      </section>
    </fieldset>

    <div class="route-setup__action">
      <p class="route-setup__action-hint">
        {{
          $t(
            !selectedArea
              ? "pages.createRoute.chooseStartFirst"
              : routeStore.canCreate
                ? "pages.createRoute.readyToCreate"
                : "pages.createRoute.previewFirst",
          )
        }}
      </p>
      <PGButton
        :disabled="isMainButtonDisabled"
        :loading="isButtonLoading"
        aria-describedby="route-start-hint"
        size="lg"
        class="route-setup__main-button"
        @click="handleMainButtonClick"
      >
        {{ mainButtonText }}
      </PGButton>
    </div>
  </section>
</template>

<script lang="ts" setup>
import WalkSetupHeader from "~/components/route/WalkSetupHeader.vue";
import RouteGuideSummary from "~/components/route/RouteGuideSummary.vue";
import RouteDurationControl from "~/components/route/RouteDurationControl.vue";
import PersonalContextForm from "~/components/tour/PersonalContextForm.vue";
import RoutePreview from "~/components/tour/RoutePreview.vue";
import { useNotification } from "~/composables/ui/useNotification";
import type { ICoordinate } from "~/types";
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
const router = useRouter();
const isSuggesting = ref(false);
const isCreating = computed(() => routeStore.isCreating);
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
  try {
    const created = await routeStore.fetchCreateRoute();
    if (created && pageAlive) await router.push({ name: "tours" });
  } catch (error) {
    useNotification().showApiError(error, "Could not create the tour");
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
.route-setup {
  display: grid;
  gap: 1.5rem;
  inline-size: 100%;
  min-inline-size: 0;
  padding: 1.25rem 1rem 1.5rem;
  background: color-mix(in srgb, var(--ui-primary) 2%, var(--ui-bg));
  color: var(--ui-text);
}
.route-setup__fields {
  display: grid;
  gap: 1.5rem;
  min-inline-size: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.route-setup__section {
  display: grid;
  gap: 0.875rem;
  min-inline-size: 0;
}
.route-setup__section--surface {
  padding: 1rem;
  border: 1px solid var(--ui-border);
  border-radius: 1.25rem;
  background: var(--ui-bg);
}
.route-setup__heading {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-inline-size: 0;
}
.route-setup__heading h2 {
  margin: 0;
  color: var(--ui-text-highlighted);
  font-size: 1rem;
  font-weight: 650;
  line-height: 1.4;
}
.route-setup__number {
  flex-shrink: 0;
  color: color-mix(in srgb, var(--ui-primary) 45%, var(--ui-text-highlighted));
  font-size: 0.6875rem;
  font-weight: 750;
  letter-spacing: 0.04em;
}
.route-setup__optional {
  margin-inline-start: auto;
  color: var(--ui-text-muted);
  font-size: 0.6875rem;
}
.route-setup__hint {
  display: flex;
  align-items: flex-start;
  gap: 0.625rem;
  padding: 0.75rem 0.875rem;
  border: 1px solid color-mix(in srgb, var(--ui-primary) 18%, var(--ui-border));
  border-radius: 0.875rem;
  background: color-mix(in srgb, var(--ui-primary) 5%, var(--ui-bg));
  color: var(--ui-text);
  font-size: 0.8125rem;
  line-height: 1.6;
}
.route-setup__hint--missing {
  border-color: color-mix(in srgb, var(--ui-warning) 50%, var(--ui-border));
  background: color-mix(in srgb, var(--ui-warning) 10%, var(--ui-bg));
  color: var(--ui-text-highlighted);
}
.route-setup__hint--missing > :first-child {
  color: var(--ui-warning);
}
.route-setup__map {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--ui-border);
  border-radius: 1.25rem;
  isolation: isolate;
}
.route-setup__map-loading {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: color-mix(in srgb, var(--ui-bg) 88%, transparent);
  text-align: center;
  font-size: 0.875rem;
  font-weight: 600;
}
.route-setup__spinner {
  inline-size: 2rem;
  block-size: 2rem;
  border: 3px solid var(--ui-border);
  border-block-start-color: color-mix(
    in srgb,
    var(--ui-primary) 45%,
    var(--ui-text-highlighted)
  );
  border-radius: 50%;
  animation: route-planning 900ms linear infinite;
}
@keyframes route-planning {
  to {
    transform: rotate(360deg);
  }
}
.route-setup__interests {
  display: grid;
  gap: 0.75rem;
  padding: 0.25rem;
}
.route-setup__label {
  color: var(--ui-text-highlighted);
  font-size: 0.8125rem;
  font-weight: 600;
}
.route-setup__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.route-setup__chips :deep(button) {
  padding-inline: 1.25rem;
  font-size: 0.8125rem;
}
.route-setup__chips :deep(button[aria-pressed="true"]) {
  padding-inline-end: 2rem;
}
.route-setup__options {
  padding-block-start: 1.25rem;
  border-block-start: 1px solid var(--ui-border);
}
.route-setup__ready-icon {
  display: grid;
  place-items: center;
  color: color-mix(in srgb, var(--ui-primary) 45%, var(--ui-text-highlighted));
}
.route-setup__description {
  margin: 0;
  font-size: 0.875rem;
  line-height: 1.65;
}
.route-setup__variant {
  display: grid;
  gap: 0.5rem;
}
.route-setup__select {
  inline-size: 100%;
  min-inline-size: 0;
  min-block-size: 2.75rem;
  border: 1px solid var(--ui-border-accented);
  border-radius: 0.75rem;
  background: var(--ui-bg);
  color: var(--ui-text);
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
}
.route-setup__select:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
}
.route-setup__action {
  position: sticky;
  inset-block-end: 0;
  z-index: 10;
  display: grid;
  justify-items: center;
  gap: 0.625rem;
  padding: 1rem 0 max(0.25rem, env(safe-area-inset-bottom));
  border-block-start: 1px solid var(--ui-border);
  background: var(--ui-bg);
  box-shadow: 0 -0.5rem 1rem color-mix(in srgb, var(--ui-text) 4%, transparent);
}
.route-setup__action-hint {
  margin: 0;
  color: var(--ui-text-muted);
  text-align: center;
  font-size: 0.75rem;
  line-height: 1.5;
}
.route-setup__main-button {
  inline-size: 100%;
  max-inline-size: 22rem;
  border-radius: 0.875rem;
}
@media (prefers-reduced-motion: reduce) {
  .route-setup__spinner {
    animation: none;
  }
}
</style>
