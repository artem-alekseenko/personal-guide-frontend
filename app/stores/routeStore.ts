import { emptyPersonalContext } from "~/types/personalContext";
import { defineStore } from "pinia";
import { computed, ref, unref, watch } from "vue";
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
import { useUserStore } from "./userStore";

export const useRouteStore = defineStore("routeStore", () => {
  // State
  const _startPoint = ref<ICoordinate | null>(null);
  const _duration = ref<string>("5");
  const selectedRouteIndex = ref(0);
  const personalContext = ref(emptyPersonalContext());
  const selectedRoute = computed(
    () => _routeSuggestion.value?.routes[selectedRouteIndex.value],
  );
  const canCreate = computed(
    () =>
      (selectedRoute.value?.stops?.length ?? 0) >= 2 &&
      (selectedRoute.value?.geometry?.length ||
        selectedRoute.value?.points.length ||
        0) >= 2,
  );
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
  let contextInitialized = false;
  let draftConsumed = false;
  let contextEdited = false;
  let contextEpoch = 0;
  const error = ref<string | null>(null);

  const effectiveContext = computed(() => {
    const context = personalContext.value;
    if (!context.enabled)
      return {
        ...emptyPersonalContext(),
        enabled: false,
        step_free: context.step_free,
      };
    return {
      ...context,
      interests: [
        ...new Set([
          ...context.interests,
          ..._tags.value
            .filter((tag) => tag.is_selected)
            .map((tag) => tag.name.toLowerCase().replaceAll(" ", "_")),
        ]),
      ].filter((interest) => !context.excluded_topics.includes(interest)),
    };
  });
  // Wait for the shared profile read, but never replace edits made while it loads.
  const initializePersonalContext = async () => {
    if (contextInitialized && !draftConsumed) return;
    if (draftConsumed) {
      draftConsumed = false;
      _actualTour.value = null;
      _routeSuggestion.value = null;
      _startPoint.value = null;
      personalContext.value = emptyPersonalContext();
      _tags.value = _tags.value.map((tag) => ({ ...tag, is_selected: false }));
      contextEdited = false;
      contextEpoch++;
    }
    contextInitialized = true;
    const current = contextEpoch;
    const user = useUserStore();
    const uid = user.user?.uid;
    const before = JSON.stringify(effectiveContext.value);
    await user.loadServerPreferences();
    if (current !== contextEpoch || user.user?.uid !== uid) return;
    if (!user.serverPreferencesLoaded) {
      contextInitialized = false;
      return;
    }
    if (
      !contextEdited &&
      JSON.stringify(effectiveContext.value) === before &&
      user.savedPersonalContext
    )
      personalContext.value = JSON.parse(
        JSON.stringify(user.savedPersonalContext),
      );
    contextEdited = false;
  };
  watch(
    () => JSON.stringify(effectiveContext.value),
    () => {
      contextEdited = true;
      requestVersion++;
      _routeSuggestion.value = null;
    },
    { flush: "sync" },
  );

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
  const toggleInterest = (topic: string) => {
    const selected = effectiveContext.value.interests.includes(topic);
    personalContext.value.interests = selected
      ? personalContext.value.interests.filter((interest) => interest !== topic)
      : [...new Set([...personalContext.value.interests, topic])];
    if (!selected)
      personalContext.value.excluded_topics =
        personalContext.value.excluded_topics.filter(
          (excluded) => excluded !== topic,
        );
    _tags.value = _tags.value.map((tag) =>
      tag.name.toLowerCase().replaceAll(" ", "_") === topic
        ? { ...tag, is_selected: !selected }
        : tag,
    );
  };

  const setStartPoint = (newPoint: ICoordinate): void => {
    if (JSON.stringify(_startPoint.value) !== JSON.stringify(newPoint)) {
      requestVersion++;
      _routeSuggestion.value = null;
    }
    _startPoint.value = newPoint;
  };

  const setDuration = (newDuration: string): void => {
    if (_duration.value !== newDuration) {
      requestVersion++;
      _routeSuggestion.value = null;
    }
    _duration.value = newDuration;
  };

  const setRouteSuggestion = (
    newRoutes: IRouteSuggestionsResponseExtended,
  ): void => {
    _routeSuggestion.value = newRoutes;
    selectRoute(0);
  };

  const selectRoute = (index: number) => {
    const route = _routeSuggestion.value?.routes[index];
    if (!route) return;
    selectedRouteIndex.value = index;
    _routeSuggestion.value = {
      ..._routeSuggestion.value!,
      coordinates: (route.geometry?.length ? route.geometry : route.points).map(
        (p) => [Number(p.lng), Number(p.lat)] as [number, number],
      ),
    };
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
      interests: effectiveContext.value.interests,
      excluded_topics: effectiveContext.value.excluded_topics,
      pace: effectiveContext.value.pace,
      step_free: String(effectiveContext.value.step_free),
      personal_context_enabled: String(effectiveContext.value.enabled),
    };

    const version = ++requestVersion;
    const routeSuggestions = await useTourSuggestions(params);
    if (version === requestVersion) setRouteSuggestion(routeSuggestions);
  };

  const fetchCreateRoute = async (): Promise<void> => {
    const selected = selectedRoute.value;
    if (!canCreate.value || !selected?.stops)
      throw new Error("Select a validated route first");
    const route = selected.stops.map((stop) => ({
      name: stop.name,
      lat: String(stop.point.lat),
      lng: String(stop.point.lng),
      source: stop.source,
      source_id: stop.source_id,
    }));

    const guidesStore = useGuidesStore();

    const preparedSettings = _tags.value
      .filter(
        (tag) =>
          tag.is_selected &&
          effectiveContext.value.interests.includes(
            tag.name.toLowerCase().replaceAll(" ", "_"),
          ),
      )
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
      contract_version: 2,
      route_geometry: selected.geometry?.length
        ? selected.geometry
        : selected.points,
      route_variant: selected.name,
      duration_minutes: Number(_duration.value),
      personal_context: effectiveContext.value,
    };

    try {
      error.value = null;
      const tour = await useCreateTour(payload);
      if (version === requestVersion) {
        setActualTour(tour);
        draftConsumed = true;
      }
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
    personalContext.value = emptyPersonalContext();
    contextInitialized = false;
    draftConsumed = false;
    contextEdited = false;
    contextEpoch++;
    selectedRouteIndex.value = 0;
    _tags.value = _tags.value.map((tag) => ({ ...tag, is_selected: false }));
    error.value = null;
    isLoading.value = false;
  };

  return {
    startPoint,
    selectedRouteIndex,
    selectedRoute,
    selectRoute,
    canCreate,
    personalContext,
    initializePersonalContext,
    effectiveContext,
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
    toggleInterest,
    stopPolling,
    fetchRoutesSuggestions,
    fetchCreateRoute,
    fetchListTours,
  };
});
