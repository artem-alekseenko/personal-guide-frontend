import { getRouterParam } from "h3";
import { useExternalApi } from "~/composables/server/useExternalApi";
import { serviceEndpoint } from "../../utils/http";
import type { RouteDiscovery } from "~/types/routeDiscovery";

export default defineEventHandler(async (event) =>
  useExternalApi<RouteDiscovery>(
    event,
    serviceEndpoint(
      "PG_API_LIST_TOURS_URL",
      "/tours/",
      `${encodeURIComponent(getRouterParam(event, "tourId", { decode: true })!)}/route-places`,
    ),
    await readBody(event),
    "POST",
  ),
);
