export interface IRoutePoint {
  name: string;
  lat: string;
  lng: string;
}

export interface IRoute {
  name: string;
  points: IRoutePoint[];
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
