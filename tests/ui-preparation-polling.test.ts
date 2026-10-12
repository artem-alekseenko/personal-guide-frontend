import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { effectScope, shallowRef, type EffectScope } from "vue";
import { createPinia, setActivePinia } from "pinia";
import type { PreparationProgress } from "../shared/types/preparationProgress";
import type { GenerationDetail } from "../shared/types/researchLifecycle";
import { useTourPreparationProgress } from "../app/composables/tour/useTourPreparationProgress";
import TourPreparationProgress from "../app/components/tour/TourPreparationProgress.vue";
import { findAll, mount } from "./helpers/render";
import {
  preparationDetail,
  preparationSnapshot,
} from "./helpers/preparationProgress";

const fetch = vi.fn();
const scopes: EffectScope[] = [];
let visibility = "visible";
let visibilityChanged: () => void;
const current = (
  snapshot = preparationSnapshot(),
  owner = "backend-owner",
  id = "tour",
) => ({
  id,
  user_id: owner,
  latest_generation_id: snapshot.generation_id,
  preparation_progress: snapshot,
});
function consumer(snapshot = preparationSnapshot(), visible = true) {
  const tour = shallowRef(current(snapshot));
  const account = shallowRef<string | null>("firebase-owner");
  const language = shallowRef("en");
  const onscreen = shallowRef(visible);
  const scope = effectScope();
  scopes.push(scope);
  const state = scope.run(() =>
    useTourPreparationProgress(tour, account, language, { visible: onscreen }),
  )!;
  return { state, tour, account, language, onscreen, scope };
}
function pendingDetail() {
  let resolve!: (value: GenerationDetail) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<GenerationDetail>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
async function flush() {
  for (let step = 0; step < 24; step++) await Promise.resolve();
}
const posts = () =>
  fetch.mock.calls.filter(([, options]) => options.method === "POST");
const reads = () => fetch.mock.calls.filter(([, options]) => !options.method);
function generated(patch: Partial<PreparationProgress> = {}) {
  return preparationDetail(
    preparationSnapshot({
      activity_text: "Reviewing the recorded source text for Clock House.",
      activity_source: "llm",
      activity_model: "small-status-model",
      activity_generated_at: "2026-10-12T12:02:05Z",
      ...patch,
    }),
  );
}
beforeEach(() => {
  vi.useFakeTimers();
  fetch.mockReset();
  visibility = "visible";
  const stored = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => {
      stored.set(key, value);
    },
    removeItem: (key: string) => {
      stored.delete(key);
    },
  });
  vi.stubGlobal("document", {
    get visibilityState() {
      return visibility;
    },
    addEventListener: (_event: string, callback: () => void) => {
      visibilityChanged = callback;
    },
    removeEventListener: vi.fn(),
  });
  Object.assign(globalThis, { useNuxtApp: () => ({ $apiFetch: fetch }) });
  fetch.mockImplementation((_path, options) =>
    Promise.resolve(
      options.method === "POST" ? generated() : preparationDetail(),
    ),
  );
});
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("consumes real status POST results on initial, scheduled and manual visible refreshes", async () => {
  const app = consumer();
  await flush();
  expect(app.state.progress.value).toMatchObject({
    activity_source: "llm",
    activity_model: "small-status-model",
    percent: 37,
    elapsed_seconds: 125,
  });
  expect(posts()).toHaveLength(1);
  expect(posts()[0]![0]).toBe(
    "/api/tour-generations/tour/generation-1/progress-message",
  );
  expect(posts()[0]![1]).toMatchObject({
    method: "POST",
    retry: 0,
    body: {
      lang: "en",
      message_variant: 0,
      previous_activity_text: "Reading a source for Clock House.",
    },
  });
  await vi.advanceTimersByTimeAsync(5000);
  await app.state.refresh();
  expect(posts().map(([, options]) => options.body.message_variant)).toEqual([
    0, 1, 2,
  ]);
  expect(
    new Set(posts().map(([, options]) => options.headers["Idempotency-Key"]))
      .size,
  ).toBe(3);
  expect(reads()).toHaveLength(3);
  expect(fetch.mock.calls.every(([, options]) => options.retry === 0)).toBe(
    true,
  );
  expect(app.tour.value.preparation_progress.activity_text).toBe(
    "Reading a source for Clock House.",
  );
});

it("keeps canonical numbers when a caption response contains different numbers", async () => {
  fetch.mockImplementation((_path, options) =>
    Promise.resolve(
      options.method === "POST"
        ? generated({
            percent: 99,
            elapsed_seconds: 999,
            claims_count: 500,
            remaining_seconds: 1,
          })
        : preparationDetail(),
    ),
  );
  const app = consumer();
  await flush();
  expect(app.state.progress.value).toMatchObject({
    activity_source: "llm",
    percent: 37,
    elapsed_seconds: 125,
    claims_count: 0,
    remaining_seconds: null,
  });
});

it.each(["budget_unavailable", "unsafe_output", "repeated_output"])(
  "preserves truthful fallback metadata for %s",
  async (reason) => {
    fetch.mockImplementation((_path, options) =>
      Promise.resolve(
        options.method === "POST"
          ? generated({
              activity_text: "Recorded source work continues.",
              activity_source: "fallback",
              activity_model: null,
              activity_generated_at: null,
              activity_fallback_reason: reason,
            })
          : preparationDetail(),
      ),
    );
    const app = consumer();
    await flush();
    expect(app.state.progress.value).toMatchObject({
      activity_source: "fallback",
      activity_fallback_reason: reason,
      activity_model: null,
      activity_generated_at: null,
    });
    expect(app.state.captionUncertain.value).toBe(false);
  },
);

it("retains immutable key/body after a lost response, polls numbers cheaply, and manually reconciles the same request", async () => {
  const app = consumer();
  fetch.mockImplementation((_path, options) =>
    options.method === "POST"
      ? Promise.reject(new Error("response lost"))
      : Promise.resolve(preparationDetail()),
  );
  await flush();
  expect(app.state.captionUncertain.value).toBe(true);
  const original = posts()[0]![1];
  app.tour.value = current(
    preparationSnapshot({
      percent: 58,
      elapsed_seconds: 150,
      updated_at: "2026-10-12T12:02:30Z",
    }),
  );
  fetch.mockImplementation((_path, options) =>
    Promise.resolve(
      options.method === "POST"
        ? generated()
        : preparationDetail(app.tour.value.preparation_progress),
    ),
  );
  await vi.advanceTimersByTimeAsync(15000);
  expect(posts()).toHaveLength(1);
  expect(reads()).toHaveLength(4);
  expect(app.state.progress.value).toMatchObject({
    percent: 58,
    elapsed_seconds: 150,
  });
  await app.state.refresh();
  expect(posts()[1]![1].headers).toEqual(original.headers);
  expect(posts()[1]![1].body).toEqual(original.body);
  expect(app.state.captionUncertain.value).toBe(false);
  await vi.advanceTimersByTimeAsync(5000);
  expect(posts()).toHaveLength(3);
  expect(posts()[2]![1].headers).not.toEqual(original.headers);
});

it.each([
  "request_in_progress",
  "request_uncertain",
  "receipt_uncertain",
  "idempotency_conflict",
  "provider_unavailable",
])("does not treat %s fallback as a settled operation", async (reason) => {
  fetch.mockImplementation((_path, options) =>
    Promise.resolve(
      options.method === "POST"
        ? generated({
            activity_source: "fallback",
            activity_fallback_reason: reason,
          })
        : preparationDetail(),
    ),
  );
  const app = consumer();
  await flush();
  expect(app.state.captionUncertain.value).toBe(true);
  const uuid = vi.spyOn(crypto, "randomUUID");
  await vi.advanceTimersByTimeAsync(15000);
  expect(posts()).toHaveLength(1);
  expect(reads()).toHaveLength(4);
  expect(uuid).not.toHaveBeenCalled();
  const original = posts()[0]![1];
  await app.state.refresh();
  expect(posts()[1]![1].headers).toEqual(original.headers);
  expect(posts()[1]![1].body).toEqual(original.body);
  expect(uuid).not.toHaveBeenCalled();
});

it("shares simultaneous list/detail requests and retains uncertain receipt across remounts", async () => {
  const request = pendingDetail();
  fetch.mockImplementation((_path, options) =>
    options.method === "POST"
      ? request.promise
      : Promise.resolve(preparationDetail()),
  );
  const first = consumer();
  const second = consumer();
  await flush();
  expect(posts()).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(10000);
  expect(posts()).toHaveLength(1);
  request.reject(new Error("lost"));
  await flush();
  first.scope.stop();
  second.scope.stop();
  const remounted = consumer();
  await flush();
  expect(remounted.state.captionUncertain.value).toBe(true);
  expect(posts()).toHaveLength(1);
  const original = posts()[0]![1];
  fetch.mockImplementation((_path, options) =>
    Promise.resolve(
      options.method === "POST" ? generated() : preparationDetail(),
    ),
  );
  await remounted.state.refresh();
  expect(posts()[1]![1].headers).toEqual(original.headers);
  expect(posts()[1]![1].body).toEqual(original.body);
});

it("does not overlap factual reads or caption calls in one consumer", async () => {
  const read = pendingDetail();
  fetch.mockReturnValueOnce(read.promise);
  const app = consumer();
  await app.state.refresh();
  await vi.advanceTimersByTimeAsync(20000);
  expect(fetch).toHaveBeenCalledTimes(1);
  read.resolve(preparationDetail());
  await flush();
  expect(posts()).toHaveLength(1);
});

it.each(["hidden", "offscreen"])(
  "does not issue paid polling while %s and refreshes on return",
  async (kind) => {
    if (kind === "hidden") visibility = "hidden";
    const app = consumer(preparationSnapshot(), kind !== "offscreen");
    await vi.advanceTimersByTimeAsync(20000);
    expect(fetch).not.toHaveBeenCalled();
    if (kind === "hidden") {
      visibility = "visible";
      visibilityChanged();
    } else app.onscreen.value = true;
    await flush();
    expect(posts()).toHaveLength(1);
    if (kind === "hidden") {
      visibility = "hidden";
      visibilityChanged();
    } else app.onscreen.value = false;
    await vi.advanceTimersByTimeAsync(20000);
    expect(posts()).toHaveLength(1);
  },
);

it("does not start a caption if the consumer becomes hidden while GET is pending", async () => {
  const request = pendingDetail();
  fetch.mockReturnValueOnce(request.promise);
  const app = consumer();
  app.onscreen.value = false;
  request.resolve(preparationDetail());
  await flush();
  expect(posts()).toHaveLength(0);
  expect(app.state.progress.value?.percent).toBe(37);
});

it.each(["phase", "stop", "activity"])(
  "does not relabel changed %s work with a late caption",
  async (change) => {
    const caption = pendingDetail();
    fetch.mockImplementation((_path, options) =>
      options.method === "POST"
        ? caption.promise
        : Promise.resolve(preparationDetail()),
    );
    const app = consumer();
    await flush();
    const newer = preparationSnapshot({
      percent: 58,
      elapsed_seconds: 150,
      updated_at: "2026-10-12T12:02:30Z",
    });
    if (change === "phase") newer.phase = "REVIEW";
    if (change === "stop")
      newer.stops = newer.stops.map((stop) => ({
        ...stop,
        phase: "SEARCHING",
      }));
    if (change === "activity") newer.activity_updated_at = newer.updated_at;
    app.tour.value = current(newer);
    caption.resolve(generated());
    await flush();
    expect(app.state.progress.value).toMatchObject({
      percent: 58,
      elapsed_seconds: 150,
    });
    expect(app.state.progress.value?.activity_source).not.toBe("llm");
    expect(app.state.progress.value?.activity_text).toBeUndefined();
  },
);

it.each(["owner", "tour", "generation", "language"])(
  "fences a late caption after %s changes",
  async (change) => {
    const caption = pendingDetail();
    fetch.mockImplementation((_path, options) =>
      options.method === "POST"
        ? caption.promise
        : Promise.resolve(preparationDetail()),
    );
    const app = consumer();
    await flush();
    fetch.mockImplementation((_path, options) =>
      options.method === "POST"
        ? Promise.reject(new Error("unconfirmed"))
        : Promise.resolve(
            preparationDetail(app.tour.value.preparation_progress, {
              tour_id: app.tour.value.id,
              owner_id: app.tour.value.user_id,
            }),
          ),
    );
    if (change === "owner") {
      app.account.value = "other-firebase-owner";
      expect(app.state.progress.value).toBeNull();
      app.tour.value = current(preparationSnapshot(), "other-backend-owner");
    }
    if (change === "tour")
      app.tour.value = current(
        preparationSnapshot(),
        "backend-owner",
        "another-tour",
      );
    if (change === "generation")
      app.tour.value = current(
        preparationSnapshot({ generation_id: "generation-2", phase: "PLAN" }),
      );
    if (change === "language") app.language.value = "ru";
    caption.resolve(generated());
    await flush();
    expect(app.state.progress.value?.activity_source).not.toBe("llm");
    expect(app.state.progress.value?.activity_text).not.toBe(
      generated().progress?.activity_text,
    );
  },
);

it("retains the old-language uncertain body until manual reconciliation, never silently making a new key", async () => {
  fetch.mockImplementation((_path, options) =>
    options.method === "POST"
      ? Promise.reject(new Error("lost"))
      : Promise.resolve(preparationDetail()),
  );
  const app = consumer();
  await flush();
  const original = posts()[0]![1];
  app.language.value = "ru";
  await flush();
  expect(posts()).toHaveLength(1);
  fetch.mockImplementation((_path, options) =>
    Promise.resolve(
      options.method === "POST"
        ? generated()
        : preparationDetail(
            preparationSnapshot({
              activity_text: "Читаем записанный источник.",
            }),
          ),
    ),
  );
  await app.state.refresh();
  expect(posts()[1]![1].body).toEqual(original.body);
  expect(posts()[1]![1].headers).toEqual(original.headers);
  expect(app.state.progress.value?.activity_text).toBe(
    "Читаем записанный источник.",
  );
  expect(app.state.progress.value?.activity_source).toBe("recorded");
  await vi.advanceTimersByTimeAsync(5000);
  expect(posts()[2]![1].body.lang).toBe("ru");
});

it.each(["owner", "generation", "source"])(
  "keeps factual metrics but uncertainty after invalid caption %s",
  async (mismatch) => {
    const bad = generated();
    if (mismatch === "owner") bad.generation.owner_id = "wrong-owner";
    if (mismatch === "generation")
      bad.progress!.generation_id = "wrong-generation";
    if (mismatch === "source") delete bad.progress!.activity_source;
    fetch.mockImplementation((_path, options) =>
      Promise.resolve(options.method === "POST" ? bad : preparationDetail()),
    );
    const app = consumer();
    await flush();
    expect(app.state.captionUncertain.value).toBe(true);
    expect(app.state.progress.value).toMatchObject({
      percent: 37,
      elapsed_seconds: 125,
      activity_source: "recorded",
    });
    await vi.advanceTimersByTimeAsync(10000);
    expect(posts()).toHaveLength(1);
  },
);

it("keeps timer refreshes alive while frequent source snapshots update numeric facts", async () => {
  const app = consumer();
  await flush();
  for (let step = 1; step <= 6; step++) {
    await vi.advanceTimersByTimeAsync(1000);
    app.tour.value = current(
      preparationSnapshot({
        elapsed_seconds: 125 + step,
        updated_at: `2026-10-12T12:02:0${step}Z`,
      }),
    );
  }
  expect(reads()).toHaveLength(2);
  expect(posts()).toHaveLength(2);
  expect(app.state.progress.value?.elapsed_seconds).toBe(131);
});

it.each(["READY", "FAILED", "CANCELLED"] as const)(
  "keeps %s factual without paid terminal polling or invented success",
  async (status) => {
    const terminal = preparationSnapshot({
      status,
      percent: status === "READY" ? 100 : 48,
      phase: "PUBLICATION",
      remaining_time_kind: "complete",
      claims_count: 0,
    });
    fetch.mockResolvedValue(preparationDetail(terminal));
    const app = consumer();
    await flush();
    expect(app.state.progress.value).toMatchObject({
      status,
      percent: terminal.percent,
      claims_count: 0,
      activity_source: "recorded",
    });
    await vi.advanceTimersByTimeAsync(60000);
    expect(reads()).toHaveLength(1);
    expect(posts()).toHaveLength(0);
    await app.state.refresh();
    expect(posts()).toHaveLength(0);
  },
);

it("does not regress numeric facts from older GET/list snapshots and stops on disposal", async () => {
  const app = consumer();
  await flush();
  const latest = preparationSnapshot({
    percent: 58,
    elapsed_seconds: 150,
    updated_at: "2026-10-12T12:02:30Z",
  });
  app.tour.value = current(latest);
  app.tour.value = current(preparationSnapshot());
  await vi.advanceTimersByTimeAsync(5000);
  expect(app.state.progress.value).toMatchObject({
    percent: 58,
    elapsed_seconds: 150,
  });
  const before = fetch.mock.calls.length;
  app.scope.stop();
  await vi.advanceTimersByTimeAsync(60000);
  expect(fetch).toHaveBeenCalledTimes(before);
});

it("retains useful metrics on GET failure and never requests a caption without confirmed facts", async () => {
  fetch.mockRejectedValue(new Error("offline"));
  const app = consumer();
  await flush();
  expect(app.state.refreshFailed.value).toBe(true);
  expect(app.state.progress.value?.elapsed_seconds).toBe(125);
  expect(posts()).toHaveLength(0);
  fetch.mockImplementation((_path, options) =>
    Promise.resolve(
      options.method === "POST" ? generated() : preparationDetail(),
    ),
  );
  await vi.advanceTimersByTimeAsync(5000);
  expect(app.state.refreshFailed.value).toBe(false);
  expect(posts()).toHaveLength(1);
});

it("restores an uncertain key/body after a full store reload instead of issuing a fresh paid caption", async () => {
  fetch.mockImplementation((_path, options) =>
    options.method === "POST"
      ? Promise.reject(new Error("lost"))
      : Promise.resolve(preparationDetail()),
  );
  const first = consumer();
  await flush();
  const original = posts()[0]![1];
  first.scope.stop();
  setActivePinia(createPinia());
  const reloaded = consumer();
  await flush();
  expect(posts()).toHaveLength(1);
  expect(reloaded.state.captionUncertain.value).toBe(true);
  fetch.mockImplementation((_path, options) =>
    Promise.resolve(
      options.method === "POST" ? generated() : preparationDetail(),
    ),
  );
  await reloaded.state.refresh();
  expect(posts()[1]![1].headers).toEqual(original.headers);
  expect(posts()[1]![1].body).toEqual(original.body);
});

it("keeps factual progress without paid dispatch if the immutable receipt cannot be stored", async () => {
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: () => {
      throw new Error("storage blocked");
    },
    removeItem: vi.fn(),
  });
  const app = consumer();
  await flush();
  expect(posts()).toHaveLength(0);
  expect(app.state.progress.value).toMatchObject({
    percent: 37,
    activity_source: "recorded",
  });
  expect(app.state.captionUncertain.value).toBe(true);
  await vi.advanceTimersByTimeAsync(10000);
  expect(reads()).toHaveLength(3);
  expect(posts()).toHaveLength(0);
});

it("blocks fresh paid keys after generation replacement until the original generation request is reconciled", async () => {
  fetch.mockImplementation((_path, options) =>
    options.method === "POST"
      ? Promise.reject(new Error("lost"))
      : Promise.resolve(preparationDetail()),
  );
  const app = consumer();
  await flush();
  const original = posts()[0]![1];
  const replacement = preparationSnapshot({
    generation_id: "generation-2",
    phase: "PLAN",
    percent: 15,
  });
  fetch.mockImplementation((_path, options) =>
    Promise.resolve(
      options.method === "POST" ? generated() : preparationDetail(replacement),
    ),
  );
  app.tour.value = current(replacement);
  await flush();
  await vi.advanceTimersByTimeAsync(10000);
  expect(posts()).toHaveLength(1);
  expect(app.state.progress.value).toMatchObject({
    generation_id: "generation-2",
    phase: "PLAN",
    percent: 15,
  });
  expect(app.state.captionUncertain.value).toBe(true);
  await app.state.refresh();
  expect(posts()[1]![0]).toBe(
    "/api/tour-generations/tour/generation-1/progress-message",
  );
  expect(posts()[1]![1].body).toEqual(original.body);
  expect(posts()[1]![1].headers).toEqual(original.headers);
  expect(app.state.progress.value?.activity_source).toBe("recorded");
  await vi.advanceTimersByTimeAsync(5000);
  expect(posts()[2]![0]).toBe(
    "/api/tour-generations/tour/generation-2/progress-message",
  );
  expect(posts()[2]![1].headers).not.toEqual(original.headers);
});

it("encodes pins and bounds novelty data without sending client factual work", async () => {
  const snapshot = preparationSnapshot({
    generation_id: "generation/one?pin",
    activity_text: "x".repeat(500),
  });
  const app = consumer(snapshot, false);
  app.tour.value = current(snapshot, "backend-owner", "tour/one?pin");
  fetch.mockImplementation((_path, options) =>
    Promise.resolve(
      preparationDetail(
        options.method === "POST"
          ? {
              ...snapshot,
              activity_source: "llm",
              activity_text: "Recorded source work continues.",
            }
          : snapshot,
        { tour_id: "tour/one?pin" },
      ),
    ),
  );
  app.onscreen.value = true;
  await flush();
  expect(posts()[0]![0]).toBe(
    "/api/tour-generations/tour%2Fone%3Fpin/generation%2Fone%3Fpin/progress-message",
  );
  expect(posts()[0]![1].body).toEqual({
    lang: "en",
    message_variant: 0,
    previous_activity_text: "x".repeat(280),
  });
  expect(app.state.progress.value?.generation_id).toBe("generation/one?pin");
});

it("preserves sparse legacy numeric snapshots without inventing missing percentages or timing", async () => {
  const sparse = preparationSnapshot({ phase: "NEW_SERVER_PHASE" });
  delete sparse.percent;
  delete sparse.elapsed_seconds;
  delete sparse.remaining_seconds;
  delete sparse.remaining_time_kind;
  delete sparse.activity_text;
  delete sparse.activity_updated_at;
  fetch.mockImplementation((_path, options) =>
    Promise.resolve(
      preparationDetail({
        ...sparse,
        ...(options.method === "POST"
          ? {
              activity_source: "fallback" as const,
              activity_fallback_reason: "status_model_unavailable",
            }
          : {}),
      }),
    ),
  );
  const app = consumer(sparse);
  await flush();
  expect(app.state.progress.value).not.toHaveProperty("percent");
  expect(app.state.progress.value).not.toHaveProperty("elapsed_seconds");
  expect(app.state.progress.value).not.toHaveProperty("remaining_time_kind");
  expect(app.state.progress.value?.activity_source).toBe("fallback");
});

it("replaces caption metadata exactly rather than keeping model or fallback metadata from older text", async () => {
  const app = consumer();
  await flush();
  expect(app.state.progress.value?.activity_model).toBe("small-status-model");
  fetch.mockImplementation((_path, options) =>
    Promise.resolve(
      options.method === "POST"
        ? preparationDetail(
            preparationSnapshot({
              activity_source: "fallback",
              activity_fallback_reason: "budget_unavailable",
            }),
          )
        : preparationDetail(),
    ),
  );
  await app.state.refresh();
  expect(app.state.progress.value?.activity_source).toBe("fallback");
  expect(app.state.progress.value?.activity_model).toBeUndefined();
  expect(app.state.progress.value?.activity_generated_at).toBeUndefined();
  fetch.mockImplementation((_path, options) =>
    Promise.resolve(
      options.method === "POST" ? generated() : preparationDetail(),
    ),
  );
  await app.state.refresh();
  expect(app.state.progress.value?.activity_source).toBe("llm");
  expect(app.state.progress.value?.activity_fallback_reason).toBeUndefined();
});

it("does not request paid wording when the canonical generation has no progress snapshot yet", async () => {
  fetch.mockResolvedValue({ ...preparationDetail(), progress: null });
  const app = consumer();
  await flush();
  expect(app.state.progress.value?.percent).toBe(37);
  expect(posts()).toHaveLength(0);
  await vi.advanceTimersByTimeAsync(5000);
  expect(reads()).toHaveLength(2);
  expect(posts()).toHaveLength(0);
});

it.each(["owner", "tour", "generation", "language"])(
  "fences old canonical reads after %s changes without clearing the new read",
  async (change) => {
    const oldRead = pendingDetail();
    const newRead = pendingDetail();
    fetch
      .mockReturnValueOnce(oldRead.promise)
      .mockReturnValueOnce(newRead.promise);
    const app = consumer();
    if (change === "owner") {
      app.account.value = "new-firebase-owner";
      expect(app.state.progress.value).toBeNull();
      app.tour.value = current(preparationSnapshot(), "new-backend-owner");
    }
    if (change === "tour")
      app.tour.value = current(
        preparationSnapshot(),
        "backend-owner",
        "new-tour",
      );
    if (change === "generation")
      app.tour.value = current(
        preparationSnapshot({ generation_id: "generation-2", phase: "PLAN" }),
      );
    if (change === "language") app.language.value = "ru";
    oldRead.resolve(
      preparationDetail(preparationSnapshot({ status: "READY", percent: 100 })),
    );
    await flush();
    expect(app.state.refreshing.value).toBe(true);
    expect(app.state.refreshFailed.value).toBe(false);
    expect(app.state.progress.value?.status).toBe("RUNNING");
    const selected = { ...app.tour.value.preparation_progress, percent: 48 };
    fetch.mockImplementation((_path, options) =>
      Promise.resolve(
        preparationDetail(
          {
            ...selected,
            activity_text:
              change === "language"
                ? "Читаем записанный источник."
                : "Reading recorded source text.",
            ...(options.method === "POST"
              ? { activity_source: "llm" as const }
              : {}),
          },
          { tour_id: app.tour.value.id, owner_id: app.tour.value.user_id },
        ),
      ),
    );
    newRead.resolve(
      preparationDetail(selected, {
        tour_id: app.tour.value.id,
        owner_id: app.tour.value.user_id,
      }),
    );
    await flush();
    expect(app.state.refreshing.value).toBe(false);
    expect(app.state.progress.value?.percent).toBe(48);
    expect(posts()).toHaveLength(1);
    expect(posts()[0]![1].body.lang).toBe(change === "language" ? "ru" : "en");
  },
);

it.each(["owner", "tour", "generation"])(
  "never requests paid wording from a canonical %s mismatch",
  async (mismatch) => {
    const response = preparationDetail();
    if (mismatch === "owner") response.generation.owner_id = "other-owner";
    if (mismatch === "tour") response.generation.tour_id = "other-tour";
    if (mismatch === "generation")
      response.progress!.generation_id = "other-generation";
    fetch.mockResolvedValue(response);
    const app = consumer();
    await flush();
    expect(app.state.refreshFailed.value).toBe(true);
    expect(app.state.progress.value?.percent).toBe(37);
    expect(posts()).toHaveLength(0);
  },
);

it("keeps selected-language caption on same-work numeric source updates without modifying activity clocks", async () => {
  const app = consumer(preparationSnapshot(), false);
  app.language.value = "ru";
  fetch.mockImplementation((_path, options) =>
    Promise.resolve(
      preparationDetail(
        preparationSnapshot({
          activity_text: "Читаем записанный источник.",
          ...(options.method === "POST"
            ? {
                activity_source: "llm" as const,
                activity_generated_at: "2026-10-12T12:02:05Z",
              }
            : {}),
        }),
      ),
    ),
  );
  app.onscreen.value = true;
  await flush();
  app.tour.value = current(
    preparationSnapshot({
      percent: 58,
      elapsed_seconds: 150,
      updated_at: "2026-10-12T12:02:30Z",
      activity_text: "Account-language English source caption",
    }),
  );
  expect(app.state.progress.value).toMatchObject({
    percent: 58,
    elapsed_seconds: 150,
    activity_source: "llm",
    activity_text: "Читаем записанный источник.",
    activity_updated_at: "2026-10-12T12:02:00Z",
    activity_generated_at: "2026-10-12T12:02:05Z",
  });
});

it("uses basic factual GET only when rich progress is explicitly disabled, including manual refresh", async () => {
  const basic = preparationSnapshot({ rich_progress_enabled: false });
  fetch.mockResolvedValue(preparationDetail(basic));
  const app = consumer(basic);
  await flush();
  await vi.advanceTimersByTimeAsync(10000);
  await app.state.refresh();
  expect(posts()).toHaveLength(0);
  expect(reads()).toHaveLength(4);
  expect(app.state.progress.value).toMatchObject({
    rich_progress_enabled: false,
    phase: "RESEARCH",
    percent: 37,
  });
});

it("retains an unresolved caption across disabling and reenabling rich progress without automatic replay", async () => {
  const rich = preparationSnapshot({ rich_progress_enabled: true });
  fetch.mockImplementation((_path, options) =>
    options.method === "POST"
      ? Promise.reject(new Error("lost"))
      : Promise.resolve(preparationDetail(rich)),
  );
  const app = consumer(rich);
  await flush();
  const original = posts()[0]![1];
  const basic = { ...rich, rich_progress_enabled: false };
  fetch.mockResolvedValue(preparationDetail(basic));
  app.tour.value = current(basic);
  await flush();
  await app.state.refresh();
  await vi.advanceTimersByTimeAsync(10000);
  expect(posts()).toHaveLength(1);
  expect(app.state.captionUncertain.value).toBe(true);
  fetch.mockImplementation((_path, options) =>
    Promise.resolve(
      options.method === "POST"
        ? generated({ rich_progress_enabled: true })
        : preparationDetail(rich),
    ),
  );
  app.tour.value = current(rich);
  await flush();
  expect(posts()).toHaveLength(1);
  await app.state.refresh();
  expect(posts()[1]![1].headers).toEqual(original.headers);
  expect(posts()[1]![1].body).toEqual(original.body);
  expect(app.state.captionUncertain.value).toBe(false);
});

it("rejects a late rich-enabled factual response after the source switches to basic mode", async () => {
  const pending = pendingDetail();
  fetch.mockReturnValueOnce(pending.promise);
  const app = consumer(preparationSnapshot({ rich_progress_enabled: true }));
  const basic = preparationSnapshot({ rich_progress_enabled: false });
  fetch.mockResolvedValue(preparationDetail(basic));
  app.tour.value = current(basic);
  await flush();
  pending.resolve(
    preparationDetail(preparationSnapshot({ rich_progress_enabled: true })),
  );
  await flush();
  expect(app.state.progress.value?.rich_progress_enabled).toBe(false);
  expect(posts()).toHaveLength(0);
});

it("honors disabling rich progress in the status response without replacing numeric facts", async () => {
  fetch.mockImplementation((_path, options) =>
    Promise.resolve(
      options.method === "POST"
        ? generated({
            rich_progress_enabled: false,
            activity_source: "fallback",
            percent: 99,
          })
        : preparationDetail(
            preparationSnapshot({ rich_progress_enabled: true }),
          ),
    ),
  );
  const app = consumer(preparationSnapshot({ rich_progress_enabled: true }));
  await flush();
  expect(app.state.progress.value).toMatchObject({
    rich_progress_enabled: false,
    percent: 37,
  });
  expect(app.state.progress.value?.activity_source).not.toBe("llm");
  expect(app.state.captionUncertain.value).toBe(true);
});

it("retains the original uncertain receipt when manual reconciliation encounters disabled rich progress", async () => {
  const rich = preparationSnapshot({ rich_progress_enabled: true });
  fetch.mockImplementation((_path, options) =>
    options.method === "POST"
      ? Promise.reject(new Error("lost"))
      : Promise.resolve(preparationDetail(rich)),
  );
  const app = consumer(rich);
  await flush();
  const original = posts()[0]![1];
  fetch.mockImplementation((_path, options) =>
    Promise.resolve(
      options.method === "POST"
        ? generated({
            rich_progress_enabled: false,
            activity_source: "fallback",
            activity_fallback_reason: "rich_progress_disabled",
          })
        : preparationDetail(rich),
    ),
  );
  await app.state.refresh();
  expect(app.state.captionUncertain.value).toBe(true);
  expect(app.state.progress.value?.rich_progress_enabled).toBe(false);
  expect(posts()[1]![1].headers).toEqual(original.headers);
  expect(posts()[1]![1].body).toEqual(original.body);
  const basic = { ...rich, rich_progress_enabled: false };
  fetch.mockResolvedValue(preparationDetail(basic));
  await app.state.refresh();
  expect(posts()).toHaveLength(2);
  fetch.mockImplementation((_path, options) =>
    Promise.resolve(
      options.method === "POST"
        ? generated({ rich_progress_enabled: true })
        : preparationDetail(rich),
    ),
  );
  await app.state.refresh();
  expect(posts()[2]![1].headers).toEqual(original.headers);
  expect(posts()[2]![1].body).toEqual(original.body);
  expect(app.state.captionUncertain.value).toBe(false);
});

it("replaces cached live-sounding captions when source activity ages while a paid response is uncertain", async () => {
  const live = preparationSnapshot({ activity_stale: false });
  fetch.mockImplementation((_path, options) =>
    Promise.resolve(
      options.method === "POST"
        ? generated({ activity_stale: false })
        : preparationDetail(live),
    ),
  );
  const app = consumer(live);
  await flush();
  expect(app.state.progress.value?.activity_source).toBe("llm");
  fetch.mockImplementation((_path, options) =>
    options.method === "POST"
      ? Promise.reject(new Error("Lost response"))
      : Promise.resolve(preparationDetail(live)),
  );
  await vi.advanceTimersByTimeAsync(5000);
  expect(app.state.captionUncertain.value).toBe(true);
  const stale = {
    ...live,
    activity_stale: true,
    activity_text: "Last observed activity: Reading a source for Clock House.",
    activity_source: "recorded" as const,
  };
  fetch.mockResolvedValue(preparationDetail(stale));
  await vi.advanceTimersByTimeAsync(5000);
  expect(posts()).toHaveLength(2);
  expect(app.state.progress.value?.activity_text).toBe(stale.activity_text);
  expect(app.state.progress.value?.activity_source).toBe("recorded");
  expect(app.state.progress.value?.activity_model).toBeUndefined();
  expect(app.state.captionUncertain.value).toBe(true);
});

const retainedBody = Object.freeze({
  lang: "ru" as const,
  message_variant: 19,
  previous_activity_text: "Читаем исходный источник.",
});
function storeReceipt(
  identity = ["firebase-owner", "backend-owner", "tour"],
  generationId = "generation-1",
) {
  sessionStorage.setItem(
    `pg-preparation-caption-${JSON.stringify(identity)}`,
    JSON.stringify({
      version: 1,
      key: "original-caption-key",
      generationId,
      body: retainedBody,
    }),
  );
}

it.each(["READY", "FAILED", "CANCELLED"] as const)(
  "restores a pending receipt on %s reload, exposes reconciliation and replays only its original body/key",
  async (status) => {
    storeReceipt();
    setActivePinia(createPinia());
    const terminal = preparationSnapshot({ status, percent: 100 });
    fetch.mockImplementation((_path, options) =>
      Promise.resolve(
        preparationDetail({
          ...terminal,
          activity_source: options?.method === "POST" ? "fallback" : "recorded",
          activity_fallback_reason:
            options?.method === "POST" ? "work_changed" : undefined,
        }),
      ),
    );
    const uuid = vi.spyOn(crypto, "randomUUID");
    const reloaded = consumer(terminal);
    await flush();
    expect(reloaded.state.captionUncertain.value).toBe(true);
    expect(posts()).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(60000);
    expect(posts()).toHaveLength(0);
    expect(reads()).toHaveLength(1);
    const view = mount(TourPreparationProgress, {
      progress: reloaded.state.progress.value,
      captionUncertain: reloaded.state.captionUncertain.value,
      refreshing: reloaded.state.refreshing.value,
      onRefresh: reloaded.state.refresh,
    });
    try {
      expect(
        findAll(view.root, (node) => "data-caption-uncertain" in node.props),
      ).toHaveLength(1);
      const button = findAll(
        view.root,
        (node) => "data-refresh-progress" in node.props,
      )[0]!;
      expect(button.props.disabled).toBe(false);
      button.props.onClick();
      await flush();
      expect(posts()).toHaveLength(1);
      expect(posts()[0]![1].headers["Idempotency-Key"]).toBe(
        "original-caption-key",
      );
      expect(posts()[0]![1].body).toEqual(retainedBody);
      expect(uuid).not.toHaveBeenCalled();
      expect(reloaded.state.captionUncertain.value).toBe(false);
    } finally {
      view.unmount();
    }
  },
);

it("restores an old-generation terminal receipt without allocating a replacement or relabeling its language", async () => {
  storeReceipt(undefined, "generation-1");
  setActivePinia(createPinia());
  const terminal = preparationSnapshot({
    generation_id: "generation-2",
    status: "READY",
    activity_text: "Selected English terminal caption.",
  });
  fetch.mockImplementation((_path, options) =>
    Promise.resolve(
      options.method === "POST" ? generated() : preparationDetail(terminal),
    ),
  );
  const uuid = vi.spyOn(crypto, "randomUUID");
  const reloaded = consumer(terminal);
  await flush();
  expect(reloaded.state.captionUncertain.value).toBe(true);
  expect(posts()).toHaveLength(0);
  await reloaded.state.refresh();
  expect(posts()[0]![0]).toBe(
    "/api/tour-generations/tour/generation-1/progress-message",
  );
  expect(posts()[0]![1].body).toEqual(retainedBody);
  expect(posts()[0]![1].headers["Idempotency-Key"]).toBe(
    "original-caption-key",
  );
  expect(reloaded.state.progress.value?.activity_text).toBe(
    "Selected English terminal caption.",
  );
  expect(uuid).not.toHaveBeenCalled();
});

it.each(["account", "owner", "tour"])(
  "does not restore or replay another %s's terminal receipt",
  async (mismatch) => {
    const identity = ["firebase-owner", "backend-owner", "tour"];
    identity[mismatch === "account" ? 0 : mismatch === "owner" ? 1 : 2] =
      "different-identity";
    storeReceipt(identity);
    setActivePinia(createPinia());
    const terminal = preparationSnapshot({ status: "READY" });
    fetch.mockResolvedValue(preparationDetail(terminal));
    const uuid = vi.spyOn(crypto, "randomUUID");
    const reloaded = consumer(terminal);
    await flush();
    expect(reloaded.state.captionUncertain.value).toBe(false);
    await reloaded.state.refresh();
    expect(posts()).toHaveLength(0);
    expect(uuid).not.toHaveBeenCalled();
  },
);

it("hydrates an owner-less terminal snapshot only after detail confirms its owner", async () => {
  storeReceipt();
  setActivePinia(createPinia());
  const terminal = preparationSnapshot({ status: "READY" });
  const detail = pendingDetail();
  fetch.mockReturnValueOnce(detail.promise);
  const reloaded = consumer(terminal, false);
  reloaded.tour.value = current(terminal, "");
  expect(reloaded.state.captionUncertain.value).toBe(false);
  reloaded.onscreen.value = true;
  await flush();
  expect(reloaded.state.captionUncertain.value).toBe(false);
  detail.resolve(preparationDetail(terminal));
  await flush();
  expect(reloaded.state.captionUncertain.value).toBe(true);
  expect(posts()).toHaveLength(0);
  fetch.mockResolvedValue(preparationDetail(terminal));
  await reloaded.state.refresh();
  expect(posts()[0]![1].body).toEqual(retainedBody);
  expect(posts()[0]![1].headers["Idempotency-Key"]).toBe(
    "original-caption-key",
  );
});

it("never replays a restored receipt when canonical detail rejects its owner", async () => {
  storeReceipt();
  setActivePinia(createPinia());
  const terminal = preparationSnapshot({ status: "FAILED" });
  fetch.mockResolvedValue(
    preparationDetail(terminal, { owner_id: "different-owner" }),
  );
  const reloaded = consumer(terminal);
  await flush();
  expect(reloaded.state.captionUncertain.value).toBe(true);
  expect(reloaded.state.refreshFailed.value).toBe(true);
  await reloaded.state.refresh();
  expect(posts()).toHaveLength(0);
});

it.each(["malformed", "unavailable"])(
  "never invents a paid key when receipt storage is %s, even on manual refresh",
  async (failure) => {
    vi.stubGlobal("sessionStorage", {
      getItem: () => {
        if (failure === "unavailable") throw new Error("storage unavailable");
        return JSON.stringify({ version: 1, key: "unrecoverable" });
      },
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    setActivePinia(createPinia());
    const uuid = vi.spyOn(crypto, "randomUUID");
    const app = consumer();
    await flush();
    await vi.advanceTimersByTimeAsync(10000);
    await app.state.refresh();
    expect(app.state.progress.value?.percent).toBe(37);
    expect(posts()).toHaveLength(0);
    expect(uuid).not.toHaveBeenCalled();
  },
);

it("shares settled captions inside the cooldown but allocates fresh keys at the exact boundary", async () => {
  const first = consumer();
  await flush();
  first.scope.stop();
  const uuid = vi.spyOn(crypto, "randomUUID");
  await vi.advanceTimersByTimeAsync(4999);
  const within = consumer();
  await flush();
  expect(posts()).toHaveLength(1);
  expect(uuid).not.toHaveBeenCalled();
  within.scope.stop();
  await vi.advanceTimersByTimeAsync(1);
  consumer();
  await flush();
  expect(posts()).toHaveLength(2);
  expect(uuid).toHaveBeenCalledTimes(1);
  expect(posts()[1]![1].headers).not.toEqual(posts()[0]![1].headers);
});

it("keeps a held original request uncertain after work changes and reconciles without allocating a new key", async () => {
  const held = pendingDetail();
  let factual = preparationSnapshot();
  fetch.mockImplementation((_path, options) =>
    options.method === "POST"
      ? held.promise
      : Promise.resolve(preparationDetail(factual)),
  );
  const app = consumer();
  await flush();
  const original = posts()[0]![1];
  const uuid = vi.spyOn(crypto, "randomUUID");
  factual = preparationSnapshot({
    phase: "REVIEW",
    percent: 72,
    activity_updated_at: "2026-10-12T12:02:30Z",
    updated_at: "2026-10-12T12:02:30Z",
  });
  await vi.advanceTimersByTimeAsync(5000);
  expect(posts()).toHaveLength(1);
  expect(app.state.progress.value).toMatchObject({
    phase: factual.phase,
    percent: factual.percent,
  });
  held.resolve(
    generated({
      activity_source: "fallback",
      activity_fallback_reason: "request_in_progress",
    }),
  );
  await flush();
  expect(app.state.captionUncertain.value).toBe(true);
  fetch.mockImplementation((_path, options) =>
    Promise.resolve(
      options.method === "POST"
        ? preparationDetail({
            ...factual,
            activity_source: "fallback",
            activity_fallback_reason: "request_uncertain",
          })
        : preparationDetail(factual),
    ),
  );
  await vi.advanceTimersByTimeAsync(5000);
  expect(posts()).toHaveLength(1);
  await app.state.refresh();
  expect(posts()).toHaveLength(2);
  expect(posts()[1]![1].headers).toEqual(original.headers);
  expect(posts()[1]![1].body).toEqual(original.body);
  expect(app.state.captionUncertain.value).toBe(true);
  await vi.advanceTimersByTimeAsync(10000);
  expect(posts()).toHaveLength(2);
  expect(uuid).not.toHaveBeenCalled();
});

it("keeps fresh GET spend text, ledger and counters when a same-work caption refresh is lost", async () => {
  const first = preparationSnapshot({
    status_text: "Researching; charged US$0.10.",
    research_spend: {
      limit_micros: 1_000_000,
      spent_micros: 100_000,
      reserved_micros: 0,
      remaining_micros: 900_000,
    },
  });
  fetch.mockImplementation((_path, options) =>
    Promise.resolve(
      options.method === "POST"
        ? generated({
            status_text: first.status_text,
            research_spend: first.research_spend,
          })
        : preparationDetail(first),
    ),
  );
  const app = consumer(first);
  await flush();
  const caption = app.state.progress.value?.activity_text;
  const latest = {
    ...first,
    status_text: "Researching; charged US$0.25.",
    research_spend: {
      ...first.research_spend!,
      spent_micros: 250_000,
      remaining_micros: 750_000,
    },
    turns_completed: first.turns_completed + 1,
    elapsed_seconds: 150,
    updated_at: "2026-10-12T12:02:30Z",
  };
  fetch.mockImplementation((_path, options) =>
    options.method === "POST"
      ? Promise.reject(new Error("caption response lost"))
      : Promise.resolve(preparationDetail(latest)),
  );
  await vi.advanceTimersByTimeAsync(5000);
  expect(posts()).toHaveLength(2);
  expect(app.state.captionUncertain.value).toBe(true);
  expect(app.state.progress.value).toMatchObject({
    status_text: latest.status_text,
    research_spend: latest.research_spend,
    turns_completed: latest.turns_completed,
    elapsed_seconds: latest.elapsed_seconds,
    activity_text: caption,
    activity_source: "llm",
  });
  await vi.advanceTimersByTimeAsync(5000);
  expect(posts()).toHaveLength(2);
  expect(app.state.progress.value?.status_text).toBe(latest.status_text);
  expect(app.state.progress.value?.research_spend).toEqual(
    latest.research_spend,
  );
});
