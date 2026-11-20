<script setup lang="ts">
import { computed, watch } from "vue";
import type { ICreatedTour } from "~/types";
import { useNativeWalkPresentation } from "~/composables/tour/useNativeWalkPresentation";
import { useNativeWalk } from "~/composables/tour/useNativeWalk";
import { useNotification } from "~/composables/ui/useNotification";
import { useToastNotifications } from "~/composables/ui/useToastNotifications";
import { useNativeWalkPosition } from "~/composables/tour/useNativeWalkPosition";
import TourLocationMode from "./TourLocationMode.vue";
import NativeWalkMap from "./NativeWalkMap.vue";
import NativeWalkControls from "./NativeWalkControls.vue";
import NativeWalkPreparation from "./NativeWalkPreparation.vue";
import TourCover from "./TourCover.vue";
const emit = defineEmits<{ updated: []; open: []; finished: [] }>();
const props = defineProps<{ tour: ICreatedTour; walking: boolean }>();
const { t } = useI18n();
const notifications = useNotification();
const toast = useToastNotifications();
const position = useNativeWalkPosition(
  computed(() => props.tour.route.walking_plan?.intent.origin),
);
const manualPosition = position.isManualMode;
const walk = useNativeWalk(props.tour.id, position.source);
const { title, knowledge } = useNativeWalkPresentation(
  computed(() => props.tour),
);
const plan = computed(() => props.tour.route.walking_plan!);
const view = walk.view;
const published = computed(() => {
  const current = view.value;
  return (
    !!current &&
    !!props.tour.playback_generation_id &&
    current.generation_id === props.tour.playback_generation_id &&
    current.route_revision === plan.value.revision &&
    current.language === plan.value.intent.language &&
    (current.started ||
      ["GENERATED", "STARTED", "FINISHED"].includes(props.tour.status))
  );
});
const inWalk = computed(() => props.walking && published.value);
const blocked = computed(
  () =>
    !walk.ready.value ||
    walk.failed.value ||
    walk.generationChanged.value ||
    !!view.value?.finished,
);
const highlights = computed(() => {
  const covered = new Set(
    knowledge.value?.coverage
      ?.filter((entry) => entry.status === "accepted" && entry.claim_ids.length)
      .map((entry) => entry.subject_id),
  );
  const names = [
    ...(props.tour.route.points ?? []).map((point) => point.name),
    ...(knowledge.value?.subjects ?? [])
      .filter(
        (subject) =>
          covered.has(subject.id) &&
          !["city", "region", "country"].includes(subject.kind ?? ""),
      )
      .map((subject) => subject.name),
  ];
  return [...new Set(names.map((name) => name?.trim()).filter(Boolean))].slice(
    0,
    4,
  );
});
watch(
  () =>
    published.value &&
    !props.walking &&
    !!view.value?.started &&
    !view.value.finished,
  (open) => {
    if (open) emit("open");
  },
  { immediate: true },
);
watch(
  view,
  (value) => {
    if (value) position.initialize(value);
  },
  { immediate: true, flush: "sync" },
);
watch(
  () => inWalk.value && !!view.value?.finished,
  (finished) => {
    if (finished) emit("finished");
  },
  { immediate: true },
);
watch(
  () =>
    inWalk.value && walk.audioUnavailable.value
      ? view.value?.active_delivery?.text
      : undefined,
  (passage) => {
    if (passage)
      notifications.showInfo({
        title: t("nativeWalk.guidePassage"),
        message: passage,
        autoClose: false,
      });
  },
);
watch(
  () =>
    inWalk.value &&
    (walk.generationChanged.value
      ? "generation"
      : walk.uncertain.value
        ? "uncertain"
        : walk.failed.value
          ? "failed"
          : null),
  (issue) => {
    if (issue === "generation") {
      notifications.showInfo({
        message: t("nativeWalk.generationChanged"),
        primaryActionText: t("nativeWalk.reloadTour"),
        onPrimaryAction: reloadTour,
        autoClose: false,
      });
    } else if (issue === "uncertain") {
      notifications.showWarning({
        message: t("nativeWalk.uncertain"),
        primaryActionText: t("buttons.tryAgain"),
        onPrimaryAction: () => void safely(walk.retry),
        secondaryActionText: t("nativeWalk.reload"),
        onSecondaryAction: () => void safely(walk.reconcile),
        showSecondaryAction: true,
      });
    } else if (issue === "failed") {
      notifications.showError({
        message: t("nativeWalk.actionFailed"),
        primaryActionText: t("nativeWalk.reload"),
        onPrimaryAction: () => void safely(walk.reconcile),
      });
    }
  },
);
function reloadTour() {
  reloadNuxtApp();
}
async function safely(action: () => unknown) {
  try {
    await action();
  } catch (error) {
    if (!inWalk.value || !(walk.failed.value || walk.uncertain.value)) {
      notifications.showApiError(error, t("nativeWalk.actionFailed"));
    }
  }
}
async function requestPassage(action: () => Promise<void>) {
  await safely(action);
  const status = walk.stepStatus.value;
  if (status && status !== "locating")
    toast.showInfo(t(`nativeWalk.stepStatus.${status}`));
}
</script>
<template>
  <section
    class="grid w-full min-w-0 gap-4 p-4"
    :data-walking-screen="inWalk ? '' : undefined"
  >
    <h1 class="pg-page-title">
      {{ title }}
    </h1>
    <template v-if="!inWalk">
      <TourCover :src="tour.image" class="rounded-xl" eager />
      <p class="leading-relaxed">
        {{ tour.description?.trim() || $t("nativeWalk.overview") }}
      </p>
      <p class="text-muted text-sm">
        {{
          $t("nativeWalk.estimate", {
            minutes: Math.round(plan.duration_seconds / 60),
            meters: Math.round(plan.distance_meters),
          })
        }}
      </p>
      <p v-if="tour.guide?.name" class="text-muted text-sm">
        {{ $t("pages.createRoute.yourGuide") }} · {{ tour.guide.name }}
      </p>
      <section v-if="highlights.length" class="grid gap-2">
        <h2 class="font-semibold">{{ $t("nativeWalk.highlights") }}</h2>
        <ul class="text-muted list-disc space-y-1 ps-5 text-sm">
          <li v-for="place in highlights" :key="place">{{ place }}</li>
        </ul>
      </section>
      <p
        v-if="
          !view &&
          !walk.preparing.value &&
          !walk.failed.value &&
          tour.status !== 'GENERATING'
        "
        role="status"
      >
        {{ $t("common.loading") }}
      </p>
      <div v-if="walk.generationChanged.value" role="alert" class="grid gap-3">
        <p>{{ $t("nativeWalk.generationChanged") }}</p>
        <PGButton @click="reloadTour">{{
          $t("nativeWalk.reloadTour")
        }}</PGButton>
      </div>
      <p v-if="walk.failed.value" role="alert">
        {{ $t("nativeWalk.actionFailed") }}
      </p>
      <div
        v-if="walk.uncertain.value"
        class="border-warning grid gap-2 rounded-lg border p-3"
        role="alert"
      >
        <p>{{ $t("nativeWalk.uncertain") }}</p>
        <PGButton :disabled="walk.busy.value" @click="safely(walk.retry)">{{
          $t("buttons.tryAgain")
        }}</PGButton>
        <PGButton :disabled="walk.busy.value" @click="safely(walk.reconcile)">{{
          $t("nativeWalk.reload")
        }}</PGButton>
      </div>
      <PGButton
        v-else-if="walk.failed.value"
        :disabled="walk.busy.value"
        @click="safely(walk.reconcile)"
        >{{ $t("nativeWalk.reload") }}</PGButton
      >
      <p v-if="view && !walk.canControl.value" role="status">
        {{ $t("nativeWalk.otherController") }}
      </p>
      <NativeWalkPreparation
        :tour="tour"
        summary-only
        @updated="emit('updated')"
      />
      <PGButton
        v-if="published && !view?.finished"
        :disabled="blocked"
        size="lg"
        @click="emit('open')"
      >
        {{ $t("tourGeneration.statuses.READY") }}
      </PGButton>
    </template>
    <template v-else-if="view">
      <TourLocationMode
        v-model="manualPosition"
        :gps-available="position.gpsAvailable.value"
        :simulation-hint="$t('nativeWalk.simulationHint')"
        compact
      />
      <NativeWalkMap
        :plan="plan"
        :simulation="manualPosition"
        :simulation-point="position.point.value"
        @move="position.move"
      />
      <PGButton
        v-if="!view.started && !view.finished"
        :disabled="blocked"
        size="lg"
        @click="requestPassage(walk.start)"
      >
        {{ $t("nativeWalk.start") }}
      </PGButton>
      <NativeWalkControls
        v-if="!view.finished"
        :view="view"
        :blocked="blocked"
        @next="requestPassage(walk.nextStep)"
        @ask="
          (question) => requestPassage(() => walk.explicit('ASK', { question }))
        "
        @finish="safely(walk.finish)"
      />
    </template>
  </section>
</template>
