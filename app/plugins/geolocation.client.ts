import { useGeolocationStore } from "~/stores/geolocationStore";

export default defineNuxtPlugin(() => {
  const geolocationStore = useGeolocationStore();

  geolocationStore.initialize().catch((e) => {
    console.warn("Failed to initialize geolocation:", e);
  });

  if (import.meta.client) {
    window.addEventListener(
      "beforeunload",
      () => {
        if (geolocationStore.isWatching) {
          geolocationStore.stopWatching();
        }
      },
      { once: true },
    );
  }
});
