import { expect, it, vi } from "vitest";
import { createApp, toWebHandler } from "h3";
import tours from "../server/api/list-tours.get";
import guides from "../server/api/guides.get";

const upstream = vi.hoisted(() => vi.fn());
vi.mock("ofetch", () => ({ $fetch: upstream }));
Object.assign(globalThis, {
  useRuntimeConfig: () => ({ pgApiBaseUrl: "http://backend.test" }),
});
const request = (handler: typeof tours) =>
  toWebHandler(createApp().use(handler))(
    new Request("http://client.test/api/list", {
      headers: { authorization: "Bearer fixture", "x-request-id": "list-read" },
    }),
  );
it.each([
  ["tours", tours],
  ["guides", guides],
] as const)(
  "returns every %s page and preserves authentication",
  async (key, handler) => {
    const items = Array.from({ length: 205 }, (_, i) => ({ id: String(i) }));
    upstream.mockImplementation(async (_url, options) => {
      const skip = options.query?.skip ?? 0;
      const limit = options.query?.limit ?? 10;
      return { [key]: items.slice(skip, skip + limit) };
    });
    const response = await request(handler);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(items);
    expect(upstream.mock.calls.map(([, options]) => options.query)).toEqual([
      { skip: 0, limit: 100 },
      { skip: 100, limit: 100 },
      { skip: 200, limit: 100 },
    ]);
    for (const [, options] of upstream.mock.calls) {
      expect(options.headers.get("authorization")).toBe("Bearer fixture");
      expect(options.headers.get("x-request-id")).toBe("list-read");
    }
  },
);
it("fails the complete read if a later page fails instead of displaying a partial list", async () => {
  upstream.mockImplementation(async (_url, options) => {
    if (options.query?.skip > 0)
      throw Object.assign(new Error("Unavailable"), { statusCode: 503 });
    return {
      tours: Array.from({ length: 100 }, (_, i) => ({ id: String(i) })),
    };
  });
  expect((await request(tours)).status).toBe(503);
});
it("bounds a backend that repeatedly returns the same full page", async () => {
  upstream.mockResolvedValue({
    tours: Array.from({ length: 100 }, (_, i) => ({ id: String(i) })),
  });
  expect((await request(tours)).status).toBe(502);
  expect(upstream).toHaveBeenCalledTimes(2);
});
it("rejects malformed list envelopes", async () => {
  upstream.mockResolvedValue({ tours: null });
  expect((await request(tours)).status).toBe(502);
});
