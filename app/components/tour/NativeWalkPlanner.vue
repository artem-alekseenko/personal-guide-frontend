<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRouteStore } from "~/stores/routeStore";
import { useNativeWalkPlannerStore } from "~/stores/nativeWalkPlannerStore";
import { useGuidesStore } from "~/stores/guidesStore";
import { useNotification } from "~/composables/ui/useNotification";
import NativeWalkMap from "./NativeWalkMap.vue";
import PersonalContextForm from "./PersonalContextForm.vue";
import RouteDurationControl from "~/components/route/RouteDurationControl.vue";
import RouteGuideSummary from "~/components/route/RouteGuideSummary.vue";
const routes = useRouteStore();
const planner = useNativeWalkPlannerStore();
const guides = useGuidesStore();
const { t } = useI18n();
const origin = computed(() =>
  routes.startPoint
    ? { lat: Number(routes.startPoint.lat), lng: Number(routes.startPoint.lng) }
    : null,
);
const duration = computed({
  get: () => Number(routes.duration),
  set: (value: number) => {
    if (!planner.busy) routes.setDuration(String(value));
  },
});
const estimatedMinutes = computed(() =>
  Math.round((planner.plan?.duration_seconds ?? 0) / 60),
);
const shorter = computed(
  () =>
    !!planner.plan &&
    planner.plan.duration_seconds < Number(routes.duration) * 54,
);
onMounted(() => {
  if (!guides.selectedGuide) void navigateTo("/guides");
  else void routes.initializePersonalContext();
});
async function prepare() {
  try {
    await planner.prepare();
  } catch (error) {
    useNotification().showApiError(error, t("nativeWalk.planFailed"));
  }
}
async function create() {
  try {
    const tour = await planner.create();
    if (tour) await navigateTo(`/tours/${encodeURIComponent(tour.id)}`);
  } catch (error) {
    useNotification().showApiError(error, t("nativeWalk.createFailed"));
  }
}
</script>
<template>
  <section class="grid min-w-0 gap-5 p-4">
    <h1 class="text-xl font-semibold">{{ $t("nativeWalk.planTitle") }}</h1>
    <RouteGuideSummary
      v-if="guides.selectedGuide"
      :guide="guides.selectedGuide"
    />
    <p>{{ $t("nativeWalk.routeDescription") }}</p>
    <fieldset
      class="grid min-w-0 gap-5"
      :disabled="planner.busy"
      :inert="planner.busy"
    >
      <p role="status">
        {{ $t(origin ? "nativeWalk.startSelected" : "nativeWalk.chooseStart") }}
      </p>
      <NativeWalkMap
        :plan="planner.plan"
        :origin="origin"
        :selectable="!planner.busy"
        @select="
          (point) =>
            routes.setStartPoint({
              lat: String(point.lat),
              lng: String(point.lng),
            })
        "
      />
      <RouteDurationControl v-model="duration" :min="5" :max="60" />
      <PersonalContextForm
        v-model="routes.personalContext"
        :guide-mode="guides.selectedGuide?.interaction_mode"
      />
      <PGButton :disabled="!origin || planner.busy" @click="prepare">{{
        $t("nativeWalk.planButton")
      }}</PGButton>
    </fieldset>
    <section
      v-if="planner.plan"
      class="border-default grid gap-3 rounded-xl border p-4"
      aria-live="polite"
    >
      <p>
        {{
          $t("nativeWalk.estimate", {
            minutes: estimatedMinutes,
            meters: Math.round(planner.plan.distance_meters),
          })
        }}
      </p>
      <p v-if="shorter" role="status">{{ $t("nativeWalk.shorterRoute") }}</p>
      <p v-for="warning in planner.plan.warnings" :key="warning">
        {{ warning }}
      </p>
      <p>{{ $t("nativeWalk.researchLater") }}</p>
      <PGButton
        :disabled="planner.busy || planner.creationUncertain"
        @click="create"
        >{{ $t("nativeWalk.createButton") }}</PGButton
      >
    </section>
    <p v-if="planner.creationUncertain" role="alert">
      {{ $t("nativeWalk.creationUncertain") }}
      <NuxtLink to="/tours">{{ $t("navigation.backToTours") }}</NuxtLink>
    </p>
  </section>
</template>
