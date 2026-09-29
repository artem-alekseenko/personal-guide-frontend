import { useExternalApi } from "~/composables/server/useExternalApi";
import type { ICreatedTour } from "~/types";
import { serviceEndpoint } from "../../utils/http";
export default defineEventHandler((event) =>
  useExternalApi<ICreatedTour>(
    event,
    serviceEndpoint(
      "PG_API_LIST_TOURS_URL",
      "/tours/",
      encodeURIComponent(getRouterParam(event, "tourId")!),
    ),
  ),
);
