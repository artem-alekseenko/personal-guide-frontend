<template>
  <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
    <!-- User profile -->
    <div class="mt-4 mb-8">
      <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        {{ $t("pages.settings.profile") }}
      </h3>

      <div class="mb-4 flex items-center">
        <div
          v-if="!userAvatar || userAvatar === '/default-avatar.png'"
          class="mr-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-200"
        >
          <span class="text-2xl font-bold text-gray-600">
            {{ userName.charAt(0).toUpperCase() }}
          </span>
        </div>
        <img
          v-else
          :alt="userName"
          :src="userAvatar"
          class="mr-4 h-16 w-16 rounded-full"
        />
        <div>
          <h4 class="text-lg font-medium text-gray-900 dark:text-white">
            {{ userName }}
          </h4>
          <p class="text-gray-600 dark:text-gray-400">
            {{ profile?.email }}
          </p>
        </div>
      </div>
    </div>

    <!-- Preferences -->
    <div class="mb-8">
      <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        {{ $t("pages.settings.preferences") }}
      </h3>

      <div class="space-y-4">
        <!-- Language -->
        <LanguageSelector
          :preferences="preferences"
          @update:preferences="handlePreferencesUpdate"
        />
        
        <!-- Voice Type -->
        <VoiceTypeSelector
          :preferences="preferences"
          @update:preferences="handlePreferencesUpdate"
        />
      </div>
    </div>

    <!-- Statistics -->
    <div v-if="stats" class="mb-8">
      <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        {{ $t("pages.settings.statistics") }}
      </h3>

      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div class="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
          <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {{ stats.totalTours }}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            {{ $t("pages.settings.totalTours") }}
          </div>
        </div>

        <div class="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
          <div class="text-2xl font-bold text-green-600 dark:text-green-400">
            {{ stats.completedTours }}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            {{ $t("pages.settings.completed") }}
          </div>
        </div>

        <div class="rounded-lg bg-purple-50 p-4 dark:bg-purple-900/20">
          <div class="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {{ formatDistance(stats.totalDistance) }}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            {{ $t("pages.settings.distance") }}
          </div>
        </div>

        <div class="rounded-lg bg-orange-50 p-4 dark:bg-orange-900/20">
          <div class="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {{ formatTime(stats.totalTime) }}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            {{ $t("pages.settings.time") }}
          </div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex justify-end space-x-4">
      <button
        class="rounded-md border border-gray-300 px-4 py-2 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
        @click="resetSettings"
      >
        {{ $t("common.reset") }}
      </button>
      <button
        class="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
        @click="logout"
      >
        {{ $t("common.logout") }}
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useAuth } from "~/composables/useAuth";
import type { IUserPreferences } from "~/types";

const {
  profile,
  stats,
  userPreferences,
  userName,
  userAvatar,
  updateUserPreferences,
  logout: authLogout,
  reset,
} = useAuth();

// Local copy of preferences for form reactivity
const preferences = ref<IUserPreferences>({ ...userPreferences.value });

// Sync with store when changes occur
watch(
  userPreferences,
  (newPrefs) => {
    preferences.value = { ...newPrefs };
  },
  { deep: true },
);

const updatePreferences = async () => {
  await updateUserPreferences(preferences.value);
};

// Handle preferences update from LanguageSelector
const handlePreferencesUpdate = async (newPreferences: IUserPreferences) => {
  preferences.value = newPreferences;
  await updatePreferences();
};

const resetSettings = () => {
  reset();
  preferences.value = { ...userPreferences.value };
};

const logout = async () => {
  await authLogout();
  await navigateTo("/");
};

const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return t('common.distanceFormat.meters', { count: meters });
  }
  return t('common.distanceFormat.kilometers', { 
    count: (meters / 1000).toFixed(1) 
  });
};

const { t } = useI18n();

const formatTime = (minutes: number): string => {
  if (minutes < 60) {
    return t('common.timeFormat.minutes', { count: minutes });
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return t('common.timeFormat.hours', { count: hours });
  }
  
  return t('common.timeFormat.hoursAndMinutes', { 
    hours, 
    minutes: remainingMinutes 
  });
};
</script>
