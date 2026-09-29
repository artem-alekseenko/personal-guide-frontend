import { expect, it } from "vitest";
import { navigationInstructions } from "../app/utils/navigationInstructions";

it("only displays provider directions when navigation is available", () => {
  const navigation = {
    status: "available" as const,
    instructions: ["Turn left at the square"],
    warnings: ["Walking access is unverified"],
  };
  expect(navigationInstructions(navigation)).toEqual([
    "Turn left at the square",
  ]);
  for (const status of [
    "unavailable",
    "location_required",
    "accessibility_unverified",
    "complete",
  ] as const) {
    expect(navigationInstructions({ ...navigation, status })).toEqual([]);
  }
  expect(navigationInstructions(null)).toEqual([]);
});
