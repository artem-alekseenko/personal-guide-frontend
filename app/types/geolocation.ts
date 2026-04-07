import type { ComputedRef, Ref } from "vue";

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
