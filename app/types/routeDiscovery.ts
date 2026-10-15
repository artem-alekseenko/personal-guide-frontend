import type { ICoordinate } from "./index";

export interface PublicMapSubject extends ICoordinate {
  id: string;
  name: string;
  source: "google" | "osm";
  source_id: string;
  types: string[];
  address: string | null;
  street_name?: string | null;
  district_name?: string | null;
  city?: string | null;
  subject_kind?: "premise" | "building" | "street";
  identity_status?: "named" | "address_only" | "unnamed";
  public_map_url?: string | null;
  building_type?: string | null;
  research_status?:
    | "SOURCE_BACKED"
    | "UNCHECKED_ACCOUNT"
    | "NO_ELIGIBLE_CONTENT"
    | "NOT_RESEARCHED"
    | null;
  approved_claim_count?: number | null;
  unchecked_account_count?: number | null;
}
export interface DiscoveredPlace extends PublicMapSubject {
  distance_to_route_meters: number;
  along_route_meters: number;
}
export interface NearbyPublicDiscovery {
  generation_id: string | null;
  language: string;
  checked_at: string;
  visitor_point: ICoordinate;
  status: "partial" | "unavailable";
  warnings: string[];
  places: PublicMapSubject[];
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
