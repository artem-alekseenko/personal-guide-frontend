import type {
  ICoordinate,
  ICreatedTour,
  ITourRecord,
  ITourRecordRequest,
} from "~/types";
import { useGetTourRecord } from "~/composables/useGetTourRecord";

export const useTourStore = defineStore("tourStore", () => {
  // State
  const _tour = ref<ICreatedTour | null>(null);
  const _currentTourRecord = ref<ITourRecord | null>(null);
  const _allTourRecord = ref<string>("");
  const _userText = ref<string>("");

  // Getters
  const tour = computed((): ICreatedTour | null => _tour.value);
  const allTourRecord = computed((): string => _allTourRecord.value);
  const currentTourRecord = computed(
    (): ITourRecord | null => _currentTourRecord.value,
  );
  const userText = computed((): string => _userText.value);

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

  const setUserText = (text: string): void => {
    _userText.value = text;
  };

  // Actions
  const fetchGetTour = async (tourId: string): Promise<void> => {
    const tour = await useGetTour(tourId);

    if (!tour) {
      return;
    }

    setTour(tour);
  };

  const fetchTourRecord = async ({ lat, lng }: ICoordinate): Promise<void> => {
    if (!tour.value) {
      return;
    }

    const params: ITourRecordRequest = {
      duration: "100",
      point: {
        lat,
        lng,
      },
      user_text: userText.value,
      pace: "1",
      type_llm: "SIMPLE",
    };

    const tourId = tour.value.id;
    const tourRecord = await useGetTourRecord(tourId, params);

    if (!tourRecord) {
      return;
    }

    const message = tourRecord.message;
    const sentences = message.match(/[^.!?]*[.!?]/g) || [];
    const firstTwoSentences = sentences.slice(0, 2).join(" ");
    setCurrentTourRecord({ ...tourRecord, message: firstTwoSentences });
    setAllTourRecord(firstTwoSentences);

    // setCurrentTourRecord(tourRecord);
    // setAllTourRecord(tourRecord.message);
    setUserText("");
  };

  return {
    tour,
    currentTourRecord,
    allTourRecord,
    fetchGetTour,
    fetchTourRecord,
    setTour,
    setUserText,
  };
});
