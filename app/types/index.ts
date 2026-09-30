import type { PersonalContext } from "./personalContext";
import type { LlmType } from "./llm";
import type { GuideInteractionMode } from "#shared/types/guideInteraction";
import type { ProgressRecord, ProgressState } from "#shared/utils/tourProgress";
export interface ITour {
  id: number;
  image: string;
  name: string;
  description: string;
  route: string;
  context: string;
  history: string[];
  status: string;
  settings: string[];
  tags: string[];
}

export interface IGuide {
  interaction_mode?: GuideInteractionMode;
  id: string;
  name: string;
  skills: string;
  avatar: string;
  context: string;
  tags: string[];
  tours: ITour[];
}

export interface IGuidesResponse {
  guides: IGuide[];
}

export interface ICoordinate {
  lat: string;
  lng: string;
}

export interface IRoutePoint extends ICoordinate {
  id?: string;
  source?: string | null;
  source_id?: string | null;
  name: string;
}

export interface IRoute {
  geometry?: ICoordinate[];
  name: string;
  points: ICoordinate[];
  provider?: string;
  stops?: {
    name: string;
    point: IPoint;
    source?: string;
    source_id?: string | null;
  }[];
  total_minutes?: number;
}

interface IGeneratedRoute {
  geometry?: ICoordinate[];
  variant?: string | null;
  id: string;
  points: IRoutePoint[];
  context: string;
  name: string;
}

interface ISetting {
  name: string;
  value: string;
}

interface IHighPlace {
  name: string;
  point: IPoint;
}

export interface IRouteSuggestionsResponse {
  routes: IRoute[];
  description: string;
  high_places: IHighPlace[];
}

export interface IRouteSuggestionsResponseExtended extends IRouteSuggestionsResponse {
  coordinates: [number, number][];
}

export interface IRouteSuggestionsParams {
  lng: string;
  lat: string;
  duration: string;
  guideId: string;

  [key: string]: string | string[];
}

interface ISetting {
  name: string;
  value: string;
}

export interface ICreateTourRequest {
  guide_id: string;
  route: (ICoordinate & {
    name?: string;
    source?: string;
    source_id?: string | null;
  })[];
  settings: ISetting[];
  contract_version?: 2;
  route_geometry?: ICoordinate[];
  route_variant?: string;
  duration_minutes?: number;
  personal_context?: PersonalContext;
}

export interface ICreatedTour {
  experience?: ProgressState;
  personal_context?: PersonalContext;
  id: string;
  name: string;
  image: string;
  description: string;
  route: IGeneratedRoute;
  guide_id: string;
  user_id: string;
  context: string;
  history: (ProgressRecord | string)[];
  created_at: string;
  generated_at: string | null;
  finished_at: string | null;
  status: string;
  settings: ISetting[];
  tags: string[];
  guide: Omit<IGuide, "tours">;
  preparation_error?: string | null;
  active_generation_id?: string | null;
  latest_generation_id?: string | null;
  playback_generation_id?: string | null;
  generating_percent: number;
  generating_string: string;
}

export interface IListOfTours {
  tours: ICreatedTour[];
}

export interface IPoint {
  name: string | null;
  lat: string;
  lng: string;
}

export interface ITourGuidance {
  stop_id?: string | null;
  stop_name?: string | null;
  action:
    | "ARRIVE"
    | "CONTINUE"
    | "WALK"
    | "ANSWER"
    | "LOCATE"
    | "COMPLETE"
    | "WAIT";
  reason: string;
  wait_seconds: number;
  requires_resume: boolean;
}

export interface ITourRecord {
  route_points?: IRoutePoint[];
  playback_segment_id?: string | null;
  playback_action_types?: string[];
  guidance?: ITourGuidance | null;
  id: string;
  point: IPoint;
  type: string;
  message: string;
  created_at: string;
  places?: IPoint[];
  audio_data: string | null;
}

export interface IGeoJSONFeature {
  type: string;
  properties: {
    title: string;
    description?: string;
  };
  geometry: {
    type: string;
    coordinates: [number, number];
  };
}

export interface IGeoJSON {
  type: string;
  features: IGeoJSONFeature[] | null;
}

import type { VoiceType } from "./voice";

export interface ITourRecordRequest {
  duration: number;
  point: ICoordinate;
  user_text: string;
  pace?: number;
  location_accuracy_meters?: number;
  location_recorded_at?: string;
  paused?: boolean;
  resume?: boolean;
  acknowledged_segment_id?: string;
  acknowledged_delivery_state?: "STARTED" | "COMPLETED" | "INTERRUPTED";
  type_llm: LlmType;
  type_voice: VoiceType;
}

export interface ITourRecordResponse {
  route_points?: IRoutePoint[];
  places: IPoint[];
  record: ITourRecord;
  audio_data: string | null;
}

export interface ITourTag {
  name: string;
  is_selected: boolean;
}

export type TypeFrom<T> = T[keyof T];

export type { IGeolocationStore } from "./geolocation";

export type TRequestMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "HEAD"
  | "PATCH"
  | "OPTIONS"
  | "CONNECT"
  | "TRACE";

export interface IUserPreferences {
  language: string;
  voiceType: VoiceType;
  llmType: LlmType;
}

export interface IUserProfile {
  id: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string;
  preferences: IUserPreferences;
}

export interface IServerUserResponse {
  personal_context?: PersonalContext | null;
  id: string;
  name: string;
  avatar: string | null;
  email: string | null;
  full_name: string | null;
  disabled: boolean;
  is_admin: boolean;
  context: string;
  language: string;
  preferences: any[];
}

export interface IUserStats {
  totalTours: number;
  completedTours: number;
  totalDistance: number; // in meters
  totalTime: number; // in minutes
  favoriteGuides: string[];
  visitedPlaces: number;
}
