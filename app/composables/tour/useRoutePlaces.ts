import { computed, watch, type ComputedRef } from "vue";
import type { ICreatedTour } from "~/types";
import type { Experience } from "~/types/tourExperience";
import {
  useRoutePlacesStore,
  type RoutePlacesIdentity,
} from "~/stores/routePlacesStore";

export function useRoutePlaces(options: {
  tour: ComputedRef<ICreatedTour | null>;
  ownerId: ComputedRef<string | null>;
  language: ComputedRef<string>;
  experience: ComputedRef<Experience | null>;
}) {
  const store = useRoutePlacesStore();
  const identity = computed<RoutePlacesIdentity | null>(() => {
    const tour = options.tour.value,
      ownerId = options.ownerId.value;
    if (!tour || !ownerId) return null;
    return {
      tourId: tour.id,
      ownerId,
      generationId:
        tour.playback_generation_id ??
        options.experience.value?.generation_id ??
        tour.active_generation_id ??
        null,
      language: options.language.value,
      geometry: JSON.stringify([
        tour.route.geometry ?? [],
        tour.route.geometry_leg_starts ?? [],
      ]),
    };
  });
  const discovery = computed(() => {
    const scope = identity.value;
    if (!scope) return null;
    const view = options.experience.value;
    const live =
      view?.generation_id === scope.generationId ? view.route_discovery : null;
    const saved = options.tour.value?.route.discovery;
    for (const candidate of [live, store.resultFor(scope), saved]) {
      if (
        candidate?.language === scope.language &&
        (candidate.generation_id ?? null) === scope.generationId
      )
        return candidate;
    }
    return null;
  });
  const places = computed(() => {
    if (!identity.value) return [];
    const live = options.experience.value;
    if (
      live?.generation_id === identity.value.generationId &&
      live.route_discovery === discovery.value &&
      live.route_places
    )
      return live.route_places;
    return (
      discovery.value?.discovered_places ??
      (!options.tour.value?.route.discovery
        ? (options.tour.value?.route.discovered_places ?? [])
        : [])
    );
  });
  watch(
    [() => JSON.stringify(identity.value), () => store.hasPending],
    () => {
      const scope = identity.value;
      if (!scope) {
        if (!options.ownerId.value) store.reset();
        else store.clearSelection();
        return;
      }
      const saved = discovery.value;
      // The worker discovers against its newly validated walking geometry.
      // Public lookup requires the published pin; don't race it during preparation.
      if (
        options.tour.value?.active_generation_id &&
        !options.tour.value.playback_generation_id &&
        !saved
      )
        return;
      void store.ensure(scope, saved).catch(() => {});
    },
    { immediate: true },
  );
  return {
    places,
    discovery,
    busy: computed(() => store.busy),
    failed: computed(() => store.failed),
    pending: computed(() => store.hasPending),
    retry: () => store.retry(),
    reconcile: async () => {
      if (identity.value) await store.reconcile(identity.value);
    },
  };
}
