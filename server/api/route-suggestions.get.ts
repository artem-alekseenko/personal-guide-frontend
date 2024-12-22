import { createError, defineEventHandler, getQuery, H3Event } from "h3";
import { useExternalApi } from "~/composables/server/useExternalApi";
import type {
  IRoute,
  IRoutePoint,
  IRouteSuggestionsParams,
  IRouteSuggestionsResponse,
  IRouteSuggestionsResponseExtended,
} from "~/types";

const validateRouteSuggestionsParams = (params: IRouteSuggestionsParams) => {
  if (!params.lng || !params.lat || !params.duration || !params.guideId) {
    throw createError({
      statusCode: 400,
      statusMessage:
        "Missing required parameters: lng, lat, duration or guideId",
    });
  }
};

const convertRouteToCoordinates = (route: IRoute): [number, number][] => {
  return route.points.map((point: IRoutePoint) => {
    const lng = parseFloat(point.lng);
    const lat = parseFloat(point.lat);
    return [lng, lat];
  });
};

export default defineEventHandler(
  async (event: H3Event): Promise<IRouteSuggestionsResponseExtended> => {
    const params = getQuery(event) as IRouteSuggestionsParams;
    const routeSuggestionApiUrl = process.env.PG_API_ROUTE_SUGGESTION_URL;

    validateRouteSuggestionsParams(params);

    const { guideId, ...restParams } = params;

    const externalApiUrl = `${routeSuggestionApiUrl}${guideId}`;

    try {
      const response = await useExternalApi<IRouteSuggestionsResponse>(
        externalApiUrl,
        {
          curr_lat: restParams.lat,
          curr_lng: restParams.lng,
          duration: restParams.duration,
        },
      );

      const firstRoute = response.routes[0];
      if (!firstRoute) {
        throw createError({
          statusCode: 500,
          statusMessage: "No route found in the response",
        });
      }

      return {
        ...response,
        coordinates: convertRouteToCoordinates(firstRoute),
      };
    } catch (error) {
      console.error(
        "Failed to fetch data about tour suggestions from external API",
        error,
      );
      throw createError({
        statusCode: 500,
        statusMessage: "Internal Server Error",
      });
    }
  },
);
