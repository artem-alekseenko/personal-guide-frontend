import type { ICreatedTour, ITourRecord, ITourRecordRequest } from "~/types";
import { useGetTourRecord } from "~/composables/useGetTourRecord";

export const useTourStore = defineStore("tourStore", () => {
  // State
  const _tour = ref<ICreatedTour | null>(null);
  const _currentTourRecord = ref<ITourRecord | null>(null);

  // Getters
  const tour = computed((): ICreatedTour | null => _tour.value);

  const currentTourRecord = computed(
    (): ITourRecord | null => _currentTourRecord.value,
  );

  // Setters
  const setTour = (tour: ICreatedTour): void => {
    _tour.value = tour;
  };

  const setCurrentTourRecord = (tourRecord: ITourRecord): void => {
    _currentTourRecord.value = tourRecord;
  };

  // Actions
  const fetchGetTour = async (tourId: string): Promise<void> => {
    const tour = await useGetTour(tourId);

    if (!tour) {
      return;
    }

    setTour(tour);
  };

  const fetchTourRecord = async (params: ITourRecordRequest): Promise<void> => {
    console.log("fetchTourRecord");
    if (!tour.value) {
      return;
    }
    const tourId = tour.value.id;
    const tourRecord = await useGetTourRecord(tourId, params);

    if (!tourRecord) {
      return;
    }

    console.log("store tourRecord", tourRecord);

    setCurrentTourRecord(tourRecord);
  };

  return {
    tour,
    currentTourRecord,
    fetchGetTour,
    fetchTourRecord,
    setTour,
  };
});
