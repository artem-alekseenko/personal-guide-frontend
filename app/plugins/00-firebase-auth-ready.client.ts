import { getCurrentUser } from "vuefire";
import { useUserStore } from "~/stores/userStore";
import { useLogger } from "~/composables/useLogger";

export default defineNuxtPlugin((nuxtApp) => {
  const logger = useLogger();

  if (!import.meta.client) {
    return;
  }

  // Defer preferences loading until the app is mounted and Firebase is ready
  nuxtApp.hooks.hook("app:mounted", async () => {
    logger.log("🔥 app:mounted → waiting for Firebase user to be ready...");

    // Wait for Firebase to restore the session (user or null)
    const user = await getCurrentUser().catch(() => null);
    if (!user) {
      logger.log("🔥 No user after app mount; skipping preferences load");
      return;
    }

    // Ensure $apiFetch is injected
    let { $apiFetch } = useNuxtApp() as any;
    if (typeof $apiFetch !== "function") {
      // Rare, but wait a frame to allow plugins to finish registering
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      $apiFetch = (useNuxtApp() as any).$apiFetch;
    }

    // One-shot guard to avoid duplicate loads on HMR / re-entries
    const prefsLoadedOnce = useState("prefs:loaded-once", () => false);
    if (prefsLoadedOnce.value) {
      logger.log("🔥 Preferences already loaded once; skipping");
      return;
    }

    try {
      const userStore = useUserStore();
      logger.log("🔥 Loading user preferences after app mount...");
      await userStore.loadServerPreferences();
      prefsLoadedOnce.value = true;
      logger.log("🔥 User preferences loaded successfully after app mount");
    } catch (e) {
      console.warn("[auth-ready] loadServerPreferences failed:", e);
      // Do not throw - app should keep working
    }
  });
});
