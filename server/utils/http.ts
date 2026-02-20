import { $fetch, type FetchOptions } from "ofetch";
import {
  getRequestHeader,
  getRequestURL,
  type H3Event,
  setResponseHeader,
} from "h3";

const PUBLIC_API_PREFIXES = ["/api/health", "/api/public"] as const;

const isPrefixMatch = (path: string, prefix: string) => {
  return (
    path === prefix ||
    path.startsWith(prefix.endsWith("/") ? prefix : prefix + "/")
  );
};

export function buildServiceUrl(url: string) {
  const cfg = useRuntimeConfig();
  const base = cfg.pgApiBaseUrl || "";

  try {
    if (!base) {
      const hasScheme = /^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(url);
      if (!hasScheme) {
        if (import.meta.dev)
          console.warn(
            "[buildServiceUrl] Relative URL without pgApiBaseUrl:",
            url,
          );
        throw createError({
          statusCode: 500,
          statusMessage: "Service base URL not configured",
        });
      }
      return url;
    }

    const final = new URL(url, base);
    const baseOrigin = new URL(base).origin;
    if (final.origin !== baseOrigin) {
      throw createError({
        statusCode: 400,
        statusMessage: "Disallowed target host",
      });
    }
    return final.toString();
  } catch (e) {
    throw createError({ statusCode: 400, statusMessage: "Invalid target URL" });
  }
}

export async function forwardAuthAndFetch<T>(
  event: H3Event,
  url: string,
  init: FetchOptions<"json"> = {},
): Promise<T> {
  const headers = new Headers(init.headers as HeadersInit | undefined);

  const clientAuth = getRequestHeader(event, "authorization");
  if (clientAuth) headers.set("authorization", clientAuth);

  const existingReqId = getRequestHeader(event, "x-request-id");
  const generatedReqId = `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
  const reqId = existingReqId || generatedReqId;
  headers.set("x-request-id", reqId);
  setResponseHeader(event, "x-request-id", reqId);

  const finalUrl = buildServiceUrl(url);

  try {
    return await $fetch<T>(finalUrl, {
      ...init,
      headers,
      retry: init.retry ?? 1,
      timeout: init.timeout ?? 15_000,
    });
  } catch (err: any) {
    const statusCode = err?.response?.status || err?.statusCode || 502;
    const statusMessage =
      err?.response?.statusText || err?.message || "Upstream fetch error";
    const data = err?.response?._data ?? err?.data ?? undefined;

    if (import.meta.dev) {
      const hasAuth = headers.has("authorization");
      console.warn("[forwardAuthAndFetch] Upstream error", {
        url: finalUrl,
        statusCode,
        statusMessage,
        reqId,
        hasAuth,
      });
    }

    throw createError({ statusCode, statusMessage, data });
  }
}

export const ensureAuthHeaderOnPrivateApi = (event: H3Event) => {
  if (event.method === "OPTIONS") return;

  const pathname = getRequestURL(event).pathname;

  if (!pathname.startsWith("/api/")) return;
  if (PUBLIC_API_PREFIXES.some((p) => isPrefixMatch(pathname, p))) return;

  const auth = getRequestHeader(event, "authorization") ?? "";
  const token = auth.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: "Missing Authorization header",
    });
  }

  event.context.bearerToken = token;
};
