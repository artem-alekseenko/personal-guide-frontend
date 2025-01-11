import type { ICreatedTour, ITourRecord, ITourRecordRequest } from "~/types";
import { useGetTourRecord } from "~/composables/useGetTourRecord";

export const useTourStore = defineStore("tourStore", () => {
  // State
  const _tour = ref<ICreatedTour | null>(null);
  const _currentTourRecord = ref<ITourRecord | null>(null);
  const _allTourRecord = ref<string>("");

  // Getters
  const tour = computed((): ICreatedTour | null => _tour.value);
  const allTourRecord = computed((): string => _allTourRecord.value);

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

  const setAllTourRecord = (text: string): void => {
    _allTourRecord.value = `${_allTourRecord.value} ${text}`;
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

    setCurrentTourRecord(tourRecord);
    setAllTourRecord(tourRecord.message);
  };

  return {
    tour,
    currentTourRecord,
    allTourRecord,
    fetchGetTour,
    fetchTourRecord,
    setTour,
  };
});
