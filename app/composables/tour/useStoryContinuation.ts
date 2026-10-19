import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Ref,
} from "vue";
import {
  createStoryBufferController,
  type StoryBufferOperation,
  type StoryObservation,
} from "#shared/utils/storyBuffer";
import type { CancelReason } from "#shared/types/storyBuffer";
import { canAutomaticallyContinueNarration } from "#shared/utils/tourNarration";
import { useStoryBufferApi } from "~/composables/api/tours/useStoryBufferApi";
import { useTourStore } from "~/stores/tourStore";
import { useUserStore } from "~/stores/userStore";
import { useGeolocationStore } from "~/stores/geolocationStore";
import { useAuth } from "~/composables/auth/useAuth";
import { usePositionMode } from "~/composables/map/usePositionMode";
import type { TourState } from "./useTourState";
import {
  createTourContinuation,
  resolveContinuationStop,
} from "#shared/utils/tourContinuation";

/** Browser adapter. Tests exercise the separate metadata controller, never this player flow. */
export function useStoryContinuation(options: {
  tourId: string;
  featureEnabled: boolean;
  state: Ref<TourState>;
  setState: (state: TourState) => void;
  remainingSeconds: () => number;
  play: () => Promise<void>;
  requestNext: () => Promise<void>;
  getPosition: () => [number, number] | null;
}) {
  const tours = useTourStore(),
    users = useUserStore(),
    geo = useGeolocationStore();
  const auth = useAuth(),
    { positionMode } = usePositionMode();
  const visible = ref(true),
    revision = ref(0);
  let controller: ReturnType<typeof createStoryBufferController> | null = null;
  let alive = true;
  let scopeEpoch = 0;
  let scope = "";
  let timer: ReturnType<typeof setInterval> | undefined;
  let bufferUnsupported = false;
  const read = (): StoryObservation => {
    const record = tours.currentTourRecord,
      tour = tours.tour;
    const coordinates = options.getPosition();
    let stopId =
      record?.discussion_focus?.object_id ?? record?.guidance?.stop_id ?? null;
    const recordPoint = record?.point ?? null;
    const stop = resolveContinuationStop(tour?.route.points ?? [], stopId);
    // Location anchors support ordinary streets without claiming arrival at a route stop.
    if (!stopId && recordPoint)
      stopId = `location:${recordPoint.lat},${recordPoint.lng}`;
    const checkpoint = tours.getPlaybackCheckpoint();
    return {
      generationId: tour?.playback_generation_id ?? null,
      segmentId: record?.playback_segment_id ?? null,
      stopId,
      started:
        checkpoint?.segment === record?.playback_segment_id &&
        checkpoint?.delivery === "STARTED",
      enabled:
        options.featureEnabled &&
        canAutomaticallyContinueNarration(record?.story) &&
        (positionMode.value === "manual" || !geo.error),
      visible: visible.value,
      playing: options.state.value === "RECORD_ACTIVE",
      finished:
        tour?.status === "FINISHED" || options.state.value === "TOUR_FINISHED",
      waiting:
        !!record?.playback_wait_kind ||
        !!record?.guidance?.requires_resume ||
        options.state.value === "RECORD_PAUSED",
      point: coordinates
        ? { lat: String(coordinates[1]), lng: String(coordinates[0]) }
        : null,
      stopPoint: recordPoint ?? stop,
      positionMode: positionMode.value,
      accuracy: positionMode.value === "gps" ? geo.accuracy : null,
      recordedAt: positionMode.value === "gps" ? geo.recordedAt : null,
      // The backend checks actual route and accepted evidence scope at prepare/activate.
      // Reliable motion is not a stop-arrival claim or a reason to restart current audio.
      backendLocationAuthority: true,
      remainingSeconds: options.remainingSeconds(),
    };
  };
  const fallback = createTourContinuation({
    read: () => {
      const evidence = read();
      const record = tours.currentTourRecord;
      const tour = tours.tour;
      return {
        ...evidence,
        scope,
        enabled:
          evidence.enabled &&
          !evidence.finished &&
          !!users.user?.uid &&
          tour?.id === options.tourId &&
          !!tour.user_id,
        turnId: record?.playback_segment_id || record?.id || null,
        fallbackAvailable:
          !tour?.playback_generation_id ||
          (bufferUnsupported && !controller?.hasPending),
        story:
          !!record?.message.trim() &&
          !["WAIT", "COMPLETE", "WALK", "LOCATE", "ANSWER"].includes(
            record?.guidance?.action ?? "",
          ),
        phase:
          options.state.value === "RECORD_ACTIVE"
            ? ("playing" as const)
            : options.state.value === "RECORD_FINISHED"
              ? ("finished" as const)
              : ("blocked" as const),
        waiting: evidence.waiting,
      };
    },
    request: options.requestNext,
  });
  watch(
    () =>
      [
        users.user?.uid,
        tours.tour?.id,
        tours.tour?.user_id,
        tours.tour?.playback_generation_id,
      ] as const,
    ([uid, id, owner, generation]) => {
      const instanceEpoch = ++scopeEpoch;
      const previous = controller;
      fallback.suspend();
      bufferUnsupported = false;
      controller = null;
      if (previous) void previous.suspend("visitor_cancel");
      scope = JSON.stringify([uid, id, owner, generation]);
      revision.value++;
      if (
        !options.featureEnabled ||
        !uid ||
        id !== options.tourId ||
        !owner ||
        !generation
      )
        return;
      const capturedScope = scope;
      const actor = users.user;
      const current = () =>
        alive &&
        scopeEpoch === instanceEpoch &&
        scope === capturedScope &&
        users.user === actor;
      const key = `pg-story-buffer-${owner}-${id}-${generation}`;
      let recovery: StoryBufferOperation | null = null;
      try {
        const saved = JSON.parse(localStorage.getItem(key) || "null");
        if (
          ["prepare", "activate", "cancel"].includes(saved?.kind) &&
          saved.key &&
          saved.body?.generation_id === generation &&
          (saved.kind === "cancel"
            ? saved.body.buffer_id && saved.body.reason
            : saved.body.current_segment_id &&
              saved.body.stop_id &&
              saved.body.point &&
              (saved.kind !== "activate" || saved.bufferId))
        )
          recovery = saved;
      } catch {
        /* Invalid device metadata is ignored. */
      }
      const transport = useStoryBufferApi(id, uid);
      // Only the proxy's explicit unsupported_backend capability response enables
      // legacy fallback. Domain 404/403 and auth failures are never capabilities.
      const instance = createStoryBufferController({
        read,
        transport: {
          ...transport,
          state: async () => {
            const state = await transport.state();
            if (current() && "status" in state) bufferUnsupported = true;
            return state;
          },
          prepare: transport.prepare,
        },
        recovery,
        current,
        canRequest: () => users.user === actor && users.user?.uid === uid,
        changed: () => {
          revision.value++;
        },
        persist: (operation) => {
          try {
            if (operation) localStorage.setItem(key, JSON.stringify(operation));
            else localStorage.removeItem(key);
          } catch {
            /* Same-tab recovery remains available without device storage. */
          }
        },
        recovered: async (state) => {
          if (
            !current() ||
            tours.tour?.status === "FINISHED" ||
            options.state.value === "TOUR_FINISHED" ||
            tours.currentTourRecord?.audio_data ||
            tours.currentTourRecord?.audio_blob
          )
            return;
          if ((await tours.recoverActivePlayback(state)) && current())
            options.setState("RECORD_PAUSED");
        },
        activated: async (view, point, recovered, mayContinue) => {
          if (!current()) return;
          // Backend atomically completed the anchor. Replace its checkpoint before any media request.
          tours.adoptBufferedStory(view, point);
          options.setState(recovered ? "RECORD_PAUSED" : "RECORD_RECEIVED");
          if (!tours.currentTourRecord?.audio_data) {
            const api = useNuxtApp().$apiFetch as typeof $fetch;
            const blob = await api<Blob>(
              `/api/tour-artifacts/${encodeURIComponent(id)}/${encodeURIComponent(view.content_refs[0]!)}`,
              { responseType: "blob", retry: 0 },
            );
            if (!current()) return;
            tours.attachBufferedRecording(view.segment_id!, blob);
          }
          if (
            !current() ||
            tours.currentTourRecord?.playback_segment_id !== view.segment_id
          )
            return;
          const canStart = !recovered && mayContinue();
          if (canStart) await options.play();
          else options.setState("RECORD_PAUSED");
        },
      });
      controller = instance;
      void instance.reconcile();
    },
    { immediate: true, flush: "sync" },
  );
  const status = computed(() => {
    revision.value;
    return controller?.status ?? "unavailable";
  });
  const suspend = async (reason: CancelReason) => {
    fallback.suspend();
    const active = controller;
    await active?.suspend(reason);
    // A lost activation must be reconciled before another action can acknowledge its checkpoint.
    if (active?.status === "uncertain" && active.hasPending) {
      await active.reconcile();
      if (active.status === "uncertain")
        throw new Error("Reload the prepared story before continuing");
    }
  };
  const tick = () => {
    fallback.observe();
    if (!bufferUnsupported && controller?.status !== "reconciling")
      void controller?.observe();
  };
  watch(
    [
      positionMode,
      () => geo.coordinates,
      () => options.getPosition(),
      () => geo.accuracy,
      () => geo.recordedAt,
      () => geo.error,
    ],
    tick,
    { flush: "sync" },
  );
  watch(
    () => options.state.value,
    (state) => {
      if (
        state === "RECORD_PAUSED" ||
        state === "TOUR_FINISHED" ||
        state === "ERROR"
      ) {
        fallback.suspend();
        void controller?.suspend(
          state === "TOUR_FINISHED" ? "completion" : "pause",
        );
      }
    },
    { flush: "sync" },
  );
  watch(
    () =>
      JSON.stringify([
        auth.userPreferences.value.llmType,
        auth.userPreferences.value.voiceType,
        auth.userPreferences.value.language,
      ]),
    () => {
      fallback.suspend();
      void controller?.suspend("visitor_cancel");
    },
    { flush: "sync" },
  );
  const onVisibility = () => {
    visible.value = !document.hidden;
    if (!visible.value) void controller?.suspend("visitor_cancel");
    if (!visible.value) fallback.suspend();
  };
  onMounted(() => {
    visible.value = !document.hidden;
    document.addEventListener("visibilitychange", onVisibility);
    timer = setInterval(tick, 500);
  });
  onBeforeUnmount(() => {
    fallback.suspend();
    void controller?.suspend("visitor_cancel");
    alive = false;
    if (timer) clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibility);
  });
  return {
    status,
    suspend,
    complete: () => controller?.complete() ?? Promise.resolve(false),
    reconcile: () => controller?.reconcile() ?? Promise.resolve(),
    afterCompletion: () => fallback.afterCompletion(),
  };
}
