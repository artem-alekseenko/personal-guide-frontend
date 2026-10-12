import type { ICoordinate } from "./index";

export interface DiscoveredPlace extends ICoordinate {
  id: string;
  name: string;
  source: "google";
  source_id: string;
  types: string[];
  address: string | null;
  distance_to_route_meters: number;
  along_route_meters: number;
  research_status?:
    | "SOURCE_BACKED"
    | "UNCHECKED_ACCOUNT"
    | "NO_ELIGIBLE_CONTENT"
    | "NOT_RESEARCHED"
    | null;
  approved_claim_count?: number | null;
  unchecked_account_count?: number | null;
}
export interface RouteDiscoverySummary {
  generation_id?: string | null;
  request_id?: string | null;
  request_fingerprint?: string | null;
  input_hash?: string | null;
  geometry_hash: string;
  language: string;
  checked_at: string;
  status: "complete" | "partial" | "unavailable";
  warnings: string[];
  geometry_provider?: string | null;
}
export interface RouteDiscovery extends RouteDiscoverySummary {
  discovered_places: DiscoveredPlace[];
  geometry: ICoordinate[];
  geometry_leg_starts?: number[];
}
export interface RoutePlacesRequest {
  generation_id: string | null;
  language: "en" | "ru";
}
