import { expect, it } from "vitest";
import { activatedStoryRecord } from "../app/utils/activatedStoryRecord";
import { buildTourProgress } from "../shared/utils/tourProgress";
import type { StoryBufferView } from "../shared/types/storyBuffer";
import { useTourStore } from "../app/stores/tourStore";
const view: StoryBufferView = {
  status: "activated",
  buffer_id: "buffer",
  generation_id: "gen",
  stop_id: "museum",
  text: "This building has another story.",
  segment_id: "buffer",
  content_refs: ["artifact"],
  expires_at: null,
  reason: null,
  discussion_focus: {
    object_id: "museum",
    turn_id: "buffer",
    point: { lat: "47", lng: "19" },
  },
};
const points = [{ id: "museum", name: "City Museum", lat: "47", lng: "19" }];
it("adopts only activated metadata and derives map focus separately from the visitor position", () => {
  const record = activatedStoryRecord(
    view,
    { lat: "47.0001", lng: "19.0001" },
    points,
  );
  expect(record.playback_segment_id).toBe("buffer");
  expect(record.point).toEqual({ name: null, lat: "47.0001", lng: "19.0001" });
  expect(record.audio_data).toBeNull();
  expect(
    buildTourProgress({ tour: { route: { points } }, record }).guideObjects,
  ).toEqual([{ name: "City Museum", coordinates: [19, 47], stopPosition: 1 }]);
});
it.each(["prepared", "already_consumed", "exhausted"] as const)(
  "refuses %s content as a new segment",
  (status) => {
    expect(() =>
      activatedStoryRecord(
        { ...view, status },
        { lat: "47", lng: "19" },
        points,
      ),
    ).toThrow();
  },
);
it("refuses focus metadata that identifies a different turn", () => {
  expect(() =>
    activatedStoryRecord(
      {
        ...view,
        discussion_focus: { ...view.discussion_focus!, turn_id: "another" },
      },
      { lat: "47", lng: "19" },
      points,
    ),
  ).toThrow();
});
it("does not append activated metadata twice when a handoff is reconciled", () => {
  const store = useTourStore();
  store.setTour({
    id: "tour",
    user_id: "owner",
    playback_generation_id: "gen",
    route: { id: "route", name: "Walk", context: "", points },
    name: "Walk",
    image: "",
    description: "",
    guide_id: "guide",
    context: "",
    history: [],
    created_at: "2026-09-30T12:00:00Z",
    generated_at: null,
    finished_at: null,
    status: "READY",
    settings: [],
    tags: [],
    generating_percent: 100,
    generating_string: "",
    guide: {
      id: "guide",
      name: "Guide",
      skills: "",
      avatar: "",
      context: "",
      tags: [],
    },
  });
  const point = { lat: "47", lng: "19" };
  store.adoptBufferedStory(view, point);
  store.adoptBufferedStory(view, point);
  expect(store.textForDisplay).toBe("This building has another story.");
  expect(store.getPlaybackCheckpoint()).toEqual({
    segment: "buffer",
    point,
    delivery: "GENERATED",
  });
});
