import { expect, it } from "vitest";
import { canAutomaticallyContinueNarration } from "../shared/utils/tourNarration";

it("requires an explicit request for each new four-sentence part", () => {
  expect(
    canAutomaticallyContinueNarration({
      chunk_count: 5,
      is_final: false,
      requires_explicit_continue: true,
      narration_policy_version: "location-four-v1",
    }),
  ).toBe(false);
  expect(
    canAutomaticallyContinueNarration({
      chunk_count: 5,
      is_final: false,
      narration_policy_version: "location-four-v1",
    }),
  ).toBe(false);
});

it("preserves historical continuation metadata", () => {
  expect(
    canAutomaticallyContinueNarration({ chunk_count: 5, is_final: false }),
  ).toBe(true);
  expect(
    canAutomaticallyContinueNarration({ chunk_count: 1, is_final: true }),
  ).toBe(false);
});
