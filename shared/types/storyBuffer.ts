/** Matches the sibling backend's story-buffer models, including existing audio recovery. */
export interface StoryPoint {
  lat: string;
  lng: string;
}

export interface StoryChunk {
  story_id: string;
  chunk_index: number;
  chunk_count: number;
  sentence_count: number;
  total_sentences: number;
  is_final: boolean;
  requires_explicit_continue?: boolean;
  narration_policy_version?: string;
}
export interface PlaybackBlock {
  reason: string;
  active_segment_id: string | null;
  active_delivery_state:
    "GENERATED" | "STARTED" | "COMPLETED" | "INTERRUPTED" | null;
}
export interface BufferedRecord {
  id: string;
  type: string;
  message: string;
  created_at: string;
  point: StoryPoint & { name?: string | null };
  playback_segment_id?: string | null;
  playback_generation_id?: string | null;
  playback_action_types?: string[];
  audio_artifact_ids?: string[];
  audio_data?: string | null;
  story?: StoryChunk | null;
}
export interface StoryPosition {
  generation_id: string;
  current_segment_id: string;
  stop_id: string;
  point: StoryPoint;
  position_mode?: "gps" | "manual";
  accuracy: number | null;
  recorded_at: string | null;
}
export interface PrepareStory extends StoryPosition {
  remaining_seconds: number;
  /** Legacy fields are retained for immutable pending-operation recovery only. */
  narration_style?: "FULL" | "SHORT";
  duration?: number;
}
export interface ActivateStory extends StoryPosition {
  completed_segment_id: string;
}
export type CancelReason =
  "pause" | "movement" | "question" | "completion" | "visitor_cancel";
export interface CancelStory {
  generation_id: string;
  buffer_id: string;
  reason: CancelReason;
}
export interface StoryBufferView {
  record?: BufferedRecord | null;
  audio_data?: string | null;
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
    "GENERATED" | "STARTED" | "COMPLETED" | "INTERRUPTED" | null;
  paused: boolean;
  active_record?: BufferedRecord | null;
  active_audio_data?: string | null;
  prepared: StoryBufferView | null;
  last_activation: StoryBufferView | null;
  prepare_requested_for_current_segment: boolean;
}

/** The proxy distinguishes an unsupported optional endpoint from tour/auth failures. */
export type StoryBufferMetadata =
  StoryBufferState | { status: "unavailable"; reason: "unsupported_backend" };
