<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouteStore } from "~/stores/routeStore";
import { useNativeWalkPlannerStore } from "~/stores/nativeWalkPlannerStore";
import { useGuidesStore } from "~/stores/guidesStore";
import { useNotification } from "~/composables/ui/useNotification";
import NativeWalkMap from "./NativeWalkMap.vue";
import PersonalContextForm from "./PersonalContextForm.vue";
import RouteDurationControl from "~/components/route/RouteDurationControl.vue";
import WalkSetupHeader from "~/components/route/WalkSetupHeader.vue";
import RouteGuideSummary from "~/components/route/RouteGuideSummary.vue";

const googleWalkingWarning =
  "Google walking routes are beta and may omit pedestrian paths or sidewalks.";

const creating = ref(false);
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
  if (planner.busy || creating.value) return;
  creating.value = true;
  try {
    const tour = await planner.create();
    if (tour) await navigateTo(`/tours/${encodeURIComponent(tour.id)}`);
  } catch (error) {
    useNotification().showApiError(error, t("nativeWalk.createFailed"));
  } finally {
    creating.value = false;
  }
}
</script>
<template>
  <section class="grid w-full min-w-0 gap-5 p-4">
    <WalkSetupHeader
      :step="2"
      :title="$t('nativeWalk.planTitle')"
      :description="$t('nativeWalk.routeDescription')"
    />
    <RouteGuideSummary
      v-if="guides.selectedGuide"
      :guide="guides.selectedGuide"
    />
    <fieldset
      class="grid min-w-0 gap-5"
      :disabled="planner.busy"
      :inert="planner.busy"
    >
      <p class="text-muted text-sm" role="status">
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
      <PGButton
        v-if="!planner.plan"
        :disabled="!origin || planner.busy || planner.creationUncertain"
        :loading="planner.busy"
        @click="prepare"
        >{{
          $t(
            planner.busy
              ? "pages.createRoute.planningRoute"
              : "nativeWalk.planButton",
          )
        }}</PGButton
      >
    </fieldset>
    <section
      v-if="planner.plan"
      class="pg-surface grid gap-3"
      aria-live="polite"
    >
      <h2 class="text-lg font-semibold">
        {{ $t("pages.createRoute.previewTitle") }}
      </h2>
      <p class="text-muted text-sm">
        {{
          $t("nativeWalk.estimate", {
            minutes: estimatedMinutes,
            meters: Math.round(planner.plan.distance_meters),
          })
        }}
      </p>
      <p v-if="shorter" role="status">{{ $t("nativeWalk.shorterRoute") }}</p>
      <p v-for="warning in planner.plan.warnings" :key="warning">
        {{
          warning === googleWalkingWarning
            ? $t("nativeWalk.googleWalkingNotice")
            : warning
        }}
      </p>
      <p>{{ $t("nativeWalk.researchLater") }}</p>
      <PGButton
        :loading="creating"
        :disabled="planner.busy || planner.creationUncertain"
        @click="create"
        >{{
          $t(
            creating
              ? "pages.createRoute.creatingTour"
              : "nativeWalk.createButton",
          )
        }}</PGButton
      >
    </section>
    <p v-if="planner.creationUncertain" role="alert">
      {{ $t("nativeWalk.creationUncertain") }}
      <NuxtLink to="/tours">{{ $t("navigation.backToTours") }}</NuxtLink>
    </p>
    <fieldset class="min-w-0" :disabled="planner.busy" :inert="planner.busy">
      <PersonalContextForm
        v-model="routes.personalContext"
        :guide-mode="guides.selectedGuide?.interaction_mode"
      />
    </fieldset>
  </section>
</template>
