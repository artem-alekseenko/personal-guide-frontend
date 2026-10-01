import { expect, it, vi } from "vitest";
import { createApp, createRouter, toWebHandler } from "h3";
import prepare from "../server/api/story-buffer/[tourId]/prepare.post";
import activate from "../server/api/story-buffer/[tourId]/[bufferId]/activate.post";
import cancel from "../server/api/story-buffer/[tourId]/cancel.post";
import state from "../server/api/story-buffer/[tourId]/index.get";
const upstream = vi.hoisted(() => vi.fn());
vi.mock("ofetch", () => ({ $fetch: upstream }));
Object.assign(globalThis, {
  useRuntimeConfig: () => ({ pgApiBaseUrl: "http://backend.test" }),
});
const handler = toWebHandler(
  createApp().use(
    createRouter()
      .post("/api/story-buffer/:tourId/prepare", prepare)
      .post("/api/story-buffer/:tourId/:bufferId/activate", activate)
      .post("/api/story-buffer/:tourId/cancel", cancel)
      .get("/api/story-buffer/:tourId", state).handler,
  ),
);
it.each([
  ["prepare", "POST", "/prepare"],
  ["buffer/activate", "POST", "/buffer/activate"],
  ["cancel", "POST", "/cancel"],
  ["", "GET", ""],
])(
  "forwards the authenticated %s contract with operation identity",
  async (path, method, suffix) => {
    upstream.mockResolvedValue({ status: "prepared" });
    const response = await handler(
      new Request(
        `http://client.test/api/story-buffer/tour${path ? `/${path}` : ""}`,
        {
          method,
          headers: {
            authorization: "Bearer fixture",
            "content-type": "application/json",
            "Idempotency-Key": "operation",
          },
          ...(method === "POST"
            ? {
                body: JSON.stringify({
                  current_segment_id: "current",
                  generation_id: "gen",
                }),
              }
            : {}),
        },
      ),
    );
    expect(response.status).toBe(200);
    const [url, options] = upstream.mock.calls.at(-1)!;
    expect(url).toBe(`http://backend.test/tours/tour/story-buffer${suffix}`);
    expect(options.headers.get("authorization")).toBe("Bearer fixture");
    expect(options.headers.get("idempotency-key")).toBe("operation");
    expect(options.retry).toBe(method === "POST" ? 0 : 1);
    if (method === "POST")
      expect(options.body).toEqual({
        current_segment_id: "current",
        generation_id: "gen",
      });
  },
);
it("rejects unauthenticated story-buffer requests before the backend", async () => {
  const response = await handler(
    new Request("http://client.test/api/story-buffer/tour"),
  );
  expect(response.status).toBe(401);
  expect(upstream).not.toHaveBeenCalled();
});
