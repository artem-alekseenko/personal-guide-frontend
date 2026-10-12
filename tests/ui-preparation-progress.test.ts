import { expect, it, vi } from "vitest";
import { nextTick } from "vue";
import PGTourCard from "../app/components/PGTourCard.vue";
import { findAll, mount, type TestNode } from "./helpers/render";
import { useRouteStore } from "../app/stores/routeStore";
import type { User } from "firebase/auth";
import { useUserStore } from "../app/stores/userStore";
import type { PreparationProgress } from "../shared/types/preparationProgress";
import { preparationSnapshot } from "./helpers/preparationProgress";
import TourPreparationProgress from "../app/components/tour/TourPreparationProgress.vue";
import PGButton from "../app/components/ui/PGButton.vue";

const api = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("../app/composables/api/tours/useListTours", () => ({
  useListTours: api.list,
}));
const snapshot = (status: PreparationProgress["status"] = "RUNNING") =>
  preparationSnapshot({
    status,
    percent: status === "READY" ? 100 : 37,
    remaining_seconds: ["READY", "FAILED", "CANCELLED"].includes(status)
      ? 0
      : null,
    remaining_time_kind: ["READY", "FAILED", "CANCELLED"].includes(status)
      ? "complete"
      : "unknown",
  });
const text = (root: TestNode): string =>
  findAll(root, (n) => n.type !== "#comment")
    .map((n) => n.text)
    .join(" ");

it("uses backend percentage on compact cards and retains saved-material counters in research details", async () => {
  Object.assign(globalThis, {
    getComputedStyle: () => ({ lineHeight: "24px" }),
    useNuxtApp: () => ({ $apiFetch: vi.fn() }),
  });
  useUserStore().user = { uid: "owner" } as User;
  const app = mount(
    PGTourCard,
    {
      description: "",
      status: "STARTED",
      name: "Walk",
      generatingText: "Preparing",
      tourId: "tour",
      imageUrl: "",
      guideName: "Guide",
      preparationProgress: snapshot(),
    },
    { NuxtLink: { template: "<a><slot /></a>" }, PGButton },
  );
  await nextTick();
  expect(findAll(app.root, (n) => n.type === "progress")[0]?.props.value).toBe(
    37,
  );
  const active = findAll(
    app.root,
    (n) => "data-active-research-stops" in n.props,
  )[0];
  expect(active && text(active)).toContain("Clock House");
  expect(active?.parent?.type).not.toBe("details");
  const counters = findAll(
    app.root,
    (n) => "data-research-counters" in n.props,
  )[0];
  expect(counters?.parent?.type).toBe("section");
  app.props.preparationProgress = {
    ...snapshot(),
    claims_count: 34,
    word_count: 1280,
    archive_bytes: 65432,
    turns_completed: 8,
  };
  await nextTick();
  expect(
    findAll(
      app.root,
      (n) => n.props["data-research-counter"] === "claims_count",
    )
      .map(text)
      .join(" "),
  ).toBe("34");
  expect(
    findAll(app.root, (n) => n.props["data-research-counter"] === "word_count")
      .map(text)
      .join(" "),
  ).toBe((1280).toLocaleString());
  app.props.preparationProgress = { ...snapshot(), percent: undefined };
  await nextTick();
  expect(findAll(app.root, (n) => n.type === "progress")).toHaveLength(0);
  expect(text(app.root)).not.toContain("60%");
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

it("distinguishes API timing kinds and exposes raw activity, freshness, and separate spend amounts", async () => {
  const app = mount(TourPreparationProgress, {
    compact: true,
    progress: preparationSnapshot({
      elapsed_seconds: 203,
      remaining_seconds: 90,
      remaining_time_kind: "estimate",
      activity_text: "<b>Reading archive records</b>",
      activity_updated_at: "2026-10-06T12:01:00Z",
      research_spend: {
        limit_micros: 5_000_000,
        spent_micros: 1_250_000,
        reserved_micros: 750_000,
        remaining_micros: 3_000_000,
      },
    }),
    refreshing: true,
  });
  const remaining = () =>
    findAll(app.root, (n) => "data-remaining-kind" in n.props)[0];
  expect(remaining()?.props["data-remaining-kind"]).toBe("estimate");
  expect(remaining() && text(remaining()!)).toContain("00:01:30");
  expect(
    findAll(app.root, (n) => "data-research-activity" in n.props)
      .map(text)
      .join(" "),
  ).toBe("<b>Reading archive records</b>");
  expect(findAll(app.root, (n) => n.type === "b")).toHaveLength(0);
  expect(
    findAll(app.root, (n) => n.type === "time").map((n) => n.props.datetime),
  ).toContain("2026-10-06T12:01:00Z");
  const spendNodes = findAll(app.root, (n) => "data-research-spend" in n.props);
  expect(
    spendNodes.find((n) => n.props["data-research-spend"] === "spent_micros")
      ?.text,
  ).toContain("1.25");
  expect(
    spendNodes.find((n) => n.props["data-research-spend"] === "reserved_micros")
      ?.text,
  ).toContain("0.75");
  expect(
    findAll(app.root, (n) => n.type === "section")[0]?.props["aria-busy"],
  ).toBeUndefined();
  app.props.progress = preparationSnapshot({
    remaining_time_kind: "deadline",
    remaining_seconds: 90,
  });
  await nextTick();
  expect(remaining()?.props["data-remaining-kind"]).toBe("deadline");
  app.props.progress = preparationSnapshot({
    percent: undefined,
    elapsed_seconds: undefined,
    remaining_time_kind: "estimate",
    remaining_seconds: null,
  });
  await nextTick();
  expect(remaining()?.props["data-remaining-kind"]).toBe("unknown");
  expect(findAll(app.root, (n) => n.type === "progress")).toHaveLength(0);
  expect(
    findAll(app.root, (n) => "data-research-elapsed" in n.props)
      .map(text)
      .join(" "),
  ).not.toContain("203");

  app.unmount();
});
it.each<[number, string]>([
  [0, "00:00:00"],
  [59, "00:00:59"],
  [60, "00:01:00"],
  [3599, "00:59:59"],
  [3600, "01:00:00"],
  [86461, "24:01:01"],
])(
  "renders %i seconds without confusing duration with time of day",
  (seconds, expected) => {
    const app = mount(TourPreparationProgress, {
      progress: preparationSnapshot({ elapsed_seconds: seconds }),
    });
    const elapsed = findAll(
      app.root,
      (node) => "data-research-elapsed" in node.props,
    )[0]!;
    expect(findAll(elapsed, (node) => node.type === "time")[0]?.text).toBe(
      expected,
    );
    app.unmount();
  },
);

it("keeps completed and skipped stops separate without presenting terminal progress as approval", async () => {
  const ready = preparationSnapshot({
    status: "READY",
    percent: 100,
    completed_stops: 1,
    skipped_stops: 1,
    remaining_time_kind: "complete",
    remaining_seconds: 0,
    stops: [{ ...snapshot().stops[0]!, status: "SKIPPED", phase: "SKIPPED" }],
  });
  const app = mount(TourPreparationProgress, { progress: ready });
  expect(findAll(app.root, (n) => n.type === "progress")[0]?.props.value).toBe(
    100,
  );
  expect(
    findAll(app.root, (n) => "data-completed-stops" in n.props)
      .map(text)
      .join(" "),
  ).toBe("1 / 2");
  expect(
    findAll(app.root, (n) => "data-skipped-stops" in n.props)
      .map(text)
      .join(" "),
  ).toBe("1");
  expect(
    findAll(app.root, (n) => "data-research-gap-notice" in n.props),
  ).toHaveLength(1);
  expect(
    findAll(app.root, (n) => "data-active-research-stops" in n.props),
  ).toHaveLength(0);
  expect(
    findAll(app.root, (n) => "data-research-completion-notice" in n.props),
  ).toHaveLength(1);
  for (const status of ["FAILED", "CANCELLED"] as const) {
    app.props.progress = { ...ready, status };
    await nextTick();
    expect(
      findAll(app.root, (n) => n.props["data-preparation-status"] === status),
    ).toHaveLength(1);
    expect(
      findAll(app.root, (n) => "data-research-completion-notice" in n.props),
    ).toHaveLength(1);
    expect(
      findAll(app.root, (n) => "data-research-gap-notice" in n.props),
    ).toHaveLength(0);
  }
  app.unmount();
});

it("keeps a missing research snapshot indeterminate", async () => {
  Object.assign(globalThis, {
    getComputedStyle: () => ({ lineHeight: "24px" }),
    useNuxtApp: () => ({ $apiFetch: vi.fn() }),
  });
  useUserStore().user = { uid: "owner" } as User;
  const app = mount(
    PGTourCard,
    {
      description: "",
      status: "GENERATING",
      name: "Walk",
      generatingText: "Waiting for worker",
      tourId: "tour",
      imageUrl: "",
      guideName: "Guide",
    },
    { NuxtLink: { template: "<a><slot /></a>" }, PGButton },
  );
  await nextTick();
  expect(findAll(app.root, (n) => n.type === "progress")).toHaveLength(0);
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

it("rejects invalid backend percentages and uses stop activity without inventing a timer", async () => {
  const app = mount(TourPreparationProgress, {
    progress: preparationSnapshot({
      percent: undefined,
      phase: "NEW_SERVER_PHASE",
      elapsed_seconds: undefined,
      remaining_seconds: undefined,
      remaining_time_kind: undefined,
      activity_text: "",
      stops: [{ ...snapshot().stops[0]!, phase: "READING", updated_at: null }],
    }),
    refreshing: false,
    refreshFailed: false,
  });
  expect(findAll(app.root, (n) => n.type === "progress")).toHaveLength(0);
  expect(
    findAll(app.root, (n) => "data-active-research-stops" in n.props)
      .map(text)
      .join(" "),
  ).toContain("Clock House");
  expect(text(app.root)).toContain("NEW_SERVER_PHASE");
  expect(text(app.root)).not.toContain(
    "preparationProgress.phases.NEW_SERVER_PHASE",
  );
  for (const percent of [-1, 101, Number.NaN, Number.POSITIVE_INFINITY]) {
    app.props.progress = preparationSnapshot({ percent, activity_text: "" });
    await nextTick();
    expect(findAll(app.root, (n) => n.type === "progress")).toHaveLength(0);
  }
  app.props.refreshing = true;
  await nextTick();
  expect(
    findAll(app.root, (n) => "data-research-refreshing" in n.props),
  ).toHaveLength(1);
  app.props.refreshing = false;
  app.props.refreshFailed = true;
  await nextTick();
  expect(
    findAll(app.root, (n) => "data-research-refreshing" in n.props),
  ).toHaveLength(0);
  expect(
    findAll(app.root, (n) => "data-research-refresh-failed" in n.props),
  ).toHaveLength(1);
  expect(
    findAll(app.root, (n) => "data-active-research-stops" in n.props)
      .map(text)
      .join(" "),
  ).toContain("Clock House");
  app.unmount();
});
