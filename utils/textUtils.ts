/**
 * Finds the starting index of a sentence within a text
 */
export const getSentenceIndex = (text: string, sentence: string): number => {
  return text.indexOf(sentence);
};

/**
 * Splits text into sentences using regex
 */
export const splitIntoSentences = (text: string): string[] => {
  return text.match(/[^.!?]*[.!?][""]?/g)?.map((s) => s.trim()) || [];
};

/**
 * Finds the current spoken sentence based on character index
 */
export const findCurrentSpokenSentence = (
  charIndex: number,
  text: string,
): string => {
  const sentences = splitIntoSentences(text);
  let accumulatedLength = 0;

  for (const sentence of sentences) {
    accumulatedLength += sentence.length;
    if (charIndex < accumulatedLength) {
      return sentence.trim();
    }
  }
  return "";
};

/**
 * Creates highlighted text with a specific sentence highlighted
 */
export const createHighlightedText = (
  text: string, 
  highlightSentence: string
): string => {
  const sentences = splitIntoSentences(text);
  
  return sentences
    .map((sentence) =>
      sentence === highlightSentence
        ? `<span class="bg-yellow-200 active-sentence">${sentence}</span> `
        : `${sentence} `,
    )
    .join("");
}; 