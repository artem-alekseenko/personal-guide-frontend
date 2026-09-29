import { useExternalApi } from "~/composables/server/useExternalApi";
import { serviceEndpoint } from "../utils/http";
import type { IServerUserResponse } from "~/types";
export default defineEventHandler((event) =>
  useExternalApi<IServerUserResponse>(
    event,
    serviceEndpoint("PG_API_GET_ME", "/users/me/"),
  ),
);
