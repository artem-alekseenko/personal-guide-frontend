import { useLogger } from "~/composables/useLogger";

export default defineNuxtRouteMiddleware(async (to) => {
  const logger = useLogger();
  logger.log(`🔒 Auth middleware: checking access to ${to.path}`);

  // Use auth composable for better compatibility
  const { isAuthenticated } = useAuth();

  // If not authenticated, wait a bit for Firebase Auth to initialize
  if (!isAuthenticated.value) {
    logger.log(
      "🔒 User not immediately authenticated, waiting for Firebase Auth initialization...",
    );

    let attempts = 0;
    const maxAttempts = 50; // 50 * 100ms = 5 seconds (increased to allow for loader display)

    while (!isAuthenticated.value && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    logger.log(
      `🔒 Auth check completed after ${attempts * 100}ms, authenticated: ${isAuthenticated.value}`,
    );
  }

  // If still not authenticated after waiting, redirect to home
  if (!isAuthenticated.value) {
    logger.warn(`🔒 Access denied to ${to.path} - redirecting to home`);
    return navigateTo("/");
  }

  logger.log(`🔒 Access granted to ${to.path}`);
});
