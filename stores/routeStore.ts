import type {
  ICoordinate,
  ICreatedTour,
  ICreateTourRequest,
  IRouteSuggestionsResponseExtended,
  ITourTag,
} from "~/types";

export const useRouteStore = defineStore("routeStore", () => {
  // State
  const _startPoint = ref<ICoordinate | null>(null);
  const _duration = ref<string>("5");
  const _routeSuggestion = ref<IRouteSuggestionsResponseExtended | null>(null);
  const currentRoute = ref<ICreatedTour | null>(null);
  const _actualTour = ref<ICreatedTour | null>(null);
  const _allTours = ref<ICreatedTour[]>([]);
  const _tags = ref<ITourTag[]>([
    { name: "Nature", is_selected: false },
    { name: "Movies", is_selected: false },
    { name: "IT", is_selected: false },
    { name: "Politics", is_selected: false },
    { name: "For child", is_selected: false },
    { name: "Science", is_selected: false },
    { name: "Art", is_selected: false },
  ]);
  const _interval = ref<NodeJS.Timeout | null>(null);

  // Getters
  const startPoint = computed((): ICoordinate | null => _startPoint.value);
  const duration = computed((): string => _duration.value);
  const routeSuggestion = computed(
    (): IRouteSuggestionsResponseExtended | null => _routeSuggestion.value,
  );
  const actualTour = computed((): ICreatedTour | null => _actualTour.value);
  const allTours = computed((): ICreatedTour[] => _allTours.value);
  const tags = computed((): ITourTag[] => _tags.value);

  // Setters
  const setTags = (newTags: ITourTag[]): void => {
    _tags.value = newTags;
  };

  // Actions
  const fetchRoutesSuggestions = async (): Promise<void> => {
    const guidesStore = useGuidesStore();

    if (
      !guidesStore.selectedGuide ||
      !guidesStore.selectedGuide?.id ||
      !unref(_duration) ||
      !unref(_startPoint)
    ) {
      return;
    }

    const params = {
      lng: unref(_startPoint)!.lng.toString(),
      lat: unref(_startPoint)!.lat.toString(),
      duration: _duration.value,
      guideId: guidesStore.selectedGuide?.id!,
    };

    const routeSuggestions = await useTourSuggestions(params);
    setRouteSuggestion(routeSuggestions);
  };

  const fetchCreateRoute = async (): Promise<void> => {
    const route = _routeSuggestion.value?.routes[0]?.points.map((point) => ({
      lat: point.lat.toString(),
      lng: point.lng.toString(),
    }));

    if (!route || !route.length) {
      return;
    }

    const guidesStore = useGuidesStore();

    const preparedSettings = _tags.value
      .filter((tag) => tag.is_selected)
      .map((tag) => ({
        name: tag.name,
        value: tag.name,
      }));

    const payload: ICreateTourRequest = {
      guide_id: guidesStore.selectedGuide?.id || "",
      route,
      settings: preparedSettings,
    };

    try {
      const tour = await useCreateTour(payload);
      setActualTour(tour);
    } catch (error) {
      console.error("Error creating route", error);
    }
  };

  const fetchListTours = async (): Promise<void> => {
    const tours = await useListTours();

    if (!tours || !tours.length) {
      return;
    }

    setAllTours(tours);
    setActualTour(tours[0] as ICreatedTour);

    const isNotGeneratedTourExist = tours.some(
      (tour) => tour.generating_percent !== 100,
    );

    if (import.meta.client) {
      if (_interval.value) {
        clearInterval(_interval.value);
      }

      if (isNotGeneratedTourExist) {
        _interval.value = setInterval(async () => {
          await fetchListTours();
        }, 5000);
      }
    }
  };

  const setStartPoint = (newPoint: ICoordinate): void => {
    _startPoint.value = newPoint;
  };

  const setDuration = (newDuration: string): void => {
    _duration.value = newDuration;
  };

  const setRouteSuggestion = (
    newRoutes: IRouteSuggestionsResponseExtended,
  ): void => {
    _routeSuggestion.value = newRoutes;
  };

  const setCurrentRoute = (newRoute: ICreatedTour): void => {
    currentRoute.value = newRoute;
  };

  const setActualTour = (newRoute: ICreatedTour): void => {
    _actualTour.value = newRoute;
  };

  const setAllTours = (newTours: ICreatedTour[]): void => {
    _allTours.value = newTours;
  };

  onUnmounted(() => {
    if (_interval.value) {
      clearInterval(_interval.value);
      _interval.value = null;
    }
  });

  return {
    // State as computed properties (read-only)
    startPoint,
    duration,
    routeSuggestion,
    actualTour,
    _actualTour,
    tags,
    // Setters
    setStartPoint,
    setDuration,
    setRouteSuggestion,
    setTags,
    // Actions
    fetchRoutesSuggestions,
    fetchCreateRoute,
    fetchListTours,
    allTours,
  };
});
