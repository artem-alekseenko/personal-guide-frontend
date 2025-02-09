import { ref } from "vue";

export const useTourSpeech = () => {
  const currentUtterance = ref<SpeechSynthesisUtterance | null>(null);

  const speakMessage = ({
    text,
    offset = 0,
    onBoundary,
    onEnd,
  }: {
    text: string;
    offset?: number;
    onBoundary: (
      charIndex: number,
      utterance: SpeechSynthesisUtterance | null,
    ) => void;
    onEnd: () => void;
  }) => {
    if (!text) {
      console.error("No text to speak");
      return;
    }

    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      console.warn("Speech already in progress");
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.onboundary = (event) => {
      onBoundary(event.charIndex, currentUtterance.value);
    };
    utterance.onend = () => {
      onEnd();
    };
    utterance.onerror = (event) => {
      console.error("Speech synthesis error", event);
    };

    currentUtterance.value = utterance;

    window.speechSynthesis.speak(utterance);
  };

  const pauseSpeech = () => {
    if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
    }
  };

  const resumeSpeech = () => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  };

  const stopSpeech = () => {
    window.speechSynthesis.cancel();
  };

  return {
    currentUtterance,
    speakMessage,
    pauseSpeech,
    resumeSpeech,
    stopSpeech,
  };
};
