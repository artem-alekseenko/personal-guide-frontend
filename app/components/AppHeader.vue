<template>
  <header
    class="w-full border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
  >
    <div
      class="container mx-auto flex items-center justify-between p-4 md:px-12"
    >
      <div class="flex items-center space-x-3">
        <AppBackButton />

        <h1 class="text-2xl font-extrabold text-gray-900 dark:text-white">
          {{ pageTitle }}
        </h1>
      </div>

      <div v-if="isAuthenticated" class="flex items-center space-x-4">
        <UButton
          v-if="route.name !== 'settings'"
          :aria-label="$t('common.settings')"
          icon="i-heroicons-cog-6-tooth"
          size="lg"
          variant="ghost"
          @click="goToSettings"
        />

        <div class="flex items-center">
          <div
            v-if="!userAvatar || userAvatar === '/default-avatar.png'"
            class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200"
          >
            <span class="text-sm font-medium text-gray-600">
              {{ userName.charAt(0).toUpperCase() }}
            </span>
          </div>
          <UAvatar v-else :alt="userName" :src="userAvatar" size="sm" />
        </div>
      </div>
    </div>
  </header>
</template>

<script lang="ts" setup>
import { useAuth } from "~/composables/useAuth";
import { usePageTitle } from "~/composables/usePageTitle";
import AppBackButton from "~/components/AppBackButton.vue";

const route = useRoute();
const router = useRouter();
const { userName, userAvatar, isAuthenticated } = useAuth();
const { pageTitle } = usePageTitle();

const goToSettings = (): void => {
  router.push("/settings");
};
</script>
