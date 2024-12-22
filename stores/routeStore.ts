import type {
  ICoordinate,
  ICreatedTour,
  ICreateTourRequest,
  IRouteSuggestionsResponseExtended,
} from "~/types";

export const useRouteStore = defineStore("routeStore", () => {
  // State
  const _startPoint = ref<ICoordinate | null>(null);
  const _duration = ref<string>("5");
  const _routeSuggestion = ref<IRouteSuggestionsResponseExtended | null>(null);
  const currentRoute = ref<ICreatedTour | null>(null);
  const _actualTour = ref<ICreatedTour | null>(null);
  const _allTours = ref<ICreatedTour[]>([]);

  // Getters
  const startPoint = computed((): ICoordinate | null => _startPoint.value);
  const duration = computed((): string => _duration.value);
  const routeSuggestion = computed(
    (): IRouteSuggestionsResponseExtended | null => _routeSuggestion.value,
  );
  const actualTour = computed((): ICreatedTour | null => _actualTour.value);
  const allTours = computed((): ICreatedTour[] => _allTours.value);

  // Actions
  const fetchRoutesSuggestions = async (): Promise<void> => {
    const guidesStore = useGuidesStore();
    const params = {
      lng: _startPoint.value ? _startPoint.value.lng.toString() : "0",
      lat: _startPoint.value ? _startPoint.value.lat.toString() : "0",
      duration: _duration.value,
      guideId: guidesStore.selectedGuide?.id || "",
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

    const payload: ICreateTourRequest = {
      guide_id: guidesStore.selectedGuide?.id || "",
      route,
      settings: [],
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

  return {
    // State as computed properties (read-only)
    startPoint,
    duration,
    routeSuggestion,
    actualTour,
    _actualTour,
    // Actions
    setStartPoint,
    setDuration,
    setRouteSuggestion,
    fetchRoutesSuggestions,
    fetchCreateRoute,
    fetchListTours,
    allTours,
  };
});
