<template>
  <div
    v-if="shouldShowAuthLoader"
    class="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-900"
  >
    <div class="flex flex-col items-center space-y-6">
      <!-- Spinner -->
      <div class="relative">
        <div class="h-16 w-16 animate-spin rounded-full border-4 border-gray-200 dark:border-gray-700"></div>
        <div class="absolute inset-0 h-16 w-16 animate-spin rounded-full border-4 border-t-green-500 border-r-green-500 border-b-transparent border-l-transparent"></div>
      </div>
      
      <!-- Loading text -->
      <div class="text-center">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
          {{ $t('auth.loading.title') }}
        </h2>
        <p class="mt-2 text-gray-600 dark:text-gray-400">
          {{ $t('auth.loading.subtitle') }}
        </p>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useAuthState } from "~/composables/useAuthState";

const { shouldShowAuthLoader } = useAuthState();
</script> 