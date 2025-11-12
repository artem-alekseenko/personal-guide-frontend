import { readonly, ref } from "vue";
import { useLogger } from "./useLogger";

interface IGeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  isLoading: boolean;
}

const GEOLOCATION_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const positionOptions: PositionOptions = {
  enableHighAccuracy: true,
  timeout: GEOLOCATION_TIMEOUT_MS,
  maximumAge: 0,
};

const getGeolocationErrorMessage = (
  error: GeolocationPositionError,
): string => {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Please enable location access in your browser settings";
    case error.POSITION_UNAVAILABLE:
      return "Unable to determine your location. Please check your GPS settings";
    case error.TIMEOUT:
      return "Location request timed out. Please check your GPS signal";
    default:
      return error.message;
  }
};

export const useGeolocation = () => {
  if (typeof window === "undefined") {
    throw new Error("useGeolocation must be used in client environment");
  }

  const state = ref<IGeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    isLoading: false,
  });

  const logger = useLogger();

  const updateCoords = (pos: GeolocationPosition) => {
    state.value.latitude = pos.coords.latitude;
    state.value.longitude = pos.coords.longitude;
    state.value.accuracy = pos.coords.accuracy;
    state.value.error = null;
  };

  const retry = (
    retryCount: number,
    resolve: (pos: GeolocationPosition) => void,
    reject: (err: unknown) => void,
    message: string,
  ) => {
    if (retryCount < MAX_RETRIES) {
      logger.log(`Retrying geolocation (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
      setTimeout(() => {
        getCurrentPosition(retryCount + 1)
          .then(resolve)
          .catch(reject);
      }, RETRY_DELAY_MS);
    } else {
      logger.warn(`Geolocation failed after ${MAX_RETRIES} attempts:`, message);
      reject(new Error(message));
    }
  };

  const getCurrentPosition = (retryCount = 0): Promise<GeolocationPosition> => {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = new Error("Geolocation is not supported by your browser");
        state.value.error = error.message;
        logger.error("Geolocation not supported:", error);
        reject(error);
        return;
      }

      state.value.isLoading = true;
      state.value.error = null;

      const handleError = (error: GeolocationPositionError) => {
        state.value.error = error.message;

        // Handle specific error cases
        switch (error.code) {
          case error.PERMISSION_DENIED:
            logger.warn("Geolocation permission denied:", error);
            reject(new Error(getGeolocationErrorMessage(error)));
            break;
          case error.POSITION_UNAVAILABLE:
          case error.TIMEOUT: {
            const message = getGeolocationErrorMessage(error);
            retry(retryCount, resolve, reject, message);
            break;
          }
          default:
            logger.error("Unexpected geolocation error:", error);
            reject(error);
        }
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          logger.log("Geolocation position obtained:", position);
          updateCoords(position);
          resolve(position);
        },
        handleError,
        positionOptions,
      );
    }).finally(() => {
      logger.log("Geolocation request completed");
      state.value.isLoading = false;
    });
  };

  const watchPosition = (
    onSuccess: (position: GeolocationPosition) => void,
    onError?: (error: GeolocationPositionError) => void,
  ): ReturnType<typeof navigator.geolocation.watchPosition> | null => {
    if (!navigator.geolocation) {
      if (onError) {
        const error = {
          code: 2, // POSITION_UNAVAILABLE
          message: "Geolocation is not supported by your browser",
          name: "PositionError",
        } as unknown as GeolocationPositionError;
        logger.error("Geolocation not supported:", error);
        onError(error);
      }
      return null;
    }

    logger.log("Starting geolocation watch...");
    return navigator.geolocation.watchPosition(
      (position) => {
        logger.log("Geolocation position updated:", position);
        updateCoords(position);
        onSuccess(position);
      },
      (error) => {
        state.value.error = error.message;
        logger.warn("Geolocation watch error:", error);
        if (onError) onError(error);
      },
      positionOptions,
    );
  };

  const clearWatch = (watchId: number) => {
    if (navigator.geolocation) {
      logger.log("Clearing geolocation watch:", watchId);
      navigator.geolocation.clearWatch(watchId);
    }
  };

  const resetState = () => {
    logger.log("Resetting geolocation state");
    state.value = {
      latitude: null,
      longitude: null,
      accuracy: null,
      error: null,
      isLoading: false,
    };
    logger.log("Geolocation state reset to:", state.value);
  };

  return {
    state: readonly(state),
    getCurrentPosition,
    watchPosition,
    clearWatch,
    resetState,
  };
};
