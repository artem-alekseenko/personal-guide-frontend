import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { effectScope, nextTick, shallowRef, type EffectScope } from "vue";
import { useTourPreparationProgress } from "../app/composables/tour/useTourPreparationProgress";
import TourPreparationProgress from "../app/components/tour/TourPreparationProgress.vue";
import type { PreparationProgress } from "../shared/types/preparationProgress";
import {
  preparationDetail,
  preparationSnapshot,
} from "./helpers/preparationProgress";
import { findAll, mount, type TestNode } from "./helpers/render";
import en from "../i18n/locales/en.json";
import ru from "../i18n/locales/ru.json";
import RoutePlacesPanel from "../app/components/tour/RoutePlacesPanel.vue";
import type { PublicMapSubject } from "../app/types/routeDiscovery";

const fetch = vi.fn();
const scopes: EffectScope[] = [];
const apps: { unmount: () => void }[] = [];
let visibility = "visible";
let onVisibility: () => void;
let latest: PreparationProgress;
const text = (node: TestNode): string =>
  [node.text, ...node.children.map(text)].join(" ");
const translate = (key: string) => {
  let value: unknown = en;
  for (const part of key.split("."))
    value =
      value && typeof value === "object" ? Reflect.get(value, part) : undefined;
  return String(value ?? key);
};
const money = (micros: number) =>
  (micros / 1_000_000).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
async function flush() {
  for (let step = 0; step < 24; step++) await Promise.resolve();
}
function consumer() {
  const tour = shallowRef({
    id: "tour",
    user_id: "backend-owner",
    latest_generation_id: latest.generation_id,
    preparation_progress: latest,
  });
  const account = shallowRef<string | null>("firebase-owner");
  const onscreen = shallowRef(true);
  const scope = effectScope();
  scopes.push(scope);
  const state = scope.run(() =>
    useTourPreparationProgress(tour, account, shallowRef("en"), {
      visible: onscreen,
    }),
  )!;
  return { state, onscreen, account, tour };
}
beforeEach(() => {
  vi.useFakeTimers();
  latest = preparationSnapshot();
  visibility = "visible";
  const stored = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  });
  vi.stubGlobal("document", {
    get visibilityState() {
      return visibility;
    },
    addEventListener: (_event: string, callback: () => void) => {
      onVisibility = callback;
    },
    removeEventListener: vi.fn(),
  });
  fetch
    .mockReset()
    .mockImplementation(() => Promise.resolve(preparationDetail(latest)));
  Object.assign(globalThis, { useNuxtApp: () => ({ $apiFetch: fetch }) });
});
afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount());
  scopes.splice(0).forEach((scope) => scope.stop());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("reads fresh factual snapshots once a second without automatically purchasing captions", async () => {
  const app = consumer();
  await flush();
  expect(fetch).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(999);
  expect(fetch).toHaveBeenCalledTimes(1);
  latest = preparationSnapshot({
    turns_started: 8,
    turns_completed: 6,
    updated_at: "2026-10-12T12:02:01Z",
    elapsed_seconds: 126,
  });
  await vi.advanceTimersByTimeAsync(1);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(app.state.progress.value?.turns_completed).toBe(6);
  expect(
    fetch.mock.calls.every(([, options]) => options.method !== "POST"),
  ).toBe(true);
});

it("stops factual polling offscreen, while hidden, and after a terminal snapshot", async () => {
  const app = consumer();
  await flush();
  app.onscreen.value = false;
  await vi.advanceTimersByTimeAsync(5000);
  expect(fetch).toHaveBeenCalledTimes(1);
  app.onscreen.value = true;
  await flush();
  expect(fetch).toHaveBeenCalledTimes(2);
  visibility = "hidden";
  onVisibility();
  await vi.advanceTimersByTimeAsync(5000);
  expect(fetch).toHaveBeenCalledTimes(2);
  latest = preparationSnapshot({
    status: "FAILED",
    percent: 48,
    updated_at: "2026-10-12T12:02:10Z",
  });
  visibility = "visible";
  onVisibility();
  await flush();
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(app.state.progress.value?.status).toBe("FAILED");
  expect(app.state.progress.value?.percent).toBe(48);
  await vi.advanceTimersByTimeAsync(5000);
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(
    fetch.mock.calls.every(([, options]) => options.method !== "POST"),
  ).toBe(true);
});

it.each([false, true])(
  "shows actual turns and distinct money values outside disclosures, compact=%s",
  async (compact) => {
    const snapshot = preparationSnapshot({
      research_spend: {
        limit_micros: 1_000_000,
        spent_micros: 120345,
        reserved_micros: 10000,
        remaining_micros: 869655,
      },
    });
    const app = mount(
      TourPreparationProgress,
      { progress: snapshot, compact },
      {},
      translate,
    );
    apps.push(app);
    const summary = () =>
      findAll(
        app.root,
        (node) => "data-live-research-summary" in node.props,
      )[0]!;
    expect(summary()).toBeDefined();
    for (let node: TestNode | undefined = summary(); node; node = node.parent)
      expect(node.type).not.toBe("details");
    const counter = (field: string) =>
      text(
        findAll(
          summary(),
          (node) => node.props["data-live-research-counter"] === field,
        )[0]!,
      );
    const spend = (field: string) =>
      text(
        findAll(
          summary(),
          (node) => node.props["data-live-research-spend"] === field,
        )[0]!,
      );
    expect(counter("turns_started")).toBe("7");
    expect(counter("turns_completed")).toBe("5");
    expect(counter("tool_calls_completed")).toBe("9");
    expect(spend("spent_micros")).toBe(money(120345));
    expect(spend("reserved_micros")).toBe(money(10000));
    expect(spend("remaining_micros")).toBe(money(869655));
    app.props.progress = preparationSnapshot({
      phase: "REVIEW",
      turns_started: 9,
      turns_completed: 8,
      tool_calls_completed: 11,
      research_spend: {
        limit_micros: 1_000_000,
        spent_micros: 130345,
        reserved_micros: 0,
        remaining_micros: 869655,
      },
    });
    await nextTick();
    expect(counter("turns_started")).toBe("9");
    expect(counter("turns_completed")).toBe("8");
    expect(counter("tool_calls_completed")).toBe("11");
    expect(spend("spent_micros")).toBe(money(130345));
    expect(spend("reserved_micros")).toBe(money(0));
    expect(text(summary())).toContain(en.preparationProgress.phases.REVIEW);
    await vi.advanceTimersByTimeAsync(5000);
    expect(counter("turns_completed")).toBe("8");
    expect(spend("spent_micros")).toBe(money(130345));
  },
);

it("keeps unavailable spending unknown rather than inventing a zero or a budget", () => {
  const app = mount(
    TourPreparationProgress,
    { progress: preparationSnapshot(), compact: true },
    {},
    translate,
  );
  apps.push(app);
  const summary = findAll(
    app.root,
    (node) => "data-live-research-summary" in node.props,
  )[0]!;
  expect(summary).toBeDefined();
  expect(
    findAll(summary, (node) => "data-live-research-spend" in node.props),
  ).toHaveLength(0);
  expect(text(summary)).not.toContain(money(0));
});

it.each([en, ru])(
  "renders the unverified research status with an explicit localized qualification",
  (messages) => {
    const place: PublicMapSubject = {
      id: "public-place",
      name: "Clock House",
      lat: "47",
      lng: "19",
      source: "osm",
      source_id: "node/1",
      types: [],
      address: null,
      research_status: "UNVERIFIED_INFORMATION",
      unverified_claim_count: 3,
    };
    const t = (key: string) => {
      let value: unknown = messages;
      for (const part of key.split("."))
        value =
          value && typeof value === "object"
            ? Reflect.get(value, part)
            : undefined;
      return String(value ?? key);
    };
    const app = mount(RoutePlacesPanel, { places: [place] }, {}, t);
    apps.push(app);
    expect(text(app.root)).toContain(
      messages.routePlaces.research.UNVERIFIED_INFORMATION,
    );
    expect(text(app.root)).not.toContain(
      "routePlaces.research.UNVERIFIED_INFORMATION",
    );
    expect(text(app.root)).not.toContain(
      messages.routePlaces.research.SOURCE_BACKED,
    );
  },
);
