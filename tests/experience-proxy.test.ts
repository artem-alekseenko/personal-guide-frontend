import { it, expect, vi } from "vitest";
import { createApp, toWebHandler, createRouter } from "h3";
import interaction from "../server/api/tour-interactions/[tourId].post";
import profile from "../server/api/user-profile.put";
const upstream = vi.hoisted(() => vi.fn());
vi.mock("ofetch", () => ({ $fetch: upstream }));
Object.assign(globalThis, {
  useRuntimeConfig: () => ({ pgApiBaseUrl: "http://backend.test" }),
});
it("forwards text action identity and preserves its body", async () => {
  upstream.mockResolvedValue({ revision: 1 });
  const router = createRouter().post(
    "/api/tour-interactions/:tourId",
    interaction,
  );
  const handler = toWebHandler(createApp().use(router.handler));
  const response = await handler(
    new Request("http://client.test/api/tour-interactions/tour", {
      method: "POST",
      headers: {
        authorization: "Bearer fixture",
        "content-type": "application/json",
        "Idempotency-Key": "text-1",
      },
      body: JSON.stringify({
        action: "ASK",
        text: "Why?",
        expected_revision: 0,
      }),
    }),
  );
  expect(response.status).toBe(200);
  const [url, options] = upstream.mock.calls[0];
  expect(url).toBe("http://backend.test/tours/tour/interactions");
  expect(options.headers.get("idempotency-key")).toBe("text-1");
  expect(options.body.text).toBe("Why?");
  expect(options.retry).toBe(0);
});
it("only saves cross-tour context when explicitly included, including an explicit clear", async () => {
  upstream.mockResolvedValue({});
  const handler = toWebHandler(createApp().use(profile));
  for (const extra of [
    {},
    { personal_context: { note: "I enjoy engineering" } },
    { personal_context: null },
  ]) {
    await handler(
      new Request("http://client.test/api/user-profile", {
        method: "PUT",
        headers: {
          authorization: "Bearer fixture",
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Visitor", language: "en", ...extra }),
      }),
    );
    expect(upstream.mock.calls.at(-1)![1].body).toEqual({
      name: "Visitor",
      language: "en",
      ...extra,
    });
  }
});
