import { useExternalApi } from "~/composables/server/useExternalApi";
import { serviceEndpoint } from "../utils/http";
import type {
  IRouteSuggestionsResponseExtended,
  IRouteSuggestionsResponse,
} from "~/types";
export default defineEventHandler(
  async (event): Promise<IRouteSuggestionsResponseExtended> => {
    const query = getQuery(event);
    const { lat, lng, duration, guideId } = query;
    if (
      ![lat, lng, duration, guideId].every(
        (value) => typeof value === "string" && value.trim() !== "",
      ) ||
      !Number.isFinite(Number(lat)) ||
      Math.abs(Number(lat)) > 90 ||
      !Number.isFinite(Number(lng)) ||
      Math.abs(Number(lng)) > 180 ||
      !Number.isInteger(Number(duration)) ||
      Number(duration) < 5 ||
      Number(duration) > 480
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid route suggestion parameters",
      });
    }
    const response = await useExternalApi<IRouteSuggestionsResponse>(
      event,
      serviceEndpoint(
        "PG_API_ROUTE_SUGGESTION_URL",
        "/guides/route_suggestions/",
        encodeURIComponent(String(guideId)),
      ),
      { curr_lat: lat, curr_lng: lng, duration },
    );
    const first = response.routes[0];
    if (!first)
      throw createError({
        statusCode: 502,
        statusMessage: "No route returned by the service",
      });
    return {
      ...response,
      coordinates: first.points.map((point) => [
        Number(point.lng),
        Number(point.lat),
      ]),
    };
  },
);
