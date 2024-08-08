import {defineStore} from "pinia";
import type {Guide} from "~/types/guides";
import {ref, useFetch} from "#imports";

export const useGuidesStore = defineStore("guidesStore", () => {
    const guides = ref<Guide[]>([]);

    const initialized = ref(false);

    const initialize = async () => {
        if (initialized.value) return;

        initialized.value = true;

        const {data, error} = await useFetch<Guide[]>("/api/guides");

        if (error.value) {
            console.error("Error fetching guides:", error.value);
            return;
        }

        if (data.value) {
            guides.value = data.value;
        }
    };

    return {
        initialize,
        initialized,
        guides,
    };
});
