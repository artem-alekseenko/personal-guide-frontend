import { beforeEach, expect, it, vi } from "vitest";
import { ref } from "vue";
import type {
  ICreatedTour,
  ITourRecord,
  ITourRecordRequest,
} from "../app/types";
import {
  useTourActions,
  type TourActionsOptions,
} from "../app/composables/tour/useTourActions";
import type { TourState } from "../app/composables/tour/useTourState";
import { useTourStore } from "../app/stores/tourStore";

const api = vi.hoisted(() => ({ next: vi.fn() }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../app/composables/api/tours/useGetTourRecord", () => ({
  useGetTourRecord: api.next,
}));
vi.mock("../app/composables/auth/useAuth", () => ({
  useAuth: () => ({
    userPreferences: { value: { llmType: "DEFAULT", voiceType: "DEFAULT" } },
  }),
}));
vi.mock("../app/stores/geolocationStore", () => ({
  useGeolocationStore: () => ({
    accuracy: 5,
    recordedAt: new Date().toISOString(),
  }),
}));

const point = { lat: "47", lng: "19" };
const tour = {
  id: "explicit-continue",
  user_id: "owner",
  playback_generation_id: "generation",
  route: { points: [point] },
  history: [],
} as unknown as ICreatedTour;
const quiet: ITourRecord = {
  id: "quiet",
  type: "SYSTEM_TEXT",
  message: "",
  created_at: "",
  point: { ...point, name: null },
  audio_data: null,
};

function fixture(pendingParams?: ITourRecordRequest) {
  localStorage.setItem(
    "pg-playback-owner-explicit-continue",
    JSON.stringify({
      checkpoint: { segment: "completed-part", point, delivery: "COMPLETED" },
      pendingControl: null,
      pendingOperation: pendingParams
        ? { id: "original-key", payload: "original", params: pendingParams }
        : null,
    }),
  );
  const store = useTourStore();
  store.setTour(tour);
  const state = ref<TourState>("RECORD_FINISHED");
  const player = {
    stopAudio: vi.fn(),
    pauseAudio: vi.fn(),
    playAudio: vi.fn(),
    resumeAudioFromSavedPosition: vi.fn(),
    canResumeAudio: () => false,
    getCurrentPosition: () => 0,
  };
  const actions = useTourActions({
    state,
    setState: (value) => {
      state.value = value;
    },
    clearSavedState: vi.fn(),
    getSavedAudioPosition: () => 0,
    audioPlayer: player as TourActionsOptions["audioPlayer"],
    coordinates: {
      getCurrentCoordinates: () => [19, 47],
      getFallbackCoordinates: () => null,
    } as TourActionsOptions["coordinates"],
    simulationMarker: {} as TourActionsOptions["simulationMarker"],
  });
  return { store, actions, player };
}

beforeEach(() => {
  api.next.mockReset().mockResolvedValue(quiet);
});

it("forwards explicit completed Next from the real button action through the store", async () => {
  const f = fixture();
  await f.actions.handleTourButtonClick();
  expect(api.next).toHaveBeenCalledOnce();
  expect(api.next.mock.calls[0]![1]).toMatchObject({
    point,
    resume: true,
    continue_story: true,
  });
  expect(f.player.playAudio).not.toHaveBeenCalled();
});

it("does not turn automatic resume requests into explicit story continuation", async () => {
  const f = fixture();
  await f.actions.getRecord({ resume: true });
  expect(api.next).toHaveBeenCalledOnce();
  expect(api.next.mock.calls[0]![1]).not.toHaveProperty("continue_story");
  expect(f.player.playAudio).not.toHaveBeenCalled();
});

it("keeps a question separate from retained-story continuation", async () => {
  const f = fixture();
  await f.actions.addQuestion("Why was this district built here?");
  expect(api.next).toHaveBeenCalledOnce();
  expect(api.next.mock.calls[0]![1]).toMatchObject({
    user_text: "Why was this district built here?",
    requested_mode: "QUESTION",
  });
  expect(api.next.mock.calls[0]![1]).not.toHaveProperty("continue_story");
  expect(f.player.playAudio).not.toHaveBeenCalled();
});

it.each([true, undefined])(
  "reconciles the original uncertain continuation intent (%s) without changing its key/body",
  async (continueStory) => {
    const params: ITourRecordRequest = {
      duration: 30,
      point,
      user_text: "",
      type_llm: "DEFAULT",
      type_voice: "DEFAULT",
      ...(continueStory ? { continue_story: true } : {}),
    };
    const f = fixture(params);
    await f.actions.handleTourButtonClick();
    expect(api.next).toHaveBeenCalledOnce();
    expect(api.next).toHaveBeenCalledWith(
      "explicit-continue",
      params,
      "original-key",
    );
    expect(f.player.playAudio).not.toHaveBeenCalled();
  },
);

it("never forwards continuation on a new question even if supplied alongside it", async () => {
  const f = fixture();
  f.store.setUserText("What happened on this street?");
  await f.store.fetchTourStep(point, { continue_story: true, resume: true });
  expect(api.next.mock.calls[0]![1]).not.toHaveProperty("continue_story");
});
