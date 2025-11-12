import { defineStore } from "pinia";
import { useGeolocation } from "~/composables/useGeolocation";
import { useLogger } from "~/composables/useLogger";
import { computed, ref } from "vue";

export interface IGeolocationStore {
  latitude: Ref<number | null>;
  longitude: Ref<number | null>;
  accuracy: Ref<number | null>;
  error: Ref<string | null>;
  isLoading: Ref<boolean>;
  watchId: Ref<number | null>;

  coordinates: ComputedRef<[number, number] | null>;
  hasError: ComputedRef<boolean>;
  isReady: ComputedRef<boolean>;
  isWatching: ComputedRef<boolean>;

  isInitialized: Ref<boolean>;
  initialize: () => Promise<void>;
  stopWatching: () => void;
  reset: () => void;
  refresh: () => Promise<void>;
}

export const useGeolocationStore = defineStore("geolocation", () => {
  const latitude = ref<number | null>(null);
  const longitude = ref<number | null>(null);
  const accuracy = ref<number | null>(null);
  const error = ref<string | null>(null);
  const watchId = ref<number | null>(null);
  const isInitialized = ref(false);

  const { state, getCurrentPosition, watchPosition, clearWatch, resetState } = useGeolocation();
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

      const id = watchPosition(
        (position) => {
          latitude.value = position.coords.latitude;
          longitude.value = position.coords.longitude;
          accuracy.value = position.coords.accuracy;
        },
        (err) => {
          error.value = err.message;
        },
      );
      watchId.value = id ?? null;
    } catch (err) {
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
