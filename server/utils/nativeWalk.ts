import { getRouterParam, readBody, type H3Event } from "h3";
import {
  ensureAuthHeaderOnPrivateApi,
  forwardAuthAndFetch,
  serviceEndpoint,
} from "./http";

export function forwardNativeWalk(
  event: H3Event,
  method: "GET" | "POST",
  suffix = "",
) {
  ensureAuthHeaderOnPrivateApi(event);
  const tour = encodeURIComponent(getRouterParam(event, "tourId")!);
  return (async () =>
    forwardAuthAndFetch(
      event,
      serviceEndpoint(
        "PG_API_LIST_TOURS_URL",
        "/tours/",
        `${tour}/walk${suffix}`,
      ),
      {
        method,
        retry: 0,
        ...(method === "POST" ? { body: await readBody(event) } : {}),
        headers: { "X-Tour-Contract-Version": "3" },
      },
    ))();
}
