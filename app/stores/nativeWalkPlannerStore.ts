import { defineStore } from "pinia";
import { computed, shallowRef, watch } from "vue";
import type { ICreatedTour } from "~/types";
import type {
  WalkingRoutePlan,
  WalkingRouteIntent,
} from "#shared/types/nativeWalk";
import { useRouteStore } from "./routeStore";
import { useGuidesStore } from "./guidesStore";
import { useUserStore } from "./userStore";

export const useNativeWalkPlannerStore = defineStore(
  "nativeWalkPlanner",
  () => {
    const routes = useRouteStore();
    const users = useUserStore();
    const guides = useGuidesStore();
    const plan = shallowRef<WalkingRoutePlan | null>(null);
    const busy = shallowRef(false);
    const creationUncertain = shallowRef(false);
    let revision = 0;
    let accountEpoch = 0;
    let operationSequence = 0;
    let activeOperation: number | null = null;
    const signature = computed(() =>
      JSON.stringify([
        users.user?.uid,
        guides.selectedGuide?.id,
        routes.startPoint,
        routes.duration,
        routes.effectiveContext,
        users.userPreferences.language,
      ]),
    );
    watch(
      signature,
      () => {
        revision++;
        plan.value = null;
      },
      { flush: "sync" },
    );
    const intent = computed<WalkingRouteIntent | null>(() =>
      routes.startPoint
        ? {
            origin: {
              lat: Number(routes.startPoint.lat),
              lng: Number(routes.startPoint.lng),
            },
            duration_minutes: Number(routes.duration),
            language: users.userPreferences.language,
            pace: routes.effectiveContext.pace,
            interests: routes.effectiveContext.interests,
            excluded_topics: routes.effectiveContext.excluded_topics,
            wheelchair: false,
            step_free: routes.effectiveContext.step_free,
          }
        : null,
    );
    async function prepare() {
      if (busy.value || !intent.value) return;
      const version = revision;
      const account = accountEpoch;
      const operation = ++operationSequence;
      activeOperation = operation;
      const uid = users.user?.uid;
      const { $apiFetch } = useNuxtApp();
      busy.value = true;
      try {
        const candidate = await ($apiFetch as typeof $fetch)<WalkingRoutePlan>(
          "/api/walk-plans",
          {
            method: "POST",
            body: JSON.parse(JSON.stringify(intent.value)),
            retry: 0,
          },
        );
        if (
          version === revision &&
          account === accountEpoch &&
          users.user?.uid === uid
        )
          plan.value = candidate;
      } finally {
        if (activeOperation === operation) {
          activeOperation = null;
          busy.value = false;
        }
      }
    }
    async function create() {
      if (
        busy.value ||
        creationUncertain.value ||
        !plan.value ||
        !guides.selectedGuide?.id
      )
        return null;
      const version = revision;
      const account = accountEpoch;
      const operation = ++operationSequence;
      activeOperation = operation;
      const uid = users.user?.uid;
      const { $apiFetch } = useNuxtApp();
      busy.value = true;
      try {
        const tour = await ($apiFetch as typeof $fetch)<ICreatedTour>(
          "/api/create-tour",
          {
            method: "POST",
            retry: 0,
            body: {
              contract_version: 3,
              guide_id: guides.selectedGuide.id,
              walking_plan_id: plan.value.id,
              personal_context: JSON.parse(
                JSON.stringify(routes.effectiveContext),
              ),
              settings: routes.effectiveContext.interests.map((topic) => ({
                name: topic,
                value: topic,
              })),
            },
          },
        );
        if (
          version !== revision ||
          account !== accountEpoch ||
          users.user?.uid !== uid
        )
          return null;
        plan.value = null;
        return tour;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (
          account === accountEpoch &&
          users.user?.uid === uid &&
          (!status || status >= 500)
        )
          creationUncertain.value = true;
        throw error;
      } finally {
        if (activeOperation === operation) {
          activeOperation = null;
          busy.value = false;
        }
      }
    }
    watch(
      () => users.user?.uid,
      () => {
        revision++;
        accountEpoch++;
        activeOperation = null;
        plan.value = null;
        busy.value = false;
        creationUncertain.value = false;
      },
      { flush: "sync" },
    );
    return { plan, intent, busy, creationUncertain, prepare, create };
  },
);
