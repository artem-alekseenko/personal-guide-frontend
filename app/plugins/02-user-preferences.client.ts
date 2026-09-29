import { useCurrentUser } from "vuefire";
import { useUserStore } from "~/stores/userStore";
import { useGuidesStore } from "~/stores/guidesStore";
import { useRouteStore } from "~/stores/routeStore";
import { useTourStore } from "~/stores/tourStore";

export default defineNuxtPlugin((nuxtApp) => {
  const firebaseUser = useCurrentUser();
  const users = useUserStore();
  const guides = useGuidesStore();
  const routes = useRouteStore();
  const tours = useTourStore();
  watch(
    () => firebaseUser.value?.uid ?? null,
    async (uid, previous) => {
      if (uid !== previous) {
        guides.reset();
        routes.reset();
        tours.reset();
        // Audio state is account-specific; do not revive another user's session.
        try {
          for (const key of Object.keys(localStorage)) {
            if (
              key.startsWith("tour-state-") ||
              [
                "pg-guides-list",
                "pg-selected-guide",
                "pg-guides-fetched-at",
              ].includes(key)
            )
              localStorage.removeItem(key);
          }
        } catch {
          /* Storage may be unavailable in private browsing. */
        }
      }
      users.setUser(firebaseUser.value ?? null);
      if (uid)
        await nuxtApp.runWithContext(() => users.loadServerPreferences());
    },
    { immediate: true },
  );
  watch(
    () => users.userPreferences.language,
    (language) => {
      const i18n = nuxtApp.$i18n as {
        setLocale: (locale: "en" | "ru") => Promise<void>;
      };
      if (language === "en" || language === "ru") void i18n.setLocale(language);
    },
    { immediate: true },
  );
});
