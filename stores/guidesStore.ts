import { defineStore } from "pinia";
import type { IGuide } from "~/types/guides.ts";
import { ref } from "vue";

export const useGuidesStore = defineStore("guidesStore", () => {
  const guidesList = ref<IGuide[]>([]);
  const isGuidesListLoading = ref<boolean>(false);

  const setGuidesList = (newGuides: IGuide[]) => {
    guidesList.value = newGuides;
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
  };
});
