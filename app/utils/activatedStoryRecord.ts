import type { ITourRecord, IRoutePoint } from "~/types";
import type { StoryBufferView, StoryPoint } from "#shared/types/storyBuffer";

/** Canonical activation, never preparation, replaces the playable/displayed segment. */
export function activatedStoryRecord(
  view: StoryBufferView,
  position: StoryPoint,
  stops: readonly IRoutePoint[],
): ITourRecord {
  if (
    view.status !== "activated" ||
    !view.segment_id ||
    view.buffer_id !== view.segment_id ||
    !view.generation_id ||
    !view.text?.trim() ||
    view.content_refs.length !== 1 ||
    (view.discussion_focus &&
      (view.discussion_focus.turn_id !== view.segment_id ||
        view.discussion_focus.object_id !== view.stop_id)) ||
    (view.record &&
      (view.record.playback_segment_id !== view.segment_id ||
        view.record.playback_generation_id !== view.generation_id ||
        view.record.message !== view.text))
  )
    throw new Error("Invalid story activation");
  const focus = view.discussion_focus;
  const stop = stops.find(
    (point, i) => (point.id || `route_point_${i}`) === focus?.object_id,
  );
  return {
    ...(view.record ?? {}),
    id: view.segment_id,
    type: "SYSTEM_TEXT",
    message: view.text,
    created_at: new Date().toISOString(),
    point: { name: null, ...(view.record?.point ?? position) },
    audio_data: view.audio_data ?? view.record?.audio_data ?? null,
    audio_artifact_ids: [...view.content_refs],
    playback_segment_id: view.segment_id,
    playback_generation_id: view.generation_id,
    playback_action_types: ["SPEAK"],
    discussion_focus: focus,
    places: focus && stop ? [{ name: stop.name, ...focus.point }] : [],
    story: view.record?.story ?? null,
  };
}
