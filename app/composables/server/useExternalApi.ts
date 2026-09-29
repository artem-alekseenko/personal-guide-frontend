import type { H3Event } from "h3";
import type { TRequestMethod } from "~/types";
import { forwardAuthAndFetch } from "../../../server/utils/http";

/** Server-only helper. Never log profile or visitor message bodies. */
export const useExternalApi = <T>(
  event: H3Event,
  url: string,
  params: Record<string, unknown> = {},
  method: TRequestMethod = "GET",
): Promise<T> =>
  forwardAuthAndFetch<T>(event, url, {
    method,
    ...(method === "GET" || method === "HEAD"
      ? { query: params }
      : { body: params }),
  });
