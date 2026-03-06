<template>
  <div class="user-settings">
    <SettingsSavingOverlay :is-saving="isSavingPreferences" />
    <div class="user-settings__profile">
      <h3 class="user-settings__title">
        {{ $t("pages.settings.profile") }}
      </h3>
      <div class="user-settings__profile-row">
        <div
          v-if="!userAvatar || userAvatar === '/default-avatar.png'"
          class="user-settings__avatar-placeholder"
        >
          <span class="user-settings__initial">
            {{ userName.charAt(0).toUpperCase() }}
          </span>
        </div>
        <img
          v-else
          :alt="userName"
          :src="userAvatar"
          class="user-settings__avatar-img"
        />
        <div class="user-settings__profile-info">
          <h4 class="user-settings__name">
            {{ userName }}
          </h4>
          <p class="user-settings__email">
            {{ profile?.email }}
          </p>
        </div>
      </div>
    </div>

    <div class="user-settings__preferences">
      <h3 class="user-settings__title">
        {{ $t("pages.settings.preferences") }}
      </h3>

      <div class="user-settings__preferences-list">
        <LanguageSelector
          :preferences="preferences"
          @update:preferences="handlePreferencesUpdate"
        />

        <VoiceTypeSelector
          :preferences="preferences"
          @update:preferences="handlePreferencesUpdate"
        />
      </div>
    </div>

    <div v-if="stats" class="user-settings__stats">
      <h3 class="user-settings__title">
        {{ $t("pages.settings.statistics") }}
      </h3>

      <div class="user-settings__stats-grid">
        <div class="user-settings__stat-card user-settings__stat-card--blue">
          <div class="user-settings__stat-value">
            {{ stats.totalTours }}
          </div>
          <div class="user-settings__stat-label">
            {{ $t("pages.settings.totalTours") }}
          </div>
        </div>

        <div class="user-settings__stat-card user-settings__stat-card--green">
          <div class="user-settings__stat-value">
            {{ stats.completedTours }}
          </div>
          <div class="user-settings__stat-label">
            {{ $t("pages.settings.completed") }}
          </div>
        </div>

        <div class="user-settings__stat-card user-settings__stat-card--purple">
          <div class="user-settings__stat-value">
            {{ formatDistance(stats.totalDistance) }}
          </div>
          <div class="user-settings__stat-label">
            {{ $t("pages.settings.distance") }}
          </div>
        </div>

        <div class="user-settings__stat-card user-settings__stat-card--orange">
          <div class="user-settings__stat-value">
            {{ formatTime(stats.totalTime) }}
          </div>
          <div class="user-settings__stat-label">
            {{ $t("pages.settings.time") }}
          </div>
        </div>
      </div>
    </div>

    <div class="user-settings__actions">
      <button
        class="user-settings__btn user-settings__btn--reset"
        type="button"
        @click="resetSettings"
      >
        {{ $t("common.reset") }}
      </button>
      <button
        class="user-settings__btn user-settings__btn--logout"
        type="button"
        @click="logout"
      >
        {{ $t("common.logout") }}
      </button>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useAuth } from "~/composables/auth/useAuth";
import { useToastNotifications } from "~/composables/ui/useToastNotifications";
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

const { isSavingPreferences } = useAuth();
const { showSettingsSaved, showSettingsError } = useToastNotifications();

const preferences = ref<IUserPreferences>({ ...userPreferences.value });

watch(
  userPreferences,
  (newPrefs) => {
    preferences.value = { ...newPrefs };
  },
  { deep: true },
);

const updatePreferences = async () => {
  try {
    await updateUserPreferences(preferences.value);
    showSettingsSaved();
  } catch (error) {
    showSettingsError();
  }
};

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
    return t("common.distanceFormat.meters", { count: meters });
  }
  return t("common.distanceFormat.kilometers", {
    count: (meters / 1000).toFixed(1),
  });
};

const { t } = useI18n();

const formatTime = (minutes: number): string => {
  if (minutes < 60) {
    return t("common.timeFormat.minutes", { count: minutes });
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return t("common.timeFormat.hours", { count: hours });
  }

  return t("common.timeFormat.hoursAndMinutes", {
    hours,
    minutes: remainingMinutes,
  });
};
</script>

<style scoped>
.user-settings {
  padding: 1.5rem;
  border-radius: 0.5rem;
  background-color: var(--fill-white);
  box-shadow:
    0 1px 3px 0 oklch(0 0 0 / 0.1),
    0 1px 2px -1px oklch(0 0 0 / 0.1);
}

.dark .user-settings {
  background-color: var(--fill-gray-800);
}

.user-settings__profile {
  margin-block-start: 1rem;
  margin-block-end: 2rem;
}

.user-settings__title {
  margin-block-end: 1rem;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--fill-gray-900);
}

.dark .user-settings__title {
  color: var(--fill-white);
}

.user-settings__profile-row {
  display: flex;
  align-items: center;
  margin-block-end: 1rem;
}

.user-settings__avatar-placeholder {
  display: flex;
  height: 4rem;
  width: 4rem;
  margin-inline-end: 1rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background-color: var(--fill-slate-200);
}

.user-settings__initial {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--fill-gray-600);
}

.user-settings__avatar-img {
  height: 4rem;
  width: 4rem;
  margin-inline-end: 1rem;
  border-radius: 9999px;
  object-fit: cover;
}

.user-settings__name {
  font-size: 1.125rem;
  font-weight: 500;
  color: var(--fill-gray-900);
}

.dark .user-settings__name {
  color: var(--fill-white);
}

.user-settings__email {
  font-size: 1rem;
  color: var(--fill-gray-600);
}

.dark .user-settings__email {
  color: var(--fill-gray-400);
}

.user-settings__preferences {
  margin-block-end: 2rem;
}

.user-settings__preferences-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.user-settings__stats {
  margin-block-end: 2rem;
}

.user-settings__stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}

.user-settings__stat-card {
  padding: 1rem;
  border-radius: 0.5rem;
}

.user-settings__stat-card--blue {
  background-color: var(--fill-blue-50);
}

.dark .user-settings__stat-card--blue {
  background-color: oklch(0.379 0.146 265.522 / 0.2);
}

.user-settings__stat-card--green {
  background-color: var(--fill-green-50);
}

.dark .user-settings__stat-card--green {
  background-color: oklch(0.393 0.095 152.535 / 0.2);
}

.user-settings__stat-card--purple {
  background-color: var(--fill-purple-50);
}

.dark .user-settings__stat-card--purple {
  background-color: oklch(0.381 0.176 304.987 / 0.2);
}

.user-settings__stat-card--orange {
  background-color: var(--fill-orange-50);
}

.dark .user-settings__stat-card--orange {
  background-color: oklch(0.408 0.123 38.172 / 0.2);
}

.user-settings__stat-value {
  font-size: 1.5rem;
  font-weight: 700;
}

.user-settings__stat-card--blue .user-settings__stat-value {
  color: var(--fill-blue-600);
}

.dark .user-settings__stat-card--blue .user-settings__stat-value {
  color: var(--fill-blue-400);
}

.user-settings__stat-card--green .user-settings__stat-value {
  color: var(--fill-green-600);
}

.dark .user-settings__stat-card--green .user-settings__stat-value {
  color: var(--fill-green-400);
}

.user-settings__stat-card--purple .user-settings__stat-value {
  color: var(--fill-purple-600);
}

.dark .user-settings__stat-card--purple .user-settings__stat-value {
  color: var(--fill-purple-400);
}

.user-settings__stat-card--orange .user-settings__stat-value {
  color: var(--fill-orange-600);
}

.dark .user-settings__stat-card--orange .user-settings__stat-value {
  color: var(--fill-orange-400);
}

.user-settings__stat-label {
  font-size: 0.875rem;
  color: var(--fill-gray-600);
}

.dark .user-settings__stat-label {
  color: var(--fill-gray-400);
}

.user-settings__actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
}

.user-settings__btn {
  padding-block: 0.5rem;
  padding-inline: 1rem;
  border-radius: 0.375rem;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.15s;
}

.user-settings__btn--reset {
  border: 1px solid var(--fill-gray-300);
  background-color: transparent;
  color: var(--fill-gray-600);
}

.user-settings__btn--reset:hover {
  background-color: var(--fill-gray-50);
}

.dark .user-settings__btn--reset {
  border-color: var(--fill-gray-600);
  color: var(--fill-gray-400);
}

.dark .user-settings__btn--reset:hover {
  background-color: var(--fill-gray-700);
}

.user-settings__btn--logout {
  border: none;
  background-color: var(--fill-red-600);
  color: var(--fill-white);
}

.user-settings__btn--logout:hover {
  background-color: var(--fill-red-700);
}
</style>
