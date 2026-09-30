import { computed, shallowRef, watch, type Ref } from "vue";
import {
  buildTourProgress,
  isGuideText,
  type ProgressRecord,
  type ProgressState,
  type ProgressTour,
} from "#shared/utils/tourProgress";

/** Display metadata only; this never requests a turn or changes playback. */
export function useTourProgress(input: {
  tour: Readonly<Ref<ProgressTour | null>>;
  record: Readonly<Ref<ProgressRecord | null>>;
  view?: Readonly<Ref<ProgressState | null>>;
  liveExperience?: {
    firebaseUid: Readonly<Ref<string | null>>;
    viewFor: (tourId: string, firebaseUid: string) => ProgressState | null;
  };
}) {
  const lastRecord = shallowRef<ProgressRecord | null>(null);
  const currentRecord = shallowRef<ProgressRecord | null>(null);
  let identity: string | undefined;
  watch(
    () =>
      [
        JSON.stringify([input.tour.value?.id, input.tour.value?.user_id]),
        input.record.value,
      ] as const,
    ([key, record]) => {
      const changed = identity !== undefined && identity !== key;
      identity = key;
      if (changed) {
        lastRecord.value = null;
        currentRecord.value = null;
        return;
      }
      // Keep only display metadata, never the record's media or provider payload.
      currentRecord.value = record
        ? {
            type: record.type,
            message: record.message,
            created_at: record.created_at,
            places: record.places?.map((place) => ({
              name: place.name,
              lat: place.lat,
              lng: place.lng,
            })),
            point: record.point
              ? { lat: record.point.lat, lng: record.point.lng }
              : undefined,
            guidance: record.guidance
              ? {
                  stop_id: record.guidance.stop_id,
                  stop_name: record.guidance.stop_name,
                  action: record.guidance.action,
                }
              : null,
          }
        : null;
      if (isGuideText(currentRecord.value))
        lastRecord.value = currentRecord.value;
    },
    { immediate: true, flush: "sync" },
  );
  const liveView = computed(() => {
    const live = input.liveExperience;
    const uid = live?.firebaseUid.value;
    const id = input.tour.value?.id;
    return live
      ? uid && id
        ? live.viewFor(id, uid)
        : null
      : (input.view?.value ?? null);
  });
  return computed(() =>
    input.tour.value
      ? buildTourProgress({
          tour: input.tour.value,
          view: liveView.value,
          record: currentRecord.value,
          lastRecord: lastRecord.value,
        })
      : null,
  );
}
