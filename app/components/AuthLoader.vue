<template>
  <div v-if="shouldShowAuthLoader" class="auth-loader">
    <div class="auth-loader__content">
      <div class="auth-loader__spinner-wrapper">
        <div aria-hidden="true" class="auth-loader__spinner-track"></div>
        <div aria-hidden="true" class="auth-loader__spinner-thumb"></div>
      </div>

      <div class="auth-loader__text">
        <h2 class="auth-loader__title">
          {{ $t("auth.loading.title") }}
        </h2>
        <p class="auth-loader__subtitle">
          {{ $t("auth.loading.subtitle") }}
        </p>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useAuthState } from "~/composables/useAuthState";

const { shouldShowAuthLoader } = useAuthState();
</script>

<style scoped>
.auth-loader {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: oklch(1 0 0);
}

@media (prefers-color-scheme: dark) {
  .auth-loader {
    background-color: oklch(0.145 0 0);
  }
}

.auth-loader__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
}

.auth-loader__spinner-wrapper {
  position: relative;
}

.auth-loader__spinner-track,
.auth-loader__spinner-thumb {
  width: 4rem;
  height: 4rem;
  border-radius: 9999px;
  border-width: 0.25rem;
  border-style: solid;
  animation: auth-loader-spin 0.8s linear infinite;
}

.auth-loader__spinner-track {
  border-color: oklch(0.922 0 0);
}

@media (prefers-color-scheme: dark) {
  .auth-loader__spinner-track {
    border-color: oklch(0.372 0 0);
  }
}

.auth-loader__spinner-thumb {
  position: absolute;
  inset: 0;
  border-block-start-color: oklch(0.623 0.214 145);
  border-inline-end-color: oklch(0.623 0.214 145);
  border-block-end-color: transparent;
  border-inline-start-color: transparent;
}

@keyframes auth-loader-spin {
  to {
    transform: rotate(360deg);
  }
}

.auth-loader__text {
  text-align: center;
}

.auth-loader__title {
  font-size: 1.25rem;
  font-weight: 600;
  color: oklch(0.145 0 0);
}

.auth-loader__subtitle {
  margin-block-start: 0.5rem;
  color: oklch(0.446 0 0);
}

@media (prefers-color-scheme: dark) {
  .auth-loader__title {
    color: oklch(0.985 0 0);
  }

  .auth-loader__subtitle {
    color: oklch(0.627 0 0);
  }
}
</style>
