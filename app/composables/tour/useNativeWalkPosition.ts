import { computed, reactive, shallowRef, watch } from "vue";
import type { Ref } from "vue";
import type { WalkPoint, WalkView } from "#shared/types/nativeWalk";
import { useGeolocationStore } from "~/stores/geolocationStore";
import { usePositionMode } from "~/composables/map/usePositionMode";

export interface NativeWalkPositionSource {
  readonly coordinates: [number, number] | null;
  readonly recordedAt: string | null;
  readonly accuracy: number | null;
  readonly error: unknown;
  readonly mode?: "gps" | "simulation";
  refresh: () => Promise<unknown>;
}

/** Selected map positions never overwrite the browser's actual GPS store. */
export function useNativeWalkPosition(origin: Ref<WalkPoint | undefined>) {
  const gps = useGeolocationStore();
  const { isManualMode } = usePositionMode();
  const point = shallowRef<WalkPoint | null>(null);
  const recordedAt = shallowRef<string | null>(null);
  let initialized = false;
  function move(value: WalkPoint) {
    if (!isManualMode.value) return;
    point.value = { ...value };
    stamp();
  }
  function stamp() {
    if (point.value) recordedAt.value = new Date().toISOString();
  }
  function initialize(view: WalkView) {
    if (initialized) return;
    initialized = true;
    point.value ??=
      view.position_mode === "simulation" && view.progress
        ? view.progress.point
        : (origin.value ?? null);
    if (isManualMode.value) stamp();
  }
  watch(
    isManualMode,
    (manual) => {
      if (manual && initialized) stamp();
    },
    { flush: "sync" },
  );
  const source = reactive<NativeWalkPositionSource>({
    get mode() {
      return isManualMode.value ? "simulation" : "gps";
    },
    get coordinates() {
      return isManualMode.value
        ? point.value
          ? ([point.value.lng, point.value.lat] as [number, number])
          : null
        : gps.coordinates;
    },
    get recordedAt() {
      return isManualMode.value ? recordedAt.value : gps.recordedAt;
    },
    get accuracy() {
      return isManualMode.value ? 5 : gps.accuracy;
    },
    get error() {
      return isManualMode.value ? null : gps.error;
    },
    async refresh() {
      if (isManualMode.value) stamp();
      else await gps.refresh();
    },
  });
  return {
    source,
    isManualMode,
    point,
    move,
    initialize,
    gpsAvailable: computed(() => !!gps.coordinates && !gps.error),
  };
}
