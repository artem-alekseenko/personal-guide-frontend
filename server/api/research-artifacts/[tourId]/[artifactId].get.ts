import { $fetch } from "ofetch";
import {
  createError,
  getRequestHeader,
  getRouterParam,
  setResponseHeader,
} from "h3";
import {
  buildServiceUrl,
  ensureAuthHeaderOnPrivateApi,
  serviceEndpoint,
} from "../../../utils/http";

/** Saved private JSON/plain text only. The existing audio route stays audio-only. */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, "Cache-Control", "private, no-store");
  setResponseHeader(event, "X-Content-Type-Options", "nosniff");
  ensureAuthHeaderOnPrivateApi(event);
  const tourId = getRouterParam(event, "tourId", { decode: true });
  const artifactId = getRouterParam(event, "artifactId", { decode: true });
  if (!tourId || !artifactId)
    throw createError({
      statusCode: 400,
      statusMessage: "Missing research identifier",
    });
  const requestId =
    getRequestHeader(event, "x-request-id") || crypto.randomUUID();
  setResponseHeader(event, "x-request-id", requestId);
  const target = serviceEndpoint(
    "PG_API_LIST_TOURS_URL",
    "/tours/",
    `${encodeURIComponent(tourId)}/artifacts/${encodeURIComponent(artifactId)}`,
  );
  try {
    const response = await $fetch.raw<ArrayBuffer, "arrayBuffer">(
      buildServiceUrl(target),
      {
        responseType: "arrayBuffer",
        redirect: "error",
        retry: 0,
        timeout: 120_000,
        headers: {
          authorization: getRequestHeader(event, "authorization")!,
          "x-request-id": requestId,
        },
      },
    );
    const type = response.headers
      .get("content-type")
      ?.split(";", 1)[0]
      ?.trim()
      .toLowerCase();
    if (
      !type ||
      (type !== "application/json" &&
        type !== "text/plain" &&
        !/^application\/[a-z0-9.+-]+\+json$/.test(type)) ||
      !(response._data instanceof ArrayBuffer)
    )
      throw createError({
        statusCode: 502,
        statusMessage: "Unexpected research content type",
      });
    setResponseHeader(event, "Content-Type", `${type}; charset=utf-8`);
    setResponseHeader(event, "Content-Disposition", "attachment");
    return Buffer.from(response._data);
  } catch (error: unknown) {
    let statusCode = 502;
    if (error && typeof error === "object") {
      if ("statusCode" in error && typeof error.statusCode === "number")
        statusCode = error.statusCode;
      if (
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "status" in error.response &&
        typeof error.response.status === "number"
      )
        statusCode = error.response.status;
    }
    throw createError({
      statusCode,
      statusMessage: "Could not download saved research",
    });
  }
});
