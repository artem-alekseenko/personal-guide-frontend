import type { LlmType } from "./llm";
import type { PersonalContext } from "./personalContext";
import type { ICoordinate } from "./index";
import type { GuideInteractionMode } from "#shared/types/guideInteraction";
import type {
  PublicMapSubject,
  RouteDiscovery,
  NearbyPublicDiscovery,
} from "./routeDiscovery";
export type Intent =
  | "ASK"
  | "ASK_GENERAL"
  | "MORE"
  | "SHORTER"
  | "KNOW_THIS"
  | "OBSERVE"
  | "PHOTO"
  | "LOCAL_TALK"
  | "BREAK"
  | "ANSWER"
  | "SKIP"
  | "DONE"
  | "CONTINUE"
  | "LOCATION_UPDATE"
  | "UPDATE_CONTEXT"
  | "FORGET_CONTEXT";
export interface Interaction {
  action: Intent;
  stop_id?: string;
  subject_place_id?: string;
  cue_id?: string;
  text?: string;
  context?: PersonalContext;
  point?: ICoordinate;
  accuracy?: number;
  recorded_at?: string;
  type_llm?: LlmType;
}
export interface Navigation {
  route_context?: "local_route" | "remote_travel";
  current_maneuver?: string | null;
  status:
    | "available"
    | "location_required"
    | "accessibility_unverified"
    | "destination_required"
    | "time_limit"
    | "complete"
    | "unavailable"
    | "remote_travel";
  target_name?: string;
  target_id?: string;
  destination_kind?: "requested" | "route_start" | "route_end" | "next";
  instructions?: string[];
  warnings?: string[];
  checked_at?: string;
  walking_minutes?: number;
  remaining_minutes?: number;
}
export interface StoryReadiness {
  status:
    | "NOT_SELECTED"
    | "AVAILABLE"
    | "CONTEXT_ONLY"
    | "UNCHECKED_ACCOUNT"
    | "EXHAUSTED"
    | "MISSING";
  eligible_fact_count: number;
  unspoken_fact_count: number;
  unchecked_account_count: number;
  prepared_story_available: boolean;
}
export interface RouteResearchDepth {
  status: "NOT_PREPARED" | "SHORTFALL" | "ENOUGH_SAVED_TEXT";
  target_seconds: number;
  target_words: number;
  eligible_words: number;
  verified_words: number;
  unverified_words: number;
  estimated_seconds: number;
  missing_words: number;
  words_per_minute: number;
  estimation_method: "deduplicated_claim_text";
}
export interface Experience {
  language?: string;
  story_readiness?: StoryReadiness;
  route_research_depth?: RouteResearchDepth | null;
  route_places?: PublicMapSubject[];
  route_discovery?: RouteDiscovery | null;
  nearby_discovery?: NearbyPublicDiscovery | null;
  interaction_mode?: GuideInteractionMode;
  navigation?: Navigation | null;
  schema_version: number;
  revision: number;
  generation_id: string | null;
  stop_id: string | null;
  stop_name: string | null;
  topic_place_id?: string | null;
  topic_place_name?: string | null;
  stops: { id: string; name: string }[];
  location_status: "GPS_CONFIRMED" | "USER_SELECTED" | "UNCERTAIN" | "REMOTE";
  activity: string | null;
  cue_id: string | null;
  personal_context: PersonalContext;
  turns: {
    id: string;
    stop_id: string;
    subject_place_id?: string | null;
    role: "visitor" | "guide";
    kind?: "story" | "navigation" | "conversation";
    fact_ids?: string[];
    text: string;
    source_ids: string[];
    created_at: string;
  }[];
  available_actions: Intent[];
  sources: ExperienceSource[];
  cues: { id: string; kind: string; text: string; limitations: string[] }[];
  remaining_minutes: number | null;
  limitation: string | null;
}
export interface ExperienceSource {
  id: string;
  title: string;
  url: string;
  checked_at?: string | null;
  kind?: "citation" | "external_review_link";
  attribution?: string | null;
}
