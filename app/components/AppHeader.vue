<template>
  <header class="app-header">
    <div class="app-header__inner">
      <div class="app-header__start">
        <AppBackButton />

        <h1 class="app-header__title">
          {{ pageTitle }}
        </h1>
      </div>

      <div v-if="isAuthenticated" class="app-header__end">
        <button
          v-if="route.name !== 'settings'"
          :aria-label="$t('common.settings')"
          class="app-header__settings-btn"
          type="button"
          @click="goToSettings"
        >
          <svg
            aria-hidden="true"
            class="app-header__settings-icon"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  </header>
</template>

<script lang="ts" setup>
import {useAuth} from "~/composables/auth/useAuth";
import {usePageTitle} from "~/composables/ui/usePageTitle";
import AppBackButton from "~/components/AppBackButton.vue";

const route = useRoute();
const router = useRouter();
const { isAuthenticated } = useAuth();
const { pageTitle } = usePageTitle();

const goToSettings = (): void => {
  router.push("/settings");
};
</script>

<style scoped>
.app-header {
  width: 100%;
  border-block-end: 1px solid var(--fill-gray-200);
  background-color: var(--fill-white);
}

.dark .app-header {
  border-block-end-color: var(--fill-gray-700);
  background-color: var(--fill-gray-900);
}

.app-header__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 80rem;
  margin-inline: auto;
  padding: 1rem;
}

.app-header__start {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.app-header__title {
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--fill-gray-900);
}

.dark .app-header__title {
  color: var(--fill-white);
}

.app-header__settings-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  border-radius: 0.5rem;
  border: none;
  background: transparent;
  color: var(--fill-gray-600);
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.app-header__settings-btn:hover {
  background-color: var(--fill-gray-100);
}

.app-header__settings-btn:active {
  background-color: var(--fill-gray-200);
}

.app-header__settings-icon {
  inline-size: 1.5rem;
  block-size: 1.5rem;
  flex-shrink: 0;
}

.dark .app-header__settings-btn {
  color: var(--fill-gray-300);
}

.dark .app-header__settings-btn:hover {
  background-color: var(--fill-gray-800);
}

.dark .app-header__settings-btn:active {
  background-color: var(--fill-gray-700);
}
</style>
