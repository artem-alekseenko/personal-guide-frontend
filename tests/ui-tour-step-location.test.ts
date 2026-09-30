import { expect, it } from "vitest";
import { readTourStepLocation } from "../app/composables/tour/tourStepLocation";

it("reads the latest location and metadata each time rather than retaining an earlier fix", () => {
  let position: [number, number] = [19, 47];
  const location = { accuracy: 12, recordedAt: "2026-09-30T12:00:00Z" };
  const read = () => readTourStepLocation("gps", () => position, location);
  expect(read()?.point).toEqual({ lat: "47", lng: "19" });
  position = [19.001, 47.001];
  location.recordedAt = "2026-09-30T12:00:05Z";
  expect(read()).toEqual({
    point: { lat: "47.001", lng: "19.001" },
    options: {
      location_accuracy_meters: 12,
      location_recorded_at: "2026-09-30T12:00:05Z",
    },
  });
});
it("keeps simulation coordinates separate from GPS metadata and rejects missing or invalid positions", () => {
  expect(
    readTourStepLocation("manual", () => [19, 47], {
      accuracy: 4,
      recordedAt: "gps-time",
    }),
  ).toEqual({ point: { lat: "47", lng: "19" }, options: {} });
  expect(
    readTourStepLocation("gps", () => null, {
      accuracy: null,
      recordedAt: null,
    }),
  ).toBeNull();
  expect(
    readTourStepLocation("gps", () => [19, 91], {
      accuracy: null,
      recordedAt: null,
    }),
  ).toBeNull();
});
