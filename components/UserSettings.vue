<template>
  <div class="rounded-lg bg-white p-6 shadow dark:bg-gray-800">
    <!-- User profile -->
    <div class="mt-4 mb-8">
      <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Profile
      </h3>

      <div class="mb-4 flex items-center">
        <div 
          v-if="!userAvatar || userAvatar === '/default-avatar.png'"
          class="mr-4 h-16 w-16 rounded-full bg-slate-200 flex items-center justify-center"
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
        Preferences
      </h3>

      <div class="space-y-4">
        <!-- Language -->
        <div class="relative">
          <label
            for="language-select"
            class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Language
          </label>
          <div class="relative">
            <button
              id="language-select"
              ref="dropdownButton"
              type="button"
              class="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white p-2 text-left dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              :class="{ 'ring-2 ring-blue-500': isDropdownOpen }"
              @click="toggleDropdown"
              @keydown.enter.prevent="toggleDropdown"
              @keydown.space.prevent="toggleDropdown"
              @keydown.escape="closeDropdown"
              @keydown.arrow-down.prevent="openDropdown"
              @keydown.arrow-up.prevent="openDropdown"
            >
              <span>{{ getLanguageLabel(preferences.language) }}</span>
              <svg
                class="ml-2 h-4 w-4 transition-transform duration-200"
                :class="{ 'rotate-180': isDropdownOpen }"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            
            <!-- Dropdown menu -->
            <div
              v-if="isDropdownOpen"
              ref="dropdownMenu"
              class="absolute z-10 mt-1 w-full rounded-md border border-gray-300 bg-white py-1 shadow-lg dark:border-gray-600 dark:bg-gray-700"
            >
              <button
                v-for="option in languageOptions"
                :key="option.value"
                type="button"
                class="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-600 dark:text-white"
                :class="{
                  'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400':
                    preferences.language === option.value,
                }"
                @click="selectLanguage(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Statistics -->
    <div v-if="stats" class="mb-8">
      <h3 class="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
        Statistics
      </h3>

      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div class="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
          <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {{ stats.totalTours }}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">
            Total tours
          </div>
        </div>

        <div class="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
          <div class="text-2xl font-bold text-green-600 dark:text-green-400">
            {{ stats.completedTours }}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">Completed</div>
        </div>

        <div class="rounded-lg bg-purple-50 p-4 dark:bg-purple-900/20">
          <div class="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {{ formatDistance(stats.totalDistance) }}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">Distance</div>
        </div>

        <div class="rounded-lg bg-orange-50 p-4 dark:bg-orange-900/20">
          <div class="text-2xl font-bold text-orange-600 dark:text-orange-400">
            {{ formatTime(stats.totalTime) }}
          </div>
          <div class="text-sm text-gray-600 dark:text-gray-400">Time</div>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex justify-end space-x-4">
      <button
        class="rounded-md border border-gray-300 px-4 py-2 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
        @click="resetSettings"
      >
        Reset
      </button>
      <button
        class="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
        @click="logout"
      >
        Logout
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

// Dropdown state
const isDropdownOpen = ref(false);
const dropdownButton = ref<HTMLButtonElement>();
const dropdownMenu = ref<HTMLDivElement>();

// Language options
const languageOptions = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
];

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

// Dropdown functions
const getLanguageLabel = (value: string): string => {
  const option = languageOptions.find(opt => opt.value === value);
  return option?.label || value;
};

const toggleDropdown = () => {
  isDropdownOpen.value = !isDropdownOpen.value;
};

const openDropdown = () => {
  isDropdownOpen.value = true;
};

const closeDropdown = () => {
  isDropdownOpen.value = false;
};

const selectLanguage = async (value: string) => {
  // Only update if language actually changed
  if (preferences.value.language === value) {
    closeDropdown();
    return;
  }

  preferences.value.language = value;
  await updatePreferences();
  closeDropdown();
};

// Close dropdown when clicking outside
const handleClickOutside = (event: Event) => {
  if (
    dropdownButton.value &&
    dropdownMenu.value &&
    !dropdownButton.value.contains(event.target as Node) &&
    !dropdownMenu.value.contains(event.target as Node)
  ) {
    closeDropdown();
  }
};

// Setup click outside listener
onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});

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
    return `${meters} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
};

const formatTime = (minutes: number): string => {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
};
</script>
