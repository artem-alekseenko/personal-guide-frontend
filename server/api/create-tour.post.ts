import { useExternalApi } from "~/composables/server/useExternalApi";
import { serviceEndpoint } from "../utils/http";
export default defineEventHandler(async (event) => {
  return useExternalApi(
    event,
    serviceEndpoint("PG_API_CREATE_ROUTE_URL", "/tours/"),
    await readBody(event),
    "POST",
  );
});
