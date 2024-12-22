export interface IGuide {
  id: string;
  name: string;
  skills: string;
  avatar: string;
  context: string;
  tags: string[];
  tours: Tour[];
}

export interface IGuidesResponse {
  guides: IGuide[];
}

export interface Tour {
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
  point: {
    name: string | null;
    lat: string;
    lng: string;
  };
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
