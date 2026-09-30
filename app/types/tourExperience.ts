import type { LlmType } from "./llm";
import type { PersonalContext } from "./personalContext";
import type { ICoordinate } from "./index";
import type { GuideInteractionMode } from "#shared/types/guideInteraction";
export type Intent =
  | "ASK"
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
  cue_id?: string;
  text?: string;
  context?: PersonalContext;
  point?: ICoordinate;
  accuracy?: number;
  recorded_at?: string;
  type_llm?: LlmType;
}
export interface Navigation {
  status:
    | "available"
    | "location_required"
    | "accessibility_unverified"
    | "destination_required"
    | "time_limit"
    | "complete"
    | "unavailable";
  target_name?: string;
  target_id?: string;
  destination_kind?: "requested" | "route_start" | "route_end" | "next";
  instructions?: string[];
  warnings?: string[];
  checked_at?: string;
  walking_minutes?: number;
  remaining_minutes?: number;
}
export interface Experience {
  interaction_mode?: GuideInteractionMode;
  navigation?: Navigation | null;
  schema_version: number;
  revision: number;
  generation_id: string | null;
  stop_id: string | null;
  stop_name: string | null;
  stops: { id: string; name: string }[];
  location_status: "GPS_CONFIRMED" | "USER_SELECTED" | "UNCERTAIN" | "REMOTE";
  activity: string | null;
  cue_id: string | null;
  personal_context: PersonalContext;
  turns: {
    id: string;
    stop_id: string;
    role: "visitor" | "guide";
    kind?: "story" | "navigation";
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
  checked_at: string;
}
