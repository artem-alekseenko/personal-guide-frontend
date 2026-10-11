import { computed, onScopeDispose, shallowRef, watch } from "vue";
import { isNavigationFailure } from "vue-router";
import { useResearchPreviewStore } from "~/stores/researchPreviewStore";
import { useTourRequestStore } from "~/stores/tourRequestStore";
import { useUserStore } from "~/stores/userStore";

export function useTourResearchPreviewAction(
  tourId: () => string,
  generationId: () => string | null,
) {
  const previews = useResearchPreviewStore();
  const requests = useTourRequestStore();
  const users = useUserStore();
  const confirming = shallowRef(false);
  let epoch = 0;
  watch(
    [tourId, () => users.user?.uid],
    () => {
      epoch++;
      confirming.value = false;
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
  async function confirm() {
    if (!confirming.value || busy.value || !users.user) return;
    const current = epoch;
    const id = tourId();
    try {
      const result = await previews.open(
        id,
        generationId(),
        async (preview) => {
          if (current !== epoch) return;
          const navigation = await navigateTo(
            `/tours/${encodeURIComponent(preview.id)}`,
          );
          if (navigation === false || isNavigationFailure(navigation))
            throw new Error("The saved draft could not be opened");
        },
      );
      if (result && current === epoch) confirming.value = false;
    } catch {
      // The shared operation retains creation/navigation failure for retry.
    }
  }
  return { confirming, busy, failed, saved, confirm };
}
