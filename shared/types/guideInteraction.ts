export type GuideInteractionMode = "interactive" | "leading";
export type InteractionPreference = "guide" | GuideInteractionMode;

export const INTERACTION_PREFERENCES = [
  "guide",
  "interactive",
  "leading",
] as const;
export const DEFAULT_GUIDE_INTERACTION_MODE: GuideInteractionMode =
  "interactive";
export const DEFAULT_INTERACTION_PREFERENCE: InteractionPreference = "guide";

export function normalizeGuideInteractionMode(
  value: unknown,
): GuideInteractionMode {
  return value === "leading" || value === "interactive"
    ? value
    : DEFAULT_GUIDE_INTERACTION_MODE;
}

export function normalizeInteractionPreference(
  value: unknown,
): InteractionPreference {
  return value === "guide" || value === "interactive" || value === "leading"
    ? value
    : DEFAULT_INTERACTION_PREFERENCE;
}
