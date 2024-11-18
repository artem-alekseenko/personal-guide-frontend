import { defineStore } from "pinia";
import type { Guide } from "~/types/guides.ts";
import { ref } from "vue";

export const useGuidesStore = defineStore("guidesStore", () => {
  const guides = ref<Guide[]>([]);

  const initialized = ref(false);

  return {
    initialized,
    guides,
  };
});
