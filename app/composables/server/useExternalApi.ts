import type { H3Event } from "h3";
import type { TRequestMethod } from "~/types";
import buildCurlCommand from "~/utils/buildCurlCommand";
import { forwardAuthAndFetch } from "../../../server/utils/http";

/**
 * Server-only helper: forwards client Authorization to downstream service.
 */
export const useExternalApi = async <T>(
  event: H3Event,
  url: string,
  params: Record<string, string | number | boolean> = {},
  method: TRequestMethod = "GET",
): Promise<T> => {
  const hasParams = Object.keys(params).length > 0;

  const headers = new Headers();
  const init: RequestInit = { method, headers: headers as any };

  if (hasParams) {
    const usp = new URLSearchParams(params as any).toString();
    if (method.toUpperCase() === "GET" || method.toUpperCase() === "HEAD") {
      url += `?${usp}`;
    } else {
      init.body = JSON.stringify(params);
      headers.set("Content-Type", "application/json");
    }
  }

  const curl = buildCurlCommand(url, init);
  console.log(`[useExternalApi] ${method} ${url}\n${curl}`);
  return forwardAuthAndFetch<T>(event, url, init);
};
