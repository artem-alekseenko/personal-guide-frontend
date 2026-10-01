import { expect, it } from "vitest";
import { tourNarrationOptions } from "../shared/utils/tourNarration";

const now = Date.parse("2026-10-01T12:00:00Z");
const input = {
  point: { lat: "47", lng: "19" },
  stops: [{ lat: "47", lng: "19" }],
  accuracy: 5,
  recordedAt: "2026-10-01T11:59:55Z",
  visitorText: "",
};

it("requests a full stationary story at a stop instead of the walking budget", () => {
  expect(tourNarrationOptions(input, now)).toEqual({
    duration: 90,
    requested_mode: "STATIONARY",
  });
});

it.each([
  { accuracy: undefined, recordedAt: undefined },
  { accuracy: 51 },
  { recordedAt: "2026-10-01T11:58:00Z" },
  { recordedAt: "2026-10-01T12:01:00Z" },
  { point: { lat: "47.001", lng: "19" } },
  { pace: 1 },
])("keeps orientation short without a reliable at-stop fix: %j", (change) => {
  expect(tourNarrationOptions({ ...input, ...change }, now)).toEqual({
    duration: 20,
    requested_mode: "WALKING",
  });
});

it("requests the question budget without treating a question as physical arrival", () => {
  expect(
    tourNarrationOptions(
      {
        ...input,
        accuracy: undefined,
        visitorText: "Tell me more about this.",
      },
      now,
    ),
  ).toEqual({ duration: 90, requested_mode: "QUESTION" });
});
