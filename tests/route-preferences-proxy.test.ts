import { it, expect, vi } from "vitest";
import { createApp, toWebHandler } from "h3";
import handler from "../server/api/route-suggestions.get";
const upstream = vi.hoisted(() => vi.fn());
vi.mock("ofetch", () => ({ $fetch: upstream }));
Object.assign(globalThis, {
  useRuntimeConfig: () => ({ pgApiBaseUrl: "http://backend.test" }),
});
it("forwards routing preferences and preserves an honest empty result", async () => {
  upstream.mockResolvedValue({
    routes: [],
    description: "No verified step-free route",
    high_places: [],
  });
  const response = await toWebHandler(createApp().use(handler))(
    new Request(
      "http://client.test/api/route-suggestions?lat=1&lng=2&duration=5&guideId=guide&interests=art&interests=science&excluded_topics=museum&pace=relaxed&step_free=true&personal_context_enabled=true",
      { headers: { authorization: "Bearer fixture" } },
    ),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ routes: [], coordinates: [] });
  expect(upstream.mock.calls[0]![1].query).toMatchObject({
    interests: ["art", "science"],
    excluded_topics: ["museum"],
    pace: "relaxed",
    step_free: "true",
    personal_context_enabled: "true",
  });
});
it("rejects malformed preference parameters", async () => {
  const response = await toWebHandler(createApp().use(handler))(
    new Request(
      "http://client.test/api/route-suggestions?lat=1&lng=2&duration=5&guideId=guide&step_free=maybe",
    ),
  );
  expect(response.status).toBe(400);
  expect(upstream).not.toHaveBeenCalled();
});
