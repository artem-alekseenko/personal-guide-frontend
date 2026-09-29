import type { IListOfTours } from "~/types";
import { useExternalApi } from "~/composables/server/useExternalApi";
import { serviceEndpoint } from "../utils/http";
export default defineEventHandler(async (event) => {
  const response = await useExternalApi<IListOfTours>(
    event,
    serviceEndpoint("PG_API_LIST_TOURS_URL", "/tours/"),
  );
  return response.tours;
});
