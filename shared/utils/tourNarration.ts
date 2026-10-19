import type { StoryChunk, StoryPoint } from "../types/storyBuffer";
import { isStoryFixAtStop } from "./storyBuffer";

export interface NarrationLocation {
  point: StoryPoint;
  stops: readonly StoryPoint[];
  accuracy?: number;
  recordedAt?: string;
  pace?: number;
  visitorText: string;
  /** Deprecated compatibility hint; never overrides the backend sentence limit. */
  duration?: number;
}

export function tourWaitHint(
  guidance?: { action: string; reason: string } | null,
): "noMoreHere" | "observingWait" | null {
  if (guidance?.action !== "WAIT") return null;
  if (["no_new_content", "no_location_change"].includes(guidance.reason))
    return "noMoreHere";
  return guidance.reason === "listening_or_observing" ? "observingWait" : null;
}

/** New location replies require an explicit request for continuation. */
export function canAutomaticallyContinueNarration(
  story?: Pick<
    StoryChunk,
    | "chunk_count"
    | "is_final"
    | "requires_explicit_continue"
    | "narration_policy_version"
  > | null,
): boolean {
  if (
    story?.requires_explicit_continue ||
    story?.narration_policy_version === "location-four-v1"
  )
    return false;
  return !(story?.chunk_count === 1 && story.is_final);
}

/** The backend enforces at most four sentences per new reply; there is no visitor length choice. */
export function tourNarrationOptions(input: NarrationLocation, now: number) {
  if (input.visitorText.trim()) return { requested_mode: "QUESTION" as const };
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
    ? { requested_mode: "STATIONARY" as const }
    : // Walking guidance uses the same sentence limit without claiming arrival.
      { requested_mode: "WALKING" as const };
}
