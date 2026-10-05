import { afterEach, expect, it, vi } from "vitest";
import {
  createTourContinuation,
  resolveContinuationStop,
} from "../shared/utils/tourContinuation";

afterEach(() => vi.useRealTimers());
function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
  let snapshot = {
    scope: "owner-tour-generation",
    turnId: "story-one",
    stopId: "stop_0",
    enabled: true,
    fallbackAvailable: true,
    story: true,
    visible: true,
    phase: "playing" as "playing" | "finished" | "blocked",
    waiting: false,
    point: { lat: "47", lng: "19" },
    stopPoint: { lat: "47", lng: "19" },
    accuracy: 5 as number | null,
    recordedAt: "2026-10-05T12:00:00Z",
    remainingSeconds: 50,
  };
  const dispatched: (typeof snapshot)[] = [];
  let release: (() => void) | undefined;
  const coordinator = createTourContinuation({
    read: () => snapshot,
    request: async () => {
      dispatched.push(snapshot);
      if (release)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
    },
  });
  return {
    coordinator,
    dispatched,
    change: (patch: Partial<typeof snapshot>) => {
      snapshot = { ...snapshot, ...patch };
    },
    delay: () => {
      release = () => {};
    },
    release: () => release?.(),
  };
}
it("arms at forty seconds and dispatches once after completion using the latest fix", async () => {
  const f = fixture();
  f.coordinator.observe();
  f.change({ remainingSeconds: 40 });
  f.coordinator.observe();
  f.coordinator.observe();
  await vi.advanceTimersByTimeAsync(1000);
  expect(f.dispatched).toEqual([]);
  f.change({ phase: "finished", remainingSeconds: 0 });
  f.coordinator.afterCompletion();
  f.coordinator.afterCompletion();
  await vi.advanceTimersByTimeAsync(999);
  expect(f.dispatched).toEqual([]);
  f.change({
    point: { lat: "47.00001", lng: "19" },
    recordedAt: "2026-10-05T12:00:01Z",
  });
  await vi.advanceTimersByTimeAsync(1);
  expect(f.dispatched).toHaveLength(1);
  expect(f.dispatched[0]!.point.lat).toBe("47.00001");
  f.coordinator.afterCompletion();
  await vi.advanceTimersByTimeAsync(2000);
  expect(f.dispatched).toHaveLength(1);
});
it.each([
  { waiting: true },
  { enabled: false },
  { visible: false },
  { accuracy: null },
  { point: { lat: "47.01", lng: "19" } },
  { recordedAt: "2026-10-05T11:00:00Z" },
  { scope: "another-account-tour" },
  { turnId: "another-story" },
])(
  "cancels delayed continuation after eligibility changes: %j",
  async (patch) => {
    const f = fixture();
    f.change({ remainingSeconds: 30 });
    f.coordinator.observe();
    f.change({ phase: "finished" });
    f.coordinator.afterCompletion();
    f.change(patch);
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.dispatched).toEqual([]);
  },
);
it("does not revive a canceled request after pause or movement and return", async () => {
  const f = fixture();
  f.change({ remainingSeconds: 30 });
  f.coordinator.observe();
  f.change({ phase: "finished" });
  f.coordinator.afterCompletion();
  f.coordinator.suspend();
  f.coordinator.afterCompletion();
  await vi.advanceTimersByTimeAsync(1000);
  expect(f.dispatched).toEqual([]);
});
it("stops on WAIT and permits a later new story without overlapping requests", async () => {
  const f = fixture();
  f.change({ remainingSeconds: 30 });
  f.coordinator.observe();
  f.change({ phase: "finished" });
  f.coordinator.afterCompletion();
  await vi.advanceTimersByTimeAsync(1000);
  f.change({ waiting: true });
  f.coordinator.observe();
  f.coordinator.afterCompletion();
  await vi.advanceTimersByTimeAsync(1000);
  expect(f.dispatched).toHaveLength(1);
  f.change({
    waiting: false,
    turnId: "story-two",
    phase: "playing",
    remainingSeconds: 30,
  });
  f.coordinator.observe();
  f.change({ phase: "finished" });
  f.coordinator.afterCompletion();
  await vi.advanceTimersByTimeAsync(1000);
  expect(f.dispatched).toHaveLength(2);
});
it("leaves preparation to a supported story-buffer backend", async () => {
  const f = fixture();
  f.change({ remainingSeconds: 30, fallbackAvailable: false });
  f.coordinator.observe();
  f.change({ phase: "finished" });
  f.coordinator.afterCompletion();
  await vi.advanceTimersByTimeAsync(1000);
  expect(f.dispatched).toEqual([]);
});
it("does not overlap a pending continuation with a later completion", async () => {
  const f = fixture();
  f.delay();
  f.change({ remainingSeconds: 30 });
  f.coordinator.observe();
  f.change({ phase: "finished" });
  f.coordinator.afterCompletion();
  await vi.advanceTimersByTimeAsync(1000);
  expect(f.dispatched).toHaveLength(1);
  f.change({ turnId: "story-two", phase: "playing", remainingSeconds: 30 });
  f.coordinator.observe();
  f.change({ phase: "finished" });
  f.coordinator.afterCompletion();
  await vi.advanceTimersByTimeAsync(1000);
  expect(f.dispatched).toHaveLength(1);
  f.release();
  await Promise.resolve();
});
it("recognizes generated stop IDs without treating named stops as another stop", () => {
  const points = [
    { lat: "47", lng: "19" },
    { id: "museum", lat: "48", lng: "20" },
  ];
  expect(resolveContinuationStop(points, "stop_0")).toBe(points[0]);
  expect(resolveContinuationStop(points, "route_point_0")).toBe(points[0]);
  expect(resolveContinuationStop(points, "museum")).toBe(points[1]);
  expect(resolveContinuationStop(points, "stop_1")).toBeNull();
  expect(resolveContinuationStop(points, "stop_99")).toBeNull();
});
