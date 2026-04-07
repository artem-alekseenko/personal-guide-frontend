<template>
  <label :class="['pg-switch', `pg-switch--${size}`]">
    <input
      :checked="modelValue"
      class="pg-switch__input"
      role="switch"
      type="checkbox"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span aria-hidden="true" class="pg-switch__track">
      <span class="pg-switch__thumb" />
    </span>
  </label>
</template>

<script lang="ts" setup>
withDefaults(
  defineProps<{
    modelValue: boolean;
    size?: "xs" | "sm" | "md" | "lg";
  }>(),
  { size: "md" },
);

defineEmits<{ "update:modelValue": [value: boolean] }>();
</script>

<style scoped>
.pg-switch {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  user-select: none;

  /* Size tokens – overridden per size modifier */
  --pg-switch-w: 2.75rem;
  --pg-switch-h: 1.5rem;
  --pg-switch-thumb-size: 1.25rem;
}

/* Visually hidden, but stays in tab order for accessibility */
.pg-switch__input {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.pg-switch__track {
  position: relative;
  display: inline-block;
  flex-shrink: 0;
  inline-size: var(--pg-switch-w);
  block-size: var(--pg-switch-h);
  border-radius: 9999px;
  background-color: var(--fill-gray-300);
  transition: background-color 0.2s ease;
}

.pg-switch__input:checked ~ .pg-switch__track {
  background-color: var(--fill-green-500);
}

.pg-switch__input:focus-visible ~ .pg-switch__track {
  outline: 2px solid var(--fill-green-500);
  outline-offset: 2px;
}

.pg-switch__thumb {
  position: absolute;
  inset-block-start: 50%;
  inset-inline-start: 0.125rem;
  inline-size: var(--pg-switch-thumb-size);
  block-size: var(--pg-switch-thumb-size);
  border-radius: 9999px;
  background-color: oklch(1 0 0);
  box-shadow: 0 0.0625rem 0.1875rem oklch(0 0 0 / 0.25);
  transform: translateY(-50%);
  transition: inset-inline-start 0.2s ease;
}

.pg-switch__input:checked ~ .pg-switch__track .pg-switch__thumb {
  inset-inline-start: calc(var(--pg-switch-w) - var(--pg-switch-thumb-size) - 0.125rem);
}

/* ─── Sizes ─── */

.pg-switch--xs {
  --pg-switch-w: 1.75rem;
  --pg-switch-h: 1rem;
  --pg-switch-thumb-size: 0.75rem;
}

.pg-switch--sm {
  --pg-switch-w: 2.25rem;
  --pg-switch-h: 1.25rem;
  --pg-switch-thumb-size: 1rem;
}

.pg-switch--md {
  --pg-switch-w: 2.75rem;
  --pg-switch-h: 1.5rem;
  --pg-switch-thumb-size: 1.25rem;
}

.pg-switch--lg {
  --pg-switch-w: 3.5rem;
  --pg-switch-h: 2rem;
  --pg-switch-thumb-size: 1.75rem;
}

/* ─── Dark mode ─── */

.dark .pg-switch__track {
  background-color: var(--fill-gray-600);
}

.dark .pg-switch__input:checked ~ .pg-switch__track {
  background-color: var(--fill-green-500);
}
</style>
