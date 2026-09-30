import type { ITourRecordRequest } from "~/types";
import type { PositionMode } from "~/composables/map/usePositionMode";

/** Sample position at dispatch time; a simulation never acquires GPS metadata. */
export function readTourStepLocation(
  mode: PositionMode,
  getPosition: () => [number, number] | null,
  location: { accuracy: number | null; recordedAt: string | null },
) {
  const coords = getPosition();
  if (
    !coords ||
    !coords.every(Number.isFinite) ||
    Math.abs(coords[0]) > 180 ||
    Math.abs(coords[1]) > 90
  )
    return null;
  const options: Partial<ITourRecordRequest> = {};
  if (mode === "gps") {
    if (location.accuracy !== null && Number.isFinite(location.accuracy))
      options.location_accuracy_meters = Math.max(
        0,
        Math.min(10000, location.accuracy),
      );
    if (location.recordedAt) options.location_recorded_at = location.recordedAt;
  }
  return { point: { lat: String(coords[1]), lng: String(coords[0]) }, options };
}
