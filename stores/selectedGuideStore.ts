import { defineStore } from "pinia";
import { ref } from "vue";
import type { IGuide } from "~/types/guides";

export const useSelectedGuide = defineStore("selectedGuideStore", () => {
  const guide = ref<IGuide | null>(null);

  const setGuide = (newGuide: IGuide) => {
    guide.value = newGuide;
  };

  return { guide, setGuide };
});
