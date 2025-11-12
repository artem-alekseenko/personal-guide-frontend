import { defineStore } from "pinia";
import type { IGuide } from "~/types";
import { ref } from "vue";
import { useGuides } from "~/composables/useGuides";

export const useGuidesStore = defineStore(
  "guidesStore",
  () => {
    // State
    const _guidesList = ref<IGuide[]>([]);
    const _selectedGuide = ref<IGuide | null>(null);
    const isGuidesListLoading = ref<boolean>(false);

    // Getters
    const selectedGuide = computed((): IGuide | null => {
      return _selectedGuide.value ?? null;
    });
    const guidesList = computed((): IGuide[] => _guidesList.value);

    // Actions
    const setSelectedGuide = (newGuide: IGuide): void => {
      _selectedGuide.value = newGuide;
    };
    const setGuidesList = (newGuides: IGuide[]) => {
      _guidesList.value = newGuides;
      isGuidesListLoading.value = false;
    };
    const fetchGuidesList = async () => {
      if (isGuidesListLoading.value) {
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

    return {
      _selectedGuide,
      guidesList,
      isGuidesListLoading,
      setGuidesList,
      fetchGuidesList,
      selectedGuide,
      setSelectedGuide,
    };
  },
  {
    persist: {
      storage: piniaPluginPersistedstate.localStorage(),
      pick: ["_selectedGuide"],
    },
  },
);
