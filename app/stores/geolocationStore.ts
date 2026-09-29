import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { useGeolocation } from "~/composables/map/useGeolocation";
import { useLogger } from "~/composables/utils/useLogger";
import type { IGeolocationStore } from "~/types";

export const useGeolocationStore = defineStore("geolocation", () => {
  const latitude = ref<number | null>(null);
  const longitude = ref<number | null>(null);
  const recordedAt = ref<string | null>(null);
  const accuracy = ref<number | null>(null);
  const error = ref<string | null>(null);
  const watchId = ref<number | null>(null);
  const isInitialized = ref(false);

  const { state, getCurrentPosition, watchPosition, clearWatch, resetState } =
    useGeolocation();
  const isLoading = computed(() => state.value.isLoading);
  const logger = useLogger();

  const coordinates = computed<[number, number] | null>(() => {
    if (latitude.value === null || longitude.value === null) return null;
    return [longitude.value, latitude.value];
  });

  const hasError = computed(() => error.value !== null);
  const isReady = computed(
    () =>
      latitude.value !== null && longitude.value !== null && !isLoading.value,
  );
  const isWatching = computed(() => watchId.value !== null);

  const initialize = async () => {
    logger.log("Initializing geolocation store...");
    if (isInitialized.value) return;
    isInitialized.value = true;

    try {
      const position = await getCurrentPosition();
      logger.log("Geolocation position obtained:", position);
      latitude.value = position.coords.latitude;
      longitude.value = position.coords.longitude;
      accuracy.value = position.coords.accuracy;
      recordedAt.value = new Date(position.timestamp).toISOString();
      error.value = null;

      const id = watchPosition(
        (position) => {
          latitude.value = position.coords.latitude;
          longitude.value = position.coords.longitude;
          accuracy.value = position.coords.accuracy;
          recordedAt.value = new Date(position.timestamp).toISOString();
          error.value = null;
        },
        (err) => {
          error.value = err.message;
        },
      );
      watchId.value = id ?? null;
    } catch (err) {
      isInitialized.value = false;
      logger.warn("Error obtaining geolocation:", err);
      if (err instanceof Error) {
        error.value = err.message;
      } else {
        error.value = "Failed to get location";
      }
    }
  };

  const stopWatching = () => {
    if (watchId.value !== null) {
      clearWatch(watchId.value);
      watchId.value = null;
    }
  };

  const reset = () => {
    resetState();
    latitude.value = null;
    longitude.value = null;
    accuracy.value = null;
    recordedAt.value = null;
    error.value = null;
    stopWatching();
    isInitialized.value = false;
  };

  const refresh = async () => {
    try {
      const position = await getCurrentPosition();
      latitude.value = position.coords.latitude;
      longitude.value = position.coords.longitude;
      accuracy.value = position.coords.accuracy;
      recordedAt.value = new Date(position.timestamp).toISOString();
      error.value = null;
      error.value = null;
    } catch (err) {
      logger.warn("Failed to refresh geolocation:", err);
      if (err instanceof Error) {
        error.value = err.message;
      } else {
        error.value = "Failed to refresh location";
      }
    }
  };

  return {
    latitude,
    longitude,
    accuracy,
    recordedAt,
    error,
    isLoading,
    watchId,
    coordinates,
    hasError,
    isReady,
    isWatching,
    isInitialized,
    initialize,
    stopWatching,
    reset,
    refresh,
  } satisfies IGeolocationStore;
});
