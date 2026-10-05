import { isStoryFixAtStop } from "./storyBuffer";
import type { StoryPoint } from "../types/storyBuffer";

export interface TourContinuationObservation {
  scope: string;
  turnId: string | null;
  stopId: string | null;
  enabled: boolean;
  fallbackAvailable: boolean;
  story: boolean;
  visible: boolean;
  phase: "playing" | "finished" | "blocked";
  waiting: boolean;
  point: StoryPoint | null;
  stopPoint: StoryPoint | null;
  accuracy: number | null;
  recordedAt: string | null;
  remainingSeconds: number;
}

/** Published packages use stop_N for route points without a stable source ID. */
export function resolveContinuationStop<
  T extends StoryPoint & { id?: string | null },
>(points: readonly T[], stopId: string | null): T | null {
  if (!stopId) return null;
  return (
    points.find((point, index) =>
      point.id
        ? point.id === stopId
        : [`route_point_${index}`, `stop_${index}`].includes(stopId),
    ) ?? null
  );
}

/** On older backends, arm lookahead locally and request only after completion.
 * No speculative /next mutation, provider calls, or recording I/O lives here. */
export function createTourContinuation(options: {
  read: () => TourContinuationObservation;
  request: () => Promise<void>;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  const attempted = new Set<string>();
  let anchor: { key: string; stopId: string } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let epoch = 0;
  let running = false;
  const key = (value: TourContinuationObservation) =>
    JSON.stringify([value.scope, value.turnId]);
  const eligible = (value: TourContinuationObservation) =>
    value.enabled &&
    value.fallbackAvailable &&
    value.visible &&
    value.story &&
    !value.waiting &&
    !!value.scope &&
    !!value.turnId &&
    !!value.stopId &&
    value.phase !== "blocked" &&
    isStoryFixAtStop(value, now());
  const matches = (value: TourContinuationObservation) =>
    anchor?.key === key(value) && anchor.stopId === value.stopId;
  const suspend = () => {
    epoch++;
    if (timer) clearTimeout(timer);
    timer = undefined;
    if (anchor) attempted.add(anchor.key);
    anchor = null;
  };
  const observe = () => {
    const value = options.read();
    if (anchor && (!eligible(value) || !matches(value))) suspend();
    if (
      running ||
      timer ||
      !eligible(value) ||
      value.phase !== "playing" ||
      attempted.has(key(value)) ||
      !Number.isFinite(value.remainingSeconds) ||
      value.remainingSeconds <= 0 ||
      value.remainingSeconds > 40
    )
      return;
    anchor = { key: key(value), stopId: value.stopId! };
  };
  const afterCompletion = () => {
    const value = options.read();
    if (
      running ||
      timer ||
      !anchor ||
      attempted.has(anchor.key) ||
      !eligible(value) ||
      !matches(value) ||
      value.phase !== "finished"
    )
      return;
    attempted.add(anchor.key);
    const scheduledEpoch = epoch;
    timer = setTimeout(() => {
      timer = undefined;
      const latest = options.read();
      if (
        scheduledEpoch !== epoch ||
        !eligible(latest) ||
        !matches(latest) ||
        latest.phase !== "finished" ||
        running
      )
        return;
      running = true;
      // The caller samples GPS again at dispatch and preserves uncertain request
      // identity. A failed request ends the chain; observing does not poll it.
      void options
        .request()
        .catch(() => suspend())
        .finally(() => {
          running = false;
        });
    }, 1000);
  };
  return { observe, afterCompletion, suspend };
}
