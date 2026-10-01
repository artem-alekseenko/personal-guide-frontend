import { getRouterParam, readBody, type H3Event } from "h3";
import {
  ensureAuthHeaderOnPrivateApi,
  forwardAuthAndFetch,
  serviceEndpoint,
} from "./http";
import type {
  StoryBufferState,
  StoryBufferView,
} from "../../shared/types/storyBuffer";

export async function forwardStoryBuffer(
  event: H3Event,
  action?: "prepare" | "activate" | "cancel",
) {
  ensureAuthHeaderOnPrivateApi(event);
  const tour = encodeURIComponent(getRouterParam(event, "tourId")!);
  const suffix =
    action === "activate"
      ? `/${encodeURIComponent(getRouterParam(event, "bufferId")!)}/activate`
      : action
        ? `/${action}`
        : "";
  return forwardAuthAndFetch<StoryBufferState | StoryBufferView>(
    event,
    serviceEndpoint(
      "PG_API_LIST_TOURS_URL",
      "/tours/",
      `${tour}/story-buffer${suffix}`,
    ),
    action
      ? { method: "POST", body: await readBody(event), retry: 0 }
      : { method: "GET" },
  );
}
