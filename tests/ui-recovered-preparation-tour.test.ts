import { expect, it } from "vitest";
import type { ICreatedTour } from "../app/types";
import { mergeRecoveredPreparationTour } from "../app/utils/recoveredPreparationTour";
import { preparationSnapshot } from "./helpers/preparationProgress";

const current = {
  id: "tour",
  user_id: "owner",
  latest_generation_id: "generation-1",
  playback_generation_id: "accepted-generation",
  active_generation_id: "accepted-generation",
  status: "STARTED",
  preparation_error: "worker_conflict",
  preparation_progress: preparationSnapshot({ status: "FAILED", percent: 95 }),
  history: ["original offered speech"],
  context: "accepted package",
} as unknown as ICreatedTour;
const recovered = {
  ...current,
  status: "GENERATED",
  playback_generation_id: "unaccepted-generation",
  active_generation_id: "unaccepted-generation",
  preparation_error: null,
  preparation_progress: preparationSnapshot({
    status: "READY",
    percent: 100,
    error: null,
  }),
  history: [],
  context: "new package",
  generating_percent: 100,
  generating_string: "Ready",
} as ICreatedTour;

it("updates recovered preparation metadata without replacing accepted playback, history or package context", () => {
  const updated = mergeRecoveredPreparationTour(current, recovered)!;
  expect(updated.status).toBe("GENERATED");
  expect(updated.preparation_error).toBeNull();
  expect(updated.preparation_progress?.status).toBe("READY");
  expect(updated.playback_generation_id).toBe("accepted-generation");
  expect(updated.active_generation_id).toBe("accepted-generation");
  expect(updated.history).toBe(current.history);
  expect(updated.context).toBe(current.context);
  expect(current.preparation_progress?.status).toBe("FAILED");
});

it.each([
  { user_id: "another-owner" },
  { id: "another-tour" },
  { latest_generation_id: "generation-2" },
  {
    preparation_progress: preparationSnapshot({
      generation_id: "generation-2",
      status: "READY",
    }),
  },
  { research_preview: {} },
])("rejects recovered metadata from a different authority: %j", (change) => {
  expect(
    mergeRecoveredPreparationTour(current, {
      ...recovered,
      ...change,
    } as ICreatedTour),
  ).toBeNull();
});
