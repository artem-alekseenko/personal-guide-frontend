<template>
  <section
    :aria-label="$t('preparationProgress.title')"
    class="mt-3 min-w-0 rounded-lg border border-white/25 bg-neutral-900 p-3 text-sm text-white"
  >
    <p class="font-semibold" role="status" aria-live="polite">
      {{ $t(`preparationProgress.statuses.${progress.status}`) }}
      <span v-if="isPending">
        · {{ $t(`preparationProgress.phases.${progress.phase}`) }}</span
      >
    </p>
    <p v-if="progress.error" class="mt-2 break-words text-red-200" role="alert">
      {{
        [
          "worker_research_credits_exhausted",
          "worker_researchcreditsexhausted",
        ].includes(progress.error)
          ? $t("preparationProgress.creditsExhausted")
          : progress.error === "worker_researchspendingunavailable"
            ? $t("preparationProgress.budgetUnavailable")
            : progress.error === "worker_researchratelimited"
              ? $t("preparationProgress.rateLimited")
              : progress.error
      }}
    </p>
    <details :open="progress.status !== 'READY'" class="mt-2">
      <summary
        class="min-h-11 cursor-pointer py-2 underline underline-offset-2"
      >
        {{ $t("preparationProgress.details") }}
      </summary>
      <dl class="grid grid-cols-2 gap-x-3 gap-y-2 tabular-nums">
        <div>
          <dt class="text-white/70">
            {{ $t("preparationProgress.activeResearchers") }}
          </dt>
          <dd>{{ formatCount(progress.active_researchers) }}</dd>
        </div>
        <div>
          <dt class="text-white/70">
            {{ $t("preparationProgress.completedStops") }}
          </dt>
          <dd>
            {{ formatCount(progress.completed_stops) }} /
            {{ formatCount(progress.total_stops) }}
          </dd>
        </div>
        <div v-for="field in fields" :key="field">
          <dt class="text-white/70">
            {{ $t(`preparationProgress.metrics.${field}`) }}
          </dt>
          <dd>{{ formatCount(progress[field]) }}</dd>
        </div>
      </dl>
      <p class="mt-3 text-xs text-white/70">
        {{ $t("preparationProgress.savedNotice") }}
      </p>
      <ul v-if="progress.stops.length" class="mt-3 grid gap-3">
        <li
          v-for="stop in progress.stops"
          :key="stop.stop_id"
          class="min-w-0 border-t border-white/20 pt-3"
        >
          <h3 class="font-medium break-words">{{ stop.name }}</h3>
          <p class="mt-1 text-white/80">
            {{ $t(`preparationProgress.stopPhases.${stop.phase}`) }}
            · {{ $t("preparationProgress.attempt") }}
            {{ formatCount(stop.attempt) }}
          </p>
          <dl
            class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs tabular-nums"
          >
            <div v-for="field in fields" :key="field">
              <dt class="text-white/70">
                {{ $t(`preparationProgress.metrics.${field}`) }}
              </dt>
              <dd>{{ formatCount(stop[field]) }}</dd>
            </div>
          </dl>
        </li>
      </ul>
      <p v-if="updatedAt" class="mt-3 text-xs text-white/60">
        {{ $t("preparationProgress.updatedAt") }}
        <time :datetime="progress.updated_at">{{ updatedAt }}</time>
      </p>
    </details>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { PreparationProgress } from "#shared/types/preparationProgress";

const props = defineProps<{ progress: PreparationProgress }>();
const fields = [
  "turns_started",
  "turns_completed",
  "tool_calls_completed",
  "sources_count",
  "source_bytes",
  "claims_count",
  "word_count",
  "archive_bytes",
] as const;
const isPending = computed(() =>
  ["PENDING", "RUNNING"].includes(props.progress.status),
);
const formatCount = (value: number) =>
  Number.isFinite(value) && value >= 0 ? value.toLocaleString() : "—";
const updatedAt = computed(() => {
  const date = new Date(props.progress.updated_at);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleTimeString();
});
</script>
