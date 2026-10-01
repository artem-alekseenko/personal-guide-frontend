import { expect, it } from "vitest";
import { tourWaitHint } from "../shared/utils/tourNarration";

it.each(["no_new_content", "no_location_change"])(
  "explains why another automatic reply is empty: %s",
  (reason) => {
    expect(tourWaitHint({ action: "WAIT", reason })).toBe("noMoreHere");
  },
);
it("distinguishes an observation break from exhausted content", () => {
  expect(
    tourWaitHint({ action: "WAIT", reason: "listening_or_observing" }),
  ).toBe("observingWait");
});
it.each([
  null,
  { action: "WAIT", reason: "paused" },
  { action: "WAIT", reason: "awaiting_location" },
  { action: "WAIT", reason: "route_complete" },
  { action: "CONTINUE", reason: "no_new_content" },
])(
  "does not suggest moving/asking for a different control state: %j",
  (guidance) => {
    expect(tourWaitHint(guidance)).toBeNull();
  },
);
