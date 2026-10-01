import { $fetch } from "ofetch";
import { getRequestHeader, getRouterParam, setResponseHeader } from "h3";
import {
  buildServiceUrl,
  ensureAuthHeaderOnPrivateApi,
  serviceEndpoint,
} from "../../../utils/http";

/** Private existing artifact bytes. Never a provider or synthesis request. */
export default defineEventHandler(async (event) => {
  ensureAuthHeaderOnPrivateApi(event);
  const target = serviceEndpoint(
    "PG_API_LIST_TOURS_URL",
    "/tours/",
    `${encodeURIComponent(getRouterParam(event, "tourId")!)}/artifacts/${encodeURIComponent(getRouterParam(event, "artifactId")!)}`,
  );
  const requestId =
    getRequestHeader(event, "x-request-id") || crypto.randomUUID();
  setResponseHeader(event, "x-request-id", requestId);
  try {
    const response = await $fetch.raw<ArrayBuffer, "arrayBuffer">(
      buildServiceUrl(target),
      {
        responseType: "arrayBuffer",
        retry: 0,
        timeout: 120_000,
        headers: {
          authorization: getRequestHeader(event, "authorization")!,
          "x-request-id": requestId,
        },
      },
    );
    const type =
      response.headers.get("content-type") || "application/octet-stream";
    if (!type.toLowerCase().startsWith("audio/"))
      throw createError({
        statusCode: 502,
        statusMessage: "Unexpected recording content type",
      });
    setResponseHeader(event, "Content-Type", type);
    setResponseHeader(event, "Cache-Control", "private, no-store");
    return Buffer.from(response._data!);
  } catch (error: any) {
    throw createError({
      statusCode: error?.response?.status || error?.statusCode || 502,
      statusMessage: "Could not load the existing recording",
    });
  }
});
