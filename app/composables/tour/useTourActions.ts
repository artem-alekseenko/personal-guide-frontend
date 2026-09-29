import { ref, type Ref } from "vue";
import { useRouter } from "vue-router";
import { useTourStore } from "~/stores/tourStore";
import { usePositionMode } from "~/composables/map/usePositionMode";
import { useGeolocationStore } from "~/stores/geolocationStore";
import { useNotification } from "~/composables/ui/useNotification";
import type { ITourRecordRequest } from "~/types";
import type { TourState } from "./useTourState";
import type { useTourAudioPlayer } from "./useTourAudioPlayer";
import type { useTourCoordinates } from "./useTourCoordinates";
import type { useSimulationMarker } from "~/composables/map/useSimulationMarker";

const STATE = {
  INITIAL: "INITIAL",
  RECORD_LOADING: "LOADING_RECORD",
  RECORD_LOADING_WHEN_PAUSED: "LOADING_RECORD_WHEN_PAUSED",
  RECORD_RECEIVED: "RECORD_RECEIVED",
  RECORD_ACTIVE: "RECORD_ACTIVE",
  RECORD_PAUSED: "RECORD_PAUSED",
  RECORD_FINISHED: "RECORD_FINISHED",
  TOUR_FINISHED: "TOUR_FINISHED",
  ERROR: "ERROR",
} as const;
export interface TourActionsOptions {
  state: Ref<TourState>;
  setState: (
    state: TourState,
    hasContent?: boolean,
    audioPosition?: number,
  ) => void;
  clearSavedState: () => void;
  getSavedAudioPosition: () => number | null;
  audioPlayer: ReturnType<typeof useTourAudioPlayer>;
  coordinates: ReturnType<typeof useTourCoordinates>;
  simulationMarker: ReturnType<typeof useSimulationMarker>;
}
export function useTourActions(options: TourActionsOptions) {
  const {
    state,
    setState,
    clearSavedState,
    getSavedAudioPosition,
    audioPlayer,
    coordinates,
    simulationMarker,
  } = options;
  const router = useRouter();
  const tourStore = useTourStore();
  const { positionMode } = usePositionMode();
  const notifications = useNotification();
  const isBusy = ref(false);
  let disposed = false;
  const fail = (error: unknown) => {
    if (disposed) return;
    setState(STATE.ERROR);
    notifications.showApiError(error, "Tour request failed");
  };
  const acknowledge = (delivery: "STARTED" | "COMPLETED" | "INTERRUPTED") =>
    tourStore.acknowledgePlayback(delivery);
  const playChunk = async (position?: number) => {
    if (!tourStore.textForSpeech || !tourStore.currentTourRecord?.audio_data) {
      setState(
        tourStore.currentTourRecord?.guidance?.requires_resume
          ? STATE.RECORD_PAUSED
          : STATE.RECORD_FINISHED,
      );
      return;
    }
    try {
      const played = await audioPlayer.playAudio(position);
      if (disposed) return;
      if (!played) {
        setState(STATE.RECORD_RECEIVED);
        return;
      }
      setState(STATE.RECORD_ACTIVE);
      await acknowledge("STARTED");
    } catch (error) {
      audioPlayer.pauseAudio();
      fail(error);
    }
  };
  const playChunkFromSavedPosition = () =>
    playChunk(Math.max(0, (getSavedAudioPosition() ?? 5) - 5));
  const pauseTour = async () => {
    if (isBusy.value) return;
    isBusy.value = true;
    audioPlayer.pauseAudio();
    setState(STATE.RECORD_PAUSED, undefined, audioPlayer.getCurrentPosition());
    try {
      await tourStore.sendPlaybackControl({ paused: true });
    } catch (error) {
      notifications.showApiError(error, "Could not pause the tour");
    } finally {
      isBusy.value = false;
    }
  };
  const getRecord = async (explicitResume = false) => {
    if (disposed || isBusy.value) return;
    let coords = coordinates.getCurrentCoordinates();
    if (!coords && positionMode.value === "manual") {
      const fallback = coordinates.getFallbackCoordinates();
      if (fallback) {
        simulationMarker.addSimulationMarker(fallback);
        coords = coordinates.getCurrentCoordinates();
      }
    }
    if (!coords) {
      notifications.showError({
        message:
          "Location is unavailable. Enable GPS or choose a manual position on the map.",
      });
      return;
    }
    isBusy.value = true;
    audioPlayer.stopAudio();
    setState(STATE.RECORD_LOADING);
    try {
      await acknowledge("INTERRUPTED");
      if (disposed) return;
      const gps: Partial<ITourRecordRequest> = {};
      if (positionMode.value === "gps") {
        const location = useGeolocationStore();
        if (location.accuracy !== null && Number.isFinite(location.accuracy))
          gps.location_accuracy_meters = Math.max(
            0,
            Math.min(10000, location.accuracy),
          );
        if (location.recordedAt) gps.location_recorded_at = location.recordedAt;
      }
      const record = await tourStore.fetchTourStep(
        { lat: String(coords[1]), lng: String(coords[0]) },
        { ...gps, ...(explicitResume ? { resume: true } : {}) },
      );
      if (!record || disposed) return;
      setState(STATE.RECORD_RECEIVED);
      await playChunk();
    } catch (error) {
      fail(error);
    } finally {
      isBusy.value = false;
    }
  };
  const resumeTour = async () => {
    if (isBusy.value) return;
    if (!tourStore.currentTourRecord?.audio_data || !tourStore.textForSpeech)
      return getRecord(true);
    isBusy.value = true;
    try {
      await tourStore.sendPlaybackControl({ resume: true });
      if (audioPlayer.canResumeAudio()) {
        const played = await audioPlayer.resumeAudioFromSavedPosition();
        if (!disposed)
          setState(played ? STATE.RECORD_ACTIVE : STATE.RECORD_RECEIVED);
      } else await playChunkFromSavedPosition();
    } catch (error) {
      fail(error);
    } finally {
      isBusy.value = false;
    }
  };
  const onAudioEnded = async () => {
    if (disposed) return;
    setState(STATE.RECORD_FINISHED);
    try {
      await acknowledge("COMPLETED");
    } catch (error) {
      fail(error);
    }
  };
  const forceStopPlayback = async () => {
    audioPlayer.stopAudio();
    setState(STATE.RECORD_FINISHED);
    try {
      await acknowledge("INTERRUPTED");
    } catch (error) {
      fail(error);
    }
  };
  const handleTourButtonClick = async () => {
    if (isBusy.value) return;
    switch (state.value) {
      case STATE.INITIAL:
      case STATE.RECORD_FINISHED:
      case STATE.ERROR:
        return getRecord(true);
      case STATE.RECORD_RECEIVED:
        return playChunk();
      case STATE.RECORD_ACTIVE:
        return pauseTour();
      case STATE.RECORD_PAUSED:
        return resumeTour();
    }
  };
  const handleCompleteTour = async () => {
    if (isBusy.value) return;
    isBusy.value = true;
    audioPlayer.stopAudio();
    try {
      await acknowledge("INTERRUPTED");
      await tourStore.finishTour();
      if (disposed) return;
      setState(STATE.TOUR_FINISHED);
      clearSavedState();
      tourStore.setUserText("");
      await router.push({ name: "tours" });
    } catch (error) {
      fail(error);
    } finally {
      isBusy.value = false;
    }
  };
  const addQuestion = async (text: string) => {
    if (!text.trim() || isBusy.value) return;
    tourStore.setUserText(text.trim());
    await getRecord(true);
  };
  const dispose = () => {
    disposed = true;
    audioPlayer.stopAudio();
  };
  return {
    STATE,
    isBusy,
    playChunk,
    playChunkFromSavedPosition,
    pauseTour,
    resumeTour,
    getRecord,
    onAudioEnded,
    forceStopPlayback,
    handleTourButtonClick,
    handleCompleteTour,
    addQuestion,
    dispose,
  };
}
