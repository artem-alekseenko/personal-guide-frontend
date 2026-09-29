import type { IGuidesResponse } from "~/types";
import { useExternalApi } from "~/composables/server/useExternalApi";
import { serviceEndpoint } from "../utils/http";
export default defineEventHandler(async (event) => {
  const response = await useExternalApi<IGuidesResponse>(
    event,
    serviceEndpoint("PG_API_GUIDES_URL", "/guides/"),
  );
  return response.guides;
});
