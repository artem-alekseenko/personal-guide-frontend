import type { Ref } from "vue";
import { useRouter } from "vue-router";
import { useTourStore } from "~/stores/tourStore";
import { usePositionMode } from "./usePositionMode";
import { useLogger } from "./useLogger";
import type { ICoordinate } from "~/types";
import type { TourState } from "./useTourState";
import type { useTourAudioPlayer } from "./useTourAudioPlayer";
import type { useTourCoordinates } from "./useTourCoordinates";
import type { useSimulationMarker } from "./useSimulationMarker";

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

const AUDIO_REWIND_SECONDS = 5;

export interface TourActionsOptions {
  state: Ref<TourState>;
  setState: (newState: TourState, hasContent?: boolean, audioPosition?: number) => void;
  clearSavedState: () => void;
  getSavedAudioPosition: () => number | null;
  audioPlayer: ReturnType<typeof useTourAudioPlayer>;
  coordinates: ReturnType<typeof useTourCoordinates>;
  simulationMarker: ReturnType<typeof useSimulationMarker>;
}

/**
 * Composable for tour user actions
 * Handles tour playback control, record fetching, questions, and completion
 */
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
  const logger = useLogger();

  /**
   * Play audio chunk
   */
  const playChunk = (): void => {
    if (!tourStore.textForSpeech.length) {
      setState(STATE.RECORD_FINISHED);
      return;
    }

    audioPlayer.playAudio();
    setState(STATE.RECORD_ACTIVE);
  };

  /**
   * Play audio chunk from saved position with rewind
   */
  const playChunkFromSavedPosition = (): void => {
    if (!tourStore.textForSpeech.length) {
      setState(STATE.RECORD_FINISHED);
      return;
    }

    const savedPosition = getSavedAudioPosition();
    if (savedPosition !== null) {
      const rewindPosition = Math.max(0, savedPosition - AUDIO_REWIND_SECONDS);
      audioPlayer.playAudio(rewindPosition);
    } else {
      audioPlayer.playAudio();
    }

    setState(STATE.RECORD_ACTIVE);
  };

  /**
   * Pause tour playback
   */
  const pauseTour = (): void => {
    const currentPosition = audioPlayer.getCurrentPosition();
    setState(STATE.RECORD_PAUSED, undefined, currentPosition);
    audioPlayer.pauseAudio();
  };

  /**
   * Resume tour playback from saved position
   */
  const resumeTour = (): void => {
    setState(STATE.RECORD_ACTIVE);
    audioPlayer.resumeAudioFromSavedPosition();
  };

  /**
   * Force stop playback
   */
  const forceStopPlayback = (): void => {
    audioPlayer.stopAudio();
    setState(STATE.RECORD_FINISHED);
  };

  /**
   * Get tour record for current position
   */
  const getRecord = async (): Promise<void> => {
    let coords = coordinates.getCurrentCoordinates();

    if (!coords) {
      logger.warn(
        "No coordinates available for current position mode, trying fallback"
      );

      const fallbackCoords = coordinates.getFallbackCoordinates();

      if (fallbackCoords) {
        if (positionMode.value === "manual") {
          simulationMarker.addSimulationMarker(fallbackCoords);
          coords = coordinates.getCurrentCoordinates();
        } else {
          coords = fallbackCoords;
        }
      } else {
        logger.error("No fallback coordinates available");
        return;
      }
    }

    if (!coords) {
      logger.error("Still unable to get coordinates after fallback");
      return;
    }

    if (state.value === STATE.RECORD_PAUSED) {
      setState(STATE.RECORD_LOADING_WHEN_PAUSED);
    } else {
      setState(STATE.RECORD_LOADING);
    }

    const currentCoord: ICoordinate = {
      lat: String(coords[1]),
      lng: String(coords[0]),
    };

    logger.log(
      `Getting record for ${positionMode.value} position:`,
      currentCoord
    );

    try {
      await tourStore.fetchTourStep(currentCoord);
    } catch (error) {
      setState(STATE.ERROR);
      logger.error("Tour step fetch failed, state set to ERROR");
    }
  };

  /**
   * Handle main tour button click (play/pause/resume)
   */
  const handleTourButtonClick = (): void => {
    switch (state.value) {
      case STATE.INITIAL:
      case STATE.RECORD_FINISHED:
      case STATE.ERROR:
        getRecord();
        break;
      case STATE.RECORD_RECEIVED:
        playChunk();
        break;
      case STATE.RECORD_ACTIVE:
        pauseTour();
        break;
      case STATE.RECORD_PAUSED:
        if (tourStore.textForSpeech?.length && audioPlayer.canResumeAudio()) {
          resumeTour();
        } else {
          playChunkFromSavedPosition();
        }
        break;
    }
  };

  /**
   * Handle tour completion
   */
  const handleCompleteTour = (): void => {
    setState(STATE.TOUR_FINISHED);
    clearSavedState();
    tourStore.setUserText("");
    router.push({ name: "tours" });
  };

  /**
   * Add user question to the tour
   * @param questionText - User's question text
   */
  const addQuestion = async (questionText: string): Promise<void> => {
    const currentPosition = audioPlayer.getCurrentPosition();
    setState(STATE.RECORD_PAUSED, undefined, currentPosition);
    audioPlayer.pauseAudio();

    tourStore.setUserText(questionText);

    audioPlayer.stopAudio();

    try {
      await getRecord();
    } catch (error) {
      logger.error("Failed to add question:", error);
    }
  };

  return {
    playChunk,
    playChunkFromSavedPosition,
    pauseTour,
    resumeTour,
    forceStopPlayback,
    getRecord,
    handleTourButtonClick,
    handleCompleteTour,
    addQuestion,
    STATE,
  };
}
