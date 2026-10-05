import { expect, it } from "vitest";
import {
  isTourButtonBlocked,
  canResumeTourRecord,
} from "../app/utils/tourControls";

it("keeps Pause available after a story starts even while STARTED is pending", () => {
  expect(isTourButtonBlocked("RECORD_ACTIVE", true, true)).toBe(false);
  expect(isTourButtonBlocked("RECORD_RECEIVED", true, false)).toBe(true);
  expect(isTourButtonBlocked("RECORD_PAUSED", false, true)).toBe(true);
  expect(isTourButtonBlocked("LOADING_RECORD", false, false)).toBe(true);
});
it("resumes only the recording loaded for the current story", () => {
  const previous = { id: "previous" },
    next = { id: "next" };
  expect(canResumeTourRecord(next, previous, 4, true)).toBe(false);
  expect(canResumeTourRecord(next, next, 4, true)).toBe(true);
  expect(canResumeTourRecord(next, next, 1, true)).toBe(false);
  expect(canResumeTourRecord(next, next, 4, false)).toBe(false);
  expect(canResumeTourRecord(null, null, 4, true)).toBe(false);
});
