/**
 * Exposes Firebase config (projectId, appId) on window.__PG_DEBUG__ for beta.personal-guide.com
 * to help diagnose App Check "App not registered" and other config issues.
 */
export default defineNuxtPlugin((nuxtApp) => {
  if (!import.meta.client) return;

  const hostname = window.location.hostname;

  const setDebugInfo = async () => {
    try {
      const { getApp } = await import("firebase/app");
      const app = getApp();
      const opts = app.options as { projectId?: string; appId?: string };
      (window as any).__PG_DEBUG__ = {
        projectId: opts.projectId,
        appId: opts.appId,
        hostname,
      };
      console.info("[PG Debug] Firebase config:", (window as any).__PG_DEBUG__);
    } catch {
      // Firebase not ready — ignore
    }
  };

  nuxtApp.hooks.hook("app:mounted", async () => {
    await setDebugInfo();
  });
});
