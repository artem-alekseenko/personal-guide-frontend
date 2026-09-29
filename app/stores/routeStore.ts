import { defineStore } from "pinia";
import { computed, ref, unref } from "vue";
import type {
  ICoordinate,
  ICreatedTour,
  ICreateTourRequest,
  IRouteSuggestionsResponseExtended,
  ITourTag,
} from "~/types";
import { useListTours } from "~/composables/api/tours/useListTours";
import { useCreateTour } from "~/composables/api/tours/useCreateTour";
import { useTourSuggestions } from "~/composables/api/useTourSuggestions";

export const useRouteStore = defineStore("routeStore", () => {
  // State
  const _startPoint = ref<ICoordinate | null>(null);
  const _duration = ref<string>("5");
  const _routeSuggestion = ref<IRouteSuggestionsResponseExtended | null>(null);
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
  const isLoading = ref(false);
  let pollingEnabled = true;
  let requestVersion = 0;
  const error = ref<string | null>(null);

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

  const setActualTour = (newRoute: ICreatedTour): void => {
    _actualTour.value = newRoute;
  };

  const setAllTours = (newTours: ICreatedTour[]): void => {
    _allTours.value = newTours;
  };

  // Polling control
  const stopPolling = (): void => {
    pollingEnabled = false;
    if (_interval.value) {
      clearInterval(_interval.value);
      _interval.value = null;
    }
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

    const version = requestVersion;
    const routeSuggestions = await useTourSuggestions(params);
    if (version === requestVersion) setRouteSuggestion(routeSuggestions);
  };

  const fetchCreateRoute = async (): Promise<void> => {
    const route = _routeSuggestion.value?.routes[0]?.points.map((point) => ({
      lat: point.lat.toString(),
      lng: point.lng.toString(),
    }));

    if (!route || !route.length) {
      throw new Error("Select a route first");
    }

    const guidesStore = useGuidesStore();

    const preparedSettings = _tags.value
      .filter((tag) => tag.is_selected)
      .map((tag) => ({
        name: tag.name,
        value: tag.name,
      }));

    if (!guidesStore.selectedGuide?.id) throw new Error("Select a guide first");
    const version = requestVersion;
    const payload: ICreateTourRequest = {
      guide_id: guidesStore.selectedGuide?.id || "",
      route,
      settings: preparedSettings,
    };

    try {
      error.value = null;
      const tour = await useCreateTour(payload);
      if (version === requestVersion) setActualTour(tour);
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to create route";
      throw e;
    }
  };

  const fetchListTours = async (): Promise<void> => {
    if (isLoading.value) return;
    pollingEnabled = true;
    const version = requestVersion;
    isLoading.value = true;
    try {
      error.value = null;
      const tours = await useListTours();
      if (version !== requestVersion) return;
      _allTours.value = tours;
      _actualTour.value = tours[0] ?? null;
    } catch (e) {
      if (version === requestVersion)
        error.value = e instanceof Error ? e.message : "Failed to load tours";
    } finally {
      if (version === requestVersion) {
        isLoading.value = false;
        if (_interval.value) clearTimeout(_interval.value);
        const pending = _allTours.value.some(
          (tour) => tour.status === "GENERATING" && !tour.preparation_error,
        );
        if (import.meta.client && pollingEnabled && (pending || error.value)) {
          _interval.value = setTimeout(() => {
            void fetchListTours();
          }, 5000);
        }
      }
    }
  };

  const reset = () => {
    stopPolling();
    requestVersion++;
    _allTours.value = [];
    _actualTour.value = null;
    _routeSuggestion.value = null;
    _startPoint.value = null;
    _tags.value = _tags.value.map((tag) => ({ ...tag, is_selected: false }));
    error.value = null;
    isLoading.value = false;
  };

  return {
    startPoint,
    duration,
    routeSuggestion,
    actualTour,
    allTours,
    tags,
    error,
    isLoading,
    reset,
    setStartPoint,
    setDuration,
    setRouteSuggestion,
    setTags,
    stopPolling,
    fetchRoutesSuggestions,
    fetchCreateRoute,
    fetchListTours,
  };
});
