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
  storyPosition,
  type StoryBufferOperation,
  type StoryObservation,
} from "#shared/utils/storyBuffer";
import type { CancelReason } from "#shared/types/storyBuffer";
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
  let scope = "";
  let timer: ReturnType<typeof setInterval> | undefined;
  let bufferUnsupported = false;
  const read = (): StoryObservation => {
    const record = tours.currentTourRecord,
      tour = tours.tour;
    let stopId =
      record?.discussion_focus?.object_id ?? record?.guidance?.stop_id ?? null;
    // Grounded narration can omit legacy guidance. Resolve only against real route coordinates.
    if (!stopId && geo.coordinates) {
      const candidates =
        tour?.route.points.filter((p) => {
          const probe: StoryObservation = {
            generationId: "probe",
            segmentId: "probe",
            stopId: "probe",
            started: true,
            enabled: true,
            playing: true,
            visible: true,
            finished: false,
            waiting: false,
            point: {
              lat: String(geo.coordinates![1]),
              lng: String(geo.coordinates![0]),
            },
            stopPoint: p,
            accuracy: geo.accuracy,
            recordedAt: geo.recordedAt,
            remainingSeconds: 0,
          };
          return !!storyPosition(probe, Date.now());
        }) ?? [];
      if (candidates.length === 1) {
        const index = tour!.route.points.indexOf(candidates[0]!);
        stopId =
          candidates[0]!.id ||
          (tour!.playback_generation_id
            ? `stop_${index}`
            : `route_point_${index}`);
      }
    }
    const stop = resolveContinuationStop(tour?.route.points ?? [], stopId);
    const checkpoint = tours.getPlaybackCheckpoint();
    return {
      generationId: tour?.playback_generation_id ?? null,
      segmentId: record?.playback_segment_id ?? null,
      stopId,
      started:
        checkpoint?.segment === record?.playback_segment_id &&
        checkpoint?.delivery === "STARTED",
      enabled:
        options.featureEnabled && positionMode.value === "gps" && !geo.error,
      visible: visible.value,
      playing: options.state.value === "RECORD_ACTIVE",
      finished:
        tour?.status === "FINISHED" || options.state.value === "TOUR_FINISHED",
      waiting:
        !!record?.playback_wait_kind ||
        !!record?.guidance?.requires_resume ||
        options.state.value === "RECORD_PAUSED",
      point: geo.coordinates
        ? { lat: String(geo.coordinates[1]), lng: String(geo.coordinates[0]) }
        : null,
      stopPoint: stop ?? null,
      accuracy: geo.accuracy,
      recordedAt: geo.recordedAt,
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
      const detectSupport = async <T>(
        request: () => Promise<T>,
      ): Promise<T> => {
        try {
          return await request();
        } catch (error) {
          const status =
            (error as { statusCode?: number; status?: number }).statusCode ??
            (error as { status?: number }).status;
          if (scope === capturedScope && [404, 405].includes(status ?? 0))
            bufferUnsupported = true;
          throw error;
        }
      };
      const instance = createStoryBufferController({
        read,
        transport: {
          ...transport,
          state: () => detectSupport(transport.state),
          prepare: (body, key) =>
            detectSupport(() => transport.prepare(body, key)),
        },
        recovery,
        current: () =>
          alive && scope === capturedScope && users.user?.uid === uid,
        canRequest: () => users.user?.uid === uid,
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
        activated: async (view, point, recovered, mayContinue) => {
          if (!alive || capturedScope !== scope || users.user?.uid !== uid)
            return;
          // Backend atomically completed the anchor. Replace its checkpoint before any media request.
          tours.adoptBufferedStory(view, point);
          options.setState(recovered ? "RECORD_PAUSED" : "RECORD_RECEIVED");
          const api = useNuxtApp().$apiFetch as typeof $fetch;
          const blob = await api<Blob>(
            `/api/tour-artifacts/${encodeURIComponent(id)}/${encodeURIComponent(view.content_refs[0]!)}`,
            { responseType: "blob", retry: 0 },
          );
          if (
            !alive ||
            scope !== capturedScope ||
            users.user?.uid !== uid ||
            tours.currentTourRecord?.playback_segment_id !== view.segment_id
          )
            return;
          tours.attachBufferedRecording(view.segment_id!, blob);
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
