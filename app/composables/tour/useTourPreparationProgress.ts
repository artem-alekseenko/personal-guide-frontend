import { onScopeDispose, ref, shallowRef, watch, type Ref } from "vue";
import { useGetTour } from "~/composables/api/tours/useGetTour";
import type { ICreatedTour } from "~/types";
import type { PreparationProgress } from "#shared/types/preparationProgress";

/** Poll read-only preparation snapshots without replacing the active playback tour. */
export function useTourPreparationProgress(
  tour: Readonly<Ref<Pick<ICreatedTour, "id" | "preparation_progress"> | null>>,
  firebaseUid: Readonly<Ref<string | null>>,
) {
  const progress = shallowRef<PreparationProgress | null>(null);
  const refreshFailed = ref(false);
  let revision = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = true;
  const clear = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };
  const pending = () =>
    progress.value && ["PENDING", "RUNNING"].includes(progress.value.status);

  const schedule = () => {
    clear();
    if (active && pending() && tour.value && firebaseUid.value) {
      timer = setTimeout(() => {
        void refresh();
      }, 5000);
    }
  };
  const refresh = async () => {
    const id = tour.value?.id;
    const uid = firebaseUid.value;
    const version = revision;
    if (!id || !uid || !active) return;
    try {
      const result = await useGetTour(id);
      if (
        !active ||
        revision !== version ||
        firebaseUid.value !== uid ||
        tour.value?.id !== id
      )
        return;
      progress.value = result.preparation_progress ?? null;
      refreshFailed.value = false;
    } catch {
      if (active && revision === version) refreshFailed.value = true;
    } finally {
      if (active && revision === version) schedule();
    }
  };
  watch(
    [tour, firebaseUid],
    ([current, uid], [previous, previousUid]) => {
      revision++;
      clear();
      refreshFailed.value = false;
      // An account switch may happen before its old tour is cleared by the store.
      if (
        !uid ||
        (previousUid && uid !== previousUid && current === previous)
      ) {
        progress.value = null;
        return;
      }
      progress.value = current?.preparation_progress ?? null;
      schedule();
    },
    { immediate: true, flush: "sync" },
  );
  onScopeDispose(() => {
    active = false;
    revision++;
    clear();
  });
  return { progress, refreshFailed };
}
