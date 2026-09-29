import { describe, it, expect, vi } from "vitest";
import { nextTick } from "vue";
import { usePositionMode } from "../app/composables/map/usePositionMode";
import { useTourTextSync } from "../app/composables/tour/useTourTextSync";
import { useTourStore } from "../app/stores/tourStore";
import { useRouteStore } from "../app/stores/routeStore";
import { useUserStore } from "../app/stores/userStore";
import { useTourCoordinates } from "../app/composables/tour/useTourCoordinates";
const api = vi.hoisted(() => ({
  next: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  profile: vi.fn(),
  update: vi.fn(),
  geo: { coordinates: null, accuracy: null, recordedAt: null },
}));
vi.mock("../app/composables/api/tours/useGetTourRecord", () => ({
  useGetTourRecord: api.next,
}));
vi.mock("../app/composables/api/tours/useListTours", () => ({
  useListTours: api.list,
}));
vi.mock("../app/composables/api/tours/useCreateTour", () => ({
  useCreateTour: api.create,
}));
vi.mock("../app/composables/api/useUserApi", () => ({
  useUserApi: () => ({
    fetchUserProfile: api.profile,
    updateUserProfile: api.update,
  }),
}));
vi.mock("../app/composables/auth/useAuth", () => ({
  useAuth: () => ({
    userPreferences: { value: useUserStore().userPreferences },
  }),
}));
vi.mock("../app/stores/geolocationStore", () => ({
  useGeolocationStore: () => api.geo,
}));
const tour = (id = "tour-1") => ({
  id,
  route: { points: [{ lat: "47", lng: "19" }] },
  history: [],
  generating_percent: 100,
});
const record = (overrides = {}) => ({
  id: "record-1",
  point: { lat: "47", lng: "19" },
  message: "Hello.",
  type: "SYSTEM_TEXT",
  created_at: "",
  audio_data: "audio",
  ...overrides,
});

describe("existing tour flows", () => {
  it("shares position mode across the page, marker and coordinate consumer", async () => {
    const page = usePositionMode();
    const consumer = usePositionMode();
    page.setManualMode();
    await nextTick();
    expect(consumer.positionMode.value).toBe("manual");
  });
  it("never substitutes a landmark for an unavailable GPS fix", () => {
    useTourStore().setTour(tour() as any);
    const coordinates = useTourCoordinates({
      getSimulationMarkerPosition: () => null,
    });
    expect(coordinates.getCoordinatesWithFallback()).toBeNull();
  });
  it("shares audio sentence highlighting with the text display", () => {
    const player = useTourTextSync();
    const display = useTourTextSync();
    player.highlightSentence(1, { text: "Hello. Next." } as any);
    expect(display.currentSpokenSentence.value).toBe("Hello.");
  });
  it("clears the prior tour transcript when switching tours", () => {
    const store = useTourStore();
    store.setTour(tour() as any);
    store.setTextForDisplay("Private tour one");
    store.setTour(tour("tour-2") as any);
    expect(store.textForDisplay).toBe("");
  });
  it("sends a voice accepted by the backend and does not invent walking speed", async () => {
    api.next.mockResolvedValue(record());
    const store = useTourStore();
    store.setTour(tour() as any);
    await store.fetchTourStep({ lat: "47", lng: "19" });
    const payload = api.next.mock.calls[0][1];
    expect(["DEFAULT", "CARTESIA", "MOCK"]).toContain(payload.type_voice);
    expect(payload.pace).toBeUndefined();
  });
  it("does not append silence to a transcript", async () => {
    api.next.mockResolvedValue(
      record({ message: "", audio_data: null, type: "WAIT" }),
    );
    const store = useTourStore();
    store.setTour(tour() as any);
    store.setTextForDisplay("Previous.");
    await store.fetchTourStep({ lat: "47", lng: "19" });
    expect(store.textForDisplay).toBe("Previous.");
    expect(store.textForSpeech).toBe("");
  });
  it("clears stale tours when the server returns an empty list", async () => {
    api.list.mockResolvedValueOnce([tour()]).mockResolvedValueOnce([]);
    const store = useRouteStore();
    await store.fetchListTours();
    await store.fetchListTours();
    expect(store.allTours).toEqual([]);
    expect(store.actualTour).toBeNull();
    store.stopPolling();
  });
  it("exposes tour creation failure to the page so its loading state can recover", async () => {
    const store = useRouteStore();
    Object.assign(globalThis, {
      useGuidesStore: () => ({ selectedGuide: { id: "guide-1" } }),
    });
    store.setRouteSuggestion({
      routes: [{ points: [{ lat: "47", lng: "19" }] }],
    } as any);
    api.create.mockRejectedValue(new Error("Unavailable"));
    await expect(store.fetchCreateRoute()).rejects.toThrow("Unavailable");
  });
  it("does not apply a slow profile response to a different signed-in user", async () => {
    let resolve!: (value: any) => void;
    api.profile.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const store = useUserStore();
    store.setUser({ uid: "alice" } as any);
    const pending = store.loadServerPreferences();
    store.setUser({ uid: "bob" } as any);
    resolve({ language: "ru" });
    await pending;
    expect(store.userPreferences.language).toBe("en");
  });
});
it("reuses a narration operation key after a failed request, then advances for a new turn", async () => {
  api.next
    .mockRejectedValueOnce(new Error("Timeout"))
    .mockResolvedValue(record());
  const store = useTourStore();
  store.setTour(tour() as any);
  await expect(store.fetchTourStep({ lat: "47", lng: "19" })).rejects.toThrow();
  await store.fetchTourStep({ lat: "47", lng: "19" });
  await store.fetchTourStep({ lat: "47", lng: "19" });
  const keys = api.next.mock.calls.map((call) => call[2]);
  expect(keys[0]).toBeTypeOf("string");
  expect(keys[1]).toBe(keys[0]);
  expect(keys[2]).not.toBe(keys[0]);
});
it("ignores a narration response after its tour has been reset", async () => {
  let resolve!: (value: any) => void;
  api.next.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const store = useTourStore();
  store.setTour(tour() as any);
  const pending = store.fetchTourStep({ lat: "47", lng: "19" });
  await Promise.resolve();
  store.reset();
  resolve(record());
  await pending;
  expect(store.currentTourRecord).toBeNull();
  expect(store.textForDisplay).toBe("");
});
it("retries the original GPS payload after an uncertain failure even if the fix changes", async () => {
  api.next
    .mockRejectedValueOnce(new Error("Timeout"))
    .mockResolvedValue(record());
  const store = useTourStore();
  store.setTour(tour() as any);
  await expect(
    store.fetchTourStep(
      { lat: "47", lng: "19" },
      { location_recorded_at: "2026-09-28T10:00:00Z" },
    ),
  ).rejects.toThrow();
  await store.fetchTourStep(
    { lat: "48", lng: "20" },
    { location_recorded_at: "2026-09-28T10:00:01Z" },
  );
  expect(api.next.mock.calls[1][2]).toBe(api.next.mock.calls[0][2]);
  expect(api.next.mock.calls[1][1]).toEqual(api.next.mock.calls[0][1]);
});
it("recovers an outstanding playback segment after resetting in-memory state", async () => {
  api.next.mockResolvedValue(record({ playback_segment_id: "segment-1" }));
  const store = useTourStore();
  store.setTour(tour() as any);
  await store.fetchTourStep({ lat: "47", lng: "19" });
  store.reset();
  store.setTour(tour() as any);
  await store.acknowledgePlayback("INTERRUPTED");
  expect(api.next.mock.calls[1][1]).toMatchObject({
    duration: 0,
    acknowledged_segment_id: "segment-1",
    acknowledged_delivery_state: "INTERRUPTED",
  });
});
it("does not acknowledge a completed segment again after navigation", async () => {
  api.next.mockResolvedValue(record({ playback_segment_id: "segment-1" }));
  const store = useTourStore();
  store.setTour(tour() as any);
  await store.fetchTourStep({ lat: "47", lng: "19" });
  await store.acknowledgePlayback("COMPLETED");
  store.reset();
  store.setTour(tour() as any);
  await store.acknowledgePlayback("INTERRUPTED");
  expect(api.next).toHaveBeenCalledTimes(2);
});
it("continues polling after a transient failure and stops after leaving", async () => {
  vi.useFakeTimers();
  try {
    api.list
      .mockResolvedValueOnce([{ ...tour(), status: "GENERATING" }])
      .mockRejectedValueOnce(new Error("Network"))
      .mockResolvedValueOnce([{ ...tour(), status: "GENERATED" }]);
    const store = useRouteStore();
    await store.fetchListTours();
    await vi.advanceTimersByTimeAsync(5000);
    expect(store.error).toBe("Network");
    await vi.advanceTimersByTimeAsync(5000);
    expect(api.list).toHaveBeenCalledTimes(3);
    store.stopPolling();
    await vi.advanceTimersByTimeAsync(10000);
    expect(api.list).toHaveBeenCalledTimes(3);
  } finally {
    vi.useRealTimers();
  }
});
it("recovers an uncertain completion acknowledgement before attempting to interrupt", async () => {
  api.next
    .mockResolvedValueOnce(record({ playback_segment_id: "segment-1" }))
    .mockRejectedValueOnce(new Error("Timeout"))
    .mockResolvedValue(
      record({
        audio_data: null,
        playback_action_types: ["INTENTIONAL_SILENCE"],
      }),
    );
  const store = useTourStore();
  store.setTour(tour() as any);
  await store.fetchTourStep({ lat: "47", lng: "19" });
  await expect(store.acknowledgePlayback("COMPLETED")).rejects.toThrow(
    "Timeout",
  );
  store.reset();
  store.setTour(tour() as any);
  await store.acknowledgePlayback("INTERRUPTED");
  expect(api.next.mock.calls[2][1].acknowledged_delivery_state).toBe(
    "COMPLETED",
  );
  expect(api.next.mock.calls[2][2]).toBe(api.next.mock.calls[1][2]);
  expect(api.next).toHaveBeenCalledTimes(3);
});
it("serializes simultaneous completion and interruption of the same segment", async () => {
  api.next.mockResolvedValue(record({ playback_segment_id: "segment-1" }));
  const store = useTourStore();
  store.setTour(tour() as any);
  await store.fetchTourStep({ lat: "47", lng: "19" });
  await Promise.all([
    store.acknowledgePlayback("COMPLETED"),
    store.acknowledgePlayback("INTERRUPTED"),
  ]);
  expect(api.next).toHaveBeenCalledTimes(2);
});
it("discards rejected input so the next request can use a corrected GPS fix", async () => {
  api.next
    .mockRejectedValueOnce(
      Object.assign(new Error("Validation failed"), { statusCode: 422 }),
    )
    .mockResolvedValue(record());
  const store = useTourStore();
  store.setTour(tour() as any);
  await expect(
    store.fetchTourStep(
      { lat: "47", lng: "19" },
      { location_accuracy_meters: 20000 },
    ),
  ).rejects.toThrow();
  await store.fetchTourStep(
    { lat: "47", lng: "19" },
    { location_accuracy_meters: 5 },
  );
  expect(api.next.mock.calls[1][1].location_accuracy_meters).toBe(5);
  expect(api.next.mock.calls[1][2]).not.toBe(api.next.mock.calls[0][2]);
});

it("uses the saved model for new narration but preserves the model on uncertain retries", async () => {
  const user = useUserStore();
  user.setUser({ uid: "alice" } as any);
  user.updatePreferences({ llmType: "OPENAI_MINI" });
  api.next
    .mockRejectedValueOnce(new Error("Timeout"))
    .mockResolvedValue(record());
  const store = useTourStore();
  store.setTour(tour() as any);
  await expect(store.fetchTourStep({ lat: "47", lng: "19" })).rejects.toThrow();
  user.updatePreferences({ llmType: "OPENAI_FULL" });
  await store.fetchTourStep({ lat: "47", lng: "19" });
  await store.fetchTourStep({ lat: "47", lng: "19" });
  expect(api.next.mock.calls.map((call) => call[1].type_llm)).toEqual([
    "OPENAI_MINI",
    "OPENAI_MINI",
    "OPENAI_FULL",
  ]);
});
it("restores the model preference when recreating the user profile", () => {
  const user = useUserStore();
  user.setUser({ uid: "alice" } as any);
  expect(user.userPreferences.llmType).toBe("DEFAULT");
  user.updatePreferences({ llmType: "MOCK" });
  user.reset();
  user.setUser({ uid: "alice" } as any);
  expect(user.userPreferences.llmType).toBe("MOCK");
});
