import { $fetch, type FetchOptions } from "ofetch";
import {
  getMethod,
  getRequestHeader,
  getRequestURL,
  type H3Event,
  setResponseHeader,
} from "h3";

export function buildServiceUrl(url: string) {
  const cfg = useRuntimeConfig();
  const base = cfg.pgApiBaseUrl || "";

  try {
    if (!base) {
      // Without base: forbid relative URLs (to avoid hitting Nuxt itself by mistake)
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
    // SSRF: do not allow changing origin
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
  // Normalize headers (supports Headers, string[][], Record<string,string>)
  const headers = new Headers(init.headers as HeadersInit | undefined);

  // Forward Authorization from client (client header has priority)
  const clientAuth = getRequestHeader(event, "authorization");
  if (clientAuth) headers.set("authorization", clientAuth);

  // Tracing: propagate/generate and echo back to client
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
    // Best-effort error propagation from downstream
    const statusCode = err?.response?.status || err?.statusCode || 502;
    const statusMessage =
      err?.response?.statusText || err?.message || "Upstream fetch error";
    const data = err?.response?._data ?? err?.data ?? undefined;

    if (import.meta.dev) {
      const hasAuth = headers.has("authorization");
      // Do not log token; only presence
      console.warn(
        "[forwardAuthAndFetch] Upstream error",
        { url: finalUrl, statusCode, statusMessage, reqId, hasAuth },
      );
    }

    throw createError({ statusCode, statusMessage, data });
  }
}

/** Require Authorization header on private /api/* endpoints (without token validation) */
export function ensureAuthHeaderOnPrivateApi(event: H3Event) {
  // Allow CORS preflight without auth
  if (getMethod(event).toUpperCase() === "OPTIONS") return;

  const cfg = useRuntimeConfig();
  const pathname = getRequestURL(event).pathname;
  if (!pathname.startsWith("/api/")) return;

  const publicPrefixes = (cfg.publicApiPrefixes as string | undefined)
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) ?? ["/api/health", "/api/public"];
  if (publicPrefixes.some((prefix) => pathname.startsWith(prefix))) return;

  const auth = getRequestHeader(event, "authorization") || "";
  if (!/^bearer\s+.+/i.test(auth)) {
    throw createError({
      statusCode: 401,
      statusMessage: "Missing Authorization header",
    });
  }
}
