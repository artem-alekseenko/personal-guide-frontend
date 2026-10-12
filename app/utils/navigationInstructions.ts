import type { Navigation } from "~/types/tourExperience";
export function navigationInstructions(
  navigation?: Navigation | null,
): string[] {
  return navigation?.status === "available" && navigation.route_context !== "remote_travel"
    ? (navigation.instructions ?? [])
    : [];
}
export function currentManeuver(navigation?: Navigation | null): string | null {
  if (navigation?.status !== "available" || navigation.route_context === "remote_travel")
    return null;
  return navigation.current_maneuver?.trim() || null;
}
