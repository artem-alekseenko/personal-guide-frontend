<template>
  <div
    v-if="isSaving"
    class="settings-saving-overlay"
  >
    <!-- Spinner -->
    <div class="settings-saving-spinner">
      <div class="spinner-ring"></div>
      <div class="spinner-ring spinner-ring--inner"></div>
    </div>
  </div>
</template>

<script lang="ts" setup>
interface Props {
  isSaving: boolean;
}

defineProps<Props>();
</script>

<style scoped>
.settings-saving-overlay {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-saving-spinner {
  position: relative;
  width: 3rem;
  height: 3rem;
}

.spinner-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 3px solid oklch(0.9 0 0);
  border-top-color: oklch(0.5 0.2 250);
  animation: spin 1s linear infinite;
}

.spinner-ring--inner {
  inset: 0.5rem;
  border-width: 2px;
  border-top-color: oklch(0.6 0.2 250);
  animation: spin 0.8s linear infinite reverse;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style> 