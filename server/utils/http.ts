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
  const base = useRuntimeConfig().pgApiBaseUrl;
  if (!base && !/^https?:\/\//.test(url)) {
    throw createError({
      statusCode: 500,
      statusMessage: "Service base URL not configured",
    });
  }
  let target: URL;
  try {
    target = base ? new URL(url, base) : new URL(url);
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: "Invalid service URL configuration",
    });
  }
  if (
    !["http:", "https:"].includes(target.protocol) ||
    target.username ||
    target.password ||
    (base && target.origin !== new URL(base).origin)
  ) {
    throw createError({
      statusCode: 400,
      statusMessage: "Disallowed target host",
    });
  }
  return target.toString();
}

/** Endpoint overrides support existing deployments; defaults follow the backend routers. */
export function serviceEndpoint(
  variable: string,
  fallback: string,
  suffix = "",
) {
  const path = process.env[variable] || fallback;
  return suffix ? `${path.replace(/\/+$/, "")}/${suffix}` : path;
}

export async function forwardAuthAndFetch<T>(
  event: H3Event,
  url: string,
  init: FetchOptions<"json"> = {},
): Promise<T> {
  const headers = new Headers(init.headers as HeadersInit | undefined);

  const clientAuth = getRequestHeader(event, "authorization");
  if (clientAuth) headers.set("authorization", clientAuth);

  const idempotencyKey = getRequestHeader(event, "idempotency-key");
  if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);

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
      retry:
        init.retry ??
        (["GET", "HEAD"].includes(String(init.method || "GET").toUpperCase())
          ? 1
          : 0),
      timeout: init.timeout ?? 120_000,
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
