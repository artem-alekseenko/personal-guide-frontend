import { it, expect, vi, beforeEach } from "vitest";
import { createApp, toWebHandler, defineEventHandler } from "h3";
import {
  buildServiceUrl,
  forwardAuthAndFetch,
  ensureAuthHeaderOnPrivateApi,
} from "../server/utils/http";
import listTours from "../server/api/list-tours.get";
const upstream = vi.hoisted(() => vi.fn());
vi.mock("ofetch", () => ({ $fetch: upstream }));
let base = "";
beforeEach(() => {
  base = "";
  Object.assign(globalThis, {
    useRuntimeConfig: () => ({ pgApiBaseUrl: base }),
  });
});
it("reports a missing server base URL as configuration failure", () => {
  expect(() => buildServiceUrl("/tours/")).toThrow(
    expect.objectContaining({ statusCode: 500 }),
  );
});
it("preserves backend errors instead of returning an empty tour list", async () => {
  base = "http://backend.test";
  process.env.PG_API_LIST_TOURS_URL = "/tours/";
  upstream.mockRejectedValue({ statusCode: 503, message: "Unavailable" });
  const handler = toWebHandler(createApp().use(listTours));
  const response = await handler(
    new Request("http://frontend.test/api/list-tours", {
      headers: { authorization: "Bearer token" },
    }),
  );
  expect(response.status).toBe(503);
});
it("forwards narration idempotency keys and disables automatic mutation retries", async () => {
  base = "http://backend.test";
  upstream.mockResolvedValue({ ok: true });
  const handler = toWebHandler(
    createApp().use(
      defineEventHandler((event) =>
        forwardAuthAndFetch(event, "/tours/id/next", {
          method: "POST",
          body: {},
        }),
      ),
    ),
  );
  await handler(
    new Request("http://frontend.test/api/next", {
      headers: { authorization: "Bearer token", "idempotency-key": "turn-123" },
    }),
  );
  const [url, options] = upstream.mock.calls[0];
  expect(url).toBe("http://backend.test/tours/id/next");
  expect(options.headers.get("idempotency-key")).toBe("turn-123");
  expect(options.headers.get("authorization")).toBe("Bearer token");
  expect(options.retry).toBe(0);
});
it("rejects a foreign upstream origin", () => {
  base = "http://backend.test";
  expect(() => buildServiceUrl("http://other.test/tours/")).toThrow(
    expect.objectContaining({ statusCode: 400 }),
  );
});
it("rejects unauthenticated private API calls", async () => {
  const handler = toWebHandler(
    createApp().use(
      defineEventHandler((event) => {
        ensureAuthHeaderOnPrivateApi(event);
        return { ok: true };
      }),
    ),
  );
  expect(
    (await handler(new Request("http://frontend.test/api/list-tours"))).status,
  ).toBe(401);
});
