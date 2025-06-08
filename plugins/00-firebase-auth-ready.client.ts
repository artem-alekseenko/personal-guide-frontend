import { useAuth } from "~/composables/useAuth";
import { useLogger } from "~/composables/useLogger";

// Extracted helper function to wait for auth state change
const waitForAuthStateChange = (firebaseAuth: any, logger: any): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error('Auth state change timeout after 10 seconds'));
    }, 10000); // 10 second timeout

    const unsubscribe = firebaseAuth.onAuthStateChanged((user: any) => {
      logger.log("🔥 Auth state changed, user:", !!user);
      clearTimeout(timeout);
      unsubscribe();
      resolve();
    });
  });
};

// Extracted helper function to load preferences with proper error handling
const loadUserPreferences = async (loadServerPreferences: Function, logger: any): Promise<void> => {
  const loadStart = performance.now();
  try {
    await loadServerPreferences();
    const loadEnd = performance.now();
    logger.log(
      `🔥 Early preference loading took ${(loadEnd - loadStart).toFixed(2)}ms`,
    );
    logger.log("User preferences loaded early from server");
  } catch (error) {
    logger.warn("Failed to load user preferences early:", error);
    throw error;
  }
};

// Helper function to handle authenticated user flow
const handleAuthenticatedUser = async (loadServerPreferences: Function, logger: any): Promise<void> => {
  logger.log("🔥 Firebase user detected, loading preferences...");
  return loadUserPreferences(loadServerPreferences, logger);
};

// Helper function to check if Firebase auth is properly initialized
const validateFirebaseAuth = (firebaseAuth: any): boolean => {
  if (!firebaseAuth) {
    console.warn("🔥 Firebase Auth is not available - check network connection and Firebase configuration");
    return false;
  }
  
  // Additional validation to ensure Firebase is properly initialized
  if (typeof firebaseAuth.onAuthStateChanged !== 'function') {
    console.warn("🔥 Firebase Auth is not properly initialized - onAuthStateChanged is not available");
    return false;
  }
  
  return true;
};

export default defineNuxtPlugin(async () => {
  const startTime = performance.now();
  const logger = useLogger();
  logger.log(
    "🔥 Firebase auth ready plugin starting at:",
    new Date().toISOString(),
  );

  // Early return if not on client
  if (!import.meta.client) {
    logger.log("🔥 Firebase auth plugin skipped - not on client");
    return;
  }

  const { loadServerPreferences } = useAuth();
  const { $firebaseAuth } = useNuxtApp();
  
  logger.log("🔥 Firebase Auth object available:", !!$firebaseAuth);

  // Validate Firebase Auth initialization
  if (!validateFirebaseAuth($firebaseAuth)) {
    const endTime = performance.now();
    logger.log(
      `🔥 Firebase auth ready plugin completed with errors in ${(endTime - startTime).toFixed(2)}ms`,
    );
    return;
  }

  let preferencesLoadAttempted = false; // Flag to prevent double loading

  try {
    // Handle case when user is already available
    if ($firebaseAuth.currentUser && !preferencesLoadAttempted) {
      logger.log("🔥 Firebase user already available, loading preferences immediately...");
      preferencesLoadAttempted = true;
      await handleAuthenticatedUser(loadServerPreferences, logger);
    } else {
      // Wait for auth state to be restored with timeout
      logger.log("🔥 Waiting for auth state to be restored...");
      await waitForAuthStateChange($firebaseAuth, logger);
      
      // Check again after auth state change and load preferences if user is authenticated
      if ($firebaseAuth.currentUser && !preferencesLoadAttempted) {
        preferencesLoadAttempted = true;
        await handleAuthenticatedUser(loadServerPreferences, logger);
      } else {
        logger.log("🔥 No Firebase user detected after auth state change");
      }
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('timeout')) {
      logger.warn("🔥 Firebase auth state change timed out:", error.message);
    } else {
      logger.warn("🔥 Firebase auth initialization error:", error);
    }
  }

  const endTime = performance.now();
  logger.log(
    `🔥 Firebase auth ready plugin completed in ${(endTime - startTime).toFixed(2)}ms`,
  );
});
