import { getAuth, signOut } from "firebase/auth";
import { useUserStore } from "~/stores/userStore";
import type { IUserPreferences, IUserStats } from "~/types";

export const useAuth = () => {
  const userStore = useUserStore();
  const updateUserPreferences = async (
    preferences: Partial<IUserPreferences>,
    syncToServer: boolean = true,
  ) => {
    const previous = { ...userStore.userPreferences };
    const uid = userStore.user?.uid;
    userStore.updatePreferences(preferences);

    if (
      syncToServer &&
      preferences.language !== undefined &&
      preferences.language !== previous.language
    ) {
      try {
        await userStore.syncPreferencesToServer();
      } catch (error) {
        if (userStore.user?.uid === uid) userStore.updatePreferences(previous);
        throw error;
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
    await signOut(getAuth());

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
