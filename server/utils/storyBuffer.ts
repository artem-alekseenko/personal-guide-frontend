import { getRouterParam, readBody, type H3Event } from "h3";
import {
  ensureAuthHeaderOnPrivateApi,
  forwardAuthAndFetch,
  serviceEndpoint,
} from "./http";
import type {
  StoryBufferMetadata,
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
  try {
    return await forwardAuthAndFetch<StoryBufferMetadata | StoryBufferView>(
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
  } catch (error) {
    const failure = error as {
      statusCode?: number;
      data?: { detail?: string; code?: string };
    };
    // Only a missing optional route is a capability result. Domain 404s (including
    // ownership failures) and every mutation retain their original failure.
    if (
      !action &&
      !failure.data?.code &&
      ((failure.statusCode === 404 && failure.data?.detail === "Not Found") ||
        (failure.statusCode === 405 &&
          failure.data?.detail === "Method Not Allowed"))
    )
      return {
        status: "unavailable",
        reason: "unsupported_backend",
      } satisfies StoryBufferMetadata;
    throw error;
  }
}
