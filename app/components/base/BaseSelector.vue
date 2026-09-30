<template>
  <div class="base-selector">
    <label v-if="label" :for="selectId" class="base-selector__label">
      {{ label }}
    </label>
    <select
      :id="selectId"
      :value="modelValue"
      class="base-selector__select"
      @change="
        emit('update:modelValue', ($event.target as HTMLSelectElement).value)
      "
    >
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </select>
  </div>
</template>

<script lang="ts" setup>
import { computed, useId } from "vue";

interface SelectorOption {
  readonly value: string;
  readonly label: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: readonly SelectorOption[];
    label?: string;
    id?: string;
  }>(),
  { label: "" },
);
const emit = defineEmits<{ "update:modelValue": [value: string] }>();
const generatedId = useId();
const selectId = computed(() => props.id || `selector-${generatedId}`);
</script>

<style scoped>
.base-selector {
  width: 100%;
  min-inline-size: 0;
}

.base-selector__label {
  margin-block-end: 0.5rem;
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: oklch(0.3 0 0);
}

.base-selector__select {
  width: 100%;
  min-block-size: 2.75rem;
  border-radius: 0.375rem;
  border: 1px solid oklch(0.8 0 0);
  background-color: white;
  color: oklch(0.3 0 0);
  padding-inline: 0.75rem;
  padding-block: 0.5rem;
  font-size: 0.875rem;
  box-shadow: 0 1px 2px 0 oklch(0 0 0 / 0.05);
}

.base-selector__select:focus-visible {
  outline: 2px solid oklch(0.5 0.2 250);
  outline-offset: 2px;
}

.dark .base-selector__label {
  color: oklch(0.85 0 0);
}

.dark .base-selector__select {
  border-color: oklch(0.5 0 0);
  background-color: oklch(0.2 0 0);
  color: white;
}

.dark .base-selector__select:focus-visible {
  outline-color: oklch(0.7 0.15 250);
}
</style>
