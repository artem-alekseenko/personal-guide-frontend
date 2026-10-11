import { expect, it, vi } from "vitest";
import { createApp, createRouter, toWebHandler } from "h3";
import preview from "../server/api/research-preview/[tourId].post";
const upstream = vi.hoisted(() => vi.fn());
vi.mock("ofetch", () => ({ $fetch: upstream }));
Object.assign(globalThis, {
  useRuntimeConfig: () => ({ pgApiBaseUrl: "http://backend.test" }),
});
const handler = toWebHandler(
  createApp().use(
    createRouter().post("/api/research-preview/:tourId", preview).handler,
  ),
);

it("keeps a decoded source-tour ID within one upstream path segment", async () => {
  const saved = {
    id: "new-tour",
    user_id: "owner",
    research_preview: { unverified: true },
  };
  upstream.mockResolvedValue(saved);
  const response = await handler(
    new Request("http://client.test/api/research-preview/original%2Ftour", {
      method: "POST",
      headers: {
        authorization: "Bearer owner-fixture",
        "content-type": "application/json",
        "Idempotency-Key": "preview-operation",
      },
      body: JSON.stringify({ generation_id: "saved-generation" }),
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(saved);
  const [url, options] = upstream.mock.calls[0]!;
  expect(url).toBe(
    "http://backend.test/tours/original%2Ftour/research-preview",
  );
  expect(options.headers.get("authorization")).toBe("Bearer owner-fixture");
  expect(options.headers.get("idempotency-key")).toBe("preview-operation");
  expect(options.body).toEqual({ generation_id: "saved-generation" });
  expect(options.retry).toBe(0);
});

it("rejects unauthenticated preview mutations before upstream ownership checks", async () => {
  const response = await handler(
    new Request("http://client.test/api/research-preview/source", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    }),
  );
  expect(response.status).toBe(401);
  expect(upstream).not.toHaveBeenCalled();
});

it("preserves upstream failure rather than reporting preview success or retrying the mutation", async () => {
  upstream.mockRejectedValue({
    response: { status: 503, statusText: "Archive drain incomplete" },
  });
  const response = await handler(
    new Request("http://client.test/api/research-preview/source", {
      method: "POST",
      headers: {
        authorization: "Bearer owner-fixture",
        "Idempotency-Key": "same-operation",
        "content-type": "application/json",
      },
      body: JSON.stringify({ generation_id: null }),
    }),
  );
  expect(response.status).toBe(503);
  expect(upstream).toHaveBeenCalledTimes(1);
  expect(upstream.mock.calls[0]![1].retry).toBe(0);
});
