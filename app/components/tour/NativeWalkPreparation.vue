<script setup lang="ts">
import { computed, watch } from "vue";
import type { ICreatedTour } from "~/types";
import { useUserStore } from "~/stores/userStore";
import { useTourPreparationProgress } from "~/composables/tour/useTourPreparationProgress";
import TourGenerationStatus from "./TourGenerationStatus.vue";
import TourPreparationProgress from "./TourPreparationProgress.vue";
import TourResearchControls from "./TourResearchControls.vue";

const props = defineProps<{
  tour: ICreatedTour;
  compact?: boolean;
  summaryOnly?: boolean;
}>();
const emit = defineEmits<{ updated: [] }>();
const users = useUserStore();
const {
  progress,
  refreshing,
  statusRefreshing,
  refreshFailed,
  captionUncertain,
  refresh,
  refreshStatus,
} = useTourPreparationProgress(
  computed(() => props.tour),
  computed(() => users.user?.uid ?? null),
  undefined,
  { onRecovered: () => emit("updated"), onPublished: () => emit("updated") },
);
const ready = computed(
  () =>
    props.tour.status !== "GENERATING" &&
    !!props.tour.playback_generation_id &&
    props.tour.playback_generation_id ===
      (props.tour.latest_generation_id || progress.value?.generation_id),
);
let notified = "";
watch(
  () => [progress.value?.generation_id, progress.value?.status] as const,
  ([generation, status], previous) => {
    const key = `${generation}:${status}`;
    if (
      !generation ||
      !status ||
      !["READY", "FAILED", "CANCELLED"].includes(status) ||
      key === notified
    )
      return;
    if (
      props.tour.status === "GENERATING" ||
      previous?.[1] === "RUNNING" ||
      previous?.[1] === "PENDING"
    ) {
      notified = key;
      emit("updated");
    }
  },
  { immediate: true },
);
</script>
<template>
  <section class="grid min-w-0 gap-3" data-native-preparation>
    <template
      v-if="
        !compact &&
        (!summaryOnly ||
          tour.preparation_error ||
          progress?.status === 'FAILED' ||
          progress?.status === 'CANCELLED' ||
          refreshFailed)
      "
    >
      <details class="pg-disclosure min-w-0" data-preparation-details>
        <summary class="min-h-11 cursor-pointer py-3 font-medium">
          {{ $t("nativeWalk.preparationDetails") }}
        </summary>
        <TourPreparationProgress
          v-if="progress"
          :progress="progress"
          :compact="compact"
          :refreshing="refreshing"
          :status-refreshing="statusRefreshing"
          :refresh-failed="refreshFailed"
          :caption-uncertain="captionUncertain"
          @refresh="refresh"
          @refresh-status="refreshStatus"
        />
        <template v-else>
          <p v-if="tour.status === 'GENERATING'" role="status">
            {{ $t("preparationProgress.waitingForSnapshot") }}
          </p>
          <p v-if="tour.preparation_error" role="alert">
            {{ tour.preparation_error }}
          </p>
          <p v-if="refreshFailed" role="alert">
            {{ $t("preparationProgress.refreshFailed") }}
          </p>
        </template>
        <TourResearchControls
          :tour-id="tour.id"
          :status="tour.status"
          :latest-generation-id="
            tour.latest_generation_id || progress?.generation_id
          "
          :preparation-progress="progress"
          :preparation-error="tour.preparation_error"
          @updated="emit('updated')"
        />
      </details>
    </template>
    <TourGenerationStatus
      :progress="progress"
      :status="tour.status"
      :preparation-error="tour.preparation_error"
      :generating-text="tour.generating_string"
      :refresh-failed="refreshFailed"
      :published="ready"
    />
  </section>
</template>
