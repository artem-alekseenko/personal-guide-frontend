import { ref, shallowRef } from "vue";
import { useTourStore } from "~/stores/tourStore";
import { useTourTextSync } from "./useTourTextSync";
import {
  base64ToAudioBlob,
  cleanupAudioUrl,
  createAudioUrl,
} from "~/utils/audioUtils";

export interface TourAudioPlayerOptions {
  getSavedAudioPosition?: () => number | null;
  onEnded?: () => void;
  onError?: (error: unknown) => void;
}
export function useTourAudioPlayer(options: TourAudioPlayerOptions = {}) {
  const tourStore = useTourStore();
  const { highlightSentence } = useTourTextSync();
  const audioElement = shallowRef<HTMLAudioElement | null>(null);
  const currentAudioUrl = ref<string | null>(null);
  let attempt = 0;
  const start = async (): Promise<boolean> => {
    const audio = audioElement.value;
    if (!audio) return false;
    const current = ++attempt;
    try {
      await audio.play();
      return current === attempt;
    } catch (error) {
      if (current === attempt && (error as Error).name !== "NotAllowedError")
        options.onError?.(error);
      return false;
    }
  };
  const playAudio = async (startFromPosition?: number): Promise<boolean> => {
    const data = tourStore.currentTourRecord?.audio_data;
    if (!data) return false;
    if (!audioElement.value) {
      const audio = new Audio();
      audioElement.value = audio;
      audio.onended = () => options.onEnded?.();
      audio.onerror = () =>
        options.onError?.(new Error("Audio could not be loaded"));
      audio.ontimeupdate = () => {
        if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
        const text = tourStore.textForSpeech;
        const progress = Math.max(0, audio.currentTime - 2) / audio.duration;
        highlightSentence(Math.floor(progress * text.length), { text });
      };
    }
    const audio = audioElement.value;
    audio.pause();
    const url = createAudioUrl(
      base64ToAudioBlob(data),
      currentAudioUrl.value ?? undefined,
    );
    currentAudioUrl.value = url;
    audio.src = url;
    audio.onloadedmetadata = () => {
      if (startFromPosition !== undefined)
        audio.currentTime = Math.max(
          0,
          Math.min(
            startFromPosition,
            Number.isFinite(audio.duration)
              ? audio.duration
              : startFromPosition,
          ),
        );
    };
    return start();
  };
  const pauseAudio = () => {
    attempt++;
    audioElement.value?.pause();
  };
  const stopAudio = () => {
    pauseAudio();
    if (audioElement.value) audioElement.value.currentTime = 0;
  };
  const canResumeAudio = () =>
    !!audioElement.value?.src && audioElement.value.readyState >= 2;
  const resumeAudioFromSavedPosition = async () => {
    if (!audioElement.value) return false;
    const saved = options.getSavedAudioPosition?.();
    if (saved !== null && saved !== undefined)
      audioElement.value.currentTime = Math.max(0, saved - 5);
    return start();
  };
  const cleanup = () => {
    stopAudio();
    const audio = audioElement.value;
    if (audio) {
      audio.onended =
        audio.onerror =
        audio.ontimeupdate =
        audio.onloadedmetadata =
          null;
      audio.removeAttribute("src");
      audio.load();
    }
    audioElement.value = null;
    if (currentAudioUrl.value) cleanupAudioUrl(currentAudioUrl.value);
    currentAudioUrl.value = null;
  };
  return {
    audioElement,
    currentAudioUrl,
    playAudio,
    pauseAudio,
    resumeAudio: start,
    stopAudio,
    canResumeAudio,
    resumeAudioFromSavedPosition,
    getCurrentPosition: () => audioElement.value?.currentTime ?? 0,
    cleanup,
  };
}
