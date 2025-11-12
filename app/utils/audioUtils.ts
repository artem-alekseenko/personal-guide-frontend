/**
 * Converts base64 audio data to blob
 */
export const base64ToAudioBlob = (base64Data: string): Blob => {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: "audio/mp3" });
};

/**
 * Creates audio URL from blob and cleans up previous URL
 */
export const createAudioUrl = (blob: Blob, previousUrl?: string): string => {
  if (previousUrl) {
    URL.revokeObjectURL(previousUrl);
  }
  return URL.createObjectURL(blob);
};

/**
 * Cleans up audio URL to prevent memory leaks
 */
export const cleanupAudioUrl = (url: string): void => {
  URL.revokeObjectURL(url);
}; 