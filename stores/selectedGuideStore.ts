import { defineStore } from "pinia";
import { ref } from "vue";
import type { Guide } from "~/types/guides";

export const useSelectedGuide = defineStore("selectedGuideStore", () => {
  const guide = ref<Guide | null>(null);

  const setGuide = (newGuide: Guide) => {
    guide.value = newGuide;
  };

  return { guide, setGuide };
});
