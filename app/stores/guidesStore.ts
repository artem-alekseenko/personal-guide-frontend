import { defineStore } from "pinia";
import { computed, ref } from "vue";
import type { IGuide } from "~/types";
import { useGuides } from "~/composables/api/useGuides";

const GUIDES_CACHE_TTL_MS = 1000 * 60 * 60;

export const useGuidesStore = defineStore("guidesStore", () => {
  // State — persisted fields are backed by localStorage via VueUse
  const guidesList = useLocalStorage<IGuide[]>("pg-guides-list", []);
  const selectedGuide = useLocalStorage<IGuide | null>("pg-selected-guide", null);
  const guidesListFetchedAt = useLocalStorage<number | null>("pg-guides-fetched-at", null);
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
    isGuidesListLoading.value = true;
    error.value = null;
    try {
      const requestedGuides = await useGuides();
      setGuidesList(requestedGuides);
    } catch (e) {
      isGuidesListLoading.value = false;
      error.value = e instanceof Error ? e.message : "Failed to load guides";
      throw e;
    }
  };

  const invalidateGuidesCache = () => {
    guidesListFetchedAt.value = null;
  };

  return {
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
