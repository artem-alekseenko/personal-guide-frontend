import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { IGuide } from "~/types";
import { useGuides } from "~/composables/api/useGuides";

const GUIDES_CACHE_TTL_MS = 1000 * 60 * 60;

export const useGuidesStore = defineStore("guidesStore", () => {
  // Guide responses include owner-specific tours; retain them only for this session.
  const guidesList = ref<IGuide[]>([]);
  const selectedGuide = ref<IGuide | null>(null);
  const guidesListFetchedAt = ref<number | null>(null);
  let requestVersion = 0;
  const isGuidesListLoading = ref<boolean>(false);
  const error = ref<string | null>(null);

  // Getters
  const isGuidesCacheValid = computed((): boolean => {
    if (!guidesListFetchedAt.value || guidesList.value.length === 0) {
      return false;
    }
    return Date.now() - guidesListFetchedAt.value < GUIDES_CACHE_TTL_MS;
  });

  // Actions
  const setSelectedGuide = (newGuide: IGuide): void => {
    selectedGuide.value = newGuide;
  };

  const setGuidesList = (newGuides: IGuide[]) => {
    guidesList.value = newGuides;
    guidesListFetchedAt.value = Date.now();
    isGuidesListLoading.value = false;
  };

  const fetchGuidesList = async () => {
    if (isGuidesListLoading.value || isGuidesCacheValid.value) {
      return;
    }
    const version = requestVersion;
    isGuidesListLoading.value = true;
    error.value = null;
    try {
      const requestedGuides = await useGuides();
      if (version === requestVersion) setGuidesList(requestedGuides);
    } catch (e) {
      if (version !== requestVersion) return;
      isGuidesListLoading.value = false;
      error.value = e instanceof Error ? e.message : "Failed to load guides";
    }
  };

  const invalidateGuidesCache = () => {
    guidesListFetchedAt.value = null;
  };

  const reset = () => {
    requestVersion++;
    guidesList.value = [];
    selectedGuide.value = null;
    guidesListFetchedAt.value = null;
    isGuidesListLoading.value = false;
    error.value = null;
  };
  return {
    reset,
    guidesList,
    selectedGuide,
    guidesListFetchedAt,
    isGuidesListLoading,
    isGuidesCacheValid,
    error,
    setGuidesList,
    fetchGuidesList,
    invalidateGuidesCache,
    setSelectedGuide,
  };
});
