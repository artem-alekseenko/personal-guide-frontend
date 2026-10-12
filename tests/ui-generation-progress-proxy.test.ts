import { beforeEach, expect, it, vi } from "vitest";
import { createApp, createRouter, toWebHandler } from "h3";
import detail from "../server/api/tour-generations/[tourId]/[generationId].get";
import progressMessage from "../server/api/tour-generations/[tourId]/[generationId]/progress-message.post";
import {
  preparationDetail,
  preparationSnapshot,
} from "./helpers/preparationProgress";

const upstream = vi.hoisted(() => vi.fn());
vi.mock("ofetch", () => ({ $fetch: upstream }));
const handler = toWebHandler(
  createApp().use(
    createRouter().get("/api/tour-generations/:tourId/:generationId", detail)
      .handler,
  ),
);
const request = (query: string, authenticated = true) =>
  new Request(
    `http://client.test/api/tour-generations/tour%2Fone/generation%2Fone?${query}`,
    { headers: authenticated ? { authorization: "Bearer owner-fixture" } : {} },
  );
const captionHandler = toWebHandler(
  createApp().use(
    createRouter().post(
      "/api/tour-generations/:tourId/:generationId/progress-message",
      progressMessage,
    ).handler,
  ),
);
const captionRequest = (
  body: unknown = {
    lang: "ru",
    message_variant: 7,
    previous_activity_text: "Читаем источник.",
  },
  key: string | null = "caption-key",
  authenticated = true,
) =>
  new Request(
    "http://client.test/api/tour-generations/tour%2Fone/generation%2Fone/progress-message",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authenticated ? { authorization: "Bearer owner-fixture" } : {}),
        ...(key === null ? {} : { "Idempotency-Key": key }),
      },
      body: JSON.stringify(body),
    },
  );
beforeEach(() => {
  upstream.mockReset();
  Object.assign(globalThis, {
    useRuntimeConfig: () => ({ pgApiBaseUrl: "http://backend.test" }),
  });
});

it("forwards language and variation on the existing private generation read without changing the response or generation", async () => {
  const result = preparationDetail(
    preparationSnapshot({
      generation_id: "generation/one",
      activity_text: "Читаем источник об остановке Clock House.",
      remaining_seconds: 95,
      remaining_time_kind: "deadline",
    }),
    { tour_id: "tour/one" },
  );
  upstream.mockResolvedValue(result);
  const response = await handler(
    request("lang=ru&message_variant=7&owner_id=ignored&lat=ignored"),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(result);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(upstream).toHaveBeenCalledTimes(1);
  expect(upstream.mock.calls[0]![0]).toBe(
    "http://backend.test/tours/tour%2Fone/generations/generation%2Fone",
  );
  const options = upstream.mock.calls[0]![1];
  expect(options.query).toEqual({ lang: "ru", message_variant: 7 });
  expect(options.retry).toBe(0);
  expect(options.headers.get("authorization")).toBe("Bearer owner-fixture");
  expect(options.method).toBeUndefined();
});

it.each([
  "message_variant=-1",
  "message_variant=1.5",
  "message_variant=2147483648",
  "message_variant=0&message_variant=1",
  "lang=fr",
  "lang=en&lang=ru",
])(
  "rejects unsupported progress query %s without an upstream read",
  async (query) => {
    const response = await handler(request(query));
    expect(response.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  },
);

it("keeps language and variant optional and bounded", async () => {
  upstream.mockResolvedValue(preparationDetail());
  const response = await handler(request(""));
  expect(response.status).toBe(200);
  expect(upstream.mock.calls[0]![1].query).toEqual({});
  await handler(request("lang=en&message_variant=2147483647"));
  expect(upstream.mock.calls[1]![1].query).toEqual({
    lang: "en",
    message_variant: 2147483647,
  });
});

it("keeps even status-only reads owner-authenticated", async () => {
  const response = await handler(request("lang=ru&message_variant=1", false));
  expect(response.status).toBe(401);
  expect(upstream).not.toHaveBeenCalled();
});

it("forwards the explicit caption mutation exactly once with its immutable key and bounded body", async () => {
  const result = preparationDetail(
    preparationSnapshot({
      generation_id: "generation/one",
      activity_source: "llm",
      activity_model: "small-status-model",
      activity_generated_at: "2026-10-12T12:02:05Z",
    }),
    { tour_id: "tour/one" },
  );
  upstream.mockResolvedValue(result);
  const response = await captionHandler(captionRequest());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(result);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(upstream).toHaveBeenCalledTimes(1);
  expect(upstream.mock.calls[0]![0]).toBe(
    "http://backend.test/tours/tour%2Fone/generations/generation%2Fone/progress-message",
  );
  const options = upstream.mock.calls[0]![1];
  expect(options).toMatchObject({
    method: "POST",
    retry: 0,
    body: {
      lang: "ru",
      message_variant: 7,
      previous_activity_text: "Читаем источник.",
    },
  });
  expect(options.headers.get("idempotency-key")).toBe("caption-key");
  expect(options.headers.get("authorization")).toBe("Bearer owner-fixture");
});

it.each([
  { lang: "fr", message_variant: 0 },
  { lang: "en", message_variant: -1 },
  { lang: "en", message_variant: 1.5 },
  { lang: "en", message_variant: 2_147_483_648 },
  { lang: "en", message_variant: 0, previous_activity_text: "x".repeat(281) },
  { lang: "en", message_variant: 0, previous_activity_text: 1 },
  { lang: "en", message_variant: 0, phase: "invented" },
  null,
])(
  "rejects invalid or client-supplied work in caption request %j",
  async (body) => {
    expect((await captionHandler(captionRequest(body))).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  },
);

it.each([null, "", "x".repeat(129)])(
  "requires a bounded caption operation key %j",
  async (key) => {
    expect((await captionHandler(captionRequest(undefined, key))).status).toBe(
      400,
    );
    expect(upstream).not.toHaveBeenCalled();
  },
);

it("keeps captions private and never automatically retries a lost mutation response", async () => {
  expect(
    (await captionHandler(captionRequest(undefined, "key", false))).status,
  ).toBe(401);
  expect(upstream).not.toHaveBeenCalled();
  upstream.mockRejectedValue({ statusCode: 504, message: "unconfirmed" });
  expect((await captionHandler(captionRequest())).status).toBe(504);
  expect(upstream).toHaveBeenCalledTimes(1);
  expect(upstream.mock.calls[0]![1].retry).toBe(0);
});
