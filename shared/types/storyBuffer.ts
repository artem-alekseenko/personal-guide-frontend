/** Matches the sibling backend's models/story_buffer.py. No recording bytes. */
export interface StoryPoint {
  lat: string;
  lng: string;
}
export interface StoryPosition {
  generation_id: string;
  current_segment_id: string;
  stop_id: string;
  point: StoryPoint;
  accuracy: number;
  recorded_at: string;
}
export interface PrepareStory extends StoryPosition {
  remaining_seconds: number;
}
export interface ActivateStory extends StoryPosition {
  completed_segment_id: string;
}
export type CancelReason =
  | "pause"
  | "movement"
  | "question"
  | "completion"
  | "visitor_cancel";
export interface CancelStory {
  generation_id: string;
  buffer_id: string;
  reason: CancelReason;
}
export interface StoryBufferView {
  status:
    | "prepared"
    | "activated"
    | "already_consumed"
    | "exhausted"
    | "unavailable"
    | "cancelled";
  buffer_id: string | null;
  generation_id: string | null;
  stop_id: string | null;
  expires_at: string | null;
  reason: string | null;
  text: string | null;
  segment_id: string | null;
  content_refs: string[];
  discussion_focus: {
    object_id: string;
    turn_id: string;
    point: StoryPoint;
  } | null;
}
export interface StoryBufferState {
  generation_id: string | null;
  active_segment_id: string | null;
  active_delivery_state?:
    | "GENERATED"
    | "STARTED"
    | "COMPLETED"
    | "INTERRUPTED"
    | null;
  paused: boolean;
  prepared: StoryBufferView | null;
  last_activation: StoryBufferView | null;
  prepare_requested_for_current_segment: boolean;
}
