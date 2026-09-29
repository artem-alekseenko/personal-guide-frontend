import { getRouterParam } from "h3";
import { useExternalApi } from "~/composables/server/useExternalApi";
import { serviceEndpoint } from "../../utils/http";
import type { Experience } from "~/types/tourExperience";
export default defineEventHandler(async (event) =>
  useExternalApi<Experience>(
    event,
    serviceEndpoint(
      "PG_API_LIST_TOURS_URL",
      "/tours/",
      `${encodeURIComponent(getRouterParam(event, "tourId")!)}/interactions`,
    ),
    await readBody(event),
    "POST",
  ),
);
