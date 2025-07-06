import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { User } from "firebase/auth";
import type { IUserPreferences, IUserProfile, IUserStats } from "~/types";
import { DEFAULT_VOICE_TYPE } from "~/types/voice";
import { useUserApi } from "~/composables/useUserApi";

export interface IUserStore {
  // State
  user: Ref<User | null>;
  profile: Ref<IUserProfile | null>;
  stats: Ref<IUserStats | null>;
  isAuthenticated: ComputedRef<boolean>;
  isLoading: Ref<boolean>;

  // Getters
  userPreferences: ComputedRef<IUserPreferences>;
  userName: ComputedRef<string>;
  userAvatar: ComputedRef<string>;

  // Actions
  setUser: (user: User | null) => void;
  setProfile: (profile: IUserProfile) => void;
  updatePreferences: (preferences: Partial<IUserPreferences>) => void;
  updateStats: (stats: Partial<IUserStats>) => void;
  loadServerPreferences: () => Promise<void>;
  syncPreferencesToServer: () => Promise<void>;
  logout: () => void;
  reset: () => void;
}

const defaultPreferences: IUserPreferences = {
  language: "en",
  voiceType: DEFAULT_VOICE_TYPE,
};

const defaultStats: IUserStats = {
  totalTours: 0,
  completedTours: 0,
  totalDistance: 0,
  totalTime: 0,
  favoriteGuides: [],
  visitedPlaces: 0,
};

export const useUserStore = defineStore(
  "userStore",
  () => {
    // State
    const user = ref<User | null>(null);
    const profile = ref<IUserProfile | null>(null);
    const stats = ref<IUserStats | null>(null);
    const isLoading = ref<boolean>(false);

    // Getters
    const isAuthenticated = computed((): boolean => {
      return user.value !== null;
    });

    const userPreferences = computed((): IUserPreferences => {
      return profile.value?.preferences || defaultPreferences;
    });

    const userName = computed((): string => {
      if (profile.value?.displayName) {
        return profile.value.displayName;
      }
      if (user.value?.displayName) {
        return user.value.displayName;
      }
      if (profile.value?.email) {
        return profile.value.email.split("@")[0] ?? "";
      }
      return "User";
    });

    const userAvatar = computed((): string => {
      return (
        profile.value?.photoURL || user.value?.photoURL || "/default-avatar.png"
      );
    });

    // Actions
    const setUser = (newUser: User | null): void => {
      user.value = newUser;

      if (newUser && !profile.value) {
        // Create basic profile for new user
        const newProfile: IUserProfile = {
          id: newUser.uid,
          email: newUser.email ?? "",
          displayName: newUser.displayName || null,
          photoURL: newUser.photoURL || null,
          emailVerified: newUser.emailVerified,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          preferences: { ...defaultPreferences },
        };
        setProfile(newProfile);
      }
    };

    const setProfile = (newProfile: IUserProfile): void => {
      profile.value = newProfile;

      if (!stats.value) {
        stats.value = { ...defaultStats };
      }
    };

    const updatePreferences = (
      newPreferences: Partial<IUserPreferences>,
    ): void => {
      if (!profile.value) return;

      profile.value.preferences = {
        ...profile.value.preferences,
        ...newPreferences,
      };
    };

    const updateStats = (newStats: Partial<IUserStats>): void => {
      if (!stats.value) {
        stats.value = { ...defaultStats };
      }

      stats.value = {
        ...stats.value,
        ...newStats,
      };
    };

    const logout = (): void => {
      user.value = null;
      profile.value = null;
      stats.value = null;
    };

    const loadServerPreferences = async (): Promise<void> => {
      const startTime = performance.now();
      console.log(
        "Starting loadServerPreferences at:",
        new Date().toISOString(),
      );

      if (!isAuthenticated.value) {
        console.warn("User not authenticated, cannot load server preferences");
        return;
      }

      try {
        isLoading.value = true;
        const { fetchUserProfile } = useUserApi();
        console.log("Fetching user profile from server...");
        const serverProfile = await fetchUserProfile();

        // Update only language from server response (without triggering server sync)
        if (serverProfile.language && profile.value) {
          profile.value.preferences = {
            ...profile.value.preferences,
            language: serverProfile.language,
          };
          console.log("Language loaded from server:", serverProfile.language);
        }

        const endTime = performance.now();
        console.log(
          `loadServerPreferences completed in ${(endTime - startTime).toFixed(2)}ms`,
        );
      } catch (error) {
        console.error("Failed to load server preferences:", error);
        // Don't throw error, just log to avoid breaking the app
      } finally {
        isLoading.value = false;
      }
    };

    const syncPreferencesToServer = async (): Promise<void> => {
      if (!isAuthenticated.value) {
        console.warn(
          "User not authenticated, cannot sync preferences to server",
        );
        return;
      }

      try {
        isLoading.value = true;
        const { updateUserProfile } = useUserApi();

        const currentName = userName.value;
        const currentLanguage = userPreferences.value.language;

        await updateUserProfile(currentName, currentLanguage);
        console.log("Preferences synced to server:", {
          name: currentName,
          language: currentLanguage,
        });
      } catch (error) {
        console.error("Failed to sync preferences to server:", error);
        throw error; // Re-throw to allow UI to handle the error
      } finally {
        isLoading.value = false;
      }
    };

    const reset = (): void => {
      user.value = null;
      profile.value = null;
      stats.value = null;
      isLoading.value = false;
    };

    return {
      // State
      user,
      profile,
      stats,
      isLoading,

      // Getters
      isAuthenticated,
      userPreferences,
      userName,
      userAvatar,

      // Actions
      setUser,
      setProfile,
      updatePreferences,
      updateStats,
      loadServerPreferences,
      syncPreferencesToServer,
      logout,
      reset,
    } satisfies IUserStore;
  },
  {
    persist: {
      key: "personal-guide-user",
      pick: ["profile", "stats"], // Save only profile and stats, user will be restored via Firebase
    },
  },
);
