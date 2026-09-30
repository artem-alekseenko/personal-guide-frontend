import { escapeHtml } from "./safeText";
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
  // Clean text for consistent character counting
  const cleanText = text
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/\n\n/g, " ") // Replace paragraph breaks with single space
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();

  const sentences = splitIntoSentences(cleanText);
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
 * Converts \n\n to proper paragraphs and cleans text
 */
export const formatTextWithParagraphs = (text: string): string => {
  return text
    .split("\n\n")
    .map((paragraph) => escapeHtml(paragraph.trim()))
    .filter((paragraph) => paragraph.length > 0)
    .join("</p><p>");
};

/**
 * Creates highlighted text with a specific sentence highlighted and proper paragraph formatting
 */
export const createHighlightedText = (
  text: string,
  highlightSentence: string,
): string => {
  return text
    .split("\n\n")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((paragraph) => {
      const sentences = paragraph.match(/[^.!?]+(?:[.!?]+["”']?|$)/g) ?? [
        paragraph,
      ];
      const html = sentences
        .map((sentence) => {
          const trimmed = sentence.trim();
          if (trimmed !== highlightSentence) return escapeHtml(sentence);
          const leading = sentence.slice(0, sentence.indexOf(trimmed));
          return `${escapeHtml(leading)}<span class="bg-yellow-200 active-sentence">${escapeHtml(trimmed)}</span>`;
        })
        .join("");
      return `<p>${html}</p>`;
    })
    .join("");
};
