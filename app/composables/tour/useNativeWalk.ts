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

/** Owns the only v3 speech scheduler; legacy playback is never mounted beside it. */
export function useNativeWalk(tourId: string) {
  const store = useNativeWalkStore();
  const gps = useGeolocationStore();
  const users = useUserStore();
  const owner = users.user?.uid;
  const { $apiFetch } = useNuxtApp();
  const api = $apiFetch as typeof $fetch;
  const canControl = shallowRef(false);
  const failed = shallowRef(false);
  const preparing = shallowRef(false);
  const audioUnavailable = shallowRef(false);
  const rendering = shallowRef(false);
  const playing = shallowRef(false);
  const loadedDelivery = shallowRef<string | null>(null);
  const locallyPaused = shallowRef(true);
  const lastText = shallowRef("");
  const lastUnverified = shallowRef(false);
  const generationChanged = shallowRef(false);
  let alive = true;
  let playbackEpoch = 0;
  let detach: (() => void) | undefined;
  let releaseLock: (() => void) | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let audio: HTMLAudioElement | null = null;
  let audioUrl: string | null = null;
  let blobs: Blob[] = [];
  let chunkIndex = 0;
  let acknowledgedStart = false;
  let lastGpsTimestamp = "";
  const current = () =>
    alive && users.user?.uid === owner && store.isScope(tourId);
  const view = computed(() => (current() ? store.view : null));
  const busy = computed(() => store.busy);
  const uncertain = computed(() => store.uncertain);
  const ready = computed(
    () => canControl.value && !!view.value && !busy.value && !uncertain.value,
  );

  function pauseLocal() {
    playbackEpoch++;
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
    view.value.control_revision === control;

  async function acknowledge(
    state: "started" | "completed" | "interrupted",
    deliveryId: string,
  ) {
    if (!current() || !canControl.value) return;
    await store.send("ACKNOWLEDGE", {
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
        void acknowledge("completed", delivery.id)
          .then(() => clearAudio(true))
          .catch(() => {
            failed.value = true;
          });
    };
    audio.onerror = () => {
      playing.value = false;
      audioUnavailable.value = true;
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
        !manifest?.complete ||
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
      if (current() && epoch === playbackEpoch) rendering.value = false;
    }
  }
  async function run(action: WalkAction, fields: Partial<WalkRequest> = {}) {
    if (!current() || !canControl.value) return null;
    try {
      failed.value = false;
      const response = await store.send(action, fields);
      if (!current()) return null;
      if (response.offered_delivery) {
        lastText.value = response.offered_delivery.text;
        lastUnverified.value =
          response.offered_delivery.evidence_status === "unverified";
        await playDelivery(response.offered_delivery);
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
      !ready.value ||
      locallyPaused.value ||
      response.paused ||
      response.finished ||
      response.active_delivery ||
      response.scheduling_mode !== "automatic"
    )
      return;
    await run("ACTIVATE", {
      operation_id: eligible.operation_id,
      eligible_action_id: eligible.id,
    });
  }
  async function observe() {
    if (
      !ready.value ||
      !view.value?.started ||
      view.value.finished ||
      !gps.coordinates ||
      !gps.recordedAt ||
      gps.accuracy === null ||
      gps.error ||
      gps.recordedAt === lastGpsTimestamp
    )
      return;
    const recordedAt = gps.recordedAt;
    const response = await run("LOCATION_UPDATE", {
      point: { lat: gps.coordinates[1], lng: gps.coordinates[0] },
      recorded_at: recordedAt,
      accuracy_meters: gps.accuracy,
    });
    if (!response) return;
    lastGpsTimestamp = recordedAt;
    await maybeActivate(response);
  }
  async function start() {
    locallyPaused.value = false;
    await run("START");
    await observe();
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
    locallyPaused.value = false;
    await run(action, fields);
  }
  async function interrupt() {
    const delivery = view.value?.active_delivery;
    clearAudio(true);
    if (delivery) await acknowledge("interrupted", delivery.id);
  }
  async function finish() {
    clearAudio();
    await run("FINISH");
  }
  async function readCompleted() {
    const delivery = view.value?.active_delivery;
    clearAudio(true);
    if (delivery) await acknowledge("completed", delivery.id);
  }
  async function playActive() {
    if (!ready.value || !view.value?.active_delivery || view.value.paused)
      return;
    locallyPaused.value = false;
    await playDelivery(view.value.active_delivery);
  }
  async function retry() {
    if (!current() || !canControl.value) return;
    const response = await store.retry();
    failed.value = false;
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
    try {
      detach = store.attach(tourId);
      // Control ownership and refresh exist even if research is not published
      // yet. A successful later read must be sufficient to make controls usable.
      if (navigator.locks) {
        void navigator.locks
          .request(
            `pg-native-walk:${owner}:${tourId}`,
            { ifAvailable: true },
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
        if (current() && !store.busy && !store.pending) void refresh();
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
  watch(
    () => gps.recordedAt,
    () => {
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
    clearAudio();
    if (timer) clearInterval(timer);
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
    playing,
    rendering,
    audioUnavailable,
    lastText,
    lastUnverified,
    generationChanged,
    locallyPaused,
    start,
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
      run("SET_MODE", { scheduling_mode: automatic ? "automatic" : "manual" }),
  };
}
