import type { PersonalContext } from "./personalContext";

export interface WalkPoint {
  lat: number;
  lng: number;
}
export interface WalkingRouteIntent {
  origin: WalkPoint;
  destination?: WalkPoint | null;
  duration_minutes: number;
  pace: "relaxed" | "normal" | "brisk";
  interests: string[];
  excluded_topics: string[];
  language: string;
  wheelchair: boolean;
  step_free: boolean;
}
export interface WalkingRoutePlan {
  id: string;
  revision: string;
  intent: WalkingRouteIntent;
  geometry: WalkPoint[];
  leg_starts: number[];
  provider: string;
  duration_seconds: number;
  distance_meters: number;
  segments: {
    id: string;
    start_index: number;
    end_index: number;
    start_meters: number;
    end_meters: number;
  }[];
  instructions: string[];
  warnings: string[];
}
export interface CreateNativeWalk {
  contract_version: 3;
  guide_id: string;
  walking_plan_id: string;
  personal_context: PersonalContext;
  settings: { name: string; value: string }[];
}
export type WalkAction =
  | "START"
  | "LOCATION_UPDATE"
  | "ACTIVATE"
  | "CONTINUE"
  | "MORE"
  | "ASK"
  | "PAUSE"
  | "REST"
  | "RESUME"
  | "REOPEN"
  | "FINISH"
  | "ACKNOWLEDGE"
  | "SET_MODE";
export interface WalkRequest {
  action: WalkAction;
  operation_id: string;
  expected_generation_id: string;
  expected_route_revision: string;
  language: string;
  point?: WalkPoint;
  recorded_at?: string;
  accuracy_meters?: number;
  position_mode?: "gps" | "simulation";
  subject_id?: string;
  question?: string;
  eligible_action_id?: string;
  delivery_id?: string;
  delivery_state?: "started" | "completed" | "interrupted";
  scheduling_mode?: "automatic" | "manual";
}
export interface WalkDelivery {
  id: string;
  kind?: "story" | "transition";
  subject_id: string | null;
  text: string;
  claim_ids: string[];
  source_ids: string[];
  unverified_claim_ids: string[];
  evidence_status: "verified" | "unverified" | "not_applicable";
  state: "offered" | "started";
  created_at: string;
}
export interface WalkView {
  contract_version: 3;
  session_id: string;
  generation_id: string;
  route_id: string;
  route_revision: string;
  language: string;
  revision: number;
  control_revision: number;
  scheduling_mode: "automatic" | "manual";
  position_mode?: "gps" | "simulation";
  paused: boolean;
  started: boolean;
  elapsed_active_seconds: number;
  remaining_seconds: number;
  progress: null | {
    route_id: string;
    route_revision: string;
    recorded_at: string;
    point: WalkPoint;
    leg_index: number;
    segment_id: string | null;
    distance_meters: number;
    furthest_meters: number;
    cross_track_meters: number;
    accuracy_meters: number;
    reliable: boolean;
    ambiguous: boolean;
    completed: boolean;
    reason: string | null;
  };
  context: {
    geographic_subject_ids: string[];
    discussion_subject_id: string | null;
    eligible_claim_ids: string[];
    delivered_claim_ids: string[];
  };
  eligible_action: null | {
    id: string;
    kind?: "story" | "transition";
    operation_id: string;
    generation_id: string;
    route_revision: string;
    language: string;
    control_revision: number;
    location_revision: number;
    subject_id: string | null;
    claim_ids: string[];
    expires_at: string;
  };
  active_delivery: WalkDelivery | null;
  offered_delivery: WalkDelivery | null;
  research_gaps: { id: string; subject_id: string | null; reason: string }[];
  continued_after_finish?: boolean;
  finished: boolean;
  completion_reason: string | null;
  silence_reason: string | null;
}
export interface WalkKnowledge {
  generation_id: string;
  route_revision: string;
  language: string;
  subjects?: { id: string; name: string; kind?: string }[];
  coverage?: { subject_id: string; status: string; claim_ids: string[] }[];
  knowledge_status?: string;
}
export interface WalkAudioManifest {
  manifest_id: string;
  canonical_text_hash: string;
  rendering_policy_version: string;
  complete: boolean;
  chunks: {
    ordered_index: number;
    audio_artifact_id: string | null;
    language: string;
    codec: string;
    failure: string | null;
  }[];
}
