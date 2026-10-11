import { useUserStore } from "~/stores/userStore";

export default defineNuxtRouteMiddleware((to, from) => {
  if (
    import.meta.client &&
    to.name === "settings" &&
    from.name &&
    from.name !== "settings"
  ) {
    const uid = useUserStore().user?.uid;
    if (!uid) return;
    try {
      sessionStorage.setItem(
        "settingsReturnRoute",
        JSON.stringify({ uid, path: from.path }),
      );
    } catch {
      // Settings remain navigable when browser storage is unavailable.
    }
  }
});
