import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { effectScope, shallowRef, type EffectScope } from "vue";
import type { User } from "firebase/auth";
import type { ICreatedTour } from "../app/types";
import type {
  GenerationSummary,
  ResearchFile,
  ResearchEnrichment,
} from "../shared/types/researchLifecycle";
import type { PreparationProgress } from "../shared/types/preparationProgress";
import { useTourResearchLifecycle } from "../app/composables/tour/useTourResearchLifecycle";
import { useTourResearchApi } from "../app/composables/api/tours/useTourResearchApi";
import { useResearchLifecycleStore } from "../app/stores/researchLifecycleStore";
import { useResearchPreviewStore } from "../app/stores/researchPreviewStore";
import { useTourRequestStore } from "../app/stores/tourRequestStore";
import { useTourStore } from "../app/stores/tourStore";
import { useUserStore } from "../app/stores/userStore";
import { useExperienceStore } from "../app/stores/experienceStore";
import type { Experience } from "../app/types/tourExperience";
import { emptyPersonalContext } from "../app/types/personalContext";

interface Options {
  method?: string;
  query?: { skip: number; limit: number };
  headers?: Record<string, string>;
  retry?: number;
  responseType?: string;
}
const fetch = vi.fn<(path: string, options?: Options) => Promise<unknown>>();
const scopes: EffectScope[] = [];
const sourceId = "source/tour?private";
const backendOwner = "backend-owner-id-not-firebase-uid";
const timestamp = "2026-10-11T12:00:00Z";
let tour: ICreatedTour;
let history: GenerationSummary[];
let saved: ResearchFile[];
let background: ResearchEnrichment;
let selectedProgress: PreparationProgress | null;
function generation(
  id = "generation/one",
  patch: Partial<GenerationSummary> = {},
): GenerationSummary {
  return {
    generation_id: id,
    tour_id: sourceId,
    owner_id: backendOwner,
    status: "READY",
    stage: "PUBLICATION",
    sequence: 1,
    created_at: timestamp,
    updated_at: timestamp,
    idempotency_key: `initial-${id}`,
    ...patch,
  };
}
function source(patch: Partial<ICreatedTour> = {}): ICreatedTour {
  return {
    id: sourceId,
    user_id: backendOwner,
    name: "Source",
    image: "",
    description: "",
    guide_id: "guide",
    guide: null,
    context: "",
    history: [],
    created_at: timestamp,
    generated_at: timestamp,
    finished_at: null,
    status: "GENERATED",
    settings: [],
    tags: [],
    generating_percent: 100,
    generating_string: "",
    active_generation_id: "old-package",
    playback_generation_id: "old-package",
    latest_generation_id: "generation/one",
    route: { id: "route", name: "Route", context: "", points: [] },
    ...patch,
  };
}
function progress(id = "generation/one", completed = 1): PreparationProgress {
  return {
    generation_id: id,
    status: "RUNNING",
    phase: "RESEARCH",
    percent: 37,
    status_text: "Researching the stops",
    elapsed_seconds: 125,
    remaining_seconds: null,
    remaining_time_kind: "unknown",
    activity_text: "Reading a source for the selected stop.",
    activity_updated_at: timestamp,
    active_researchers: 1,
    completed_stops: completed,
    total_stops: 2,
    error: null,
    stops: [],
    updated_at: timestamp,
    turns_started: 1,
    turns_completed: 1,
    tool_calls_completed: 0,
    sources_count: 1,
    source_bytes: 10,
    claims_count: 1,
    word_count: 1,
    archive_bytes: 10,
  };
}
async function read(path: string, options?: Options): Promise<unknown> {
  if (options?.method === "POST")
    throw new Error("No mutation was authorized by this fixture");
  if (path.startsWith("/api/get-tour/")) return structuredClone(tour);
  if (path.startsWith("/api/tour-research/"))
    return { files: structuredClone(saved) };
  if (path.startsWith("/api/tour-enrichment/"))
    return structuredClone(background);
  if (options?.query)
    return {
      generations: structuredClone(
        history.slice(
          options.query.skip,
          options.query.skip + options.query.limit,
        ),
      ),
    };
  const id = decodeURIComponent(path.split("/").at(-1)!);
  const found = history.find((item) => item.generation_id === id);
  if (!found) throw new Error("Unknown generation");
  return {
    generation: structuredClone(found),
    progress:
      selectedProgress?.generation_id === id
        ? structuredClone(selectedProgress)
        : null,
  };
}
function consumer() {
  const id = shallowRef(sourceId);
  const latest = shallowRef<string | null>("generation/one");
  const scope = effectScope();
  scopes.push(scope);
  const controls = scope.run(() =>
    useTourResearchLifecycle(
      () => id.value,
      () => latest.value,
    ),
  )!;
  return { scope, id, latest, controls };
}
async function flush() {
  for (let step = 0; step < 12; step++) await Promise.resolve();
}
const mutations = () =>
  fetch.mock.calls.filter(([, options]) => options?.method === "POST");
beforeEach(() => {
  tour = source();
  history = [generation()];
  selectedProgress = null;
  saved = [
    {
      artifact_id: "archive/raw?one",
      generation_id: "generation/one",
      kind: "research",
      content_type: "application/json",
      byte_size: 10,
      created_at: timestamp,
      url: "https://untrusted.test/private",
    },
  ];
  background = {
    status: "completed",
    rounds: 1,
    items: [],
    reason: null,
    error: null,
    updated_at: timestamp,
  };
  fetch.mockReset().mockImplementation(read);
  Object.assign(globalThis, { useNuxtApp: () => ({ $apiFetch: fetch }) });
  useUserStore().user = { uid: "firebase-owner" } as User;
});
afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop();
});

it("does no research or private reads until disclosure refresh, and never invokes next/audio", async () => {
  const { controls } = consumer();
  expect(fetch).not.toHaveBeenCalled();
  expect(controls.canRegenerate.value).toBe(false);
  await controls.refresh();
  expect(controls.sourceTour.value?.user_id).toBe(backendOwner);
  expect(controls.selectedGeneration.value?.generation_id).toBe(
    "generation/one",
  );
  expect(controls.files.value).toHaveLength(1);
  expect(controls.enrichment.value?.items).toEqual([]);
  expect(controls.canRegenerate.value).toBe(true);
  expect(mutations()).toHaveLength(0);
  expect(
    fetch.mock.calls.every(([path]) => !/next|record|audio/.test(path)),
  ).toBe(true);
});

it("reads complete generation history and preserves known data on pagination failure", async () => {
  const { controls, latest } = consumer();
  history = Array.from({ length: 101 }, (_, index) =>
    generation(`generation-${index}`, { sequence: 101 - index }),
  );
  tour.latest_generation_id = history[0]!.generation_id;
  latest.value = "generation-0";
  await controls.refresh();
  expect(controls.generations.value).toHaveLength(101);
  expect(
    fetch.mock.calls
      .filter(([, options]) => options?.query)
      .some(([, options]) => options!.query!.skip === 100),
  ).toBe(true);
  const known = controls.generations.value;
  fetch.mockImplementation((path, options) =>
    options?.query
      ? Promise.resolve({ generations: history.slice(0, 100) })
      : read(path, options),
  );
  await controls.refresh();
  expect(controls.failed.value).toBe(true);
  expect(controls.generations.value).toEqual(known);
  expect(controls.files.value).toHaveLength(1);
  expect(controls.canRegenerate.value).toBe(false);
});

it("rejects malformed and bounded-truncated history instead of an empty or partial success", async () => {
  fetch.mockResolvedValue({ generations: null });
  await expect(useTourResearchApi().history(sourceId)).rejects.toThrow();
  let page = 0;
  fetch.mockImplementation(async () => {
    const entries = Array.from({ length: 100 }, (_, index) =>
      generation(`page-${page}-${index}`),
    );
    page++;
    return { generations: entries };
  });
  await expect(useTourResearchApi().history(sourceId)).rejects.toThrow(
    "limit exceeded",
  );
});

it("fences late source/account reads, including returning to the same UID", async () => {
  const cache = useTourStore();
  cache.setTour(tour);
  cache.setTextForDisplay("original transcript");
  const { controls, id } = consumer();
  const delayed = Promise.withResolvers<ICreatedTour>();
  fetch.mockImplementation((path, options) =>
    path.startsWith("/api/get-tour/") ? delayed.promise : read(path, options),
  );
  const refresh = controls.refresh();
  id.value = "different-source";
  id.value = sourceId;
  useUserStore().user = { uid: "other-account" } as User;
  useUserStore().user = { uid: "firebase-owner" } as User;
  delayed.resolve(
    source({
      latest_generation_id: "late-generation",
      status: "GENERATING",
    }),
  );
  await refresh;
  expect(controls.sourceTour.value).toBeNull();
  expect(controls.generations.value).toEqual([]);
  expect(controls.loading.value).toBe(false);
  expect(cache.tour?.latest_generation_id).toBe("generation/one");
  expect(cache.tour?.status).toBe("GENERATED");
  expect(cache.textForDisplay).toBe("original transcript");
});

it("keeps explicit selection and ignores status/progress arriving for an older selection", async () => {
  history.push(generation("second-generation", { sequence: 2 }));
  const { controls } = consumer();
  await controls.refresh();
  const delayed = Promise.withResolvers<unknown>();
  fetch.mockImplementation((path, options) =>
    path.endsWith("generation%2Fone") ? delayed.promise : read(path, options),
  );
  const first = controls.selectGeneration("generation/one");
  selectedProgress = progress("second-generation", 2);
  await controls.selectGeneration("second-generation");
  delayed.resolve({ generation: generation(), progress: progress() });
  await first;
  expect(controls.selectedGenerationId.value).toBe("second-generation");
  expect(controls.progress.value?.generation_id).toBe("second-generation");
  await controls.refresh();
  expect(controls.selectedGenerationId.value).toBe("second-generation");
});

it("retains immutable regeneration identity across uncertainty/remount and reconciles only its matching job", async () => {
  const first = consumer();
  await first.controls.refresh();
  fetch.mockImplementation((path, options) =>
    options?.method === "POST"
      ? Promise.reject(new Error("Response lost"))
      : read(path, options),
  );
  expect(await first.controls.run("regenerate")).toBe(false);
  const pending = first.controls.pending.value!;
  const original = mutations()[0]!;
  expect(pending.kind).toBe("regenerate");
  expect(first.controls.previewBlocked.value).toBe(true);
  first.scope.stop();
  const retry = consumer();
  retry.latest.value = "different-generation";
  expect(retry.controls.pending.value?.key).toBe(pending.key);
  history.unshift(
    generation("unrelated-new", {
      sequence: 2,
      idempotency_key: "someone-else",
    }),
  );
  await retry.controls.refresh();
  expect(retry.controls.pending.value?.key).toBe(pending.key);
  expect(await retry.controls.run("accept")).toBe(false);
  fetch.mockImplementation(async (path, options) => {
    if (options?.method !== "POST") return read(path, options);
    const admitted = generation("confirmed-new", {
      sequence: 3,
      status: "PENDING",
      stage: "CAPTURE",
      idempotency_key: pending.key,
    });
    history.unshift(admitted);
    tour.latest_generation_id = admitted.generation_id;
    return { tour, result: "SUCCESS", generation: admitted };
  });
  expect(await retry.controls.retry()).toBe(true);
  expect(mutations()[1]).toEqual(original);
  expect(retry.controls.pending.value).toBeNull();
  expect(retry.controls.selectedGeneration.value?.generation_id).toBe(
    "confirmed-new",
  );
});

it("read-only refresh reconciles a lost regeneration response without another costly mutation", async () => {
  const { controls } = consumer();
  await controls.refresh();
  fetch.mockImplementation((path, options) =>
    options?.method === "POST"
      ? Promise.reject(new Error("Response lost"))
      : read(path, options),
  );
  await controls.run("regenerate");
  const key = controls.pending.value!.key;
  history.unshift(
    generation("admitted", {
      sequence: 2,
      status: "RUNNING",
      stage: "RESEARCH",
      idempotency_key: key,
    }),
  );
  await controls.refresh();
  expect(controls.pending.value).toBeNull();
  expect(mutations()).toHaveLength(1);
});

it("fences queued mutation work on synchronous account/source changes and late acceptance effects", async () => {
  const { controls, id } = consumer();
  await controls.refresh();
  const gate = Promise.withResolvers<void>();
  const queued = useTourRequestStore().run(sourceId, () => gate.promise);
  // Direct store submission checks the queue fence without bypassing UI eligibility.
  const action = useResearchLifecycleStore().start(
    sourceId,
    "accept",
    "generation/one",
    backendOwner,
    () => id.value === sourceId,
  );
  id.value = "other-source";
  useUserStore().user = null;
  useUserStore().user = { uid: "firebase-owner" } as User;
  gate.resolve();
  await queued;
  expect(await action).toBeNull();
  expect(mutations()).toHaveLength(0);
  expect(useResearchLifecycleStore().forTour(sourceId)).toBeUndefined();
});

it("mutually blocks uncertain preview and ordinary lifecycle operations without losing preview navigation retry", async () => {
  const { controls } = consumer();
  await controls.refresh();
  fetch.mockImplementation((path, options) =>
    options?.method === "POST"
      ? Promise.reject(new Error("Response lost"))
      : read(path, options),
  );
  await controls.run("regenerate");
  expect(
    await useResearchPreviewStore().start(sourceId, "generation/one"),
  ).toBeNull();
  expect(mutations()).toHaveLength(1);
  useUserStore().user = null;
  useUserStore().user = { uid: "firebase-owner" } as User;
  await controls.refresh();
  await expect(
    useResearchPreviewStore().start(sourceId, "generation/one"),
  ).rejects.toThrow();
  expect(controls.mutationBlocked.value).toBe(true);
  expect(await controls.run("regenerate")).toBe(false);
  expect(mutations()).toHaveLength(2);
});

it("confirms stop-only and completed-research continuation distinctly, with immutable retries and no automatic acceptance", async () => {
  history = [
    generation("generation/one", { status: "RUNNING", stage: "RESEARCH" }),
  ];
  selectedProgress = progress();
  const { controls } = consumer();
  await controls.refresh();
  expect(controls.canFinishEarly.value).toBe(true);
  expect(controls.canCancel.value).toBe(true);
  fetch.mockImplementation((path, options) =>
    options?.method === "POST"
      ? Promise.reject(new Error("Response lost"))
      : read(path, options),
  );
  expect(await controls.run("finish-early")).toBe(false);
  const original = mutations()[0]!;
  history[0] = { ...history[0]!, finish_early_requested: true };
  await controls.refresh();
  expect(controls.pending.value).toBeNull();
  expect(controls.canFinishEarly.value).toBe(false);
  expect(mutations()).toHaveLength(1);
  expect(original[0]).toContain("/finish-early");
  expect(await controls.run("cancel")).toBe(false);
  const cancel = mutations()[1]!;
  fetch.mockImplementation(async (path, options) => {
    if (options?.method !== "POST") return read(path, options);
    history[0] = { ...history[0]!, status: "CANCELLED" };
    return { generation: history[0] };
  });
  expect(await controls.retry()).toBe(true);
  expect(mutations()[2]).toEqual(cancel);
  expect(controls.canAccept.value).toBe(false);
  expect(mutations().every(([path]) => !path.endsWith("/accept"))).toBe(true);
});

it.each([
  ["cancel", "READY", "PUBLICATION"],
  ["cancel", "FAILED", "RESEARCH"],
  ["cancel", "CANCELLED", "RESEARCH"],
  ["finish-early", "READY", "PUBLICATION"],
  ["finish-early", "FAILED", "RESEARCH"],
  ["finish-early", "CANCELLED", "RESEARCH"],
  ["finish-early", "RUNNING", "COMPOSITION"],
] as const)(
  "retires an impossible %s after fresh matching %s/%s without replay",
  async (kind, status, stage) => {
    history = [
      generation("generation/one", { status: "RUNNING", stage: "RESEARCH" }),
    ];
    selectedProgress = progress();
    const { controls } = consumer();
    await controls.refresh();
    fetch.mockImplementation((path, options) =>
      options?.method === "POST"
        ? Promise.reject({ statusCode: 409 })
        : read(path, options),
    );
    expect(await controls.run(kind)).toBe(false);
    expect(controls.pending.value?.kind).toBe(kind);
    history[0] = { ...history[0]!, status, stage };
    await controls.refresh();
    expect(controls.pending.value).toBeNull();
    expect(controls.mutationBlocked.value).toBe(false);
    expect(controls.previewBlocked.value).toBe(false);
    expect(mutations()).toHaveLength(1);
  },
);

it.each(["cancel", "finish-early"] as const)(
  "retains viable uncertain %s and rejects foreign-owner terminal reconciliation",
  async (kind) => {
    history = [
      generation("generation/one", { status: "RUNNING", stage: "RESEARCH" }),
    ];
    selectedProgress = progress();
    const { controls } = consumer();
    await controls.refresh();
    fetch.mockImplementation((path, options) =>
      options?.method === "POST"
        ? Promise.reject(new Error("Response lost"))
        : read(path, options),
    );
    await controls.run(kind);
    const key = controls.pending.value!.key;
    await controls.refresh();
    expect(controls.pending.value?.key).toBe(key);
    expect(controls.mutationBlocked.value).toBe(true);
    const terminal = generation("generation/one", {
      status: "READY",
      owner_id: "another-owner",
    });
    expect(
      useResearchLifecycleStore().reconcile(sourceId, tour, [terminal]),
    ).toBe(false);
    expect(controls.pending.value?.key).toBe(key);
    expect(mutations()).toHaveLength(1);
  },
);

it.each([
  ["PENDING", "RESEARCH", 1, false],
  ["RUNNING", "COMPOSITION", 1, false],
  ["RUNNING", "RESEARCH", 0, false],
  ["RUNNING", "RESEARCH", 1, true],
] as const)(
  "does not continue unsupported research state %s/%s",
  async (status, stage, completed, experimental) => {
    history = [
      generation("generation/one", {
        status,
        stage,
        experimental_preview: experimental,
      }),
    ];
    selectedProgress = progress("generation/one", completed);
    const { controls } = consumer();
    await controls.refresh();
    expect(controls.canFinishEarly.value).toBe(false);
    expect(await controls.run("finish-early")).toBe(false);
    expect(mutations()).toHaveLength(0);
  },
);

it.each(["STARTED", "GENERATED"])(
  "only accepts latest normal unpinned READY generation from %s source",
  async (status) => {
    tour.status = status;
    const { controls } = consumer();
    await controls.refresh();
    expect(controls.canAccept.value).toBe(status !== "STARTED");
    await controls.selectGeneration("generation/one");
    history.unshift(generation("newer", { sequence: 2 }));
    tour.latest_generation_id = "newer";
    await controls.refresh();
    expect(controls.canAccept.value).toBe(false);
    await controls.selectGeneration("newer");
    history[0] = { ...history[0]!, experimental_preview: true };
    await controls.refresh();
    expect(controls.canAccept.value).toBe(false);
  },
);

it("ordinary acceptance invalidates same-tour stale transcript/checkpoint but reads do not", async () => {
  const cache = useTourStore();
  const checkpoint = {
    segment: "old",
    point: { lat: "47", lng: "19" },
    delivery: "GENERATED",
  };
  localStorage.setItem(
    `pg-playback-${backendOwner}-${sourceId}`,
    JSON.stringify({ checkpoint }),
  );
  cache.setTour(tour);
  cache.setTextForDisplay("stale transcript");
  const { controls } = consumer();
  await controls.refresh();
  expect(cache.textForDisplay).toBe("stale transcript");
  expect(cache.getPlaybackCheckpoint()).toEqual(checkpoint);
  fetch.mockImplementation(async (path, options) => {
    if (options?.method !== "POST") return read(path, options);
    tour = source({
      active_generation_id: "generation/one",
      playback_generation_id: "generation/one",
    });
    return tour;
  });
  expect(await controls.run("accept")).toBe(true);
  expect(cache.tour?.playback_generation_id).toBe("generation/one");
  expect(cache.textForDisplay).toBe("");
  expect(cache.currentTourRecord).toBeNull();
  expect(cache.getPlaybackCheckpoint()).toBeNull();
  expect(
    localStorage.getItem(`pg-playback-${backendOwner}-${sourceId}`),
  ).toBeNull();
});

it("confirmed acceptance supersedes the matching text retry before reloading the new generation", async () => {
  useTourStore().setTour(tour);
  const experiences = useExperienceStore();
  const oldText: Experience = {
    schema_version: 1,
    revision: 12,
    generation_id: "old-package",
    stop_id: null,
    stop_name: null,
    stops: [],
    location_status: "UNCERTAIN",
    activity: null,
    cue_id: null,
    personal_context: emptyPersonalContext(),
    turns: [],
    available_actions: ["PHOTO"],
    sources: [],
    cues: [],
    remaining_minutes: null,
    limitation: null,
  };
  fetch.mockResolvedValueOnce(oldText);
  await experiences.load(sourceId, "firebase-owner", "old-package");
  fetch.mockRejectedValueOnce(new Error("Lost text action response"));
  await expect(experiences.act({ action: "PHOTO" })).rejects.toThrow();
  expect(experiences.hasPending).toBe(true);
  const { controls } = consumer();
  await controls.refresh();
  fetch.mockImplementation(async (path, options) => {
    if (options?.method !== "POST") return read(path, options);
    tour = source({
      active_generation_id: "generation/one",
      playback_generation_id: "generation/one",
    });
    return tour;
  });
  expect(await controls.run("accept")).toBe(true);
  expect(experiences.view).toBeNull();
  expect(experiences.hasPending).toBe(false);
  expect(experiences.needsReconciliation).toBe(true);
  const count = mutations().length;
  await expect(experiences.act({ action: "PHOTO" })).rejects.toThrow();
  expect(mutations()).toHaveLength(count);
  fetch.mockRejectedValueOnce(new Error("Offline"));
  await expect(experiences.reconcile()).rejects.toThrow("Offline");
  expect(experiences.ready).toBe(false);
  fetch.mockResolvedValueOnce({
    ...oldText,
    revision: 0,
    generation_id: "generation/one",
  });
  await experiences.reconcile();
  expect(experiences.view?.generation_id).toBe("generation/one");
  expect(experiences.view?.revision).toBe(0);
  expect(experiences.ready).toBe(true);
});

it("lost acceptance refresh reconciles both pins, while unrelated cache/account responses stay untouched", async () => {
  const cache = useTourStore();
  cache.setTour(source({ id: "unrelated-tour" }));
  cache.setTextForDisplay("unrelated transcript");
  const { controls } = consumer();
  await controls.refresh();
  fetch.mockImplementation((path, options) =>
    options?.method === "POST"
      ? Promise.reject(new Error("Response lost"))
      : read(path, options),
  );
  await controls.run("accept");
  tour.active_generation_id = "generation/one";
  await controls.refresh();
  expect(controls.pending.value?.kind).toBe("accept");
  tour.playback_generation_id = "generation/one";
  await controls.refresh();
  expect(controls.pending.value).toBeNull();
  expect(cache.tour?.id).toBe("unrelated-tour");
  expect(cache.textForDisplay).toBe("unrelated transcript");
  expect(mutations()).toHaveLength(1);
});

it("fences a late confirmed acceptance from a replaced account, and malformed mutation responses remain retryable", async () => {
  const cache = useTourStore();
  cache.setTour(tour);
  cache.setTextForDisplay("original account transcript");
  const { controls } = consumer();
  await controls.refresh();
  const delayed = Promise.withResolvers<unknown>();
  fetch.mockImplementation((path, options) =>
    options?.method === "POST" ? delayed.promise : read(path, options),
  );
  const acceptance = controls.run("accept");
  await flush();
  useUserStore().user = { uid: "new-account" } as User;
  delayed.resolve(
    source({
      active_generation_id: "generation/one",
      playback_generation_id: "generation/one",
    }),
  );
  expect(await acceptance).toBe(false);
  expect(cache.textForDisplay).toBe("original account transcript");
  expect(controls.sourceTour.value).toBeNull();
  await controls.refresh();
  fetch.mockImplementation((path, options) =>
    options?.method === "POST"
      ? Promise.resolve(source({ id: "wrong-source" }))
      : read(path, options),
  );
  expect(await controls.run("accept")).toBe(false);
  expect(controls.pending.value?.failed).toBe(true);
  expect(cache.textForDisplay).toBe("original account transcript");
});

it("downloads through authenticated fixed research route rather than the archive URL, and ignores late scope results", async () => {
  const { controls, id } = consumer();
  await controls.refresh();
  const click = vi.fn();
  const create = vi
    .spyOn(URL, "createObjectURL")
    .mockReturnValue("blob:research");
  const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.stubGlobal("document", {
    createElement: () => ({ href: "", download: "", click }),
  });
  fetch.mockResolvedValue(new Blob(["{}"], { type: "application/json" }));
  await controls.downloadFile(saved[0]!);
  expect(fetch).toHaveBeenLastCalledWith(
    `/api/research-artifacts/${encodeURIComponent(sourceId)}/archive%2Fraw%3Fone`,
    { responseType: "blob", retry: 0 },
  );
  expect(click).toHaveBeenCalledTimes(1);
  expect(revoke).toHaveBeenCalledWith("blob:research");
  const delayed = Promise.withResolvers<unknown>();
  fetch.mockReturnValue(delayed.promise);
  const download = controls.downloadFile(saved[0]!);
  id.value = "other-tour";
  delayed.resolve(new Blob(["{}"], { type: "application/json" }));
  await download;
  expect(click).toHaveBeenCalledTimes(1);
  create.mockRestore();
  revoke.mockRestore();
  vi.unstubAllGlobals();
});

it("does not reset the active source cache for confirmed cancellation or regeneration", async () => {
  history = [
    generation("generation/one", { status: "RUNNING", stage: "RESEARCH" }),
  ];
  const cache = useTourStore();
  cache.setTour(structuredClone(tour));
  cache.adoptBufferedStory(
    {
      status: "activated",
      buffer_id: "existing-record",
      segment_id: "existing-record",
      generation_id: "old-package",
      stop_id: "museum",
      text: "existing narration",
      content_refs: ["metadata-only-artifact"],
      expires_at: null,
      reason: null,
      discussion_focus: null,
    },
    { lat: "47", lng: "19" },
  );
  cache.setTextForDisplay("still usable ordinary package");
  cache.setTextForSpeech("existing narration");
  const { controls } = consumer();
  await controls.refresh();
  fetch.mockImplementation(async (path, options) => {
    if (options?.method !== "POST") return read(path, options);
    if (path.endsWith("/cancel")) {
      history[0] = { ...history[0]!, status: "CANCELLED" };
      tour.latest_generation_id = "old-package";
      tour.status = "GENERATED";
      return { generation: history[0] };
    }
    const next = generation("next", {
      status: "PENDING",
      stage: "CAPTURE",
      sequence: 2,
      idempotency_key: options.headers!["Idempotency-Key"]!,
    });
    history.unshift(next);
    tour.latest_generation_id = "next";
    tour.status = "GENERATING";
    return { tour, result: "SUCCESS", generation: next };
  });
  expect(await controls.run("cancel")).toBe(true);
  expect(cache.textForDisplay).toBe("still usable ordinary package");
  expect(cache.tour?.latest_generation_id).toBe("old-package");
  expect(cache.tour?.status).toBe("GENERATED");
  expect(await controls.run("regenerate")).toBe(true);
  expect(cache.textForDisplay).toBe("still usable ordinary package");
  expect(cache.tour?.playback_generation_id).toBe("old-package");
  expect(cache.tour?.latest_generation_id).toBe("next");
  expect(cache.tour?.status).toBe("GENERATING");
  expect(cache.textForSpeech).toBe("existing narration");
  expect(cache.currentTourRecord?.id).toBe("existing-record");
});

it("keeps a confirmed preview's navigation-only retry usable during ordinary mutation uncertainty", async () => {
  const { controls } = consumer();
  await controls.refresh();
  const draft = source({
    id: "separate-draft",
    research_preview: {
      source_tour_id: sourceId,
      source_generation_id: "generation/one",
      unverified: true,
      available_stop_ids: [],
      missing_stop_ids: [],
      captured_at: timestamp,
    },
  });
  fetch.mockImplementation((path, options) =>
    options?.method !== "POST"
      ? read(path, options)
      : path.startsWith("/api/research-preview/")
        ? Promise.resolve(draft)
        : Promise.reject(new Error("Response lost")),
  );
  const previews = useResearchPreviewStore();
  await expect(
    previews.open(sourceId, "generation/one", async () => {
      throw new Error("Navigation failed");
    }),
  ).rejects.toThrow("Navigation failed");
  expect(await controls.run("regenerate")).toBe(false);
  const before = mutations().length;
  const navigate = vi.fn<() => Promise<void>>().mockResolvedValue();
  expect(await previews.open(sourceId, "changed-selection", navigate)).toEqual(
    draft,
  );
  expect(navigate).toHaveBeenCalledTimes(1);
  expect(mutations()).toHaveLength(before);
});

it("does not fetch later history pages after the source/account epoch changes", async () => {
  history = Array.from({ length: 100 }, (_, index) =>
    generation(`entry-${index}`),
  );
  const firstPage = Promise.withResolvers<unknown>();
  fetch.mockImplementation((path, options) =>
    options?.query ? firstPage.promise : read(path, options),
  );
  const { controls } = consumer();
  const refresh = controls.refresh();
  useUserStore().user = null;
  useUserStore().user = { uid: "firebase-owner" } as User;
  firstPage.resolve({ generations: history });
  await refresh;
  expect(fetch.mock.calls.filter(([, options]) => options?.query)).toHaveLength(
    1,
  );
  expect(controls.generations.value).toEqual([]);
});

it("never restores old checkpoint/pending metadata on acceptance even if recovery-key removal fails", async () => {
  const cache = useTourStore();
  localStorage.setItem(
    `pg-playback-${backendOwner}-${sourceId}`,
    JSON.stringify({
      checkpoint: {
        segment: "old-package",
        point: { lat: "47", lng: "19" },
        delivery: "GENERATED",
      },
      pendingOperation: {
        id: "old-generation-request",
        params: { point: { lat: "47", lng: "19" } },
      },
      pendingControl: {
        id: "old-generation-control",
        params: { point: { lat: "47", lng: "19" } },
      },
    }),
  );
  cache.setTour(tour);
  const { controls } = consumer();
  await controls.refresh();
  const remove = vi.spyOn(localStorage, "removeItem").mockImplementation(() => {
    throw new Error("Storage blocked");
  });
  const readRecovery = vi.spyOn(localStorage, "getItem");
  fetch.mockImplementation((path, options) =>
    options?.method !== "POST"
      ? read(path, options)
      : Promise.resolve(
          source({
            active_generation_id: "generation/one",
            playback_generation_id: "generation/one",
          }),
        ),
  );
  try {
    expect(await controls.run("accept")).toBe(true);
    expect(cache.getPlaybackCheckpoint()).toBeNull();
    expect(cache.tour?.playback_generation_id).toBe("generation/one");
    expect(
      readRecovery.mock.calls.some(
        ([key]) => key === `pg-playback-${backendOwner}-${sourceId}`,
      ),
    ).toBe(false);
  } finally {
    remove.mockRestore();
    readRecovery.mockRestore();
  }
});
