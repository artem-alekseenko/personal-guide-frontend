import { useExternalApi } from "~/composables/server/useExternalApi";
import { serviceEndpoint } from "../../utils/http";
export default defineEventHandler((event) =>
  useExternalApi(
    event,
    serviceEndpoint(
      "PG_API_CREATE_ROUTE_URL",
      "/tours/",
      `${encodeURIComponent(getRouterParam(event, "tourId")!)}/finish`,
    ),
    {},
    "POST",
  ),
);
