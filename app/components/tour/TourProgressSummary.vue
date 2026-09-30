<template>
  <section
    :aria-label="$t('tourProgress.title')"
    class="mx-4 grid min-w-0 gap-3 rounded-xl border border-neutral-200 bg-white p-3 text-sm text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="font-semibold">{{ $t("tourProgress.title") }}</h2>
      <span v-if="progress.isFinished" class="text-xs">
        {{ $t("tourProgress.finished") }}
      </span>
    </div>
    <p
      v-if="recordedDate"
      class="text-xs text-neutral-600 dark:text-neutral-300"
    >
      {{ $t("tourProgress.recordedAt") }}
      <time :datetime="progress.updatedAt!">{{ recordedDate }}</time>
    </p>
    <div class="grid gap-1">
      <p v-if="hasKnownPosition" class="font-medium">
        {{
          $t("tourProgress.position", {
            position: progress.stopPosition,
            total: progress.totalStops,
          })
        }}
      </p>
      <p v-else>{{ $t("tourProgress.unknownPosition") }}</p>
      <meter
        v-if="hasKnownPosition"
        :aria-label="$t('tourProgress.routePosition')"
        :aria-valuetext="
          $t('tourProgress.position', {
            position: progress.stopPosition,
            total: progress.totalStops,
          })
        "
        :value="progress.stopPosition!"
        :max="progress.totalStops"
        min="0"
        class="h-3 w-full"
      >
        {{
          $t("tourProgress.position", {
            position: progress.stopPosition,
            total: progress.totalStops,
          })
        }}
      </meter>
      <p v-if="progress.stopName" class="break-words">
        <span class="text-neutral-600 dark:text-neutral-300">
          {{ $t(`tourProgress.stopLabels.${progress.locationLabel}`) }}:
        </span>
        {{ progress.stopName }}
      </p>
      <p class="text-xs text-neutral-600 dark:text-neutral-300">
        {{ $t(`tourProgress.locationStatus.${progress.locationLabel}`) }}
      </p>
    </div>
    <div class="grid gap-1">
      <h3 class="font-medium">{{ $t("tourProgress.lastLocation") }}</h3>
      <p v-if="progress.coordinates" class="break-all tabular-nums">
        {{ progress.coordinates.lat }}, {{ progress.coordinates.lng }}
      </p>
      <p v-else class="text-neutral-600 dark:text-neutral-300">
        {{ $t("tourProgress.noLocation") }}
      </p>
    </div>
    <div class="grid min-w-0 gap-1">
      <h3 class="font-medium">{{ $t("tourProgress.latestText") }}</h3>
      <p v-if="text" class="break-words whitespace-pre-wrap">{{ excerpt }}</p>
      <p v-else class="text-neutral-600 dark:text-neutral-300">
        {{ $t("tourProgress.noText") }}
      </p>
      <details v-if="isTruncated" class="min-w-0">
        <summary
          class="min-h-11 cursor-pointer py-2 underline underline-offset-2"
        >
          {{ $t("tourProgress.fullText") }}
        </summary>
        <p class="mt-1 break-words whitespace-pre-wrap">{{ text }}</p>
      </details>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { TourProgress } from "#shared/utils/tourProgress";

const props = defineProps<{ progress: TourProgress }>();
const { locale } = useI18n();
const hasKnownPosition = computed(
  () =>
    Number.isInteger(props.progress.stopPosition) &&
    props.progress.stopPosition !== null &&
    props.progress.stopPosition >= 1 &&
    props.progress.stopPosition <= props.progress.totalStops,
);
const text = computed(() => props.progress.latestText?.trim() ?? "");
const words = computed(() => text.value.split(/\s+/));
const isTruncated = computed(() => words.value.length > 35);
const excerpt = computed(() =>
  isTruncated.value ? `… ${words.value.slice(-35).join(" ")}` : text.value,
);
const recordedDate = computed(() => {
  if (!props.progress.updatedAt) return null;
  const date = new Date(props.progress.updatedAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale.value, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
});
</script>
