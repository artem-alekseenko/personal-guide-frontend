import { expect, it, vi } from "vitest";
import { nextTick } from "vue";
import PGTourCard from "../app/components/PGTourCard.vue";
import { findAll, mount } from "./helpers/render";
import { useRouteStore } from "../app/stores/routeStore";

const api = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("../app/composables/api/tours/useListTours", () => ({
  useListTours: api.list,
}));
const snapshot = (status = "RUNNING") => ({
  generation_id: "generation-1",
  status,
  phase: "RESEARCH",
  active_researchers: 2,
  completed_stops: 0,
  total_stops: 2,
  turns_started: 7,
  turns_completed: 5,
  tool_calls_completed: 9,
  sources_count: 4,
  source_bytes: 14320,
  claims_count: 0,
  word_count: 0,
  archive_bytes: 0,
  error: null,
  updated_at: "2026-10-06T12:00:00Z",
  stops: [
    {
      stop_id: "clock",
      name: "Clock House",
      status: "RUNNING",
      phase: "FETCHING",
      attempt: 1,
      turns_started: 4,
      turns_completed: 3,
      tool_calls_completed: 6,
      sources_count: 3,
      source_bytes: 11200,
      claims_count: 0,
      word_count: 0,
      archive_bytes: 0,
      updated_at: "2026-10-06T12:00:00Z",
    },
  ],
});
const text = (root: any) =>
  findAll(root, (n) => n.type !== "#comment")
    .map((n) => n.text)
    .join(" ");

it("renders real research snapshots and updates saved material without invented percentages", async () => {
  Object.assign(globalThis, {
    getComputedStyle: () => ({ lineHeight: "24px" }),
  });
  const app = mount(
    PGTourCard,
    {
      description: "",
      status: "STARTED",
      name: "Walk",
      generatingPercent: 60,
      generatingText: "Preparing",
      tourId: "tour",
      imageUrl: "",
      guideName: "Guide",
      preparationProgress: snapshot(),
    },
    { NuxtLink: { template: "<a><slot /></a>" } },
  );
  await nextTick();
  expect(text(app.root)).toContain("preparationProgress.phases.RESEARCH");
  expect(text(app.root)).toContain("Clock House");
  expect(text(app.root)).toContain("preparationProgress.stopPhases.FETCHING");
  expect(findAll(app.root, (n) => n.props.role === "progressbar")).toHaveLength(
    0,
  );
  expect(text(app.root)).not.toContain("60%");
  app.props.preparationProgress = {
    ...snapshot(),
    claims_count: 34,
    word_count: 1280,
    archive_bytes: 65432,
    turns_completed: 8,
  };
  await nextTick();
  expect(text(app.root)).toContain("34");
  expect(text(app.root)).toContain((1280).toLocaleString());
  expect(text(app.root)).toContain((65432).toLocaleString());
  app.props.preparationProgress = {
    ...snapshot("FAILED"),
    error: "Research deadline reached.",
  };
  await nextTick();
  expect(
    findAll(app.root, (n) => n.props.role === "alert")
      .map(text)
      .join(" "),
  ).toContain("Research deadline reached.");
  app.props.preparationProgress = {
    ...snapshot("FAILED"),
    error: "worker_research_credits_exhausted",
  };
  await nextTick();
  expect(text(app.root)).toContain("preparationProgress.creditsExhausted");
  expect(text(app.root)).not.toContain("worker_research_credits_exhausted");
  app.props.preparationProgress = {
    ...snapshot("FAILED"),
    error: "worker_researchspendingunavailable",
  };
  await nextTick();
  expect(text(app.root)).toContain("preparationProgress.budgetUnavailable");
  expect(text(app.root)).not.toContain("worker_researchspendingunavailable");
  app.props.preparationProgress = {
    ...snapshot("FAILED"),
    error: "worker_researchratelimited",
  };
  await nextTick();
  expect(text(app.root)).toContain("preparationProgress.rateLimited");
  expect(text(app.root)).not.toContain("worker_researchratelimited");
  app.unmount();
});

it("polls research on an already started tour and stops when preparation finishes", async () => {
  vi.useFakeTimers();
  const store = useRouteStore();
  try {
    api.list
      .mockResolvedValueOnce([
        { id: "tour", status: "STARTED", preparation_progress: snapshot() },
      ])
      .mockResolvedValueOnce([
        {
          id: "tour",
          status: "STARTED",
          preparation_progress: snapshot("READY"),
        },
      ]);
    await store.fetchListTours();
    await vi.advanceTimersByTimeAsync(5000);
    expect(api.list).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10000);
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(store.allTours[0]?.preparation_progress?.status).toBe("READY");
  } finally {
    store.stopPolling();
    vi.useRealTimers();
  }
});
