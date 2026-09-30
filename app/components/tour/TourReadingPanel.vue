<template>
  <section
    class="mx-4 min-w-0 rounded-2xl border border-neutral-200 bg-white p-4 text-neutral-900 shadow-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
  >
    <h2
      class="mb-3 text-sm font-semibold text-neutral-600 dark:text-neutral-300"
    >
      {{ $t("tourProgress.latestText") }}
    </h2>
    <div
      v-if="text"
      class="tour-reading-text text-base leading-7 break-words whitespace-pre-wrap"
    >
      {{ text }}
    </div>
    <p v-else class="text-sm text-neutral-600 dark:text-neutral-300">
      {{ $t("tourProgress.noText") }}
    </p>
  </section>
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
import type { TourProgress } from "#shared/utils/tourProgress";
import TourProgressSummary from "./TourProgressSummary.vue";
defineProps<{ text: string; progress: TourProgress | null }>();
</script>
