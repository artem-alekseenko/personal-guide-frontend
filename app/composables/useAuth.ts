import { useCurrentUser } from "vuefire";
import { useUserStore } from "~/stores/userStore";
import type { IUserPreferences, IUserStats } from "~/types";

export const useAuth = () => {
  const userStore = useUserStore();
  const firebaseUser = useCurrentUser();

  // Sync Firebase user with Pinia store
  watch(
    firebaseUser,
    (newUser) => {
      userStore.setUser(newUser ?? null);

      // Update last login time when user logs in
      if (newUser && userStore.profile) {
        const updatedProfile = {
          ...userStore.profile,
          lastLoginAt: new Date().toISOString(),
        };
        userStore.setProfile(updatedProfile);
      }
    },
    { immediate: true },
  );

  const updateUserPreferences = async (
    preferences: Partial<IUserPreferences>,
    syncToServer: boolean = true,
  ) => {
    userStore.updatePreferences(preferences);

    if (syncToServer) {
      try {
        await userStore.syncPreferencesToServer();
      } catch (error) {
        console.error("Failed to sync preferences to server:", error);
      }
    }
  };

  const updateUserStats = (stats: Partial<IUserStats>) => {
    userStore.updateStats(stats);
  };

  const loadServerPreferences = async () => {
    await userStore.loadServerPreferences();
  };

  const syncPreferencesToServer = async () => {
    await userStore.syncPreferencesToServer();
  };

  const logout = async () => {
    const { $firebaseAuth } = useNuxtApp();
    if ($firebaseAuth) {
      await $firebaseAuth.signOut();
    }

    userStore.reset();
  };

  return {
    // State from store
    user: computed(() => userStore.user),
    profile: computed(() => userStore.profile),
    stats: computed(() => userStore.stats),
    isAuthenticated: computed(() => userStore.isAuthenticated),
    isLoading: computed(() => userStore.isLoading),
    isSavingPreferences: computed(() => userStore.isSavingPreferences),

    // Getters from store
    userPreferences: computed(() => userStore.userPreferences),
    userName: computed(() => userStore.userName),
    userAvatar: computed(() => userStore.userAvatar),

    // Actions
    updateUserPreferences,
    updateUserStats,
    loadServerPreferences,
    syncPreferencesToServer,
    logout,

    // Store methods
    setProfile: userStore.setProfile,
    reset: userStore.reset,
  };
};
