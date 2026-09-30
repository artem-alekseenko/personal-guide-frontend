import type { ICreatedTour } from "~/types";
import { useTourRequestStore } from "~/stores/tourRequestStore";
export const useFinishTour = async (tourId: string): Promise<ICreatedTour> => {
  const apiFetch = useNuxtApp().$apiFetch as typeof $fetch;
  const response = await useTourRequestStore().run(tourId, () =>
    apiFetch<{ tour: ICreatedTour; result: string }>(
      `/api/finish-tour/${encodeURIComponent(tourId)}`,
      { method: "POST", retry: 0 },
    ),
  );
  return response.tour;
};
