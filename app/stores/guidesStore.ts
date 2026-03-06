import { defineStore } from "pinia";
import type { IGuide } from "~/types";
import { ref } from "vue";
import { useGuides } from "~/composables/api/useGuides";

const GUIDES_CACHE_TTL_MS = 1000 * 60 * 60;

export const useGuidesStore = defineStore(
  "guidesStore",
  () => {
    // State
    const _guidesList = ref<IGuide[]>([]);
    const _selectedGuide = ref<IGuide | null>(null);
    const _guidesListFetchedAt = ref<number | null>(null);
    const isGuidesListLoading = ref<boolean>(false);

    // Getters
    const selectedGuide = computed((): IGuide | null => {
      return _selectedGuide.value ?? null;
    });
    const guidesList = computed((): IGuide[] => _guidesList.value);
    const isGuidesCacheValid = computed((): boolean => {
      if (!_guidesListFetchedAt.value || _guidesList.value.length === 0) {
        return false;
      }
      return Date.now() - _guidesListFetchedAt.value < GUIDES_CACHE_TTL_MS;
    });

    // Actions
    const setSelectedGuide = (newGuide: IGuide): void => {
      _selectedGuide.value = newGuide;
    };
    const setGuidesList = (newGuides: IGuide[]) => {
      _guidesList.value = newGuides;
      _guidesListFetchedAt.value = Date.now();
      isGuidesListLoading.value = false;
    };
    const fetchGuidesList = async () => {
      if (isGuidesListLoading.value || isGuidesCacheValid.value) {
        return;
      }
      isGuidesListLoading.value = true;
      try {
        const requestedGuides = await useGuides();
        setGuidesList(requestedGuides);
      } catch (error) {
        isGuidesListLoading.value = false;
        throw error;
      }
    };
    const invalidateGuidesCache = () => {
      _guidesListFetchedAt.value = null;
    };

    return {
      _selectedGuide,
      _guidesList,
      _guidesListFetchedAt,
      guidesList,
      isGuidesListLoading,
      isGuidesCacheValid,
      setGuidesList,
      fetchGuidesList,
      invalidateGuidesCache,
      selectedGuide,
      setSelectedGuide,
    };
  },
  {
    persist: {
      storage: piniaPluginPersistedstate.localStorage(),
      pick: ["_selectedGuide", "_guidesList", "_guidesListFetchedAt"],
    },
  },
);
