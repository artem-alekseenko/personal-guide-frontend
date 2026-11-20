import { computed, onBeforeUnmount, onMounted, shallowRef, watch } from "vue";
import { useNativeWalkStore } from "~/stores/nativeWalkStore";
import { useGeolocationStore } from "~/stores/geolocationStore";
import { useUserStore } from "~/stores/userStore";
import type {
  WalkAction,
  WalkRequest,
  WalkView,
  WalkDelivery,
  WalkAudioManifest,
} from "#shared/types/nativeWalk";

import type { NativeWalkPositionSource } from "./useNativeWalkPosition";

/** Owns the only v3 speech scheduler; legacy playback is never mounted beside it. */
export function useNativeWalk(
  tourId: string,
  position?: NativeWalkPositionSource,
) {
  const store = useNativeWalkStore();
  const gps: NativeWalkPositionSource = position ?? useGeolocationStore();
  const locationKey = () =>
    `${gps.mode ?? "gps"}:${gps.recordedAt}:${gps.coordinates?.join(",")}`;
  const users = useUserStore();
  const owner = users.user?.uid;
  const { $apiFetch } = useNuxtApp();
  const api = $apiFetch as typeof $fetch;
  const canControl = shallowRef(false);
  const failed = shallowRef(false);
  const preparing = shallowRef(false);
  const stepStatus = shallowRef<
    | "locating"
    | "location_required"
    | "location_inaccurate"
    | "location_stale"
    | "location_unconfirmed"
    | "off_route"
    | "no_story"
    | "no_local_research"
    | "no_answer"
    | null
  >(null);
  function usableLocation() {
    const progress = view.value?.progress;
    const age = progress ? Date.now() - Date.parse(progress.recorded_at) : NaN;
    return (
      !!gps.coordinates &&
      (view.value?.position_mode ?? "gps") === (gps.mode ?? "gps") &&
      !!progress?.reliable &&
      !progress.ambiguous &&
      !gps.error &&
      age >= 0 &&
      age <= 60000
    );
  }
  function explainLocation() {
    if (!gps.coordinates || gps.error) return "location_required" as const;
    const reason = view.value?.progress?.reason;
    if (reason === "off_route") return "off_route" as const;
    if (reason === "inaccurate_observation")
      return "location_inaccurate" as const;
    if (!view.value?.progress) return "location_required" as const;
    if (
      reason === "stale_observation" ||
      Date.now() - Date.parse(view.value.progress.recorded_at) > 60000
    )
      return "location_stale" as const;
    return "location_unconfirmed" as const;
  }
  const audioUnavailable = shallowRef(false);
  const rendering = shallowRef(false);
  const playing = shallowRef(false);
  const loadedDelivery = shallowRef<string | null>(null);
  const locallyPaused = shallowRef(true);
  const lastText = shallowRef("");
  const lastUnverified = shallowRef(false);
  const generationChanged = shallowRef(false);
  const advancing = shallowRef(false);
  let flow: Promise<unknown> = Promise.resolve();
  let queued = 0;
  const foregroundPending = shallowRef(0);
  let observationQueued = false;
  let readingTimer: ReturnType<typeof setTimeout> | undefined;
  let alive = true;
  let playbackEpoch = 0;
  let mediaControl: { deliveryId: string; from: number; to: number } | null =
    null;
  let detach: (() => void) | undefined;
  let releaseLock: (() => void) | undefined;
  const lockRequest = new AbortController();
  let timer: ReturnType<typeof setInterval> | undefined;
  let audio: HTMLAudioElement | null = null;
  let audioUrl: string | null = null;
  let blobs: Blob[] = [];
  let chunkIndex = 0;
  let acknowledgedStart = false;
  let lastGpsTimestamp = "";
  let lastGpsAttempt = "";
  const current = () =>
    alive && users.user?.uid === owner && store.isScope(tourId);
  const view = computed(() => (current() ? store.view : null));
  const busy = computed(() => store.busy || advancing.value);
  const uncertain = computed(() => store.uncertain);
  const ready = computed(
    () =>
      canControl.value &&
      !!view.value &&
      foregroundPending.value === 0 &&
      !uncertain.value,
  );

  function serialize(work: () => Promise<void>, background = false) {
    if (!background) foregroundPending.value++;
    queued++;
    advancing.value = true;
    const task = flow.then(async () => {
      if (current() && canControl.value && !store.uncertain) await work();
    });
    flow = task.catch(() => {});
    return task.finally(() => {
      queued--;
      if (!background) foregroundPending.value--;
      advancing.value = queued > 0;
    });
  }
  function clearReading() {
    clearTimeout(readingTimer);
    readingTimer = undefined;
  }
  function scheduleReading(delivery: WalkDelivery) {
    clearReading();
    if (
      !current() ||
      locallyPaused.value ||
      view.value?.paused ||
      view.value?.finished ||
      !canControl.value ||
      view.value?.active_delivery?.id !== delivery.id ||
      (typeof document !== "undefined" && document.visibilityState === "hidden")
    )
      return;
    // Full text remains visible. A conservative reading interval replaces media
    // completion only when audio is unavailable; hidden time is never consumed.
    const words = delivery.text.trim().split(/\s+/u).filter(Boolean).length;
    const delay = Math.max(8000, Math.ceil((words / 180) * 60_000));
    readingTimer = setTimeout(() => {
      readingTimer = undefined;
      void completeDelivery(delivery.id).catch(() => {
        failed.value = true;
      });
    }, delay);
  }
  async function completeDelivery(
    deliveryId: string,
    continueAutomatically = true,
  ) {
    await serialize(async () => {
      if (
        view.value?.active_delivery?.id !== deliveryId ||
        locallyPaused.value ||
        view.value.paused
      )
        return;
      clearAudio(true);
      if (gps.mode === "simulation") await gps.refresh();
      await observeNow(false);
      const response = await acknowledge("completed", deliveryId);
      if (response && continueAutomatically) await maybeActivate(response);
    }, true);
  }
  const visibilityChanged = () => {
    if (document.visibilityState === "hidden") clearReading();
    else if (
      audioUnavailable.value &&
      view.value?.active_delivery &&
      !playing.value &&
      !rendering.value
    )
      scheduleReading(view.value.active_delivery);
  };
  function pauseLocal() {
    clearReading();
    playbackEpoch++;
    mediaControl = null;
    locallyPaused.value = true;
    rendering.value = false;
    audio?.pause();
    playing.value = false;
  }
  function clearAudio(keepWalking = false) {
    const previousPause = locallyPaused.value;
    pauseLocal();
    if (keepWalking) locallyPaused.value = previousPause;
    if (audio) {
      audio.onended =
        audio.onplaying =
        audio.onerror =
        audio.onloadedmetadata =
          null;
      audio.removeAttribute("src");
      audio.load();
    }
    audio = null;
    blobs = [];
    loadedDelivery.value = null;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = null;
  }
  const activeMatches = (delivery: WalkDelivery, control: number) =>
    current() &&
    canControl.value &&
    !locallyPaused.value &&
    !view.value?.paused &&
    !view.value?.finished &&
    view.value?.active_delivery?.id === delivery.id &&
    view.value.control_revision ===
      (mediaControl?.deliveryId === delivery.id && mediaControl.from === control
        ? mediaControl.to
        : control);

  async function acknowledge(
    state: "started" | "completed" | "interrupted",
    deliveryId: string,
  ) {
    if (!current() || !canControl.value) return;
    return await store.send("ACKNOWLEDGE", {
      delivery_id: deliveryId,
      delivery_state: state,
    });
  }
  async function playChunk(
    delivery: WalkDelivery,
    control: number,
    epoch: number,
  ) {
    if (
      !activeMatches(delivery, control) ||
      epoch !== playbackEpoch ||
      !blobs[chunkIndex]
    )
      return;
    if (!audio) audio = new Audio();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(blobs[chunkIndex]!);
    audio.src = audioUrl;
    audio.onplaying = () => {
      if (!activeMatches(delivery, control) || epoch !== playbackEpoch) {
        audio?.pause();
        return;
      }
      clearReading();
      playing.value = true;
      if (!acknowledgedStart) {
        acknowledgedStart = true;
        void acknowledge("started", delivery.id).catch(() => {
          failed.value = true;
          pauseLocal();
        });
      }
    };
    audio.onended = () => {
      if (!activeMatches(delivery, control) || epoch !== playbackEpoch) return;
      playing.value = false;
      chunkIndex++;
      if (chunkIndex < blobs.length) void playChunk(delivery, control, epoch);
      else
        void completeDelivery(delivery.id).catch(() => {
          failed.value = true;
        });
    };
    audio.onerror = () => {
      playing.value = false;
      audioUnavailable.value = true;
      scheduleReading(delivery);
    };
    try {
      await audio.play();
    } catch {
      playing.value = false;
      audioUnavailable.value = true;
    }
  }
  async function playDelivery(delivery: WalkDelivery) {
    const control = view.value?.control_revision;
    if (control === undefined || !activeMatches(delivery, control)) return;
    const epoch = ++playbackEpoch;
    rendering.value = true;
    audioUnavailable.value = false;
    try {
      const snapshot = view.value!;
      const manifest = await api<WalkAudioManifest | null>(
        `/api/native-walk/${encodeURIComponent(tourId)}/audio`,
        {
          method: "POST",
          retry: 0,
          body: {
            delivery_id: delivery.id,
            expected_generation_id: snapshot.generation_id,
            expected_route_revision: snapshot.route_revision,
            language: snapshot.language,
          },
        },
      );
      if (!activeMatches(delivery, control) || epoch !== playbackEpoch) return;
      if (!manifest?.complete) {
        audioUnavailable.value = true;
        return;
      }
      const textHash = Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(delivery.text),
          ),
        ),
      )
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      if (
        manifest.canonical_text_hash !== textHash ||
        manifest.chunks.some(
          (chunk, index) =>
            chunk.failure ||
            !chunk.audio_artifact_id ||
            chunk.ordered_index !== index ||
            chunk.language !== snapshot.language,
        )
      ) {
        audioUnavailable.value = true;
        return;
      }
      const recordings: Blob[] = [];
      for (const chunk of manifest.chunks)
        recordings.push(
          await api<Blob>(
            `/api/tour-artifacts/${encodeURIComponent(tourId)}/${encodeURIComponent(chunk.audio_artifact_id!)}`,
            { responseType: "blob", retry: 0 },
          ),
        );
      if (!activeMatches(delivery, control) || epoch !== playbackEpoch) return;
      blobs = recordings;
      chunkIndex = 0;
      acknowledgedStart = delivery.state === "started";
      loadedDelivery.value = delivery.id;
      await playChunk(delivery, control, epoch);
    } catch {
      if (current() && epoch === playbackEpoch) audioUnavailable.value = true;
    } finally {
      if (current() && epoch === playbackEpoch) {
        rendering.value = false;
        if (audioUnavailable.value && !playing.value) scheduleReading(delivery);
      }
    }
  }
  async function run(action: WalkAction, fields: Partial<WalkRequest> = {}) {
    if (!current() || !canControl.value) return null;
    try {
      failed.value = false;
      const response = await store.send(action, fields);
      if (!current()) return null;
      if (response.offered_delivery) {
        stepStatus.value = null;
        lastText.value = response.offered_delivery.text;
        lastUnverified.value =
          response.offered_delivery.evidence_status === "unverified";
        // Media rendering must not hold the stepping queue or block Finish.
        void playDelivery(response.offered_delivery);
      }
      return response;
    } catch (error) {
      recordReadFailure(error);
      throw error;
    }
  }
  async function maybeActivate(response: WalkView) {
    const eligible = response.eligible_action;
    if (
      !eligible ||
      !current() ||
      !canControl.value ||
      store.uncertain ||
      locallyPaused.value ||
      response.paused ||
      response.finished ||
      response.active_delivery ||
      response.scheduling_mode !== "automatic" ||
      locationKey() !== lastGpsTimestamp
    )
      return;
    await run("ACTIVATE", {
      operation_id: eligible.operation_id,
      eligible_action_id: eligible.id,
    });
  }
  async function observeNow(activate = true) {
    if (
      !current() ||
      !canControl.value ||
      store.uncertain ||
      !view.value?.started ||
      view.value.finished ||
      !gps.coordinates ||
      !gps.recordedAt ||
      gps.accuracy === null ||
      gps.error ||
      locationKey() === lastGpsTimestamp
    )
      return;
    const recordedAt = gps.recordedAt;
    const key = locationKey();
    lastGpsAttempt = key;
    const response = await run("LOCATION_UPDATE", {
      point: { lat: gps.coordinates[1], lng: gps.coordinates[0] },
      recorded_at: recordedAt,
      accuracy_meters: gps.accuracy,
      position_mode: gps.mode ?? "gps",
    });
    if (!response) return;
    lastGpsTimestamp = key;
    if (response.progress?.reliable) stepStatus.value = null;
    if (activate) await maybeActivate(response);
  }
  async function observe() {
    if (
      observationQueued ||
      !current() ||
      !view.value?.started ||
      !gps.recordedAt ||
      !gps.coordinates ||
      gps.accuracy === null ||
      !!gps.error ||
      locationKey() === lastGpsAttempt
    )
      return;
    observationQueued = true;
    try {
      await serialize(() => observeNow(), true);
    } finally {
      observationQueued = false;
    }
  }
  async function nextPassage() {
    stepStatus.value = null;
    locallyPaused.value = false;
    if (view.value?.paused) await run("RESUME");
    const active = view.value?.active_delivery;
    clearAudio(true);
    if (gps.mode === "simulation") await gps.refresh();
    await observeNow(false);
    if (!view.value?.finished && !usableLocation()) {
      stepStatus.value = "locating";
      await gps.refresh();
      if (!current() || !canControl.value) return;
      await observeNow(false);
    }
    if (active && view.value?.active_delivery?.id === active.id)
      await acknowledge("completed", active.id);
    if (view.value?.finished) {
      stepStatus.value = null;
      return;
    }
    // A fresh precise position is required; never substitute the route origin.
    if (!usableLocation()) {
      stepStatus.value = explainLocation();
      return;
    }
    const response = await run("CONTINUE");
    if (
      response &&
      !response.offered_delivery &&
      !response.active_delivery &&
      !response.finished
    )
      stepStatus.value =
        response.silence_reason === "no_local_evidence"
          ? "no_local_research"
          : "no_story";
  }
  async function start() {
    await serialize(async () => {
      locallyPaused.value = false;
      await run("START");
      await nextPassage();
    });
  }
  async function reopen() {
    await serialize(async () => {
      if (!view.value?.finished) return;
      clearAudio();
      const response = await run("REOPEN");
      if (!response || response.finished) return;
      // The saved position is retained; request fresh context before speaking.
      lastGpsTimestamp = "";
      lastGpsAttempt = "";
      await nextPassage();
    });
  }
  async function nextStep() {
    const displayed = view.value?.active_delivery?.id;
    await serialize(async () => {
      // A simultaneous automatic completion may already have advanced the screen.
      if (view.value?.active_delivery?.id !== displayed) return;
      await nextPassage();
    });
  }
  async function pause() {
    pauseLocal();
    await run("PAUSE");
  }
  async function resume() {
    locallyPaused.value = false;
    await run("RESUME");
    const active = view.value?.active_delivery;
    if (active) {
      if (loadedDelivery.value === active.id && audio?.src) {
        // Old callbacks capture a superseded control revision. Rebind the same
        // chunk under the resumed controls, then retain its actual audio offset.
        const offset = audio.currentTime;
        await playChunk(active, view.value!.control_revision, playbackEpoch);
        if (audio) {
          const element = audio;
          if (element.readyState >= 1) element.currentTime = offset;
          else
            element.onloadedmetadata = () => {
              element.currentTime = offset;
              element.onloadedmetadata = null;
            };
        }
      } else await playDelivery(active);
    }
  }
  async function explicit(
    action: "CONTINUE" | "MORE" | "ASK",
    fields: Partial<WalkRequest> = {},
  ) {
    await serialize(async () => {
      stepStatus.value = null;
      locallyPaused.value = false;
      if (action === "ASK") {
        if (gps.mode === "simulation") await gps.refresh();
        await observeNow(false);
      }
      const response = await run(action, fields);
      if (
        action === "ASK" &&
        response &&
        !response.offered_delivery &&
        !response.active_delivery &&
        !response.finished
      )
        stepStatus.value = "no_answer";
    });
  }
  async function interrupt() {
    const delivery = view.value?.active_delivery;
    clearAudio(true);
    if (delivery) await acknowledge("interrupted", delivery.id);
  }
  async function finish() {
    clearAudio();
    await serialize(async () => {
      await run("FINISH");
    });
  }
  async function readCompleted() {
    const delivery = view.value?.active_delivery;
    if (delivery) await completeDelivery(delivery.id);
  }
  async function playActive() {
    if (!ready.value || !view.value?.active_delivery || view.value.paused)
      return;
    locallyPaused.value = false;
    await playDelivery(view.value.active_delivery);
  }
  async function retry() {
    if (!current() || !canControl.value) return;
    foregroundPending.value++;
    try {
      const pendingAction = store.pending?.action;
      const response = await store.retry();
      failed.value = false;
      if (pendingAction === "REOPEN" && !view.value?.finished) {
        await serialize(async () => {
          lastGpsTimestamp = "";
          lastGpsAttempt = "";
          await nextPassage();
        });
        return;
      }
      // A locally requested pause survives recovery of an uncertain activation.
      if (locallyPaused.value) {
        await run("PAUSE");
        return;
      }
      if (response.offered_delivery) {
        lastText.value = response.offered_delivery.text;
        lastUnverified.value =
          response.offered_delivery.evidence_status === "unverified";
        await playDelivery(response.offered_delivery);
      } else await maybeActivate(response);
    } finally {
      foregroundPending.value--;
    }
  }

  function recordReadFailure(error: unknown) {
    const failure = error as {
      statusCode?: number;
      status?: number;
      data?: { detail?: string; data?: { detail?: string } };
      message?: string;
    };
    const detail =
      failure.data?.data?.detail ??
      failure.data?.detail ??
      failure.message ??
      "";
    // Only this explicit preparation state is retryable readiness. Other 409s,
    // unavailable packages and infrastructure errors remain real failures.
    preparing.value =
      !view.value &&
      (failure.statusCode ?? failure.status) === 409 &&
      detail.includes("Walking research is not yet published");
    failed.value = !preparing.value;
    if (detail.includes("generation changed")) {
      generationChanged.value = true;
      clearAudio();
    }
  }
  async function refresh(reconcile = false) {
    try {
      await store.load(reconcile);
      if (!current()) return false;
      preparing.value = false;
      failed.value = false;
      return true;
    } catch (error) {
      if (current()) recordReadFailure(error);
      return false;
    }
  }
  async function reconcile() {
    clearAudio();
    if (!(await refresh(true))) return;
    if (
      canControl.value &&
      view.value?.started &&
      !view.value.paused &&
      !view.value.finished
    )
      await run("PAUSE");
  }
  onMounted(async () => {
    if (typeof document !== "undefined")
      document.addEventListener("visibilitychange", visibilityChanged);
    try {
      detach = store.attach(tourId);
      // Control ownership and refresh exist even if research is not published
      // yet. A successful later read must be sufficient to make controls usable.
      if (navigator.locks) {
        void navigator.locks
          .request(
            `pg-native-walk:${owner}:${tourId}`,
            { signal: lockRequest.signal },
            async (lock) => {
              if (!lock || !current()) return;
              canControl.value = true;
              await new Promise<void>((resolve) => {
                releaseLock = resolve;
              });
              canControl.value = false;
            },
          )
          .catch(() => {
            canControl.value = false;
          });
      }
      timer = setInterval(() => {
        if (current() && !busy.value && !store.pending) void refresh();
      }, 10000);
      if (await refresh()) {
        lastText.value = view.value?.active_delivery?.text ?? "";
        lastUnverified.value =
          view.value?.active_delivery?.evidence_status === "unverified";
      }
    } catch {
      failed.value = true;
    }
  });
  watch(locationKey, () => {
    void observe().catch(() => {
      failed.value = true;
    });
  });
  watch(
    () => [store.busy, advancing.value, locationKey()] as const,
    () => {
      if (!store.busy && !advancing.value && locationKey() !== lastGpsTimestamp)
        void observe().catch(() => {
          failed.value = true;
        });
    },
  );
  watch(
    () => users.user?.uid,
    () => {
      if (users.user?.uid !== owner) {
        clearAudio();
        lockRequest.abort();
        releaseLock?.();
        detach?.();
      }
    },
  );
  watch(
    () => [view.value?.paused, view.value?.finished],
    ([paused, finished]) => {
      if (paused || finished) pauseLocal();
    },
  );
  onBeforeUnmount(() => {
    alive = false;
    if (typeof document !== "undefined")
      document.removeEventListener("visibilitychange", visibilityChanged);
    clearAudio();
    if (timer) clearInterval(timer);
    lockRequest.abort();
    releaseLock?.();
    detach?.();
  });
  return {
    view,
    busy,
    ready,
    uncertain,
    canControl,
    failed,
    preparing,
    stepStatus,
    playing,
    rendering,
    audioUnavailable,
    lastText,
    lastUnverified,
    generationChanged,
    locallyPaused,
    start,
    reopen,
    nextStep,
    pause,
    resume,
    explicit,
    interrupt,
    finish,
    readCompleted,
    playActive,
    retry,
    reconcile,
    setMode: (automatic: boolean) =>
      serialize(async () => {
        const before = view.value;
        const response = await run("SET_MODE", {
          scheduling_mode: automatic ? "automatic" : "manual",
        });
        // A confirmed scheduling-only change keeps the current narration valid.
        // Pause, finish, owner changes and other revisions still invalidate it.
        if (
          response &&
          before?.active_delivery &&
          response.active_delivery?.id === before.active_delivery.id
        ) {
          mediaControl = {
            deliveryId: before.active_delivery.id,
            from:
              mediaControl?.deliveryId === before.active_delivery.id &&
              mediaControl.to === before.control_revision
                ? mediaControl.from
                : before.control_revision,
            to: response.control_revision,
          };
        }
        if (response && automatic) await maybeActivate(response);
      }),
  };
}
