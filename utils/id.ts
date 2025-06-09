/**
 * Generate a stable unique ID for accessibility attributes
 * Uses crypto.randomUUID if available, otherwise falls back to Math.random
 */
export function generateStableId(prefix = 'id'): string {
  let randomPart: string;
  
  // Use crypto.randomUUID if available (modern browsers)
  if (import.meta.client && 'crypto' in window && 'randomUUID' in window.crypto) {
    randomPart = window.crypto.randomUUID();
  } else {
    // Fallback for older browsers or server-side
    randomPart = Math.random().toString(36).substr(2, 9);
  }
  
  return `${prefix}-${randomPart}`;
}

/**
 * Generate a pair of related IDs for modal accessibility
 * Returns an object with titleId and descriptionId
 */
export function generateModalIds(): { titleId: string; descriptionId: string } {
  const baseId = generateStableId('modal');
  return {
    titleId: `${baseId}-title`,
    descriptionId: `${baseId}-description`,
  };
} 