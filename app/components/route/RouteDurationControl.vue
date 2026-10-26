<script setup lang="ts">
import { computed } from "vue";
const props = defineProps<{ min: number; max: number }>();
const duration = defineModel<number>({ required: true });
const { t } = useI18n();
const formattedTime = computed(() =>
  t("common.timeFormat.minutes", { count: duration.value }),
);
</script>

<template>
  <div class="route-duration">
    <div class="route-duration__heading">
      <label for="tour-duration" class="route-duration__label">{{
        $t("pages.createRoute.durationLabel")
      }}</label>
      <output for="tour-duration" class="route-duration__value">{{
        formattedTime
      }}</output>
    </div>
    <input
      id="tour-duration"
      type="range"
      :value="duration"
      :min="props.min"
      :max="props.max"
      :aria-valuetext="formattedTime"
      class="route-duration__slider"
      @input="duration = Number(($event.target as HTMLInputElement).value)"
    />
    <div class="route-duration__limits" aria-hidden="true">
      <span>{{ $t("pages.createRoute.minDuration") }}</span>
      <span>{{ $t("pages.createRoute.maxDuration") }}</span>
    </div>
  </div>
</template>

<style scoped>
.route-duration__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.route-duration__label {
  color: var(--ui-text);
  font-size: 0.875rem;
  line-height: 1.5;
}
.route-duration__value {
  flex-shrink: 0;
  padding: 0.5rem 0.75rem;
  border-radius: 0.875rem;
  background: color-mix(in srgb, var(--ui-primary) 8%, var(--ui-bg));
  color: var(--ui-text-highlighted);
  font-size: 1.125rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}
.route-duration__slider {
  display: block;
  inline-size: 100%;
  min-block-size: 2.75rem;
  margin-block: 0.5rem 0;
  appearance: none;
  background: transparent;
  cursor: pointer;
}
.route-duration__slider::-webkit-slider-runnable-track {
  height: 0.375rem;
  border-radius: 999px;
  background: var(--ui-bg-accented);
}
.route-duration__slider::-moz-range-track {
  height: 0.375rem;
  border-radius: 999px;
  background: var(--ui-bg-accented);
}
.route-duration__slider::-webkit-slider-thumb {
  appearance: none;
  width: 1.25rem;
  height: 1.25rem;
  margin-top: -0.4375rem;
  border: 3px solid
    color-mix(in srgb, var(--ui-primary) 45%, var(--ui-text-highlighted));
  border-radius: 50%;
  background: var(--ui-bg);
  box-shadow: 0 1px 4px color-mix(in srgb, var(--ui-text) 15%, transparent);
}
.route-duration__slider::-moz-range-thumb {
  box-sizing: border-box;
  width: 1.25rem;
  height: 1.25rem;
  border: 3px solid
    color-mix(in srgb, var(--ui-primary) 45%, var(--ui-text-highlighted));
  border-radius: 50%;
  background: var(--ui-bg);
}
.route-duration__slider:focus-visible {
  outline: 2px solid var(--ui-primary);
  outline-offset: 2px;
  border-radius: 0.5rem;
}
.route-duration__limits {
  display: flex;
  justify-content: space-between;
  color: var(--ui-text-muted);
  font-size: 0.75rem;
}
</style>
