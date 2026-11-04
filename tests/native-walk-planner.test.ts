import { beforeEach, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { reactive } from "vue";
import { emptyPersonalContext } from "../shared/types/personalContext";
import type { WalkingRoutePlan } from "../shared/types/nativeWalk";
const fixtures = vi.hoisted(() => ({
  routes: null as any,
  user: null as any,
  guides: null as any,
}));
vi.mock("../app/stores/routeStore", () => ({
  useRouteStore: () => fixtures.routes,
}));
vi.mock("../app/stores/userStore", () => ({
  useUserStore: () => fixtures.user,
}));
vi.mock("../app/stores/guidesStore", () => ({
  useGuidesStore: () => fixtures.guides,
}));
import { useNativeWalkPlannerStore } from "../app/stores/nativeWalkPlannerStore";
const api = vi.fn();
const plan: WalkingRoutePlan = {
  id: "saved-plan",
  revision: "revision-a",
  provider: "walking-fixture",
  duration_seconds: 580,
  distance_meters: 800,
  geometry: [
    { lat: 47, lng: 19 },
    { lat: 47.001, lng: 19.001 },
  ],
  leg_starts: [0],
  segments: [
    {
      id: "segment",
      start_index: 0,
      end_index: 1,
      start_meters: 0,
      end_meters: 800,
    },
  ],
  instructions: [],
  warnings: [],
  intent: {
    origin: { lat: 47, lng: 19 },
    duration_minutes: 10,
    pace: "normal",
    interests: [],
    excluded_topics: [],
    language: "en",
    wheelchair: false,
    step_free: false,
  },
};
beforeEach(() => {
  setActivePinia(createPinia());
  fixtures.routes = reactive({
    startPoint: { lat: "47", lng: "19" },
    duration: "10",
    effectiveContext: emptyPersonalContext(),
    setActualTour: vi.fn(),
  });
  fixtures.user = reactive({
    user: { uid: "owner" },
    userPreferences: { language: "en" },
  });
  fixtures.guides = reactive({ selectedGuide: { id: "guide" } });
  api.mockReset();
  Object.assign(globalThis, { useNuxtApp: () => ({ $apiFetch: api }) });
});
it("creates a zero-highlight walk using the server-owned plan ID and no required stop list", async () => {
  api.mockResolvedValueOnce(plan).mockResolvedValueOnce({ id: "tour" });
  const planner = useNativeWalkPlannerStore();
  await planner.prepare();
  expect(api.mock.calls[0]![0]).toBe("/api/walk-plans");
  expect(api.mock.calls[0]![1].body).toMatchObject({
    origin: { lat: 47, lng: 19 },
    duration_minutes: 10,
  });
  await planner.create();
  expect(api.mock.calls[1]![1].body).toMatchObject({
    contract_version: 3,
    walking_plan_id: "saved-plan",
    guide_id: "guide",
  });
  expect(api.mock.calls[1]![1].body).not.toHaveProperty("route");
  expect(api.mock.calls[1]![1].body).not.toHaveProperty("route_geometry");
});
it("discards an in-flight candidate if the duration changes", async () => {
  const deferred = Promise.withResolvers<WalkingRoutePlan>();
  api.mockReturnValueOnce(deferred.promise);
  const planner = useNativeWalkPlannerStore();
  const waiting = planner.prepare();
  fixtures.routes.duration = "20";
  deferred.resolve(plan);
  await waiting;
  expect(planner.plan).toBeNull();
});
it("does not adopt another account's in-flight plan", async () => {
  const deferred = Promise.withResolvers<WalkingRoutePlan>();
  api.mockReturnValueOnce(deferred.promise);
  const planner = useNativeWalkPlannerStore();
  const waiting = planner.prepare();
  fixtures.user.user = { uid: "other-owner" };
  deferred.resolve(plan);
  await waiting;
  expect(planner.plan).toBeNull();
});

it("releases a retired account's busy state without releasing the next account's request", async () => {
  const first = Promise.withResolvers<WalkingRoutePlan>();
  const second = Promise.withResolvers<WalkingRoutePlan>();
  api.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const planner = useNativeWalkPlannerStore();
  const oldRequest = planner.prepare();
  expect(planner.busy).toBe(true);
  fixtures.user.user = { uid: "other-owner" };
  expect(planner.busy).toBe(false);
  const newRequest = planner.prepare();
  expect(planner.busy).toBe(true);
  first.resolve(plan);
  await oldRequest;
  expect(planner.busy).toBe(true);
  expect(planner.plan).toBeNull();
  second.resolve(plan);
  await newRequest;
  expect(planner.busy).toBe(false);
  expect(planner.plan?.id).toBe("saved-plan");
});
it("does not restore an old request after signing out and back into the same UID", async () => {
  const old = Promise.withResolvers<WalkingRoutePlan>();
  api.mockReturnValueOnce(old.promise);
  const planner = useNativeWalkPlannerStore();
  const waiting = planner.prepare();
  fixtures.user.user = null;
  fixtures.user.user = { uid: "owner" };
  old.resolve(plan);
  await waiting;
  expect(planner.plan).toBeNull();
  expect(planner.busy).toBe(false);
});
