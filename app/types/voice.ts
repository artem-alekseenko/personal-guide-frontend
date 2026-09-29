/**
 * Voice types supported by the application
 */
export type VoiceType = "DEFAULT" | "CARTESIA" | "MOCK";

/**
 * Voice type options with labels for UI
 */
export const VOICE_TYPE_OPTIONS = [
  {
    value: "DEFAULT" as const,
    label: "Default voice",
  },
  { value: "CARTESIA" as const, label: "Cartesia" },
  {
    value: "MOCK" as const,
    label: "Sample audio",
  },
] as const;

/**
 * Default voice type
 */
export const DEFAULT_VOICE_TYPE: VoiceType = "DEFAULT";

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
