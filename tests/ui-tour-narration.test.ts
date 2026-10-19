import { expect, it } from "vitest";
import {
  canAutomaticallyContinueNarration,
  tourNarrationOptions,
} from "../shared/utils/tourNarration";

const now = Date.parse("2026-10-01T12:00:00Z");
const input = {
  point: { lat: "47", lng: "19" },
  stops: [{ lat: "47", lng: "19" }],
  accuracy: 5,
  recordedAt: "2026-10-01T11:59:55Z",
  visitorText: "",
};

it("requests a stationary story only with a trusted at-stop fix", () => {
  expect(tourNarrationOptions(input, now)).toEqual({
    requested_mode: "STATIONARY",
  });
});

it.each([
  { accuracy: undefined, recordedAt: undefined },
  { accuracy: 51 },
  { recordedAt: "2026-10-01T11:58:00Z" },
  { recordedAt: "2026-10-01T12:01:00Z" },
  { point: { lat: "47.001", lng: "19" } },
  { point: { lat: "48", lng: "20" } },
  { pace: 1 },
])(
  "preserves walking guidance without restricting the story budget: %j",
  (change) => {
    expect(tourNarrationOptions({ ...input, ...change }, now)).toEqual({
      requested_mode: "WALKING",
    });
  },
);

it("requests a complete answer without treating a question as physical arrival", () => {
  expect(
    tourNarrationOptions(
      {
        ...input,
        accuracy: undefined,
        visitorText: "Tell me more about this.",
      },
      now,
    ),
  ).toEqual({
    requested_mode: "QUESTION",
  });
});

it("allows local commentary outside arrival range without claiming the visitor is stationary", () => {
  expect(
    tourNarrationOptions(
      { ...input, point: { lat: "47.00034", lng: "19" } },
      now,
    ),
  ).toEqual({
    requested_mode: "WALKING",
  });
});

it("lets backend guidance choose a story for simulation without creating GPS evidence", () => {
  expect(
    tourNarrationOptions(
      { ...input, accuracy: undefined, recordedAt: undefined },
      now,
    ),
  ).toEqual({
    requested_mode: "WALKING",
  });
});

it("ignores legacy duration hints rather than selecting a shorter response", () => {
  expect(tourNarrationOptions({ ...input, duration: 90 }, now)).toEqual({
    requested_mode: "STATIONARY",
  });
});

it("never automatically paginates or chains a complete response", () => {
  expect(
    canAutomaticallyContinueNarration({ chunk_count: 1, is_final: true }),
  ).toBe(false);
  expect(
    canAutomaticallyContinueNarration({ chunk_count: 4, is_final: false }),
  ).toBe(true);
  expect(canAutomaticallyContinueNarration(null)).toBe(true);
});
