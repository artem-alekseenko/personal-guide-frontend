import { afterEach, expect, it, vi } from "vitest";
import { nextTick, ref } from "vue";
import TourPreparationProgress from "../app/components/tour/TourPreparationProgress.vue";
import type { PreparationProgress } from "../shared/types/preparationProgress";
import en from "../i18n/locales/en.json";
import ru from "../i18n/locales/ru.json";
import { findAll, mount, type TestNode } from "./helpers/render";
import { preparationSnapshot } from "./helpers/preparationProgress";

const reducedMotion = ref("no-preference");
vi.mock("@vueuse/core", () => ({
  usePreferredReducedMotion: () => reducedMotion,
}));

const text = (root: TestNode): string =>
  [root.text, ...root.children.map(text)].join(" ");
const translate = (language: "en" | "ru") => (key: string) => {
  let value: unknown = language === "ru" ? ru : en;
  for (const part of key.split("."))
    value =
      value && typeof value === "object" ? Reflect.get(value, part) : undefined;
  return String(value ?? key);
};
const apps: { unmount: () => void }[] = [];
function render(
  snapshot: PreparationProgress,
  language: "en" | "ru" = "en",
  compact = false,
) {
  const app = mount(
    TourPreparationProgress,
    { progress: snapshot, compact },
    {},
    translate(language),
  );
  apps.push(app);
  return app;
}
afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount());
  vi.useRealTimers();
  reducedMotion.value = "no-preference";
});

it.each([false, true])(
  "shows authoritative time, percent and observed activity on compact=%s surfaces",
  async (compact) => {
    vi.useFakeTimers();
    const app = render(preparationSnapshot(), "en", compact);
    expect(text(app.root)).toContain("37%");
    const elapsedBefore = text(
      findAll(app.root, (node) => "data-research-elapsed" in node.props)[0]!,
    );
    expect(text(app.root)).toContain(
      en.preparationProgress.remainingValues.unknown,
    );
    expect(text(app.root)).toContain("Reading a source for Clock House.");
    expect(
      findAll(app.root, (node) => node.type === "progress")[0]!.props,
    ).toMatchObject({
      "aria-label": translate("en")("preparationProgress.progressEstimate"),
      "aria-valuenow": 37,
      "aria-valuemin": "0",
      "aria-valuemax": "100",
    });
    const activity = findAll(
      app.root,
      (node) =>
        node.props.role === "status" && text(node).includes("Reading a source"),
    )[0]!;
    expect(activity.props["aria-live"]).toBe("polite");
    expect(
      findAll(app.root, (node) => node.type === "time").some(
        (node) => node.props.datetime === "2026-10-12T12:02:00Z",
      ),
    ).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(
      text(
        findAll(app.root, (node) => "data-research-elapsed" in node.props)[0]!,
      ),
    ).toBe(elapsedBefore);
    expect(
      findAll(app.root, (node) => node.type === "progress")[0]!.props[
        "aria-valuenow"
      ],
    ).toBe(37);
    app.props.progress = preparationSnapshot({
      elapsed_seconds: 190,
      percent: 48,
      activity_text: "Checking the submitted research for Clock House.",
      claims_count: 34,
    });
    await nextTick();
    expect(text(app.root)).toContain("37%");
    for (let percent = 38; percent <= 48; percent++) {
      await vi.advanceTimersByTimeAsync(80);
      expect(
        findAll(app.root, (node) => node.type === "progress")[0]!.props.value,
      ).toBe(percent);
      expect(text(app.root)).toContain(percent + "%");
    }
    expect(text(app.root)).toContain("Checking the submitted research");
    expect(text(app.root)).toContain("34");
  },
);

it.each(["estimate", "deadline"] as const)(
  "distinguishes %s remaining time from a promised completion",
  (kind) => {
    const app = render(
      preparationSnapshot({ remaining_seconds: 95, remaining_time_kind: kind }),
    );
    expect(text(app.root)).toContain(
      en.preparationProgress.remainingLabels[kind],
    );
    expect(text(app.root)).toContain(
      en.preparationProgress.remainingNotices[kind],
    );
    const other = kind === "deadline" ? "estimate" : "deadline";
    expect(text(app.root)).not.toContain(
      en.preparationProgress.remainingLabels[other],
    );
  },
);

it("does not derive approved facts or available stories from completed processing", () => {
  const app = render(
    preparationSnapshot({
      status: "READY",
      phase: "PUBLICATION",
      percent: 100,
      elapsed_seconds: 3661,
      remaining_seconds: 0,
      remaining_time_kind: "complete",
      activity_text: "Generation processing has completed.",
      active_researchers: 0,
      sources_count: 0,
      claims_count: 0,
      word_count: 0,
      completed_stops: 0,
      stops: [],
    }),
  );
  expect(text(app.root)).toContain("100%");
  expect(text(app.root)).toContain(
    en.preparationProgress.remainingValues.complete,
  );
  expect(text(app.root)).toContain(en.preparationProgress.completionNotice);
  expect(text(app.root)).not.toContain(
    en.preparationProgress.remainingLabels.estimate,
  );
  expect(text(app.root)).not.toContain(
    en.preparationProgress.remainingLabels.deadline,
  );
  const savedFacts = findAll(
    app.root,
    (node) =>
      node.type === "div" &&
      node.children.some(
        (child) => text(child) === en.preparationProgress.metrics.claims_count,
      ),
  )[0]!;
  expect(savedFacts.children.find((node) => node.type === "dd")!.text).toBe(
    "0",
  );
});

it("keeps the backend research estimate on a failed generation rather than forcing completion", () => {
  const percent = 48;
  const app = render(
    preparationSnapshot({
      status: "FAILED",
      phase: "RESEARCH",
      percent,
      remaining_seconds: 0,
      remaining_time_kind: "complete",
      error: "Research deadline reached.",
    }),
  );
  expect(
    findAll(app.root, (node) => node.type === "progress")[0]!.props[
      "aria-valuenow"
    ],
  ).toBe(percent);
  expect(text(app.root)).not.toContain("100%");
  expect(
    findAll(app.root, (node) => node.props.role === "alert")
      .map(text)
      .join(" "),
  ).toContain("Research deadline reached.");
});

it("shows Russian labels with the selected-language activity without translating it locally", () => {
  const app = render(
    preparationSnapshot({
      activity_text: "Читаем источник об остановке Clock House.",
      remaining_seconds: 65,
      remaining_time_kind: "deadline",
    }),
    "ru",
  );
  expect(text(app.root)).toContain(ru.preparationProgress.elapsed);
  expect(text(app.root)).toContain(
    ru.preparationProgress.remainingLabels.deadline,
  );
  expect(text(app.root)).toContain(
    ru.preparationProgress.remainingNotices.deadline,
  );
  expect(text(app.root)).toContain("Читаем источник об остановке Clock House.");
  expect(
    findAll(app.root, (node) => node.type === "progress")[0]!.props[
      "aria-label"
    ],
  ).toBe(translate("ru")("preparationProgress.progressEstimate"));
});

it.each(["en", "ru"] as const)(
  "shows model, recorded and fallback origins transparently in %s",
  async (language) => {
    const labels =
      language === "ru" ? ru.preparationProgress : en.preparationProgress;
    const app = render(
      preparationSnapshot({ activity_source: "llm" }),
      language,
    );
    expect(text(app.root)).toContain(labels.activitySources.llm);
    expect(
      findAll(app.root, (node) => node.props["data-activity-source"] === "llm"),
    ).toHaveLength(1);
    app.props.progress = preparationSnapshot({ activity_source: "recorded" });
    await nextTick();
    expect(text(app.root)).toContain(labels.activitySources.recorded);
    expect(text(app.root)).not.toContain(labels.activitySources.llm);
    app.props.progress = preparationSnapshot({
      activity_source: "fallback",
      activity_fallback_reason: "budget_unavailable",
    });
    await nextTick();
    expect(text(app.root)).toContain(labels.activitySources.fallback);
    expect(text(app.root)).toContain(labels.captionFallbacks.budget);
    expect(text(app.root)).not.toContain(labels.activitySources.llm);
  },
);

it("does not expose provider error details or claim repeated fallback wording was freshly generated", () => {
  const app = render(
    preparationSnapshot({
      activity_source: "fallback",
      activity_fallback_reason: "provider_error_secret",
    }),
  );
  expect(text(app.root)).toContain(
    en.preparationProgress.captionFallbacks.unavailable,
  );
  expect(text(app.root)).not.toContain("provider_error_secret");
  const repeated = render(
    preparationSnapshot({
      activity_source: "fallback",
      activity_fallback_reason: "repeated_output",
    }),
  );
  expect(text(repeated.root)).toContain(
    en.preparationProgress.captionFallbacks.wording,
  );
  expect(text(repeated.root)).not.toContain(
    en.preparationProgress.activitySources.llm,
  );
});

it("keeps numbers visible under uncertainty and offers only explicit same-request reconciliation", async () => {
  const refresh = vi.fn();
  const app = mount(
    TourPreparationProgress,
    {
      progress: preparationSnapshot({ activity_source: "recorded" }),
      captionUncertain: true,
      refreshing: false,
      onRefresh: refresh,
    },
    {},
    translate("en"),
  );
  apps.push(app);
  expect(text(app.root)).toContain(en.preparationProgress.captionUncertain);
  expect(text(app.root)).toContain("37%");
  const button = findAll(
    app.root,
    (node) => "data-refresh-progress" in node.props,
  )[0]!;
  expect(text(button)).toContain(en.preparationProgress.reconcileCaption);
  button.props.onClick();
  expect(refresh).toHaveBeenCalledTimes(1);
  app.props.refreshing = true;
  await nextTick();
  expect(
    findAll(app.root, (node) => "data-refresh-progress" in node.props)[0]!.props
      .disabled,
  ).toBe(true);
});

it.each([false, true])(
  "shows basic phase and percentage but no enhanced fields in compact=%s when rich progress is disabled",
  (compact) => {
    const snapshot = preparationSnapshot({
      rich_progress_enabled: false,
      activity_source: "llm",
      activity_model: "small-status-model",
      research_spend: {
        limit_micros: 1000000,
        spent_micros: 10,
        reserved_micros: 10,
        remaining_micros: 999980,
      },
    });
    const app = mount(
      TourPreparationProgress,
      {
        progress: snapshot,
        compact,
        captionUncertain: true,
      },
      {},
      translate("en"),
    );
    apps.push(app);
    expect(text(app.root)).toContain(en.preparationProgress.phases.RESEARCH);
    expect(text(app.root)).toContain("37%");
    expect(findAll(app.root, (node) => node.type === "progress")).toHaveLength(
      1,
    );
    expect(
      findAll(
        app.root,
        (node) =>
          "data-research-elapsed" in node.props ||
          "data-remaining-kind" in node.props ||
          "data-research-activity" in node.props ||
          "data-research-counters" in node.props ||
          "data-caption-uncertain" in node.props ||
          "data-activity-source" in node.props ||
          node.type === "details",
      ),
    ).toHaveLength(0);
    expect(text(app.root)).not.toContain(snapshot.activity_text);
    expect(text(app.root)).not.toContain(en.preparationProgress.spendTitle);
    expect(text(app.root)).not.toContain(
      en.preparationProgress.activitySources.llm,
    );
    const button = findAll(
      app.root,
      (node) => "data-refresh-progress" in node.props,
    )[0]!;
    expect(text(button)).toContain(en.preparationProgress.refresh);
    expect(text(button)).not.toContain(en.preparationProgress.reconcileCaption);
  },
);

it("renders enhanced fields only for an explicitly rich-enabled snapshot", () => {
  const app = render(
    preparationSnapshot({
      rich_progress_enabled: true,
      activity_source: "recorded",
    }),
  );
  expect(
    findAll(app.root, (node) => "data-research-elapsed" in node.props),
  ).toHaveLength(1);
  expect(
    findAll(app.root, (node) => "data-research-activity" in node.props),
  ).toHaveLength(1);
  expect(text(app.root)).toContain(
    en.preparationProgress.activitySources.recorded,
  );
});

const displayedPercent = (root: TestNode) =>
  findAll(root, (node) => node.type === "progress")[0]?.props.value;

it("animates every percentage from zero to 100 only as the server permits", async () => {
  vi.useFakeTimers();
  const app = render(preparationSnapshot({ percent: 0 }));
  expect(displayedPercent(app.root)).toBe(0);
  for (const target of [15, 35, 70, 85, 95, 99]) {
    const previous = displayedPercent(app.root);
    app.props.progress = preparationSnapshot({ percent: target });
    await nextTick();
    expect(displayedPercent(app.root)).toBe(previous);
    for (let value = previous + 1; value <= target; value++) {
      await vi.advanceTimersByTimeAsync(80);
      expect(displayedPercent(app.root)).toBe(value);
    }
  }
  await vi.advanceTimersByTimeAsync(60_000);
  expect(displayedPercent(app.root)).toBe(99);
  app.props.progress = preparationSnapshot({ percent: 100, status: "READY" });
  await nextTick();
  await vi.advanceTimersByTimeAsync(80);
  expect(displayedPercent(app.root)).toBe(100);
});

it.each(["FAILED", "CANCELLED"] as const)(
  "stops an in-flight animation immediately when preparation is %s",
  async (status) => {
    vi.useFakeTimers();
    const app = render(preparationSnapshot({ percent: 40 }));
    app.props.progress = preparationSnapshot({ percent: 95 });
    await nextTick();
    await vi.advanceTimersByTimeAsync(160);
    expect(displayedPercent(app.root)).toBe(42);
    app.props.progress = preparationSnapshot({ percent: 95, status });
    await nextTick();
    expect(displayedPercent(app.root)).toBe(95);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(displayedPercent(app.root)).toBe(95);
    expect(vi.getTimerCount()).toBe(0);
  },
);

it("replaces the target during animation without skipping a percentage", async () => {
  vi.useFakeTimers();
  const app = render(preparationSnapshot({ percent: 15 }));
  app.props.progress = preparationSnapshot({ percent: 40 });
  await nextTick();
  await vi.advanceTimersByTimeAsync(160);
  expect(displayedPercent(app.root)).toBe(17);
  app.props.progress = preparationSnapshot({ percent: 70 });
  await nextTick();
  await vi.advanceTimersByTimeAsync(80);
  expect(displayedPercent(app.root)).toBe(18);
  await vi.advanceTimersByTimeAsync(52 * 80);
  expect(displayedPercent(app.root)).toBe(70);
  expect(vi.getTimerCount()).toBe(0);
});

it("resets immediately for another generation and clears timers on disposal", async () => {
  vi.useFakeTimers();
  const app = render(preparationSnapshot({ percent: 85 }));
  app.props.progress = preparationSnapshot({ percent: 95 });
  await nextTick();
  app.props.progress = preparationSnapshot({
    generation_id: "new-generation",
    percent: 0,
  });
  await nextTick();
  await vi.advanceTimersByTimeAsync(1000);
  expect(displayedPercent(app.root)).toBe(0);
  app.props.progress = preparationSnapshot({
    generation_id: "new-generation",
    percent: 15,
  });
  await nextTick();
  expect(vi.getTimerCount()).toBe(1);
  app.unmount();
  apps.pop();
  expect(vi.getTimerCount()).toBe(0);
});

it.each([undefined, NaN, Infinity, -1, 101])(
  "stops the animation and renders unknown for invalid percent %s",
  async (percent) => {
    vi.useFakeTimers();
    const app = render(preparationSnapshot({ percent: 15 }));
    app.props.progress = preparationSnapshot({ percent: 40 });
    await nextTick();
    app.props.progress = preparationSnapshot({ percent });
    await nextTick();
    expect(displayedPercent(app.root)).toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  },
);

it("does not show 100 while the server still reports running", () => {
  const app = render(preparationSnapshot({ percent: 100 }));
  expect(displayedPercent(app.root)).toBe(99);
});

it("honors reduced motion immediately, including a preference change mid-animation", async () => {
  vi.useFakeTimers();
  const app = render(preparationSnapshot({ percent: 15 }));
  app.props.progress = preparationSnapshot({ percent: 40 });
  await nextTick();
  await vi.advanceTimersByTimeAsync(80);
  expect(displayedPercent(app.root)).toBe(16);
  reducedMotion.value = "reduce";
  await nextTick();
  expect(displayedPercent(app.root)).toBe(40);
  expect(vi.getTimerCount()).toBe(0);
  app.props.progress = preparationSnapshot({ percent: 70 });
  await nextTick();
  expect(displayedPercent(app.root)).toBe(70);
});

it("applies corrected server progress without animating backwards", async () => {
  vi.useFakeTimers();
  const app = render(preparationSnapshot({ percent: 70 }));
  app.props.progress = preparationSnapshot({ percent: 35 });
  await nextTick();
  expect(displayedPercent(app.root)).toBe(35);
  expect(vi.getTimerCount()).toBe(0);
});
