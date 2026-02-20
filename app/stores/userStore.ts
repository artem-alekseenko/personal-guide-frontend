import { defineStore } from "pinia";
import { computed, markRaw, ref, shallowRef } from "vue";
import type { User } from "firebase/auth";
import type { IUserPreferences, IUserProfile, IUserStats } from "~/types";
import { DEFAULT_VOICE_TYPE } from "~/types/voice";
import { useUserApi } from "~/composables/useUserApi";

const makeDefaultPreferences = (): IUserPreferences => ({
  language: "en",
  voiceType: DEFAULT_VOICE_TYPE,
});

const makeDefaultStats = (): IUserStats => ({
  totalTours: 0,
  completedTours: 0,
  totalDistance: 0,
  totalTime: 0,
  favoriteGuides: [],
  visitedPlaces: 0,
});

const makeProfileFromFirebaseUser = (u: User): IUserProfile => ({
  id: u.uid,
  email: u.email ?? "",
  displayName: u.displayName ?? null,
  photoURL: u.photoURL ?? null,
  emailVerified: u.emailVerified,
  createdAt: new Date().toISOString(),
  lastLoginAt: new Date().toISOString(),
  preferences: makeDefaultPreferences(),
});

export const useUserStore = defineStore(
  "userStore",
  () => {
    // State
    const user = shallowRef<User | null>(null);
    const profile = ref<IUserProfile | null>(null);
    const stats = ref<IUserStats | null>(null);

    const guestLanguage = ref<string>("en");

    const isLoading = ref(false);
    const isSavingPreferences = ref(false);

    // Getters
    const isAuthenticated = computed(() => !!user.value);

    const userPreferences = computed<IUserPreferences>(() => {
      if (profile.value) return profile.value.preferences;
      return { ...makeDefaultPreferences(), language: guestLanguage.value };
    });

    const userName = computed(() => {
      if (profile.value?.displayName) return profile.value.displayName;
      if (user.value?.displayName) return user.value.displayName;
      if (profile.value?.email)
        return profile.value.email.split("@")[0] || "User";
      return "User";
    });

    const userAvatar = computed(() => {
      return (
        profile.value?.photoURL ?? user.value?.photoURL ?? "/default-avatar.png"
      );
    });

    const ensureStats = () => {
      if (!stats.value) stats.value = makeDefaultStats();
    };

    // Actions
    const setUser = (newUser: User | null) => {
      if (newUser && profile.value && profile.value.id !== newUser.uid) {
        profile.value = null;
        stats.value = null;
      }

      user.value = newUser ? markRaw(newUser) : null;

      if (!newUser) {
        profile.value = null;
        stats.value = null;
        return;
      }

      if (!profile.value) {
        profile.value = makeProfileFromFirebaseUser(newUser);
      }

      ensureStats();
    };

    const setProfile = (newProfile: IUserProfile) => {
      profile.value = {
        ...newProfile,
        preferences: { ...makeDefaultPreferences(), ...newProfile.preferences },
      };
      ensureStats();
    };

    const updatePreferences = (patch: Partial<IUserPreferences>) => {
      if (patch.language) guestLanguage.value = patch.language;

      if (!profile.value) return;
      profile.value.preferences = { ...profile.value.preferences, ...patch };
    };

    const updateStats = (patch: Partial<IUserStats>) => {
      stats.value = { ...(stats.value ?? makeDefaultStats()), ...patch };
    };

    const loadServerPreferences = async () => {
      if (!isAuthenticated.value || isLoading.value) return;

      isLoading.value = true;
      try {
        const { fetchUserProfile } = useUserApi();
        const serverProfile = await fetchUserProfile();

        if (user.value && !profile.value)
          profile.value = makeProfileFromFirebaseUser(user.value);

        if (serverProfile.language && profile.value) {
          profile.value.preferences = {
            ...profile.value.preferences,
            language: serverProfile.language,
          };
          guestLanguage.value = serverProfile.language;
        }
      } catch (e) {
        if (import.meta.dev)
          console.error("Failed to load server preferences:", e);
      } finally {
        isLoading.value = false;
      }
    };

    const syncPreferencesToServer = async () => {
      if (!isAuthenticated.value || isSavingPreferences.value) return;

      isSavingPreferences.value = true;
      try {
        const { updateUserProfile } = useUserApi();

        const name = userName.value;
        const language = userPreferences.value.language;

        await updateUserProfile(name, language);

        if (import.meta.dev) {
          console.log("Preferences synced:", { name, language });
        }
      } finally {
        isSavingPreferences.value = false;
      }
    };

    const reset = () => {
      user.value = null;
      profile.value = null;
      stats.value = null;
      isLoading.value = false;
      isSavingPreferences.value = false;
    };

    return {
      user,
      profile,
      stats,
      guestLanguage,
      isLoading,
      isSavingPreferences,

      isAuthenticated,
      userPreferences,
      userName,
      userAvatar,

      setUser,
      setProfile,
      updatePreferences,
      updateStats,
      loadServerPreferences,
      syncPreferencesToServer,
      reset,
    };
  },
  {
    persist: {
      key: "personal-guide-user",
      pick: ["guestLanguage"],
    },
  },
);
