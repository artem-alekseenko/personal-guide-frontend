<script setup lang="ts">
import { computed } from "vue";
import type { PreparationProgress } from "#shared/types/preparationProgress";
import { usePreparationPercent } from "~/composables/tour/usePreparationPercent";

const props = withDefaults(
  defineProps<{
    progress?: PreparationProgress | null;
    status: string;
    preparationError?: string | null;
    generatingText?: string;
    refreshFailed?: boolean;
    published?: boolean;
  }>(),
  { published: undefined },
);
const message = (key: string) => ({ key, text: "" });
const state = computed(() => {
  if (
    props.status === "FINISHED" &&
    (!props.progress || props.progress.status === "READY")
  )
    return "FINISHED";
  if (props.progress) {
    if (props.progress.status === "READY" && props.published === false)
      return "FINALIZING";
    return props.progress.status;
  }
  if (props.preparationError) return "FAILED";
  if (["GENERATED", "STARTED"].includes(props.status)) return "READY";
  return "PENDING";
});
const active = computed(() =>
  ["PENDING", "RUNNING", "FINALIZING"].includes(state.value),
);
const recordedPercent = usePreparationPercent(() => ({
  generation_id: props.progress?.generation_id ?? "",
  percent: props.progress?.percent,
  status: props.progress?.status ?? "PENDING",
}));
const percent = computed(() => {
  if (["READY", "FINISHED"].includes(state.value)) return 100;
  return recordedPercent.value === null
    ? null
    : Math.min(99, recordedPercent.value);
});
const phases = [
  "CAPTURE",
  "ROUTE",
  "PLAN",
  "RESEARCH",
  "SYNTHESIS",
  "COMPOSITION",
  "REVIEW",
  "PUBLICATION",
];
const activity = computed(() => {
  const progress = props.progress;
  if (state.value === "FAILED") return message("tourGeneration.failed");
  if (state.value === "CANCELLED") return message("tourGeneration.cancelled");
  if (props.refreshFailed) return message("tourGeneration.refreshFailed");
  if (state.value === "FINISHED") return message("tourGeneration.finished");
  if (state.value === "READY")
    return message(
      progress?.partial_result ||
        (progress?.skipped_stops ?? 0) > 0 ||
        ["budget_wrap_up", "incomplete_wrap_up"].includes(
          progress?.completion_reason ?? "",
        )
        ? "tourGeneration.partial"
        : "tourGeneration.ready",
    );
  if (state.value === "FINALIZING") return message("tourGeneration.finalizing");
  const recorded = [
    progress?.activity_stale ? null : progress?.activity_text,
    progress?.step_description,
    progress?.step_name,
    progress ? null : props.generatingText,
  ].find((value) => value?.trim());
  if (!recorded)
    return progress && phases.includes(progress.phase)
      ? message(`preparationProgress.phases.${progress.phase}`)
      : message("tourGeneration.waiting");
  const sentence = recorded
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s/)[0]!;
  return {
    key: "",
    text:
      sentence.length > 140
        ? `${sentence.slice(0, 137).replace(/\s+\S*$/, "")}…`
        : sentence,
  };
});
</script>

<template>
  <section
    class="generation-status"
    :class="{
      'generation-status--active': active,
      'generation-status--error': state === 'FAILED',
      'generation-status--cancelled': state === 'CANCELLED',
    }"
    :aria-label="$t('preparationProgress.title')"
    :data-preparation-status="state"
    data-tour-generation
  >
    <div class="generation-status__heading">
      <span class="generation-status__icon" aria-hidden="true">
        <span v-if="active" class="generation-status__spinner" />
        <svg
          v-else
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path v-if="state === 'FAILED'" d="M12 6v7m0 4h.01" />
          <path v-else-if="state === 'CANCELLED'" d="M7 7l10 10M17 7L7 17" />
          <path v-else d="m5 12 4 4L19 6" />
        </svg>
      </span>
      <span class="generation-status__label" role="status">
        {{ $t(`tourGeneration.statuses.${state}`) }}
      </span>
      <span v-if="percent !== null" class="generation-status__percent"
        >{{ percent }}%</span
      >
    </div>
    <progress
      class="generation-status__progress"
      :value="percent ?? undefined"
      max="100"
      :aria-label="$t('preparationProgress.progressEstimate')"
      :aria-valuenow="percent ?? undefined"
      :class="{ 'generation-status__progress--unknown': percent === null }"
      v-if="percent !== null || active"
    />
    <p
      class="generation-status__activity"
      :role="state === 'FAILED' ? 'alert' : 'status'"
      aria-atomic="true"
      data-generation-activity
    >
      {{ activity.key ? $t(activity.key) : activity.text }}
    </p>
  </section>
</template>

<style scoped>
.generation-status {
  --status-color: var(--ui-primary);
  display: grid;
  gap: 0.75rem;
  min-inline-size: 0;
  padding: 1rem;
  border: 1px solid
    color-mix(in srgb, var(--status-color) 18%, var(--ui-border));
  border-radius: 1rem;
  background: color-mix(in srgb, var(--status-color) 5%, var(--ui-bg));
}
.generation-status--error {
  --status-color: var(--ui-error);
}
.generation-status--cancelled {
  --status-color: var(--ui-warning);
}
.generation-status__heading {
  display: flex;
  align-items: center;
  gap: 0.625rem;
}
.generation-status__icon {
  display: grid;
  place-items: center;
  flex: none;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  background: color-mix(in srgb, var(--status-color) 12%, transparent);
  color: var(--status-color);
}
.generation-status__icon svg {
  width: 1.125rem;
  height: 1.125rem;
}
.generation-status__spinner {
  width: 0.875rem;
  height: 0.875rem;
  border: 2px solid color-mix(in srgb, var(--status-color) 25%, transparent);
  border-top-color: var(--status-color);
  border-radius: 50%;
  animation: generation-spin 1s linear infinite;
}
.generation-status__label {
  flex: 1;
  min-width: 0;
  font-size: 0.875rem;
  font-weight: 650;
  color: var(--ui-text-highlighted);
}
.generation-status__percent {
  color: var(--status-color);
  font-size: 0.875rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}
.generation-status__progress {
  display: block;
  width: 100%;
  height: 0.375rem;
  overflow: hidden;
  appearance: none;
  border: 0;
  border-radius: 999px;
  background: color-mix(in srgb, var(--status-color) 12%, transparent);
  color: var(--status-color);
}
.generation-status__progress::-webkit-progress-bar {
  background: transparent;
}
.generation-status__progress::-webkit-progress-value {
  background: var(--status-color);
  border-radius: 999px;
  transition: width 80ms linear;
}
.generation-status__progress::-moz-progress-bar {
  background: var(--status-color);
  border-radius: 999px;
}
.generation-status__progress--unknown {
  opacity: 0.45;
}
.generation-status__activity {
  margin: 0;
  color: var(--ui-text-muted);
  font-size: 0.8125rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
@keyframes generation-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .generation-status__spinner {
    animation: none;
  }
  .generation-status__progress::-webkit-progress-value {
    transition: none;
  }
}
</style>
