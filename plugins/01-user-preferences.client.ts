import { useAuth } from "~/composables/useAuth";
import { useLogger } from "~/composables/useLogger";

// Global state to track loading and prevent race conditions
let isLoadingPreferences = false;
let lastLoadTimestamp = 0;
const LOAD_COOLDOWN_MS = 5000; // 5 seconds cooldown between loads

// Helper function to check if preferences are already cached/loaded
const arePreferencesAlreadyLoaded = (profile: any): boolean => {
  return !!(profile?.preferences?.language);
};

// Helper function to determine if we should load preferences
const shouldLoadPreferences = (profile: any, logger: any): boolean => {
  // Check if preferences are already loaded
  if (arePreferencesAlreadyLoaded(profile)) {
    logger.log("🔧 User preferences already loaded, skipping duplicate load");
    return false;
  }

  // Check cooldown period to prevent rapid successive calls
  const now = Date.now();
  if (now - lastLoadTimestamp < LOAD_COOLDOWN_MS) {
    logger.log(`🔧 Preferences load cooldown active (${Math.ceil((LOAD_COOLDOWN_MS - (now - lastLoadTimestamp)) / 1000)}s remaining)`);
    return false;
  }

  return true;
};

// Protected function to load preferences with race condition protection
const loadPreferencesWithProtection = async (loadServerPreferences: Function, profile: any, logger: any): Promise<void> => {
  // Double-check to prevent race conditions
  if (isLoadingPreferences) {
    logger.log("🔧 Preferences are already being loaded, skipping concurrent request");
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
    // Reset timestamp on failure to allow retry after cooldown
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

  // Watch for authentication changes (for login after page load)
  watch(isAuthenticated, async (newValue, oldValue) => {
    // Only load if user just logged in (transition from unauthenticated to authenticated)
    if (newValue && !oldValue) {
      logger.log("🔧 User authentication state changed: logged in");
      
      // Use nextTick to ensure profile is updated before checking
      await nextTick();
      
      await loadPreferencesWithProtection(loadServerPreferences, profile.value, logger);
    } else if (!newValue && oldValue) {
      // User logged out - reset loading state for future logins
      logger.log("🔧 User authentication state changed: logged out, resetting preferences state");
      isLoadingPreferences = false;
      lastLoadTimestamp = 0;
    }
  });

  // Additional safety: reset loading state on page unload
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
      isLoadingPreferences = false;
      lastLoadTimestamp = 0;
    });
  }
});
