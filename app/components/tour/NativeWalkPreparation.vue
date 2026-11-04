<script setup lang="ts">
import { computed, watch } from "vue";
import type { ICreatedTour } from "~/types";
import { useUserStore } from "~/stores/userStore";
import { useTourPreparationProgress } from "~/composables/tour/useTourPreparationProgress";
import TourPreparationProgress from "./TourPreparationProgress.vue";
import TourResearchControls from "./TourResearchControls.vue";

const props = defineProps<{ tour: ICreatedTour; compact?: boolean }>();
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
  { onRecovered: () => emit("updated") },
);
const ready = computed(
  () =>
    progress.value?.status === "READY" &&
    props.tour.playback_generation_id === progress.value.generation_id,
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
    <p v-if="ready" role="status">{{ $t("nativeWalk.preparationReady") }}</p>
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
  </section>
</template>
