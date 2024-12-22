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

  // Getters
  const startPoint = computed((): ICoordinate | null => _startPoint.value);
  const duration = computed((): string => _duration.value);
  const routeSuggestion = computed(
    (): IRouteSuggestionsResponseExtended | null => _routeSuggestion.value,
  );

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
      const res = await useCreateTour(payload);
    } catch (error) {
      console.error("Error creating route", error);
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

  const setRoute = (newRoute: ICreatedTour): void => {
    currentRoute.value = newRoute;
  };

  return {
    // State as computed properties (read-only)
    startPoint,
    duration,
    routeSuggestion,
    // Actions
    setStartPoint,
    setDuration,
    setRouteSuggestion,
    setRoute,
    fetchRoutesSuggestions,
    fetchCreateRoute,
  };
});
