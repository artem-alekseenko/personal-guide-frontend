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
        <UButton
          v-if="route.name !== 'settings'"
          :aria-label="$t('common.settings')"
          icon="i-heroicons-cog-6-tooth"
          size="lg"
          variant="ghost"
          @click="goToSettings"
        />
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
</style>
