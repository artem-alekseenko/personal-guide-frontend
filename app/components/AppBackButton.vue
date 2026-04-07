<template>
  <button
    v-if="shouldShow"
    :aria-label="$t('common.goBack')"
    class="app-back-button"
    type="button"
    @click="goBack"
  >
    <svg
      aria-hidden="true"
      class="app-back-button__icon"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </button>
</template>

<script lang="ts" setup>
import { useBackNavigation } from "~/composables/ui/useBackNavigation";

const { shouldShow, goBack } = useBackNavigation();
</script>

<style scoped>
.app-back-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem;
  border-radius: 0.375rem;
  border: none;
  background: transparent;
  color: var(--fill-green-500);
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.app-back-button:hover {
  background-color: var(--fill-gray-100);
}

.app-back-button:active {
  background-color: var(--fill-gray-200);
}

.app-back-button__icon {
  inline-size: 1.25rem;
  block-size: 1.25rem;
  flex-shrink: 0;
}

.dark .app-back-button {
  color: var(--fill-gray-100);
}

.dark .app-back-button:hover {
  background-color: var(--fill-gray-700);
}

.dark .app-back-button:active {
  background-color: var(--fill-gray-600);
}
</style>
