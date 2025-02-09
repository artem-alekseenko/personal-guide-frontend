import type {
  ICoordinate,
  ICreatedTour,
  IGeoJSON,
  ITourRecord,
  ITourRecordRequest,
} from "~/types";
import { useGetTourRecord } from "~/composables/useGetTourRecord";
import ensureSentenceEndsProperly from "~/utils/pages/ensureSentenceEndsProperly";

export const useTourStore = defineStore("tourStore", () => {
  // State
  const _tour = useState<ICreatedTour | null>(`tour`, () => null);
  const _currentTourRecord = ref<ITourRecord | null>(null);
  const _textForDisplay = ref<string>("");
  const _textForSpeech = ref<string>("");
  const _userText = ref<string>("");

  // Getters
  const tour = computed((): ICreatedTour | null => _tour.value);
  const textForDisplay = computed((): string => _textForDisplay.value);
  const textForSpeech = computed((): string => _textForSpeech.value);
  const currentTourRecord = computed(
    (): ITourRecord | null => _currentTourRecord.value,
  );
  const userText = computed((): string => _userText.value);
  const currentPlacesGeoJSON = computed((): IGeoJSON | null => {
    const features = _currentTourRecord.value?.places?.map((place) => ({
      type: "Feature",
      properties: {
        title: place.name ?? "Empty place name",
      },
      geometry: {
        type: "Point",
        coordinates: [Number(place.lng), Number(place.lat)] as [number, number],
      },
    }));

    if (!features || !features.length) {
      return null;
    }

    return {
      type: "FeatureCollection",
      features,
    };
  });

  // Mutations
  const setTour = (tour: ICreatedTour): void => {
    _tour.value = tour;
  };

  const setCurrentTourRecord = (tourRecord: ITourRecord): void => {
    _currentTourRecord.value = tourRecord;
  };

  const setTextForDisplay = (text: string): void => {
    console.log("setTextForDisplay", text);
    _textForDisplay.value = text;
  };

  const setTextForSpeech = (text: string): void => {
    _textForSpeech.value = text;
  };

  const appendToTextForDisplay = (part: string) => {
    if (!_textForDisplay.value) {
      _textForDisplay.value = part;
    } else {
      _textForDisplay.value += " " + part;
    }
  };

  const setUserText = (text: string): void => {
    _userText.value = text;
  };

  // Actions
  const fetchGetTour = async (tourId: string): Promise<void> => {
    if (_tour.value?.id === tourId) return;

    const tour = await useGetTour(tourId);

    if (!tour) return;

    setTour(tour);
  };

  const fetchTourStep = async ({ lat, lng }: ICoordinate): Promise<void> => {
    if (!tour.value) return;

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

    const fixedMessage = ensureSentenceEndsProperly(tourRecord.message);

    // const sentences = fixedMessage.match(/[^.!?]*[.!?]/g) || [];
    // const firstTwoSentences = sentences.slice(0, 2).join(" ");
    // setCurrentTourRecord({ ...tourRecord, message: firstTwoSentences });
    // appendToTextForDisplay(firstTwoSentences);
    // setTextForSpeech(firstTwoSentences);

    setCurrentTourRecord(tourRecord);
    appendToTextForDisplay(fixedMessage);
    setTextForSpeech(fixedMessage);
    setUserText("");
  };

  return {
    tour,
    currentTourRecord,
    textForDisplay,
    textForSpeech,
    appendToTextForDisplay,
    setTextForSpeech,
    currentPlacesGeoJSON,
    setTextForDisplay,
    fetchGetTour,
    fetchTourStep,
    setTour,
    setUserText,
  };
});
