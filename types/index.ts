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
  name: string;
}

export interface IRoute {
  name: string;
  points: IRoutePoint[];
}

interface IGeneratedRoute {
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

export interface IRouteSuggestionsResponseExtended
  extends IRouteSuggestionsResponse {
  coordinates: [number, number][];
}

export interface IRouteSuggestionsParams {
  lng: string;
  lat: string;
  duration: string;
  guideId: string;

  [key: string]: string;
}

interface ISetting {
  name: string;
  value: string;
}

export interface ICreateTourRequest {
  guide_id: string;
  route: ICoordinate[];
  settings: ISetting[];
}

export interface ICreatedTour {
  id: string;
  name: string;
  image: string;
  description: string;
  route: IGeneratedRoute;
  guide_id: string;
  user_id: string;
  context: string;
  history: string[];
  created_at: string;
  generated_at: string | null;
  finished_at: string | null;
  status: string;
  settings: ISetting[];
  tags: string[];
  guide: Omit<IGuide, "tours">;
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

export interface ITourRecord {
  id: string;
  point: IPoint;
  type: string;
  message: string;
  created_at: string;
  places?: IPoint[];
  audio_data: string;
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

export interface ITourRecordRequest {
  duration: string;
  point: ICoordinate;
  user_text: string;
  pace: string;
  type_llm: "SIMPLE" | "OPENAI" | "GEMINI" | "MOCK";
  type_voice: "ELEVEN_LABS" | "MOCK";
}

export interface ITourRecordResponse {
  places: IPoint[];
  record: ITourRecord;
  audio_data: string;
}

export interface ITourTag {
  name: string;
  is_selected: boolean;
}

export type TypeFrom<T> = T[keyof T];

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

// User related types
export interface IUserPreferences {
  language: string;
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

// Server user response
export interface IServerUserResponse {
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
