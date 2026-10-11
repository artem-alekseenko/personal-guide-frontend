import { getRouterParam, readBody } from "h3";
import {
  ensureAuthHeaderOnPrivateApi,
  forwardAuthAndFetch,
  serviceEndpoint,
} from "../../utils/http";
import type { ICreatedTour } from "../../../app/types";

export default defineEventHandler(async (event) => {
  ensureAuthHeaderOnPrivateApi(event);
  const tourId = encodeURIComponent(
    getRouterParam(event, "tourId", { decode: true })!,
  );
  return forwardAuthAndFetch<ICreatedTour>(
    event,
    serviceEndpoint(
      "PG_API_LIST_TOURS_URL",
      "/tours/",
      `${tourId}/research-preview`,
    ),
    { method: "POST", body: await readBody(event), retry: 0 },
  );
});
