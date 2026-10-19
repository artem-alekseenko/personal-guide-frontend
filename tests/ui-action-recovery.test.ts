import { beforeEach, expect, it, vi } from "vitest";
import { ref } from "vue";
import type { ITourRecord } from "../app/types";
import type { TourState } from "../app/composables/tour/useTourState";
import { useTourActions } from "../app/composables/tour/useTourActions";
import type { TourActionsOptions } from "../app/composables/tour/useTourActions";

const fake = vi.hoisted(() => ({
  record: null as ITourRecord | null,
  speech: "",
  userText: "",
  setUserText: vi.fn(),
  fetch: vi.fn(),
  recover: vi.fn(),
  pending: vi.fn(),
  control: vi.fn(),
  ack: vi.fn(),
  checkpoint: null as {
    segment: string;
    point: { lat: string; lng: string };
    delivery: "GENERATED" | "STARTED" | "COMPLETED" | "INTERRUPTED";
  } | null,
}));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../app/stores/tourStore", () => ({
  useTourStore: () => ({
    get currentTourRecord() {
      return fake.record;
    },
    get textForSpeech() {
      return fake.speech;
    },
    setUserText: fake.setUserText,
    recoverActivePlayback: fake.recover,
    recoverPendingNarration: fake.pending,
    getPlaybackCheckpoint: () => fake.checkpoint,
    fetchTourStep: fake.fetch,
    sendPlaybackControl: fake.control,
    acknowledgePlayback: fake.ack,
  }),
}));
vi.mock("../app/stores/geolocationStore", () => ({
  useGeolocationStore: () => ({
    accuracy: 5,
    recordedAt: new Date().toISOString(),
  }),
}));
const original: ITourRecord = {
  id: "original-record",
  type: "SYSTEM_TEXT",
  created_at: "",
  message: "Original supported speech.",
  point: { name: null, lat: "47", lng: "19" },
  audio_data: null,
  playback_segment_id: "original",
};
function fixture() {
  const state = ref<TourState>("RECORD_PAUSED");
  const audio = {
    playAudio: vi.fn().mockResolvedValue(true),
    pauseAudio: vi.fn(),
    stopAudio: vi.fn(),
    resumeAudioFromSavedPosition: vi.fn().mockResolvedValue(true),
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
    audioPlayer: audio as TourActionsOptions["audioPlayer"],
    coordinates: {
      getCurrentCoordinates: () => [19, 47],
      getFallbackCoordinates: () => null,
    } as TourActionsOptions["coordinates"],
    simulationMarker: {} as TourActionsOptions["simulationMarker"],
  });
  return { actions, audio, state };
}
beforeEach(() => {
  fake.record = null;
  fake.speech = "";
  fake.checkpoint = null;
  fake.fetch.mockReset();
  fake.recover.mockReset();
  fake.pending.mockReset();
  fake.control.mockReset();
  fake.ack.mockReset();
  fake.userText = "";
  fake.setUserText.mockReset().mockImplementation((text: string) => {
    fake.userText = text;
  });
});
it("never turns missing original audio into an implicit interruption or a fresh narration POST", async () => {
  fake.record = original;
  fake.speech = original.message;
  fake.checkpoint = {
    segment: "original",
    point: original.point,
    delivery: "GENERATED",
  };
  fake.recover.mockResolvedValue(true);
  const f = fixture();
  await f.actions.resumeTour();
  expect(fake.fetch).not.toHaveBeenCalled();
  expect(fake.ack).not.toHaveBeenCalled();
  expect(f.audio.playAudio).not.toHaveBeenCalled();
  expect(f.state.value).toBe("RECORD_PAUSED");
});
it("recovers old empty responses without playback_block and leaves original audio paused", async () => {
  fake.fetch.mockResolvedValue({
    ...original,
    id: "quiet",
    message: "",
    audio_data: null,
  });
  fake.recover.mockImplementation(async () => {
    fake.record = { ...original, audio_data: "existing-artifact" };
    fake.speech = original.message;
    return true;
  });
  const f = fixture();
  await f.actions.getRecord();
  expect(fake.fetch).toHaveBeenCalledOnce();
  expect(f.audio.playAudio).not.toHaveBeenCalled();
  expect(f.state.value).toBe("RECORD_PAUSED");
  expect(fake.ack).not.toHaveBeenCalledWith("COMPLETED");
});

it("retries an uncertain original answer without interrupting it or creating a replacement", async () => {
  fake.pending.mockImplementation(async () => {
    fake.record = { ...original, audio_data: "original-answer" };
    fake.speech = original.message;
    fake.checkpoint = {
      segment: "original",
      point: original.point,
      delivery: "GENERATED",
    };
    return fake.record;
  });
  const f = fixture();
  f.state.value = "ERROR";
  await f.actions.handleTourButtonClick();
  expect(fake.fetch).not.toHaveBeenCalled();
  expect(fake.ack).not.toHaveBeenCalledWith("INTERRUPTED");
  expect(fake.ack).toHaveBeenCalledWith("STARTED");
  expect(f.audio.playAudio).toHaveBeenCalledOnce();
  expect(f.state.value).toBe("RECORD_ACTIVE");
});

it("keeps a newly submitted question after reconciling an older uncertain operation", async () => {
  fake.pending.mockImplementation(async () => {
    fake.userText = "";
    fake.record = { ...original, audio_data: "old-answer" };
    fake.speech = original.message;
    fake.checkpoint = {
      segment: "original",
      point: original.point,
      delivery: "GENERATED",
    };
    return fake.record;
  });
  let submittedQuestion = "";
  fake.fetch.mockImplementation(async () => {
    submittedQuestion = fake.userText;
    fake.record = {
      ...original,
      playback_segment_id: "new-answer",
      audio_data: "new-answer",
    };
    fake.checkpoint = {
      segment: "new-answer",
      point: original.point,
      delivery: "GENERATED",
    };
    return fake.record;
  });
  const f = fixture();
  await f.actions.addQuestion("Why was the market built here?");
  expect(submittedQuestion).toBe("Why was the market built here?");
  expect(fake.ack).toHaveBeenCalledWith("INTERRUPTED");
  expect(f.state.value).toBe("RECORD_ACTIVE");
});

it("cannot resume or directly replay an already consumed recovered segment", async () => {
  fake.record = { ...original, audio_data: "existing-artifact" };
  fake.speech = original.message;
  fake.checkpoint = {
    segment: "original",
    point: original.point,
    delivery: "COMPLETED",
  };
  const f = fixture();
  await f.actions.resumeTour();
  await f.actions.playChunk();
  expect(f.audio.playAudio).not.toHaveBeenCalled();
  expect(fake.control).not.toHaveBeenCalled();
  expect(fake.fetch).not.toHaveBeenCalled();
  expect(f.state.value).toBe("RECORD_FINISHED");
});

it("plays legacy speech without requiring a versioned delivery checkpoint", async () => {
  fake.record = {
    ...original,
    playback_segment_id: null,
    audio_data: "legacy-artifact",
  };
  fake.speech = original.message;
  const f = fixture();
  await f.actions.playChunk();
  expect(f.audio.playAudio).toHaveBeenCalledOnce();
  expect(f.state.value).toBe("RECORD_ACTIVE");
});
