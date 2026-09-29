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
    const topics = (value: unknown): string[] => {
      const values =
        value === undefined ? [] : Array.isArray(value) ? value : [value];
      if (
        values.length > 20 ||
        values.some(
          (item) =>
            typeof item !== "string" || !/^[a-z][a-z0-9_]{0,63}$/.test(item),
        )
      )
        throw createError({
          statusCode: 400,
          statusMessage: "Invalid route topics",
        });
      return values as string[];
    };
    const interests = topics(query.interests);
    const excluded_topics = topics(query.excluded_topics);
    const pace = query.pace ?? "normal";
    const step_free = query.step_free ?? "false";
    const personal_context_enabled = query.personal_context_enabled ?? "true";
    if (
      !["relaxed", "normal", "brisk"].includes(String(pace)) ||
      !["true", "false"].includes(String(step_free)) ||
      !["true", "false"].includes(String(personal_context_enabled))
    )
      throw createError({
        statusCode: 400,
        statusMessage: "Invalid route preferences",
      });
    const response = await useExternalApi<IRouteSuggestionsResponse>(
      event,
      serviceEndpoint(
        "PG_API_ROUTE_SUGGESTION_URL",
        "/guides/route_suggestions/",
        encodeURIComponent(String(guideId)),
      ),
      {
        curr_lat: lat,
        curr_lng: lng,
        duration,
        interests,
        excluded_topics,
        pace,
        step_free,
        personal_context_enabled,
      },
    );
    const first = response.routes[0];
    return {
      ...response,
      coordinates: (first?.geometry?.length
        ? first.geometry
        : (first?.points ?? [])
      ).map((point) => [Number(point.lng), Number(point.lat)]),
    };
  },
);
