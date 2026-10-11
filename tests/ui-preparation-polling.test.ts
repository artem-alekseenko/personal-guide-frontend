import { expect, it, vi } from "vitest";
import { effectScope, ref } from "vue";
import { useTourPreparationProgress } from "../app/composables/tour/useTourPreparationProgress";

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../app/composables/api/tours/useGetTour", () => ({
  useGetTour: api.get,
}));
const current = () =>
  ({
    id: "tour",
    preparation_progress: {
      generation_id: "generation",
      status: "RUNNING",
      turns_completed: 2,
    },
  }) as any;

it("refreshes only preparation metadata and stops after the terminal snapshot", async () => {
  vi.useFakeTimers();
  const scope = effectScope();
  try {
    const tour = ref(current());
    const account = ref("owner");
    api.get.mockResolvedValue({
      ...current(),
      preparation_progress: {
        generation_id: "generation",
        status: "READY",
        turns_completed: 8,
      },
    });
    const state = scope.run(() => useTourPreparationProgress(tour, account))!;
    await vi.advanceTimersByTimeAsync(5000);
    expect(state.progress.value?.turns_completed).toBe(8);
    expect(tour.value.preparation_progress.turns_completed).toBe(2);
    await vi.advanceTimersByTimeAsync(10000);
    expect(api.get).toHaveBeenCalledTimes(1);
  } finally {
    scope.stop();
    vi.useRealTimers();
  }
});

it("keeps the last factual snapshot on refresh failure and retries", async () => {
  vi.useFakeTimers();
  const scope = effectScope();
  try {
    api.get
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(current());
    const state = scope.run(() =>
      useTourPreparationProgress(ref(current()), ref("owner")),
    )!;
    await vi.advanceTimersByTimeAsync(5000);
    expect(state.refreshFailed.value).toBe(true);
    expect(state.progress.value?.turns_completed).toBe(2);
    await vi.advanceTimersByTimeAsync(5000);
    expect(state.refreshFailed.value).toBe(false);
  } finally {
    scope.stop();
    vi.useRealTimers();
  }
});

it("discards in-flight progress after the account changes and stops on disposal", async () => {
  vi.useFakeTimers();
  const scope = effectScope();
  try {
    let resolve!: (value: any) => void;
    api.get.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const account = ref("owner");
    const state = scope.run(() =>
      useTourPreparationProgress(ref(current()), account),
    )!;
    await vi.advanceTimersByTimeAsync(5000);
    account.value = "other-owner";
    expect(state.progress.value).toBeNull();
    resolve(current());
    await vi.advanceTimersByTimeAsync(10000);
    expect(state.progress.value).toBeNull();
    expect(api.get).toHaveBeenCalledTimes(1);
    scope.stop();
    await vi.advanceTimersByTimeAsync(10000);
    expect(api.get).toHaveBeenCalledTimes(1);
  } finally {
    scope.stop();
    vi.useRealTimers();
  }
});
