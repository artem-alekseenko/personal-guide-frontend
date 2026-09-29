import { it, expect, vi } from "vitest";
import { ref } from "vue";
import { useTourActions } from "../app/composables/tour/useTourActions";
import { useTourState } from "../app/composables/tour/useTourState";
const fakes = vi.hoisted(() => ({
  push: vi.fn(),
  tour: {
    tour: { id: "tour-1" },
    textForDisplay: "",
    textForSpeech: "",
    currentTourRecord: null as any,
    setUserText: vi.fn(),
    fetchTourStep: vi.fn(),
    sendPlaybackControl: vi.fn(),
    finishTour: vi.fn(),
    acknowledgePlayback: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: fakes.push }) }));
vi.mock("../app/stores/tourStore", () => ({ useTourStore: () => fakes.tour }));
function actions() {
  const state = ref<any>("INITIAL");
  const audio = {
    playAudio: vi.fn().mockResolvedValue(true),
    pauseAudio: vi.fn(),
    stopAudio: vi.fn(),
    resumeAudioFromSavedPosition: vi.fn().mockResolvedValue(true),
    canResumeAudio: () => true,
    getCurrentPosition: () => 9,
  };
  const controls = useTourActions({
    state,
    setState: (s) => {
      state.value = s;
    },
    clearSavedState: vi.fn(),
    getSavedAudioPosition: () => 9,
    audioPlayer: audio as any,
    coordinates: {
      getCurrentCoordinates: () => [19, 47],
      getFallbackCoordinates: () => null,
    } as any,
    simulationMarker: {} as any,
  });
  return { ...controls, state, audio };
}
it("finishes on the backend before navigating away", async () => {
  fakes.tour.finishTour.mockResolvedValue(undefined);
  const a = actions();
  await a.handleCompleteTour();
  expect(fakes.tour.finishTour).toHaveBeenCalledOnce();
  expect(fakes.push).toHaveBeenCalledWith({ name: "tours" });
});
it("keeps the page open when backend finish fails", async () => {
  fakes.tour.finishTour.mockRejectedValue(new Error("Conflict"));
  const a = actions();
  await a.handleCompleteTour();
  expect(fakes.push).not.toHaveBeenCalled();
  expect(a.state.value).not.toBe("TOUR_FINISHED");
});
it("does not enter active playback when a record has no audio", async () => {
  fakes.tour.textForSpeech = "Text without audio";
  fakes.tour.currentTourRecord = {
    message: "Text without audio",
    audio_data: null,
  };
  const a = actions();
  await a.playChunk();
  expect(a.audio.playAudio).not.toHaveBeenCalled();
  expect(a.state.value).toBe("RECORD_FINISHED");
});
it("sends explicit persistent pause to the backend", async () => {
  fakes.tour.currentTourRecord = null;
  fakes.tour.sendPlaybackControl.mockResolvedValue(undefined);
  const a = actions();
  await a.pauseTour();
  expect(fakes.tour.sendPlaybackControl).toHaveBeenCalledWith(
    expect.objectContaining({ paused: true }),
  );
  expect(a.state.value).toBe("RECORD_PAUSED");
});
it("does not restore active playback after reload without an audio payload", () => {
  Object.assign(globalThis, { useTourStore: () => fakes.tour });
  fakes.tour.currentTourRecord = null;
  fakes.tour.textForDisplay = "";
  localStorage.setItem(
    "tour-state-tour-1",
    JSON.stringify({
      state: "RECORD_ACTIVE",
      tourId: "tour-1",
      hasContent: true,
      lastUpdated: Date.now(),
    }),
  );
  expect(useTourState("tour-1").state.value).toBe("INITIAL");
});
