import { useAuth } from "~/composables/useAuth";
import { useLogger } from "~/composables/useLogger";

let isLoadingPreferences = false;
let lastLoadTimestamp = 0;
const LOAD_COOLDOWN_MS = 5000; // 5 seconds cooldown between loads

const arePreferencesAlreadyLoaded = (profile: any): boolean => {
  return !!profile?.preferences?.language;
};

const shouldLoadPreferences = (profile: any, logger: any): boolean => {
  // Check if preferences are already loaded
  if (arePreferencesAlreadyLoaded(profile)) {
    logger.log("🔧 User preferences already loaded, skipping duplicate load");
    return false;
  }

  const now = Date.now();
  if (now - lastLoadTimestamp < LOAD_COOLDOWN_MS) {
    logger.log(
      `🔧 Preferences load cooldown active (${Math.ceil((LOAD_COOLDOWN_MS - (now - lastLoadTimestamp)) / 1000)}s remaining)`,
    );
    return false;
  }

  return true;
};

const loadPreferencesWithProtection = async (
  loadServerPreferences: Function,
  profile: any,
  logger: any,
): Promise<void> => {
  if (isLoadingPreferences) {
    logger.log(
      "🔧 Preferences are already being loaded, skipping concurrent request",
    );
    return;
  }

  if (!shouldLoadPreferences(profile, logger)) {
    return;
  }

  isLoadingPreferences = true;
  lastLoadTimestamp = Date.now();

  try {
    logger.log("🔧 Loading user preferences after login...");
    await loadServerPreferences();
    logger.log("🔧 User preferences loaded successfully after login");
  } catch (error) {
    logger.warn("🔧 Failed to load user preferences after login:", error);
    lastLoadTimestamp = 0;
  } finally {
    isLoadingPreferences = false;
  }
};

export default defineNuxtPlugin(() => {
  const { isAuthenticated, loadServerPreferences } = useAuth();
  const { profile } = useAuth();
  const logger = useLogger();

  if (!import.meta.client) {
    return;
  }

  logger.log("🔧 User preferences plugin initialized");

  watch(isAuthenticated, async (newValue, oldValue) => {
    if (newValue && !oldValue) {
      logger.log("🔧 User authentication state changed: logged in");

      await nextTick();

      await loadPreferencesWithProtection(
        loadServerPreferences,
        profile.value,
        logger,
      );
    } else if (!newValue && oldValue) {
      logger.log(
        "🔧 User authentication state changed: logged out, resetting preferences state",
      );
      isLoadingPreferences = false;
      lastLoadTimestamp = 0;
    }
  });

  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
      isLoadingPreferences = false;
      lastLoadTimestamp = 0;
    });
  }
});
