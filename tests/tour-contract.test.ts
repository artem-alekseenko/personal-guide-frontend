import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRouteStore } from "../app/stores/routeStore";
const suggest = vi.hoisted(() => vi.fn());
const list = vi.hoisted(() => vi.fn());
vi.mock("../app/composables/api/tours/useListTours", () => ({
  useListTours: list,
}));
vi.mock("../app/composables/api/useTourSuggestions", () => ({
  useTourSuggestions: suggest,
}));
const create = vi.fn().mockResolvedValue({ id: "tour-1" });
vi.mock("../app/composables/api/tours/useCreateTour", () => ({
  useCreateTour: (p: unknown) => create(p),
}));
beforeEach(() => {
  suggest.mockReset();
  list.mockReset();
  create.mockReset().mockResolvedValue({ id: "tour-1" });
});
Object.assign(globalThis, {
  useGuidesStore: () => ({ selectedGuide: { id: "guide-1" } }),
});
const variant = (name: string) => ({
  name,
  provider: "google",
  points: [
    { lat: "1", lng: "2" },
    { lat: "1.001", lng: "2.001" },
    { lat: "1.002", lng: "2.002" },
  ],
  stops: [
    {
      name: "Museum",
      point: { lat: "1", lng: "2" },
      source: "google",
      source_id: "a",
    },
    {
      name: "Square",
      point: { lat: "1.002", lng: "2.002" },
      source: "google",
      source_id: "b",
    },
  ],
});
describe("tour creation contract", () => {
  it("keeps stops separate from geometry and preserves intent", async () => {
    const store = useRouteStore();
    store.setDuration("20");
    store.setTags([{ name: "Art", is_selected: true }]);
    store.setRouteSuggestion({
      routes: [variant("easy")],
      coordinates: [],
      description: "",
      high_places: [],
    });
    await store.fetchCreateRoute();
    const p = create.mock.calls[0]![0];
    expect(p.contract_version).toBe(2);
    expect(p.route.map((x: any) => x.name)).toEqual(["Museum", "Square"]);
    expect(p.route_geometry).toHaveLength(3);
    expect(p.duration_minutes).toBe(20);
    expect(p.personal_context.interests).toEqual(["art"]);
  });
  it("rejects a placeholder route before posting", async () => {
    const store = useRouteStore();
    store.setRouteSuggestion({
      routes: [
        {
          name: "No validated walking route",
          points: [{ lat: "1", lng: "2" }],
        },
      ],
      coordinates: [],
      description: "",
      high_places: [],
    });
    await expect(store.fetchCreateRoute()).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });
  it("creates the selected second variant", async () => {
    const store = useRouteStore();
    store.setRouteSuggestion({
      routes: [variant("highlights"), variant("easy")],
      coordinates: [],
      description: "",
      high_places: [],
    });
    expect(typeof (store as any).selectRoute).toBe("function");
    (store as any).selectRoute(1);
    await store.fetchCreateRoute();
    expect(create.mock.calls[0]![0].route_variant).toBe("easy");
  });
});
it("invalidates a route after the start or duration changes", () => {
  const store = useRouteStore();
  store.setRouteSuggestion({
    routes: [variant("easy")],
    coordinates: [],
    description: "",
    high_places: [],
  });
  store.setDuration("30");
  expect(store.canCreate).toBe(false);
  store.setRouteSuggestion({
    routes: [variant("easy")],
    coordinates: [],
    description: "",
    high_places: [],
  });
  store.setStartPoint({ lat: "1", lng: "2" });
  expect(store.canCreate).toBe(false);
});
it("preserves full provider geometry while accepting legacy sampled points", async () => {
  const store = useRouteStore();
  const full = Array.from({ length: 47 }, (_, i) => ({
    lat: String(1 + i / 1000),
    lng: "2",
  }));
  store.setRouteSuggestion({
    routes: [{ ...variant("easy"), geometry: full }],
    coordinates: [],
    description: "",
    high_places: [],
  });
  expect(store.routeSuggestion!.coordinates).toHaveLength(47);
  await store.fetchCreateRoute();
  expect(create.mock.calls[0]![0].route_geometry).toEqual(full);
});

it("invalidates suggestions on nested route preference changes", () => {
  const store = useRouteStore();
  for (const change of [
    () => {
      store.personalContext.pace = "relaxed";
    },
    () => {
      store.personalContext.excluded_topics.push("museum");
    },
    () => {
      store.personalContext.step_free = true;
    },
    () => {
      store.setTags([{ name: "Art", is_selected: true }]);
    },
  ]) {
    store.setRouteSuggestion({
      routes: [variant("easy")],
      coordinates: [],
      description: "",
      high_places: [],
    });
    change();
    expect(store.canCreate).toBe(false);
  }
});

it("preserves explicit interests with tags when creating", async () => {
  const store = useRouteStore();
  store.personalContext.interests = ["science"];
  store.setTags([{ name: "Art", is_selected: true }]);
  store.setRouteSuggestion({
    routes: [variant("easy")],
    coordinates: [],
    description: "",
    high_places: [],
  });
  await store.fetchCreateRoute();
  expect(create.mock.calls[0]![0].personal_context.interests).toEqual([
    "science",
    "art",
  ]);
});

it("sends preferences and ignores a late suggestion after an edit", async () => {
  const store = useRouteStore();
  store.setStartPoint({ lat: "1", lng: "2" });
  store.personalContext.interests = ["science"];
  store.personalContext.excluded_topics = ["museum"];
  store.personalContext.pace = "relaxed";
  store.personalContext.step_free = true;
  let resolve!: (value: unknown) => void;
  suggest.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const pending = store.fetchRoutesSuggestions();
  expect(suggest.mock.calls[0]![0]).toMatchObject({
    interests: ["science"],
    excluded_topics: ["museum"],
    pace: "relaxed",
    step_free: "true",
  });
  store.personalContext.pace = "brisk";
  resolve({
    routes: [variant("easy")],
    coordinates: [],
    description: "",
    high_places: [],
  });
  await pending;
  expect(store.routeSuggestion).toBeNull();
});

it("does not send disabled personal information while retaining access requirements", async () => {
  const store = useRouteStore();
  store.setStartPoint({ lat: "1", lng: "2" });
  store.personalContext.interests = ["science"];
  store.personalContext.note = "Private";
  store.personalContext.step_free = true;
  store.personalContext.enabled = false;
  suggest.mockResolvedValueOnce({
    routes: [],
    coordinates: [],
    description: "",
    high_places: [],
  });
  await store.fetchRoutesSuggestions();
  expect(suggest.mock.calls[0]![0]).toMatchObject({
    interests: [],
    excluded_topics: [],
    personal_context_enabled: "false",
    step_free: "true",
  });
});

it("does not persist disabled or excluded interests through legacy settings", async () => {
  const store = useRouteStore();
  store.setTags([
    { name: "Art", is_selected: true },
    { name: "Politics", is_selected: true },
  ]);
  store.personalContext.excluded_topics = ["politics"];
  store.setRouteSuggestion({
    routes: [variant("easy")],
    coordinates: [],
    description: "",
    high_places: [],
  });
  await store.fetchCreateRoute();
  expect(create.mock.calls.at(-1)![0].settings).toEqual([
    { name: "Art", value: "Art" },
  ]);
  store.personalContext.enabled = false;
  store.setRouteSuggestion({
    routes: [variant("easy")],
    coordinates: [],
    description: "",
    high_places: [],
  });
  await store.fetchCreateRoute();
  expect(create.mock.calls.at(-1)![0].settings).toEqual([]);
});
it("can deselect a saved interest and select an excluded topic without conflicting preferences", () => {
  const store = useRouteStore();
  store.personalContext.interests = ["art"];
  store.personalContext.excluded_topics = ["science"];
  store.toggleInterest("art");
  expect(store.effectiveContext.interests).toEqual([]);
  store.toggleInterest("science");
  expect(store.effectiveContext.interests).toEqual(["science"]);
  expect(store.effectiveContext.excluded_topics).toEqual([]);
});

it.each(["guide", "interactive", "leading"] as const)(
  "creates the walk with its explicit %s interaction preference",
  async (mode) => {
    const store = useRouteStore();
    store.personalContext.interaction_mode = mode;
    store.personalContext.note = "Preserve my context";
    store.setRouteSuggestion({
      routes: [variant("easy")],
      coordinates: [],
      description: "",
      high_places: [],
    });
    await store.fetchCreateRoute();
    expect(create.mock.calls.at(-1)![0].personal_context).toMatchObject({
      interaction_mode: mode,
      note: "Preserve my context",
    });
  },
);

it("retains the operational interaction choice when personal memories are disabled", async () => {
  const store = useRouteStore();
  store.personalContext.interaction_mode = "leading";
  store.personalContext.note = "Private";
  store.personalContext.enabled = false;
  store.setRouteSuggestion({
    routes: [variant("easy")],
    coordinates: [],
    description: "",
    high_places: [],
  });
  await store.fetchCreateRoute();
  expect(create.mock.calls.at(-1)![0].personal_context).toMatchObject({
    enabled: false,
    note: "",
    interaction_mode: "leading",
  });
});

it.each(["duration", "context"])(
  "finishes loading tours after a %s draft edit",
  async (field) => {
    const store = useRouteStore();
    let resolveList!: (value: unknown) => void;
    list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveList = resolve;
        }),
    );
    const loading = store.fetchListTours();
    if (field === "duration") store.setDuration("30");
    else store.personalContext.note = "Draft edit";
    resolveList([{ id: "existing", status: "COMPLETED" }]);
    await loading;
    expect(store.isLoading).toBe(false);
    expect(store.allTours.map((tour) => tour.id)).toEqual(["existing"]);
    store.stopPolling();
  },
);

it.each(["duration", "context"])(
  "retains a successfully created tour after a %s draft edit",
  async (field) => {
    const store = useRouteStore();
    store.setRouteSuggestion({
      routes: [variant("easy")],
      coordinates: [],
      description: "",
      high_places: [],
    });
    let resolveCreate!: (value: unknown) => void;
    create.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );
    const creating = store.fetchCreateRoute();
    if (field === "duration") store.setDuration("30");
    else store.personalContext.note = "Later edit";
    resolveCreate({ id: "created" });
    expect(await creating).toBe(true);
    expect(store.actualTour?.id).toBe("created");
  },
);

it("keeps a late creation out of a reset account's draft", async () => {
  const store = useRouteStore();
  store.setRouteSuggestion({
    routes: [variant("easy")],
    coordinates: [],
    description: "",
    high_places: [],
  });
  let resolveCreate!: (value: unknown) => void;
  create.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveCreate = resolve;
      }),
  );
  const creating = store.fetchCreateRoute();
  store.reset();
  resolveCreate({ id: "previous-account-tour" });
  expect(await creating).toBe(false);
  expect(store.actualTour).toBeNull();
});

it("keeps a reset list request from clearing a newer request's loading state", async () => {
  const store = useRouteStore();
  let resolveOld!: (value: unknown) => void;
  let resolveNew!: (value: unknown) => void;
  list.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  const oldLoad = store.fetchListTours();
  store.reset();
  list.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveNew = resolve;
      }),
  );
  const newLoad = store.fetchListTours();
  resolveOld([{ id: "old" }]);
  await oldLoad;
  expect(store.isLoading).toBe(true);
  expect(store.allTours).toEqual([]);
  resolveNew([{ id: "new" }]);
  await newLoad;
  expect(store.isLoading).toBe(false);
  expect(store.allTours.map((tour) => tour.id)).toEqual(["new"]);
  store.stopPolling();
});

it.each(["pending", "failure"])(
  "resumes %s list polling after remounting during an unfinished request",
  async (result) => {
    vi.useFakeTimers();
    const store = useRouteStore();
    try {
      const deferred = Promise.withResolvers<unknown>();
      list.mockImplementationOnce(() => deferred.promise);
      const loading = store.fetchListTours();
      store.stopPolling();
      await store.fetchListTours();
      expect(list).toHaveBeenCalledTimes(1);
      if (result === "pending")
        deferred.resolve([{ id: "preparing", status: "GENERATING" }]);
      else deferred.reject(new Error("Offline"));
      await loading;
      list.mockResolvedValueOnce([{ id: "ready", status: "GENERATED" }]);
      await vi.advanceTimersByTimeAsync(5000);
      expect(list).toHaveBeenCalledTimes(2);
      expect(store.allTours.map((tour) => tour.id)).toEqual(["ready"]);
      expect(store.error).toBeNull();
      await vi.advanceTimersByTimeAsync(10000);
      expect(list).toHaveBeenCalledTimes(2);
    } finally {
      store.stopPolling();
      vi.useRealTimers();
    }
  },
);

it.each(["duration", "context", "variant"])(
  "does not consume a %s draft edited after its creation was submitted",
  async (field) => {
    const store = useRouteStore();
    store.setStartPoint({ lat: "1", lng: "2" });
    store.personalContext.note = "Original draft";
    store.setRouteSuggestion({
      routes: [variant("easy"), variant("highlights")],
      coordinates: [],
      description: "",
      high_places: [],
    });
    const deferred = Promise.withResolvers<unknown>();
    create.mockImplementationOnce(() => deferred.promise);
    const creating = store.fetchCreateRoute();
    if (field === "duration") store.setDuration("30");
    else if (field === "context") store.personalContext.note = "Later draft";
    else store.selectRoute(1);
    deferred.resolve({ id: "created" });
    expect(await creating).toBe(true);
    await store.initializePersonalContext();
    expect(store.startPoint).toEqual({ lat: "1", lng: "2" });
    expect(store.personalContext.note).toBe(
      field === "context" ? "Later draft" : "Original draft",
    );
    if (field === "duration") expect(store.duration).toBe("30");
    if (field === "variant")
      expect(store.selectedRoute?.name).toBe("highlights");
  },
);

it("serializes creation attempts and releases the creation lock after failure", async () => {
  const store = useRouteStore();
  store.setRouteSuggestion({
    routes: [variant("easy")],
    coordinates: [],
    description: "",
    high_places: [],
  });
  const deferred = Promise.withResolvers<unknown>();
  create.mockImplementationOnce(() => deferred.promise);
  const creating = store.fetchCreateRoute();
  const offline = new Error("Offline");
  const outcome = creating.catch((error: unknown) => error);
  try {
    expect(await store.fetchCreateRoute()).toBe(false);
    expect(create).toHaveBeenCalledTimes(1);
    expect(store.isCreating).toBe(true);
    deferred.reject(offline);
    expect(await outcome).toBe(offline);
    expect(store.isCreating).toBe(false);
    expect(store.canCreate).toBe(true);
    create.mockResolvedValueOnce({ id: "retried" });
    expect(await store.fetchCreateRoute()).toBe(true);
    expect(store.isCreating).toBe(false);
    expect(store.actualTour?.id).toBe("retried");
  } finally {
    deferred.reject(offline);
    await outcome;
  }
});

it("does not release a newer account's creation lock from an old completion", async () => {
  const store = useRouteStore();
  const suggestions = {
    routes: [variant("easy")],
    coordinates: [],
    description: "",
    high_places: [],
  };
  store.setRouteSuggestion(suggestions);
  const oldDeferred = Promise.withResolvers<unknown>();
  const newDeferred = Promise.withResolvers<unknown>();
  create.mockImplementationOnce(() => oldDeferred.promise);
  const oldCreation = store.fetchCreateRoute();
  store.reset();
  store.setRouteSuggestion(suggestions);
  create.mockImplementationOnce(() => newDeferred.promise);
  const newCreation = store.fetchCreateRoute();
  try {
    oldDeferred.resolve({ id: "old" });
    expect(await oldCreation).toBe(false);
    expect(await store.fetchCreateRoute()).toBe(false);
    expect(store.isCreating).toBe(true);
    expect(store.actualTour).toBeNull();
    newDeferred.resolve({ id: "new" });
    expect(await newCreation).toBe(true);
    expect(store.isCreating).toBe(false);
    expect(store.actualTour?.id).toBe("new");
  } finally {
    newDeferred.resolve({ id: "new" });
    await newCreation;
  }
});
