import { computed, onScopeDispose, shallowRef, watch } from "vue";
import { isNavigationFailure } from "vue-router";
import { useResearchPreviewStore } from "~/stores/researchPreviewStore";
import { useTourRequestStore } from "~/stores/tourRequestStore";
import { useUserStore } from "~/stores/userStore";
import type { ICreatedTour } from "~/types";

export function useTourResearchPreviewAction(
  tourId: () => string,
  generationId: () => string | null,
) {
  const previews = useResearchPreviewStore();
  const requests = useTourRequestStore();
  const users = useUserStore();
  const confirming = shallowRef(false);
  const newGeneration = shallowRef<string | null>(null);
  let epoch = 0;
  watch(
    [tourId, () => users.user?.uid],
    () => {
      epoch++;
      confirming.value = false;
      newGeneration.value = null;
    },
    { flush: "sync" },
  );
  onScopeDispose(() => {
    epoch++;
  });
  const busy = computed(
    () =>
      !!previews.forTour(tourId())?.busy ||
      !!previews.forTour(tourId())?.opening ||
      requests.isBusy(tourId()),
  );
  const saved = computed(() => !!previews.forTour(tourId())?.result);
  const failed = computed(
    () =>
      !!previews.forTour(tourId())?.failed ||
      !!previews.forTour(tourId())?.navigationFailed,
  );
  const creatingNew = computed(() => newGeneration.value !== null);
  const canCreateNew = computed(
    () =>
      !!previews.forTour(tourId())?.result &&
      generationId() !== null &&
      previews.forTour(tourId())?.result?.research_preview
        ?.source_generation_id !== generationId(),
  );
  watch(
    generationId,
    () => {
      if (creatingNew.value && !busy.value) {
        confirming.value = false;
        newGeneration.value = null;
      }
    },
    { flush: "sync" },
  );
  function beginSaved() {
    if (busy.value || !users.user) return;
    newGeneration.value = null;
    confirming.value = true;
  }
  function cancelConfirmation() {
    newGeneration.value = null;
    confirming.value = false;
  }
  function beginNew() {
    if (busy.value || !canCreateNew.value || !users.user) return;
    newGeneration.value = generationId();
    confirming.value = true;
  }
  async function confirm() {
    if (!confirming.value || busy.value || !users.user) return;
    const current = epoch;
    const id = tourId();
    try {
      const navigate = async (preview: ICreatedTour) => {
        if (current !== epoch) return;
        const navigation = await navigateTo(
          `/tours/${encodeURIComponent(preview.id)}`,
        );
        if (navigation === false || isNavigationFailure(navigation))
          throw new Error("The saved draft could not be opened");
      };
      const result =
        newGeneration.value === null
          ? await previews.open(id, generationId(), navigate)
          : await previews.openNew(id, newGeneration.value, navigate);
      if (result && current === epoch) {
        confirming.value = false;
        newGeneration.value = null;
      }
    } catch {
      // The shared operation retains creation/navigation failure for retry.
    }
  }
  return {
    confirming,
    busy,
    failed,
    saved,
    creatingNew,
    canCreateNew,
    beginSaved,
    beginNew,
    cancelConfirmation,
    confirm,
  };
}
