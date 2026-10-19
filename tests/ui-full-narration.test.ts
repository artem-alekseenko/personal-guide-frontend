import { expect, it, vi } from "vitest";
import type {
  ICreatedTour,
  ITourRecord,
  ITourRecordRequest,
} from "../app/types";
import { useTourStore } from "../app/stores/tourStore";

const api = vi.hoisted(() => ({ next: vi.fn() }));
vi.mock("../app/composables/api/tours/useGetTourRecord", () => ({
  useGetTourRecord: api.next,
}));
vi.mock("../app/composables/auth/useAuth", () => ({
  useAuth: () => ({
    userPreferences: { value: { llmType: "DEFAULT", voiceType: "DEFAULT" } },
  }),
}));
const point = { lat: "47", lng: "19" };
const tour = {
  id: "tour-full",
  user_id: "owner",
  playback_generation_id: "generation",
  route: { points: [point] },
  history: [],
} as unknown as ICreatedTour;
const message = "One. Two. Three. Four. Five. Six. Seven. Eight.";
const record: ITourRecord = {
  id: "full-record",
  type: "SYSTEM_TEXT",
  message,
  created_at: "",
  point: { ...point, name: null },
  audio_data: null,
  playback_segment_id: "full-segment",
  playback_generation_id: "generation",
  story: {
    story_id: "full-story",
    chunk_index: 0,
    chunk_count: 1,
    sentence_count: 8,
    total_sentences: 8,
    is_final: true,
  },
};

it("retains the entire response and sends no narration-length choice for a fresh question", async () => {
  api.next.mockResolvedValue(record);
  const store = useTourStore();
  store.setTour(tour);
  store.setUserText("Explain this place.");
  await store.fetchTourStep(point, { duration: 60, narration_style: "SHORT" });
  const params = api.next.mock.calls[0]![1];
  expect(params.requested_mode).toBe("QUESTION");
  expect(params).not.toHaveProperty("duration");
  expect(params).not.toHaveProperty("narration_style");
  expect(store.currentTourRecord?.message).toBe(message);
  expect(store.textForDisplay).toBe(message);
  expect(store.textForSpeech).toBe(message);
  expect(store.currentTourRecord?.story?.chunk_count).toBe(1);
  expect(store.getPlaybackCheckpoint()?.delivery).toBe("GENERATED");
  expect(api.next).toHaveBeenCalledOnce();
});

it("reconciles a stored legacy operation with its exact original body and key", async () => {
  const params: ITourRecordRequest = {
    duration: 90,
    narration_style: "SHORT",
    point,
    user_text: "Original question",
    type_llm: "DEFAULT",
    type_voice: "DEFAULT",
  };
  localStorage.setItem(
    "pg-playback-owner-tour-full",
    JSON.stringify({
      checkpoint: null,
      pendingControl: null,
      pendingOperation: { id: "original-key", payload: "original", params },
    }),
  );
  api.next.mockResolvedValue(record);
  const store = useTourStore();
  store.setTour(tour);
  await store.fetchTourStep({ lat: "48", lng: "20" });
  expect(api.next).toHaveBeenCalledWith("tour-full", params, "original-key");
  expect(store.textForDisplay).toBe(message);
});

it("preserves duration-zero silence requests", async () => {
  api.next.mockResolvedValue({
    ...record,
    message: "",
    playback_segment_id: null,
    story: null,
  });
  const store = useTourStore();
  store.setTour(tour);
  await store.fetchTourStep(point, { duration: 0 });
  expect(api.next.mock.calls[0]![1].duration).toBe(0);
});

it("does not adopt a response from a superseded tour", async () => {
  let resolve!: (value: ITourRecord) => void;
  api.next.mockImplementationOnce(
    () =>
      new Promise<ITourRecord>((done) => {
        resolve = done;
      }),
  );
  const store = useTourStore();
  store.setTour(tour);
  const pending = store.fetchTourStep(point);
  store.setTour({ ...tour, id: "another-tour" });
  resolve(record);
  await pending;
  expect(store.currentTourRecord).toBeNull();
  expect(store.textForDisplay).toBe("");
});
