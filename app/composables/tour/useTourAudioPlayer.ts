import { ref } from "vue";
import { useTourStore } from "~/stores/tourStore";
import { useTourTextSync } from "./useTourTextSync";
import { useLogger } from "~/composables/utils/useLogger";
import {
  base64ToAudioBlob,
  cleanupAudioUrl,
  createAudioUrl,
} from "~/utils/audioUtils";

const AUDIO_REWIND_SECONDS = 5;
const AUDIO_SYNC_DELAY_SECONDS = 2;

export interface TourAudioPlayerOptions {
  getSavedAudioPosition?: () => number | null;
}

/**
 * Composable for managing tour audio playback
 * Handles HTML5 audio element, playback controls, and text synchronization
 */
export function useTourAudioPlayer(options: TourAudioPlayerOptions = {}) {
  const tourStore = useTourStore();
  const logger = useLogger();
  const { highlightSentence } = useTourTextSync();

  const audioElement = ref<HTMLAudioElement | null>(null);
  const currentAudioUrl = ref<string | null>(null);

  /**
   * Play audio from current tour record
   * @param startFromPosition - Optional position in seconds to start playback from
   */
  const playAudio = (startFromPosition?: number): void => {
    if (!tourStore.currentTourRecord) return;

    const audioData = tourStore.currentTourRecord.audio_data;

    if (!audioData) return;

    if (!audioElement.value) {
      audioElement.value = new Audio();

      audioElement.value.addEventListener("timeupdate", () => {
        if (!audioElement.value) return;

        const totalDuration = audioElement.value.duration;
        const currentTime = audioElement.value.currentTime;

        if (!totalDuration || totalDuration <= 0) {
          logger.warn("Invalid audio duration for progress calculation");
          return;
        }

        const adjustedTime = Math.max(
          0,
          currentTime - AUDIO_SYNC_DELAY_SECONDS,
        );
        const progress = adjustedTime / totalDuration;

        const cleanText = tourStore.textForSpeech
          .replace(/<[^>]*>/g, "") // Remove HTML tags
          .replace(/\n\n/g, " ") // Replace paragraph breaks with single space
          .replace(/\s+/g, " ") // Normalize whitespace
          .trim();
        const totalTextLength = cleanText.length;

        if (totalTextLength <= 0) {
          logger.warn("Empty text for speech progress calculation");
          return;
        }

        const currentCharIndex = Math.floor(progress * totalTextLength);

        if (Math.floor(currentTime) % 5 === 0 && currentTime % 1 < 0.1) {
          logger.log(
            `Sync Debug: Time=${currentTime.toFixed(1)}s/${totalDuration.toFixed(1)}s (${(progress * 100).toFixed(1)}%), CharIndex=${currentCharIndex}/${totalTextLength}, AdjustedTime=${adjustedTime.toFixed(1)}s, Text="${cleanText.substring(currentCharIndex - 10, currentCharIndex + 10)}"`,
          );
        }

        const utterance = new SpeechSynthesisUtterance(tourStore.textForSpeech);
        highlightSentence(currentCharIndex, utterance);
      });
    }

    const blob = base64ToAudioBlob(audioData);
    const audioUrl = createAudioUrl(blob, currentAudioUrl.value ?? undefined);

    currentAudioUrl.value = audioUrl;
    audioElement.value.src = audioUrl;

    if (startFromPosition !== undefined) {
      const setPositionAndPlay = () => {
        if (audioElement.value) {
          audioElement.value.currentTime = startFromPosition;
          audioElement.value.play();
        }
      };

      audioElement.value.addEventListener("loadeddata", setPositionAndPlay, {
        once: true,
      });

      setTimeout(() => {
        if (audioElement.value && audioElement.value.currentTime === 0) {
          setPositionAndPlay();
        }
      }, 200);

      audioElement.value.load();
    } else {
      audioElement.value.play();
    }
  };

  /**
   * Pause audio playback
   */
  const pauseAudio = (): void => {
    if (audioElement.value) {
      audioElement.value.pause();
    }
  };

  /**
   * Resume audio playback from current position
   */
  const resumeAudio = (): void => {
    if (audioElement.value) {
      audioElement.value.play();
    }
  };

  /**
   * Stop audio playback and reset position
   */
  const stopAudio = (): void => {
    if (audioElement.value) {
      audioElement.value.pause();
      audioElement.value.currentTime = 0;
    }
  };

  /**
   * Check if audio can be resumed (has valid source and is loaded)
   * @returns True if audio is ready to be resumed
   */
  const canResumeAudio = (): boolean => {
    return !!(
      audioElement.value &&
      audioElement.value.src &&
      audioElement.value.readyState >= 2 // HAVE_CURRENT_DATA or higher
    );
  };

  /**
   * Resume audio from saved position with rewind buffer
   */
  const resumeAudioFromSavedPosition = (): void => {
    if (!audioElement.value) return;

    const savedPosition = options.getSavedAudioPosition?.();

    if (savedPosition !== null && savedPosition !== undefined) {
      const rewindPosition = Math.max(0, savedPosition - AUDIO_REWIND_SECONDS);
      audioElement.value.currentTime = rewindPosition;
    }

    audioElement.value.play();
  };

  /**
   * Get current audio playback position
   * @returns Current time in seconds or 0 if no audio element
   */
  const getCurrentPosition = (): number => {
    return audioElement.value?.currentTime ?? 0;
  };

  /**
   * Cleanup audio resources
   */
  const cleanup = (): void => {
    if (currentAudioUrl.value) {
      cleanupAudioUrl(currentAudioUrl.value);
      currentAudioUrl.value = null;
    }

    if (audioElement.value) {
      audioElement.value.pause();
      audioElement.value = null;
    }
  };

  return {
    audioElement,
    currentAudioUrl,
    playAudio,
    pauseAudio,
    resumeAudio,
    stopAudio,
    canResumeAudio,
    resumeAudioFromSavedPosition,
    getCurrentPosition,
    cleanup,
  };
}
