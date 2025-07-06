/**
 * Voice types supported by the application
 */
export type VoiceType = "ELEVEN_LABS" | "MOCK";

/**
 * Voice type options with labels for UI
 */
export const VOICE_TYPE_OPTIONS = [
  {
    value: "ELEVEN_LABS" as const,
    label: "Eleven Labs (AI Voice)",
  },
  {
    value: "MOCK" as const,
    label: "Mock (Browser Voice)",
  },
] as const;

/**
 * Default voice type
 */
export const DEFAULT_VOICE_TYPE: VoiceType = "ELEVEN_LABS";

/**
 * Helper function to check if a string is a valid voice type
 */
export const isValidVoiceType = (value: string): value is VoiceType => {
  return VOICE_TYPE_OPTIONS.some((option) => option.value === value);
};

/**
 * Helper function to get voice type label by value
 */
export const getVoiceTypeLabel = (value: VoiceType): string => {
  const option = VOICE_TYPE_OPTIONS.find((opt) => opt.value === value);
  return option?.label || value;
};
