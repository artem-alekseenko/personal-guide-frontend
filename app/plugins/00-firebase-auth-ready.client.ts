import { getCurrentUser } from "vuefire";
import { useUserStore } from "~/stores/userStore";
import { useLogger } from "~/composables/useLogger";

export default defineNuxtPlugin((nuxtApp) => {
  const logger = useLogger();

  if (!import.meta.client) {
    return;
  }

  nuxtApp.hooks.hook("app:mounted", async () => {
    logger.log("🔥 app:mounted → waiting for Firebase user to be ready...");

    const user = await getCurrentUser().catch(() => null);
    if (!user) {
      logger.log("🔥 No user after app mount; skipping preferences load");
      return;
    }

    let { $apiFetch } = useNuxtApp() as any;
    if (typeof $apiFetch !== "function") {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      $apiFetch = (useNuxtApp() as any).$apiFetch;
    }

    const prefsLoadedOnce = useState("prefs:loaded-once", () => false);
    if (prefsLoadedOnce.value) {
      logger.log("🔥 Preferences already loaded once; skipping");
      return;
    }

    try {
      const userStore = useUserStore();

      if (!userStore.isAuthenticated) {
        logger.log(
          "🔥 Store not yet authenticated — syncing Firebase user to store",
        );
        userStore.setUser(user);
      }

      logger.log("🔥 Loading user preferences after app mount...");
      await userStore.loadServerPreferences();
      prefsLoadedOnce.value = true;
      logger.log("🔥 User preferences loaded successfully after app mount");
    } catch (e) {
      console.warn("[auth-ready] loadServerPreferences failed:", e);
    }
  });
});
