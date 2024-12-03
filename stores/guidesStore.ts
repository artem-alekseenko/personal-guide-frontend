import { defineStore } from "pinia";
import type { IGuide } from "~/types/guides.ts";
import { ref } from "vue";

export const useGuidesStore = defineStore("guidesStore", () => {
  const guides = ref<IGuide[]>([]);

  const initialized = ref(false);

  return {
    initialized,
    guides,
  };
});
