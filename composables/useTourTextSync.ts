import { ref } from "vue";
import { useTourStore } from "~/stores/tourStore";
import { useLogger } from "@/composables/useLogger";
import { findCurrentSpokenSentence, getSentenceIndex } from "~/utils/textUtils";

export function useTourTextSync() {
  const tourStore = useTourStore();
  const logger = useLogger();
  
  const currentSpokenSentence = ref("");

  // Highlighting the current spoken sentence
  const highlightSentence = (
    charIndex: number,
    utterance: SpeechSynthesisUtterance | null,
  ): void => {
    if (!utterance || !utterance.text) {
      logger.warn("Invalid utterance for highlighting");
      return;
    }

    const spokenSentence = findCurrentSpokenSentence(charIndex, utterance.text);

    if (
      currentSpokenSentence.value &&
      currentSpokenSentence.value === spokenSentence
    )
      return;

    currentSpokenSentence.value = spokenSentence;
  };

  const updateTextForSpeech = (): void => {
    const text = tourStore.textForDisplay || "";
    const startIndexOfLastSpokenSentence = getSentenceIndex(
      text,
      currentSpokenSentence.value,
    );
    if (startIndexOfLastSpokenSentence === -1) {
      logger.warn("Sentence not found in textForSpeech");
      return;
    }

    const remainingSentences = text.slice(
      startIndexOfLastSpokenSentence + currentSpokenSentence.value.length,
    );
    tourStore.setTextForSpeech(remainingSentences);
  };

  const updateTextForDisplay = (): void => {
    const text = tourStore.textForDisplay || "";
    const startIndexOfLastSpokenSentence = getSentenceIndex(
      text,
      currentSpokenSentence.value,
    );
    if (startIndexOfLastSpokenSentence === -1) {
      logger.warn("Sentence not found in textForDisplay");
      return;
    }

    const truncatedText = text.slice(
      0,
      startIndexOfLastSpokenSentence + currentSpokenSentence.value.length,
    );
    tourStore.setTextForDisplay(truncatedText);
  };

  return {
    currentSpokenSentence,
    highlightSentence,
    updateTextForSpeech,
    updateTextForDisplay,
  };
} 