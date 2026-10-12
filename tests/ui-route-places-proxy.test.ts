import { expect, it, vi } from "vitest";
import { createApp, createRouter, toWebHandler } from "h3";
import routePlaces from "../server/api/tour-route-places/[tourId].post";
const upstream = vi.hoisted(() => vi.fn());
vi.mock("ofetch", () => ({ $fetch: upstream }));
Object.assign(globalThis, { useRuntimeConfig: () => ({ pgApiBaseUrl: "http://backend.test" }) });
it("forwards discovery generation, language and immutable operation key without mutation retries", async () => {
  upstream.mockResolvedValue({ status: "partial", discovered_places: [] });
  const router = createRouter().post("/api/tour-route-places/:tourId", routePlaces);
  const handler = toWebHandler(createApp().use(router.handler));
  const response = await handler(new Request("http://client.test/api/tour-route-places/tour%2Fid", {
    method: "POST", headers: { authorization: "Bearer fixture", "content-type": "application/json", "Idempotency-Key": "route-scan-1" },
    body: JSON.stringify({ generation_id: "generation-1", language: "ru" }),
  }));
  expect(response.status).toBe(200);
  const [url, options] = upstream.mock.calls[0]!;
  expect(url).toBe("http://backend.test/tours/tour%2Fid/route-places");
  expect(options.body).toEqual({ generation_id: "generation-1", language: "ru" });
  expect(options.headers.get("idempotency-key")).toBe("route-scan-1");
  expect(options.retry).toBe(0);
});
