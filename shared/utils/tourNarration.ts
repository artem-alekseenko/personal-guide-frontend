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

/** The backend budgets walking at 20s, stationary stories and questions at 90s. */
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
    : { duration: 20, requested_mode: "WALKING" as const };
}
