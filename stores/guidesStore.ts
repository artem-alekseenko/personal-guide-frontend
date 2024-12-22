import { defineStore } from "pinia";
import type { IGuide } from "~/types";
import { ref } from "vue";
import { useGuides } from "~/composables/useGuides";

export const useGuidesStore = defineStore(
  "guidesStore",
  () => {
    // State
    const _guidesList = ref<IGuide[]>([]);
    const isGuidesListLoading = ref<boolean>(false);
    const _selectedGuideId = ref<string | null>(null);

    // Getters
    const selectedGuide = computed((): IGuide | null => {
      if (!_selectedGuideId.value) {
        return null;
      }

      return (
        _guidesList.value.find(
          (guide) => guide.id === _selectedGuideId.value,
        ) || null
      );
    });
    const guidesList = computed((): IGuide[] => _guidesList.value);

    // Actions
    const setSelectedGuideId = (newGuide: string): void => {
      _selectedGuideId.value = newGuide;
    };
    const setGuidesList = (newGuides: IGuide[]) => {
      _guidesList.value = newGuides;
      isGuidesListLoading.value = false;
    };
    const fetchGuidesList = async () => {
      if (isGuidesListLoading.value || guidesList.value.length) {
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
      guidesList,
      isGuidesListLoading,
      setGuidesList,
      fetchGuidesList,
      selectedGuide,
      setSelectedGuideId,
      _selectedGuideId,
      _guidesList,
    };
  },
  {
    persist: {
      storage: piniaPluginPersistedstate.localStorage(),
      pick: ["_selectedGuideId", "_guidesList"],
    },
  },
);
