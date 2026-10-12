import { defineStore } from "pinia";
import { computed, ref, shallowRef, watch } from "vue";
import type { ICreatedTour } from "~/types";
import type {
  RouteDiscovery,
  RoutePlacesRequest,
} from "~/types/routeDiscovery";
import { useTourRequestStore } from "./tourRequestStore";
import { useUserStore } from "./userStore";

export interface RoutePlacesIdentity {
  tourId: string;
  ownerId: string;
  generationId: string | null;
  language: string;
  geometry: string;
}
const identityKey = (identity: RoutePlacesIdentity) => JSON.stringify(identity);

interface DiscoveryState {
  identity: RoutePlacesIdentity;
  result: RouteDiscovery | null;
  attempted: boolean;
  busy: boolean;
  failed: boolean;
  operation: {
    readonly key: string;
    readonly body: Readonly<RoutePlacesRequest>;
  } | null;
}

const tourKey = (scope: RoutePlacesIdentity) =>
  JSON.stringify([scope.ownerId, scope.tourId]);

/** A single bounded scan per immutable route identity, never a GPS polling action. */
export const useRoutePlacesStore = defineStore("routePlaces", () => {
  const users = useUserStore();
  const states = ref<Record<string, DiscoveryState>>({});
  const selected = shallowRef<RoutePlacesIdentity | null>(null);
  const cache = new Map<string, RouteDiscovery>();
  let epoch = 0;
  const matches = (left: RoutePlacesIdentity, right: RoutePlacesIdentity) =>
    identityKey(left) === identityKey(right);
  const current = computed(() =>
    selected.value && users.user?.uid === selected.value.ownerId
      ? states.value[tourKey(selected.value)]
      : undefined,
  );
  const result = computed(() =>
    current.value &&
    selected.value &&
    matches(current.value.identity, selected.value)
      ? current.value.result
      : null,
  );
  const busy = computed(() => current.value?.busy ?? false);
  const failed = computed(() => current.value?.failed ?? false);
  const hasPending = computed(() => !!current.value?.operation);
  const clearSelection = () => {
    selected.value = null;
  };
  const reset = () => {
    epoch++;
    states.value = {};
    clearSelection();
    cache.clear();
  };
  watch(() => users.user?.uid, reset, { flush: "sync" });

  async function send(state = current.value) {
    if (!state?.operation || state.busy) return;
    const scope = state.identity;
    const pending = state.operation;
    const version = epoch;
    const isCurrent = () =>
      version === epoch &&
      states.value[tourKey(scope)] === state &&
      users.user?.uid === scope.ownerId;
    state.busy = true;
    state.failed = false;
    try {
      const response = await useTourRequestStore().run(scope.tourId, () => {
        if (!isCurrent())
          throw new Error(
            "The signed-in account or discovery operation changed",
          );
        return (useNuxtApp().$apiFetch as typeof $fetch)<RouteDiscovery>(
          `/api/tour-route-places/${encodeURIComponent(scope.tourId)}`,
          {
            method: "POST",
            body: pending.body,
            headers: { "Idempotency-Key": pending.key },
            retry: 0,
          },
        );
      });
      if (isCurrent()) {
        state.result = response;
        cache.set(identityKey(scope), response);
        state.operation = null;
      }
    } catch (error) {
      if (isCurrent()) {
        state.failed = true;
        let status: unknown;
        if (error && typeof error === "object") {
          if ("statusCode" in error) status = error.statusCode;
          else if ("status" in error) status = error.status;
        }
        if (
          typeof status === "number" &&
          [400, 401, 403, 404, 422].includes(status)
        )
          state.operation = null;
      }
      throw error;
    } finally {
      if (isCurrent()) state.busy = false;
    }
  }
  async function ensure(
    scope: RoutePlacesIdentity,
    saved?: RouteDiscovery | null,
  ) {
    if (!scope.ownerId || users.user?.uid !== scope.ownerId) return;
    selected.value = { ...scope };
    const id = tourKey(scope);
    let state = states.value[id];
    if (state && !matches(state.identity, scope) && state.operation) return;
    if (!state || !matches(state.identity, scope)) {
      states.value[id] = {
        identity: { ...scope },
        result: cache.get(identityKey(scope)) ?? null,
        attempted: false,
        busy: false,
        failed: false,
        operation: null,
      };
      state = states.value[id]!;
    }
    const language = scope.language;
    if (language !== "en" && language !== "ru") return;
    if (
      saved?.language === scope.language &&
      (saved.generation_id ?? null) === scope.generationId &&
      !state.result
    ) {
      state.result = saved;
      cache.set(identityKey(scope), saved);
    }
    if (state.attempted || state.result || state.busy) return;
    state.attempted = true;
    state.operation = Object.freeze({
      key: crypto.randomUUID(),
      body: Object.freeze({ generation_id: scope.generationId, language }),
    });
    await send(state);
  }
  async function reconcile(scope: RoutePlacesIdentity) {
    const state = states.value[tourKey(scope)];
    if (!state || state.busy || users.user?.uid !== scope.ownerId) return;
    const version = epoch;
    const isCurrent = () =>
      version === epoch &&
      states.value[tourKey(scope)] === state &&
      users.user?.uid === scope.ownerId;
    state.busy = true;
    try {
      const tour = await (
        useNuxtApp().$apiFetch as typeof $fetch
      )<ICreatedTour>(`/api/get-tour/${encodeURIComponent(scope.tourId)}`);
      if (!isCurrent()) return;
      const saved = tour.route.discovery;
      if (
        state.operation &&
        saved?.request_id === state.operation.key &&
        (saved.generation_id ?? null) === state.operation.body.generation_id &&
        saved.language === state.operation.body.language
      ) {
        state.result = saved;
        cache.set(identityKey(state.identity), saved);
        state.operation = null;
      } else if (state.operation) {
        // A GET without our receipt proves nothing about the original paid call.
        state.busy = false;
        await send(state);
        if (!isCurrent() || state.operation) return;
      }
      state.busy = false;
      if (selected.value && matches(selected.value, scope))
        await ensure(scope, saved);
    } finally {
      if (isCurrent()) state.busy = false;
    }
  }
  return {
    result,
    busy,
    failed,
    hasPending,
    ensure,
    retry: () => send(),
    reconcile,
    reset,
    clearSelection,
    resultFor: (scope: RoutePlacesIdentity) => {
      const state = states.value[tourKey(scope)];
      return users.user?.uid === scope.ownerId &&
        state &&
        matches(state.identity, scope)
        ? state.result
        : null;
    },
  };
});
