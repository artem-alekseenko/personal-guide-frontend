import { useGeolocationStore } from "~/stores/geolocationStore";

export default defineNuxtPlugin(async () => {
  const geolocationStore = useGeolocationStore();

  try {
    await geolocationStore.initialize();
  } catch (e) {
    console.warn("Failed to initialize geolocation:", e);
  }

  if (import.meta.client) {
    window.addEventListener("beforeunload", () => {
      if (geolocationStore.isWatching) {
        geolocationStore.stopWatching();
      }
    }, { once: true });
  }
});
