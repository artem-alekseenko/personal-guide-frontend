import { useAuth } from "~/composables/auth/useAuth";
import { useLogger } from "~/composables/utils/useLogger";

let isLoadingPreferences = false;

export default defineNuxtPlugin(() => {
  const { isAuthenticated, loadServerPreferences } = useAuth();
  const logger = useLogger();

  if (!import.meta.client) {
    return;
  }

  logger.log("🔧 User preferences plugin initialized");

  watch(isAuthenticated, async (newValue, oldValue) => {
    if (newValue && !oldValue) {
      logger.log("🔧 User authenticated — loading server preferences");

      if (isLoadingPreferences) {
        logger.log("🔧 Preferences load already in progress, skipping");
        return;
      }

      isLoadingPreferences = true;
      try {
        await loadServerPreferences();
        logger.log("🔧 Server preferences loaded successfully");
      } catch (error) {
        logger.warn("🔧 Failed to load user preferences after login:", error);
      } finally {
        isLoadingPreferences = false;
      }
    } else if (!newValue && oldValue) {
      logger.log("🔧 User logged out — resetting preferences load state");
      isLoadingPreferences = false;
    }
  });
});
