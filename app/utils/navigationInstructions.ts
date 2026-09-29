import type { Navigation } from "~/types/tourExperience";
export function navigationInstructions(
  navigation?: Navigation | null,
): string[] {
  return navigation?.status === "available"
    ? (navigation.instructions ?? [])
    : [];
}
