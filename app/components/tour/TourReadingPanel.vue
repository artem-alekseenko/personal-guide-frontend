<template>
  <section
    class="mx-4 min-w-0 rounded-2xl border border-neutral-200 bg-white p-4 text-neutral-900 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
  >
    <h2 class="text-sm font-semibold text-neutral-600 dark:text-neutral-300">
      {{ $t("tourProgress.latestText") }}
    </h2>
    <slot v-if="text">
      <div class="tour-reading-text mt-3 text-base leading-7 break-words">
        {{ text }}
      </div>
    </slot>
    <p v-else class="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
      {{ $t("tourProgress.noText") }}
    </p>
  </section>
  <details
    v-if="earlierText"
    :key="text"
    class="mx-4 min-w-0 rounded-2xl border border-neutral-200 bg-white p-4 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
  >
    <summary
      class="min-h-11 cursor-pointer rounded-lg text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
    >
      {{ $t("tourProgress.earlierText") }}
    </summary>
    <div class="mt-3 text-base leading-7 break-words whitespace-pre-wrap">
      {{ earlierText }}
    </div>
  </details>
  <details
    v-if="progress"
    class="mx-4 min-w-0 rounded-2xl border border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900"
  >
    <summary
      class="min-h-11 cursor-pointer rounded-2xl px-4 py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-700"
    >
      {{ $t("tourProgress.title") }}
      <span
        v-if="progress.stopPosition !== null"
        class="ml-2 text-neutral-600 dark:text-neutral-300"
        >{{
          $t("tourProgress.position", {
            position: progress.stopPosition,
            total: progress.totalStops,
          })
        }}</span
      >
    </summary>
    <TourProgressSummary :progress="progress" class="mb-4" />
  </details>
</template>
<script setup lang="ts">
import { computed } from "vue";
import type { TourProgress } from "#shared/utils/tourProgress";
import TourProgressSummary from "./TourProgressSummary.vue";
const props = defineProps<{
  text: string;
  transcript?: string;
  progress: TourProgress | null;
}>();
const earlierText = computed(() => {
  const transcript = props.transcript?.trim() ?? "";
  const latest = props.text.trim();
  return latest && transcript.endsWith(latest)
    ? transcript.slice(0, -latest.length).trim()
    : transcript;
});
</script>

<style scoped>
.tour-reading-text {
  white-space: pre-wrap;
}
</style>
