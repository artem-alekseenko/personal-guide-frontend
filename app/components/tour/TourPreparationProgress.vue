<script setup lang="ts">
import { computed } from "vue";
import { usePreparationPercent } from "~/composables/tour/usePreparationPercent";
import type { PreparationProgress } from "#shared/types/preparationProgress";

const props = defineProps<{
  progress: PreparationProgress;
  compact?: boolean;
  refreshing?: boolean;
  statusRefreshing?: boolean;
  refreshFailed?: boolean;
  captionUncertain?: boolean;
}>();
const emit = defineEmits<{ refresh: []; refreshStatus: [] }>();
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
const visibleFields = [
  "sources_count",
  "tool_calls_completed",
  "claims_count",
  "word_count",
] as const;
const compactFields = ["sources_count"] as const;
const liveCounterFields = [
  "turns_started",
  "turns_completed",
  "tool_calls_completed",
] as const;
const liveSpendFields = [
  "spent_micros",
  "reserved_micros",
  "remaining_micros",
] as const;
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
const stopPhases = [
  "QUEUED",
  "THINKING",
  "SEARCHING",
  "FETCHING",
  "READING",
  "SUBMITTING",
  "CHECKPOINT",
  "WRAPUP",
  "COMPLETED",
  "SKIPPED",
  "FAILED",
  "CANCELLED",
];
const spendFields = [
  "limit_micros",
  "spent_micros",
  "reserved_micros",
  "remaining_micros",
] as const;
const richProgress = computed(
  () => props.progress.rich_progress_enabled !== false,
);
const isPending = computed(() =>
  ["PENDING", "RUNNING"].includes(props.progress.status),
);
const isLoading = computed(
  () => isPending.value && props.progress.is_loading !== false,
);
const partialCompletion = computed(() => {
  if (props.progress.status !== "READY") return null;
  if (props.progress.completion_reason === "budget_wrap_up")
    return "budgetWrapUp";
  if (
    props.progress.partial_result ||
    props.progress.completion_reason === "incomplete_wrap_up"
  )
    return "incompleteWrapUp";
  return null;
});
const validPercent = (value: number | undefined): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 100;
const statusClass = computed(() =>
  props.progress.status === "FAILED"
    ? "border-error/40 text-error"
    : props.progress.status === "CANCELLED"
      ? "border-warning/40 text-warning"
      : "border-default text-default",
);
const activeStops = computed(() => {
  if (!isPending.value) return [];
  const running = props.progress.stops.filter(
    (stop) => stop.status === "RUNNING",
  );
  return running.length
    ? running
    : props.progress.stops.filter((stop) => stop.status === "QUEUED");
});
const isNonnegative = (value: number | null | undefined): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const formatCount = (value: number | null | undefined) =>
  isNonnegative(value) ? value.toLocaleString() : "—";
const formatDuration = (value: number) => {
  const seconds = Math.floor(value);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};
const formatTime = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
};
const updatedAt = computed(() => formatTime(props.progress.updated_at));
const percent = usePreparationPercent(() => props.progress);
const remainingKind = computed(() => {
  const kind = props.progress.remaining_time_kind;
  if (kind === "complete") return kind;
  return (kind === "estimate" || kind === "deadline") &&
    isNonnegative(props.progress.remaining_seconds)
    ? kind
    : "unknown";
});
const activityUpdatedAt = computed(() =>
  formatTime(props.progress.activity_updated_at),
);
const activitySource = computed(() =>
  props.progress.activity_source === "llm" ||
  props.progress.activity_source === "fallback"
    ? props.progress.activity_source
    : "recorded",
);
const captionFallback = computed(() => {
  const reason = props.progress.activity_fallback_reason;
  if (
    [
      "request_in_progress",
      "request_uncertain",
      "receipt_uncertain",
      "idempotency_conflict",
    ].includes(reason ?? "")
  )
    return "uncertain";
  if (
    [
      "budget_unavailable",
      "budget_exhausted",
      "insufficient_budget",
      "capacity_reserved",
    ].includes(reason ?? "")
  )
    return "budget";
  if (
    ["repeated_output", "unsafe_output", "invalid_output"].includes(
      reason ?? "",
    )
  )
    return "wording";
  return "unavailable";
});
const formatSpend = (micros: number) =>
  isNonnegative(micros) && Number.isSafeInteger(micros)
    ? (micros / 1_000_000).toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      })
    : "—";
</script>

<template>
  <section
    :aria-label="$t('preparationProgress.title')"
    :data-preparation-status="progress.status"
    class="bg-elevated mt-3 min-w-0 rounded-lg border text-sm"
    :class="[statusClass, compact ? 'p-3' : 'p-4']"
  >
    <div class="flex items-start gap-2" :aria-busy="isLoading">
      <span
        v-if="isLoading"
        aria-hidden="true"
        class="border-primary/30 border-t-primary mt-0.5 size-5 shrink-0 animate-spin rounded-full border-2 motion-reduce:animate-none"
      />
      <div class="min-w-0">
        <p class="font-semibold" role="status" aria-live="polite">
          {{ $t(`preparationProgress.statuses.${progress.status}`) }}
        </p>
        <p v-if="isPending" class="text-default mt-1 break-words">
          {{
            phases.includes(progress.phase)
              ? $t(`preparationProgress.phases.${progress.phase}`)
              : $t("preparationProgress.phaseUnknown")
          }}
          <span v-if="!phases.includes(progress.phase) && progress.phase">
            · {{ progress.phase }}
          </span>
        </p>
      </div>
    </div>
    <div
      v-if="progress.step_name || progress.step_description"
      data-preparation-step
      class="text-default mt-2 break-words"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <p v-if="progress.step_name" class="font-medium">
        {{ progress.step_name }}
      </p>
      <p v-if="progress.step_description" class="text-muted mt-1">
        {{ progress.step_description }}
      </p>
      <p
        v-if="isPending && validPercent(progress.step_percent)"
        class="text-muted mt-1 text-xs"
      >
        {{ $t("preparationProgress.stepProgress") }}:
        {{ Math.floor(progress.step_percent) }}%
      </p>
    </div>
    <p
      v-if="isLoading"
      data-preparation-loading
      class="text-muted mt-1 text-xs"
    >
      {{ $t("preparationProgress.loadingStep") }}
    </p>
    <p
      v-if="partialCompletion"
      data-preparation-partial-result
      role="status"
      class="text-warning mt-2 break-words"
    >
      {{ $t(`preparationProgress.${partialCompletion}`) }}
    </p>
    <p
      v-if="richProgress && progress.status_text && !compact"
      class="text-default mt-2 break-words"
    >
      <span class="text-muted"
        >{{ $t("preparationProgress.serverStatus") }}:</span
      >
      {{ progress.status_text }}
    </p>
    <div class="text-default mt-3">
      <p
        class="flex flex-wrap items-baseline justify-between gap-x-3 tabular-nums"
      >
        <span>{{ $t("preparationProgress.progress") }}</span>
        <strong>
          {{
            percent === null
              ? $t("preparationProgress.progressUnknown")
              : `${formatCount(percent)}%`
          }}
        </strong>
      </p>
      <progress
        v-if="percent !== null"
        :value="percent"
        max="100"
        :aria-label="$t('preparationProgress.progressEstimate')"
        :aria-valuenow="percent"
        aria-valuemin="0"
        aria-valuemax="100"
        class="preparation-progress mt-2 block h-2 w-full"
      />
      <p v-if="percent !== null" class="text-muted mt-1 text-xs">
        {{
          $t(
            compact
              ? "preparationProgress.progressEstimate"
              : "preparationProgress.progressEstimateNotice",
          )
        }}
      </p>
    </div>
    <div
      v-if="richProgress"
      data-live-research-summary
      class="border-default mt-3 border-t pt-3"
    >
      <p class="text-muted text-xs">
        {{ $t("preparationProgress.livePhase") }}
      </p>
      <p class="text-default break-words">
        {{
          phases.includes(progress.phase)
            ? $t(`preparationProgress.phases.${progress.phase}`)
            : progress.phase || $t("preparationProgress.phaseUnknown")
        }}
      </p>
      <dl
        class="text-default mt-2 grid grid-cols-2 gap-x-3 gap-y-2 tabular-nums"
      >
        <div v-for="field in liveCounterFields" :key="field">
          <dt class="text-muted">
            {{ $t(`preparationProgress.metrics.${field}`) }}
          </dt>
          <dd :data-live-research-counter="field">
            {{ formatCount(progress[field]) }}
          </dd>
        </div>
        <template v-if="progress.research_spend">
          <div v-for="field in liveSpendFields" :key="field">
            <dt class="text-muted">
              {{ $t(`preparationProgress.spend.${field}`) }}
            </dt>
            <dd :data-live-research-spend="field">
              {{ formatSpend(progress.research_spend[field]) }}
            </dd>
          </div>
        </template>
      </dl>
      <p v-if="isPending" class="text-muted mt-2 text-xs">
        {{ $t("preparationProgress.liveCadence") }}
      </p>
    </div>
    <template v-if="richProgress">
      <dl
        class="text-default mt-3 grid grid-cols-2 gap-x-3 gap-y-2 tabular-nums"
      >
        <div>
          <dt class="text-muted">{{ $t("preparationProgress.elapsed") }}</dt>
          <dd data-research-elapsed>
            <template v-if="isNonnegative(progress.elapsed_seconds)">
              <time :datetime="`PT${progress.elapsed_seconds}S`">{{
                formatDuration(progress.elapsed_seconds)
              }}</time>
            </template>
            <template v-else>{{
              $t("preparationProgress.progressUnknown")
            }}</template>
          </dd>
        </div>
        <div>
          <dt class="text-muted">
            {{ $t(`preparationProgress.remainingLabels.${remainingKind}`) }}
          </dt>
          <dd :data-remaining-kind="remainingKind">
            <template
              v-if="
                remainingKind === 'estimate' || remainingKind === 'deadline'
              "
            >
              <time :datetime="`PT${progress.remaining_seconds}S`">{{
                formatDuration(progress.remaining_seconds!)
              }}</time>
            </template>
            <template v-else>
              {{ $t(`preparationProgress.remainingValues.${remainingKind}`) }}
            </template>
          </dd>
        </div>
      </dl>
      <p
        v-if="
          !compact &&
          (remainingKind === 'estimate' || remainingKind === 'deadline')
        "
        class="text-muted mt-1 text-xs"
      >
        {{ $t(`preparationProgress.remainingNotices.${remainingKind}`) }}
      </p>
      <p
        v-if="!isPending"
        data-research-completion-notice
        class="text-muted mt-2 text-xs"
      >
        {{ $t("preparationProgress.completionNotice") }}
      </p>
      <p
        v-if="
          progress.status === 'READY' &&
          isNonnegative(progress.skipped_stops) &&
          progress.skipped_stops > 0
        "
        data-research-gap-notice
        class="text-warning mt-2"
      >
        {{ $t("preparationProgress.skippedNotice") }}
      </p>
      <div v-if="isPending || progress.activity_text" class="text-default mt-3">
        <p class="text-muted text-xs">
          {{ $t("preparationProgress.activity") }}
        </p>
        <p
          v-if="progress.activity_text"
          class="break-words"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-research-activity
        >
          {{ progress.activity_text }}
        </p>
        <p
          v-if="progress.activity_text"
          class="text-muted mt-1 text-xs"
          :data-activity-source="activitySource"
        >
          {{ $t(`preparationProgress.activitySources.${activitySource}`) }}
          <span
            v-if="activitySource === 'fallback'"
            :data-caption-fallback="
              progress.activity_fallback_reason ?? 'unavailable'
            "
          >
            {{ $t(`preparationProgress.captionFallbacks.${captionFallback}`) }}
          </span>
        </p>
        <p v-else-if="!activeStops.length" class="break-words" role="status">
          {{
            phases.includes(progress.phase)
              ? $t(`preparationProgress.phases.${progress.phase}`)
              : $t("preparationProgress.waitingForActivity")
          }}
        </p>
        <ul
          v-if="activeStops.length && (!compact || !progress.activity_text)"
          class="mt-1 grid gap-1"
          data-active-research-stops
        >
          <li
            v-for="stop in activeStops"
            :key="stop.stop_id"
            class="break-words"
          >
            <span class="font-medium">{{ stop.name }}</span>
            ·
            {{
              stopPhases.includes(stop.phase)
                ? $t(`preparationProgress.stopPhases.${stop.phase}`)
                : stop.phase
            }}
          </li>
        </ul>
        <p v-if="activityUpdatedAt" class="text-muted mt-1 text-xs">
          {{ $t("preparationProgress.activityUpdatedAt") }}
          <time :datetime="progress.activity_updated_at ?? undefined">{{
            activityUpdatedAt
          }}</time>
        </p>
      </div>
    </template>
    <p v-if="progress.error" class="text-error mt-2 break-words" role="alert">
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
    <dl
      v-if="richProgress"
      class="text-default mt-3 grid grid-cols-2 gap-x-3 gap-y-2 tabular-nums"
      data-research-counters
    >
      <div>
        <dt class="text-muted">
          {{ $t("preparationProgress.completedStops") }}
        </dt>
        <dd data-completed-stops>
          {{ formatCount(progress.completed_stops) }} /
          {{ formatCount(progress.total_stops) }}
        </dd>
      </div>
      <div
        v-if="
          !compact ||
          (isNonnegative(progress.skipped_stops) && progress.skipped_stops > 0)
        "
      >
        <dt class="text-muted">{{ $t("preparationProgress.skippedStops") }}</dt>
        <dd data-skipped-stops>{{ formatCount(progress.skipped_stops) }}</dd>
      </div>
      <div v-if="compact && isPending">
        <dt class="text-muted">
          {{ $t("preparationProgress.activeResearchers") }}
        </dt>
        <dd>{{ formatCount(progress.active_researchers) }}</dd>
      </div>
      <div
        v-for="field in compact ? compactFields : visibleFields"
        :key="field"
      >
        <dt class="text-muted">
          {{ $t(`preparationProgress.metrics.${field}`) }}
        </dt>
        <dd :data-research-counter="field">
          {{ formatCount(progress[field]) }}
        </dd>
      </div>
    </dl>
    <p
      v-if="
        richProgress &&
        updatedAt &&
        (!compact || updatedAt !== activityUpdatedAt)
      "
      class="text-muted mt-3 text-xs"
    >
      {{ $t("preparationProgress.updatedAt") }}
      <time :datetime="progress.updated_at ?? undefined">{{ updatedAt }}</time>
    </p>
    <p
      v-if="refreshing"
      data-research-refreshing
      role="status"
      class="text-muted mt-1 flex items-center gap-2 text-xs"
    >
      <span
        aria-hidden="true"
        class="border-primary/30 border-t-primary size-3 shrink-0 animate-spin rounded-full border-2 motion-reduce:animate-none"
      />
      {{ $t("preparationProgress.refreshing") }}
    </p>
    <p
      v-if="refreshFailed"
      data-research-refresh-failed
      class="text-warning mt-2"
      role="status"
    >
      {{ $t("preparationProgress.refreshFailed") }}
    </p>
    <p
      v-if="richProgress && captionUncertain"
      data-caption-uncertain
      role="status"
      class="text-warning mt-2 text-xs"
    >
      {{ $t("preparationProgress.captionUncertain") }}
    </p>
    <button
      v-if="progress.status === 'FAILED'"
      type="button"
      :disabled="statusRefreshing ?? refreshing"
      class="focus-visible:outline-primary mt-2 min-h-11 rounded px-2 text-xs underline underline-offset-2 focus-visible:outline-2"
      data-refresh-status
      @click="emit('refreshStatus')"
    >
      {{ $t("preparationProgress.refreshStatus") }}
    </button>
    <button
      v-if="(richProgress && captionUncertain) || isPending"
      type="button"
      :disabled="refreshing"
      class="focus-visible:outline-primary mt-2 min-h-11 rounded px-2 text-xs underline underline-offset-2 focus-visible:outline-2"
      data-refresh-progress
      @click="
        richProgress && captionUncertain
          ? emit('refresh')
          : emit('refreshStatus')
      "
    >
      {{
        $t(
          richProgress && captionUncertain
            ? "preparationProgress.reconcileCaption"
            : "preparationProgress.refresh",
        )
      }}
    </button>
    <details v-if="richProgress" class="text-default mt-2">
      <summary
        class="focus-visible:outline-primary min-h-11 cursor-pointer rounded py-3 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {{ $t("preparationProgress.details") }}
      </summary>
      <template v-if="compact">
        <p v-if="progress.status_text" class="mt-2 break-words">
          <span class="text-muted"
            >{{ $t("preparationProgress.serverStatus") }}:</span
          >
          {{ progress.status_text }}
        </p>
        <p v-if="percent !== null" class="text-muted mt-2 text-xs">
          {{ $t("preparationProgress.progressEstimateNotice") }}
        </p>
        <p
          v-if="remainingKind === 'estimate' || remainingKind === 'deadline'"
          class="text-muted mt-2 text-xs"
        >
          {{ $t(`preparationProgress.remainingNotices.${remainingKind}`) }}
        </p>
      </template>
      <dl class="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 tabular-nums">
        <div v-if="!compact || !isPending">
          <dt class="text-muted">
            {{ $t("preparationProgress.activeResearchers") }}
          </dt>
          <dd>{{ formatCount(progress.active_researchers) }}</dd>
        </div>
        <div v-for="field in fields" :key="field">
          <dt class="text-muted">
            {{ $t(`preparationProgress.metrics.${field}`) }}
          </dt>
          <dd :data-research-counter="field">
            {{ formatCount(progress[field]) }}
          </dd>
        </div>
      </dl>
      <p class="text-muted mt-3 text-xs">
        {{ $t("preparationProgress.savedNotice") }}
      </p>
      <div
        v-if="progress.research_spend"
        class="border-default mt-3 border-t pt-3"
      >
        <h3 class="font-medium">{{ $t("preparationProgress.spendTitle") }}</h3>
        <dl class="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 tabular-nums">
          <div v-for="field in spendFields" :key="field">
            <dt class="text-muted">
              {{ $t(`preparationProgress.spend.${field}`) }}
            </dt>
            <dd :data-research-spend="field">
              {{ formatSpend(progress.research_spend[field]) }}
            </dd>
          </div>
        </dl>
        <p class="text-muted mt-2 text-xs">
          {{ $t("preparationProgress.spendNotice") }}
        </p>
      </div>
      <ul v-if="progress.stops.length" class="mt-3 grid gap-3">
        <li
          v-for="stop in progress.stops"
          :key="stop.stop_id"
          class="border-default min-w-0 border-t pt-3"
        >
          <h3 class="font-medium break-words">{{ stop.name }}</h3>
          <p class="text-muted mt-1 break-words">
            {{ $t(`preparationProgress.stopStatuses.${stop.status}`) }}
            ·
            {{
              stopPhases.includes(stop.phase)
                ? $t(`preparationProgress.stopPhases.${stop.phase}`)
                : stop.phase
            }}
            · {{ $t("preparationProgress.attempt") }}
            {{ formatCount(stop.attempt) }}
          </p>
          <p v-if="stop.step_name" class="mt-1 break-words" data-stop-step>
            {{ stop.step_name }}
          </p>
          <p v-if="stop.step_description" class="text-muted mt-1 break-words">
            {{ stop.step_description }}
          </p>
          <p
            v-if="validPercent(stop.progress_percent)"
            class="text-muted mt-1 text-xs"
            data-stop-progress
          >
            {{ $t("preparationProgress.stopProgress") }}:
            {{ Math.floor(stop.progress_percent) }}%
          </p>
          <dl
            class="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs tabular-nums"
          >
            <div v-for="field in fields" :key="field">
              <dt class="text-muted">
                {{ $t(`preparationProgress.metrics.${field}`) }}
              </dt>
              <dd>{{ formatCount(stop[field]) }}</dd>
            </div>
          </dl>
        </li>
      </ul>
    </details>
  </section>
</template>

<style scoped>
.preparation-progress {
  overflow: hidden;
  appearance: none;
  border: 0;
  border-radius: 9999px;
  background: var(--ui-bg-accented);
  color: var(--ui-primary);
}
.preparation-progress::-webkit-progress-bar {
  border-radius: 9999px;
  background: var(--ui-bg-accented);
}
.preparation-progress::-webkit-progress-value {
  border-radius: 9999px;
  background: currentColor;
  transition: width 80ms linear;
}
.preparation-progress::-moz-progress-bar {
  border-radius: 9999px;
  background: currentColor;
}
@media (prefers-reduced-motion: reduce) {
  .preparation-progress::-webkit-progress-value {
    transition: none;
  }
}
</style>
