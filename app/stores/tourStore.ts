import { defineStore } from "pinia";
import type {
  ICoordinate,
  ICreatedTour,
  IGeoJSON,
  ITourRecord,
  ITourRecordRequest,
} from "~/types";
import { useGetTourRecord } from "~/composables/api/tours/useGetTourRecord";
import { useGetTour } from "~/composables/api/tours/useGetTour";
import { useNotification } from "~/composables/ui/useNotification";
import { useAuth } from "~/composables/auth/useAuth";
import { useFinishTour } from "~/composables/api/tours/useFinishTour";
import ensureSentenceEndsProperly from "~/utils/pages/ensureSentenceEndsProperly";
import { activatedStoryRecord } from "~/utils/activatedStoryRecord";
import type {
  StoryBufferView,
  StoryPoint,
  StoryBufferMetadata,
} from "#shared/types/storyBuffer";
import { tourNarrationOptions } from "#shared/utils/tourNarration";
import { useStoryBufferApi } from "~/composables/api/tours/useStoryBufferApi";
import { useUserStore } from "~/stores/userStore";

type Operation = { payload: string; id: string; params: ITourRecordRequest };
type Delivery = "STARTED" | "COMPLETED" | "INTERRUPTED";
type PlaybackCheckpoint = {
  segment: string;
  point: ICoordinate;
  delivery: Delivery | "GENERATED";
};

export const useTourStore = defineStore("tourStore", () => {
  let revision = 0;
  let pendingOperation: Operation | null = null;
  let pendingControl: Operation | null = null;
  let checkpoint: PlaybackCheckpoint | null = null;
  let acknowledgementQueue: Promise<unknown> = Promise.resolve();
  let controlQueue: Promise<unknown> = Promise.resolve();
  // State
  // useState keeps the tour in Nuxt's shared SSR/hydration payload so it
  // survives navigation without a re-fetch on the client.
  const _tour = useState<ICreatedTour | null>(`tour`, () => null);
  const _currentTourRecord = ref<ITourRecord | null>(null);
  const _textForDisplay = ref<string>("");
  const _textForSpeech = ref<string>("");
  const _userText = ref<string>("");
  const _playbackNotice = ref<ITourRecord | null>(null);
  const playbackNotice = computed(() => _playbackNotice.value);

  // Getters
  const tour = computed((): ICreatedTour | null => _tour.value);
  const textForDisplay = computed((): string => _textForDisplay.value);
  const textForSpeech = computed((): string => _textForSpeech.value);
  const currentTourRecord = computed(
    (): ITourRecord | null => _currentTourRecord.value,
  );
  const userText = computed((): string => _userText.value);
  const currentPlacesGeoJSON = computed((): IGeoJSON | null => {
    const features = _currentTourRecord.value?.places?.map((place) => ({
      type: "Feature",
      properties: {
        title: place.name ?? "Empty place name",
      },
      geometry: {
        type: "Point",
        coordinates: [Number(place.lng), Number(place.lat)] as [number, number],
      },
    }));

    if (!features || !features.length) {
      return null;
    }

    return {
      type: "FeatureCollection",
      features,
    };
  });

  const recoveryKey = () =>
    _tour.value ? `pg-playback-${_tour.value.user_id}-${_tour.value.id}` : null;
  const saveRecovery = () => {
    const key = recoveryKey();
    if (!key) return;
    try {
      localStorage.setItem(
        key,
        JSON.stringify({ checkpoint, pendingOperation, pendingControl }),
      );
    } catch {
      /* In-memory recovery remains available when storage is blocked. */
    }
  };
  const restoreRecovery = () => {
    const key = recoveryKey();
    if (!key) return;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      if (
        saved?.checkpoint?.segment &&
        saved.checkpoint.point &&
        ["GENERATED", "STARTED", "COMPLETED", "INTERRUPTED"].includes(
          saved.checkpoint.delivery,
        )
      )
        checkpoint = saved.checkpoint;
      if (saved?.pendingOperation?.id && saved.pendingOperation.params?.point)
        pendingOperation = saved.pendingOperation;
      if (saved?.pendingControl?.id && saved.pendingControl.params?.point)
        pendingControl = saved.pendingControl;
    } catch {
      /* Ignore invalid local data. */
    }
  };

  // Mutations
  const setTour = (
    tour: ICreatedTour,
    options: { restoreRecovery?: boolean } = {},
  ): void => {
    const changed = _tour.value?.id !== tour.id;
    if (changed) reset();
    _tour.value = tour;
    if (changed && options.restoreRecovery !== false) restoreRecovery();
  };

  const setCurrentTourRecord = (tourRecord: ITourRecord): void => {
    _currentTourRecord.value = tourRecord;
  };

  const setTextForDisplay = (text: string): void => {
    _textForDisplay.value = text;
  };

  const setTextForSpeech = (text: string): void => {
    _textForSpeech.value = text;
  };

  const appendToTextForDisplay = (part: string) => {
    if (!part.trim()) return;
    if (!_textForDisplay.value) {
      _textForDisplay.value = part;
    } else {
      _textForDisplay.value += " " + part;
    }
  };

  const setUserText = (text: string): void => {
    _userText.value = text;
  };

  const adoptBufferedStory = (view: StoryBufferView, point: StoryPoint) => {
    if (
      !_tour.value ||
      _tour.value.playback_generation_id !== view.generation_id
    )
      throw new Error("The tour generation changed");
    const record = activatedStoryRecord(view, point, _tour.value.route.points);
    if (
      _currentTourRecord.value?.playback_segment_id ===
        record.playback_segment_id &&
      checkpoint?.segment === record.playback_segment_id
    )
      return;
    _playbackNotice.value = null;
    checkpoint = {
      segment: record.playback_segment_id!,
      point,
      delivery: "GENERATED",
    };
    setCurrentTourRecord(record);
    setTextForSpeech(record.message);
    appendToTextForDisplay(record.message);
    saveRecovery();
  };
  const attachBufferedRecording = (segment: string, blob: Blob) => {
    if (_currentTourRecord.value?.playback_segment_id === segment)
      _currentTourRecord.value = {
        ..._currentTourRecord.value,
        audio_blob: blob,
      };
  };
  const recoverActivePlayback = async (
    state?: StoryBufferMetadata,
  ): Promise<boolean> => {
    const tour = _tour.value;
    const actor = useUserStore().user;
    const uid = actor?.uid;
    if (!tour?.playback_generation_id || tour.status === "FINISHED" || !uid)
      return false;
    const currentRevision = revision;
    const metadata = state ?? (await useStoryBufferApi(tour.id, uid).state());
    if (
      currentRevision !== revision ||
      useUserStore().user !== actor ||
      _tour.value?.id !== tour.id ||
      _tour.value?.status === "FINISHED" ||
      _tour.value?.playback_generation_id !== tour.playback_generation_id ||
      "status" in metadata ||
      metadata.generation_id !== tour.playback_generation_id
    )
      return false;
    const record = metadata.active_record;
    if (
      !record ||
      record.playback_segment_id !== metadata.active_segment_id ||
      !["GENERATED", "STARTED"].includes(metadata.active_delivery_state ?? "")
    )
      return false;
    if (
      checkpoint?.segment === metadata.active_segment_id &&
      ["COMPLETED", "INTERRUPTED"].includes(checkpoint.delivery)
    )
      return false;
    if (
      !_playbackNotice.value?.playback_block &&
      !_playbackNotice.value?.message.trim()
    ) {
      _playbackNotice.value = {
        ...record,
        point: { name: null, ...record.point },
        message: "",
        audio_data: null,
        playback_block: {
          reason: metadata.paused ? "paused" : "active_segment_unacknowledged",
          active_segment_id: metadata.active_segment_id ?? null,
          active_delivery_state: metadata.active_delivery_state ?? null,
        },
      };
    }
    if (
      _currentTourRecord.value?.playback_segment_id ===
        metadata.active_segment_id &&
      (_currentTourRecord.value.audio_data ||
        _currentTourRecord.value.audio_blob)
    )
      return true;
    checkpoint = {
      segment: metadata.active_segment_id!,
      point: record.point,
      delivery: metadata.active_delivery_state as Delivery | "GENERATED",
    };
    const previousSegment = _currentTourRecord.value?.playback_segment_id;
    setCurrentTourRecord({
      ...record,
      point: { name: null, ...record.point },
      audio_data: metadata.active_audio_data ?? record.audio_data ?? null,
    });
    setTextForSpeech(record.message);
    if (previousSegment !== record.playback_segment_id)
      appendToTextForDisplay(record.message);
    saveRecovery();
    return true;
  };

  // Actions
  const fetchGetTour = async (tourId: string): Promise<void> => {
    if (_tour.value?.id !== tourId) reset();

    const currentRevision = revision;
    try {
      const tour = await useGetTour(tourId);
      if (revision !== currentRevision) return;

      if (!tour) return;

      setTour(tour);
    } catch (error) {
      if (revision !== currentRevision) return;
      console.error("Error fetching tour:", error);

      const { showApiError } = useNotification();
      showApiError(error, "Failed to fetch tour data");
      throw error;
    }
  };

  const requestRecord = async (params: ITourRecordRequest, control = false) => {
    const id = _tour.value?.id;
    if (!id) throw new Error("No tour selected");
    const currentRevision = revision;
    const payload = JSON.stringify({ id, params });
    let operation = control ? pendingControl : pendingOperation;
    // An uncertain narration result must be recovered with its original input,
    // even if GPS has moved in the meantime.
    if (!operation || (control && operation.payload !== payload))
      operation = { payload, params, id: crypto.randomUUID() };
    if (control) pendingControl = operation;
    else pendingOperation = operation;
    saveRecovery();
    let record: ITourRecord;
    try {
      record = await useGetTourRecord(id, operation.params, operation.id);
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (
        currentRevision === revision &&
        status &&
        [400, 401, 403, 404, 422].includes(status)
      ) {
        if (control) pendingControl = null;
        else pendingOperation = null;
        saveRecovery();
      }
      throw error;
    }
    if (currentRevision !== revision) return null;
    if (!record) throw new Error("No tour record returned");
    if (control) {
      pendingControl = null;
      if (
        checkpoint &&
        checkpoint.segment === operation.params.acknowledged_segment_id &&
        operation.params.acknowledged_delivery_state
      ) {
        checkpoint.delivery = operation.params.acknowledged_delivery_state;
        if (
          ["COMPLETED", "INTERRUPTED"].includes(checkpoint.delivery) &&
          _playbackNotice.value?.playback_block?.active_segment_id ===
            checkpoint.segment
        )
          _playbackNotice.value = null;
      }
    } else {
      pendingOperation = null;
      if (
        record.playback_segment_id &&
        !record.playback_action_types?.includes("INTENTIONAL_SILENCE")
      ) {
        checkpoint = {
          segment: record.playback_segment_id,
          point: record.point,
          delivery: "GENERATED",
        };
      }
    }
    saveRecovery();
    if (record.route_points && _tour.value)
      _tour.value.route.points = record.route_points;
    return record;
  };

  const fetchTourStep = async (
    point: ICoordinate,
    options: Partial<ITourRecordRequest> = {},
  ) => {
    const { userPreferences } = useAuth();
    const message = pendingOperation?.params.user_text ?? userText.value;
    // Fresh narration cannot select a shorter policy. requestRecord still replays
    // an uncertain operation's exact stored body/key, including legacy options.
    const requestOptions = { ...options };
    delete requestOptions.narration_style;
    if (requestOptions.duration !== 0) delete requestOptions.duration;
    // A question starts its own answer; resume alone cannot consume retained text.
    // requestRecord still preserves an uncertain operation's original intent.
    if (message.trim() || requestOptions.continue_story !== true)
      delete requestOptions.continue_story;
    const record = await requestRecord({
      ...tourNarrationOptions(
        {
          point,
          stops: _tour.value?.route.points ?? [],
          accuracy: options.location_accuracy_meters,
          recordedAt: options.location_recorded_at,
          pace: options.pace,
          visitorText: message,
        },
        Date.now(),
      ),
      point,
      user_text: message,
      type_llm: userPreferences.value.llmType,
      type_voice: userPreferences.value.voiceType,
      ...requestOptions,
    });
    if (!record) return null;
    _playbackNotice.value = record;
    const text = ensureSentenceEndsProperly(record.message);
    // A quiet /next is not a new playback owner or a receipt for the old one.
    if (
      record.message.trim() ||
      !checkpoint ||
      ["COMPLETED", "INTERRUPTED"].includes(checkpoint.delivery)
    ) {
      appendToTextForDisplay(text);
      setTextForSpeech(text);
      setCurrentTourRecord(record);
    }
    if (_userText.value === message) setUserText("");
    return record;
  };

  // Serialize acknowledgements and controls; these silence-only requests must not
  // replace the audio record the visitor is still listening to.
  const sendPlaybackControl = (options: Partial<ITourRecordRequest>) => {
    const point = _currentTourRecord.value?.point ?? checkpoint?.point;
    if (!point) return Promise.resolve(null);
    const currentRevision = revision;
    const task = controlQueue
      .catch(() => {})
      .then(async () => {
        if (currentRevision !== revision) return null;
        if (pendingControl) {
          const previousParams = pendingControl.params;
          const previousResult = await requestRecord(previousParams, true);
          if (currentRevision !== revision) return null;
          if (
            options.acknowledged_segment_id &&
            ["COMPLETED", "INTERRUPTED"].includes(checkpoint?.delivery ?? "")
          )
            return previousResult;
        }
        return requestRecord(
          {
            duration: 0,
            point,
            user_text: "",
            type_llm: useAuth().userPreferences.value.llmType,
            type_voice: "DEFAULT",
            ...options,
          },
          true,
        );
      });
    controlQueue = task;
    return task;
  };

  const acknowledgePlayback = (delivery: Delivery) => {
    const currentRevision = revision;
    const task = acknowledgementQueue
      .catch(() => {})
      .then(async () => {
        if (
          currentRevision !== revision ||
          !checkpoint ||
          ["COMPLETED", "INTERRUPTED"].includes(checkpoint.delivery)
        )
          return;
        const segment = checkpoint.segment;
        await sendPlaybackControl({
          acknowledged_segment_id: segment,
          acknowledged_delivery_state: delivery,
        });
      });
    acknowledgementQueue = task;
    return task;
  };

  const finishTour = async () => {
    const id = _tour.value?.id;
    if (!id) throw new Error("No tour selected");
    const currentRevision = revision;
    await controlQueue;
    if (currentRevision !== revision) return;
    const finished = await useFinishTour(id);
    if (currentRevision === revision) {
      _tour.value = finished;
      const key = recoveryKey();
      if (key) {
        try {
          localStorage.removeItem(key);
        } catch {}
      }
    }
  };

  const reset = () => {
    revision++;
    checkpoint = null;
    acknowledgementQueue = Promise.resolve();
    pendingOperation = null;
    pendingControl = null;
    controlQueue = Promise.resolve();
    _tour.value = null;
    _currentTourRecord.value = null;
    _textForDisplay.value = "";
    _textForSpeech.value = "";
    _userText.value = "";
    _playbackNotice.value = null;
  };

  return {
    playbackNotice,
    recoverActivePlayback,
    adoptBufferedStory,
    attachBufferedRecording,
    recoverPendingNarration: async () => {
      return pendingOperation
        ? await fetchTourStep(
            pendingOperation.params.point,
            pendingOperation.params,
          )
        : null;
    },
    getPlaybackCheckpoint: () => (checkpoint ? { ...checkpoint } : null),
    reset,
    sendPlaybackControl,
    acknowledgePlayback,
    finishTour,
    tour,
    currentTourRecord,
    textForDisplay,
    textForSpeech,
    appendToTextForDisplay,
    setTextForSpeech,
    currentPlacesGeoJSON,
    setTextForDisplay,
    fetchGetTour,
    fetchTourStep,
    setTour,
    setUserText,
  };
});
