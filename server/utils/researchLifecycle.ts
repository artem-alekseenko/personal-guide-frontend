import {
  createError,
  getRouterParam,
  setResponseHeader,
  type H3Event,
} from "h3";
import { ensureAuthHeaderOnPrivateApi, serviceEndpoint } from "./http";

/** Encode each decoded router segment once; never use an upstream download URL. */
export function researchEndpoint(
  event: H3Event,
  suffix: string,
  generation = false,
) {
  ensureAuthHeaderOnPrivateApi(event);
  setResponseHeader(event, "Cache-Control", "private, no-store");
  const tourId = getRouterParam(event, "tourId", { decode: true });
  const generationId = generation
    ? getRouterParam(event, "generationId", { decode: true })
    : null;
  if (!tourId || (generation && !generationId))
    throw createError({
      statusCode: 400,
      statusMessage: "Missing research identifier",
    });
  return serviceEndpoint(
    "PG_API_LIST_TOURS_URL",
    "/tours/",
    `${encodeURIComponent(tourId)}/${generation ? `generations/${encodeURIComponent(generationId!)}` : ""}${generation && suffix ? "/" : ""}${suffix}`,
  );
}
