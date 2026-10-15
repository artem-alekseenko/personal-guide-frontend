import type { StoryPoint } from "../types/storyBuffer";
import { isStoryFixAtStop } from "./storyBuffer";

export interface NarrationLocation {
  point: StoryPoint;
  stops: readonly StoryPoint[];
  accuracy?: number;
  recordedAt?: string;
  pace?: number;
  visitorText: string;
}

export function tourWaitHint(
  guidance?: { action: string; reason: string } | null,
): "noMoreHere" | "observingWait" | null {
  if (guidance?.action !== "WAIT") return null;
  if (["no_new_content", "no_location_change"].includes(guidance.reason))
    return "noMoreHere";
  return guidance.reason === "listening_or_observing" ? "observingWait" : null;
}

/** Request enough room for a supported story; the backend owns actual length. */
export function tourNarrationOptions(input: NarrationLocation, now: number) {
  if (input.visitorText.trim())
    return { duration: 90, requested_mode: "QUESTION" as const };
  const nearStop =
    !(input.pace !== undefined && input.pace > 0.5) &&
    input.stops.some((stopPoint) =>
      isStoryFixAtStop(
        {
          point: input.point,
          stopPoint,
          accuracy: input.accuracy ?? null,
          recordedAt: input.recordedAt ?? null,
        },
        now,
      ),
    );
  return nearStop
    ? { duration: 90, requested_mode: "STATIONARY" as const }
    : // WALKING is not an arrival claim or a short-story cap. Backend location
      // guidance chooses a brief maneuver or eligible local commentary.
      { duration: 90, requested_mode: "WALKING" as const };
}
