import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, ref } from "vue";
import type { User } from "firebase/auth";
import type { ICreatedTour } from "../app/types";
import type { TourState } from "../app/composables/tour/useTourState";
import type {
  CancelReason,
  StoryBufferMetadata,
} from "../shared/types/storyBuffer";
import { useStoryContinuation } from "../app/composables/tour/useStoryContinuation";
import { useTourStore } from "../app/stores/tourStore";
import { useUserStore } from "../app/stores/userStore";
import { mount } from "./helpers/render";

const transport = vi.hoisted(() => ({
  state: vi.fn(),
  prepare: vi.fn(),
  activate: vi.fn(),
  cancel: vi.fn(),
}));
vi.mock("../app/composables/api/tours/useStoryBufferApi", () => ({
  useStoryBufferApi: () => transport,
}));
vi.mock("../app/composables/auth/useAuth", () => ({
  useAuth: () => ({
    userPreferences: {
      value: { llmType: "DEFAULT", voiceType: "DEFAULT", language: "en" },
    },
  }),
}));
vi.mock("../app/stores/geolocationStore", () => ({
  useGeolocationStore: () => ({
    error: null,
    coordinates: [19, 47],
    accuracy: 5,
    recordedAt: new Date().toISOString(),
  }),
}));

const metadata: StoryBufferMetadata = {
  generation_id: "generation",
  active_segment_id: "original",
  active_delivery_state: "GENERATED",
  paused: false,
  active_record: {
    id: "original-record",
    type: "SYSTEM_TEXT",
    created_at: "",
    message: "Original source-grounded story.",
    point: { name: null, lat: "47", lng: "19" },
    playback_segment_id: "original",
    audio_data: "existing-artifact",
  },
  active_audio_data: "existing-artifact",
  prepared: null,
  last_activation: null,
  prepare_requested_for_current_segment: false,
};
const empty: StoryBufferMetadata = {
  ...metadata,
  active_segment_id: null,
  active_delivery_state: null,
  active_record: null,
  active_audio_data: null,
};
const mounted: Array<{ unmount: () => void }> = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("document", {
    hidden: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  transport.state.mockReset();
  transport.prepare.mockReset();
  transport.activate.mockReset();
  transport.cancel.mockReset();
});
afterEach(() => {
  mounted.splice(0).forEach((app) => app.unmount());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function consumer() {
  const users = useUserStore();
  users.setUser({ uid: "owner" } as User);
  const tours = useTourStore();
  tours.setTour({
    id: "tour",
    user_id: "owner",
    status: "ACTIVE",
    playback_generation_id: "generation",
    route: { points: [] },
    history: [],
  } as unknown as ICreatedTour);
  let resolve!: (value: StoryBufferMetadata) => void;
  const response = new Promise<StoryBufferMetadata>((done) => {
    resolve = done;
  });
  transport.state.mockReturnValueOnce(response).mockResolvedValue(empty);
  const state = ref<TourState>("INITIAL");
  const setState = vi.fn((value: TourState) => {
    state.value = value;
  });
  let suspend!: (reason: CancelReason) => Promise<void>;
  const app = mount(
    defineComponent({
      setup() {
        suspend = useStoryContinuation({
          tourId: "tour",
          featureEnabled: true,
          state,
          setState,
          remainingSeconds: () => NaN,
          play: vi.fn(),
          requestNext: vi.fn(),
          getPosition: () => [19, 47],
        }).suspend;
        return () => h("div");
      },
    }),
  );
  mounted.push(app);
  return { users, tours, state, setState, suspend, app, resolve };
}
async function settle() {
  for (let step = 0; step < 12; step++) await Promise.resolve();
  await nextTick();
}
it("does not restore a cancelled metadata read into the still-open tour", async () => {
  const fixture = consumer();
  await fixture.suspend("visitor_cancel");
  fixture.resolve(metadata);
  await settle();
  expect(fixture.tours.currentTourRecord).toBeNull();
  expect(fixture.tours.getPlaybackCheckpoint()).toBeNull();
  expect(fixture.setState).not.toHaveBeenCalled();
  expect(localStorage.getItem("pg-playback-owner-tour")).toBeNull();
});
it("cannot resurrect recovery after completing and disposing the tour page", async () => {
  const fixture = consumer();
  await fixture.suspend("completion");
  fixture.tours.setTour({ ...fixture.tours.tour!, status: "FINISHED" });
  fixture.state.value = "TOUR_FINISHED";
  fixture.app.unmount();
  mounted.splice(mounted.indexOf(fixture.app), 1);
  fixture.resolve(metadata);
  await settle();
  expect(fixture.tours.getPlaybackCheckpoint()).toBeNull();
  expect(fixture.setState).not.toHaveBeenCalled();
  expect(localStorage.getItem("pg-playback-owner-tour")).toBeNull();
});
it("fences an old metadata response when the same UID signs in again", async () => {
  const fixture = consumer();
  fixture.users.reset();
  fixture.users.setUser({ uid: "owner" } as User);
  fixture.resolve(metadata);
  await settle();
  expect(fixture.tours.currentTourRecord).toBeNull();
  expect(fixture.tours.getPlaybackCheckpoint()).toBeNull();
  expect(fixture.setState).not.toHaveBeenCalled();
});
