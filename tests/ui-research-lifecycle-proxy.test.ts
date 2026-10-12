import { beforeEach, expect, it, vi } from "vitest";
import { createApp, createRouter, toWebHandler } from "h3";
import history from "../server/api/tour-generations/[tourId]/index.get";
import detail from "../server/api/tour-generations/[tourId]/[generationId].get";
import cancel from "../server/api/tour-generations/[tourId]/[generationId]/cancel.post";
import accept from "../server/api/tour-generations/[tourId]/[generationId]/accept.post";
import finishEarly from "../server/api/tour-generations/[tourId]/[generationId]/finish-early.post";
import regenerate from "../server/api/tour-regenerate/[tourId].post";
import research from "../server/api/tour-research/[tourId].get";
import enrichment from "../server/api/tour-enrichment/[tourId].get";
import artifact from "../server/api/research-artifacts/[tourId]/[artifactId].get";
const upstream = vi.hoisted(() => ({ json: vi.fn(), raw: vi.fn() }));
vi.mock("ofetch", () => ({
  $fetch: Object.assign(upstream.json, { raw: upstream.raw }),
}));
Object.assign(globalThis, {
  useRuntimeConfig: () => ({ pgApiBaseUrl: "http://backend.test" }),
});
const handler = toWebHandler(
  createApp().use(
    createRouter()
      .get("/api/tour-generations/:tourId", history)
      .get("/api/tour-generations/:tourId/:generationId", detail)
      .post("/api/tour-generations/:tourId/:generationId/cancel", cancel)
      .post("/api/tour-generations/:tourId/:generationId/accept", accept)
      .post(
        "/api/tour-generations/:tourId/:generationId/finish-early",
        finishEarly,
      )
      .post("/api/tour-regenerate/:tourId", regenerate)
      .get("/api/tour-research/:tourId", research)
      .get("/api/tour-enrichment/:tourId", enrichment)
      .get("/api/research-artifacts/:tourId/:artifactId", artifact).handler,
  ),
);
const request = (path: string, method = "GET", authenticated = true) =>
  new Request(`http://client.test${path}`, {
    method,
    headers: authenticated
      ? {
          authorization: "Bearer owner-fixture",
          "x-request-id": "research-request",
        }
      : {},
  });
beforeEach(() => {
  upstream.raw.mockReset();
  upstream.json.mockReset();
});

it.each([
  ["/api/tour-generations/source", "GET"],
  ["/api/tour-generations/source/generation", "GET"],
  ["/api/tour-generations/source/generation/cancel", "POST"],
  ["/api/tour-generations/source/generation/accept", "POST"],
  ["/api/tour-generations/source/generation/finish-early", "POST"],
  ["/api/tour-regenerate/source", "POST"],
  ["/api/tour-research/source", "GET"],
  ["/api/tour-enrichment/source", "GET"],
  ["/api/research-artifacts/source/file", "GET"],
])(
  "rejects unauthenticated lifecycle access to %s before upstream",
  async (path, method) => {
    const response = await handler(request(path, method, false));
    expect(response.status).toBe(401);
    expect(upstream.raw).not.toHaveBeenCalled();
    expect(upstream.json).not.toHaveBeenCalled();
  },
);

it.each([
  "application/json",
  "application/problem+json",
  "text/plain; charset=utf-8",
])(
  "privately downloads allowed saved %s bytes without following redirects or backend URLs",
  async (type) => {
    upstream.raw.mockResolvedValue({
      headers: new Headers({ "content-type": type }),
      _data: new TextEncoder().encode('{"saved":true}').buffer,
    });
    const response = await handler(
      request("/api/research-artifacts/source%2Ftour/file%2Fraw"),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('{"saved":true}');
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("content-disposition")).toBe("attachment");
    expect(response.headers.get("x-request-id")).toBe("research-request");
    expect(upstream.raw.mock.calls[0]![0]).toBe(
      "http://backend.test/tours/source%2Ftour/artifacts/file%2Fraw",
    );
    const options = upstream.raw.mock.calls[0]![1];
    expect(options.redirect).toBe("error");
    expect(options.retry).toBe(0);
    expect(options.headers.authorization).toBe("Bearer owner-fixture");
    expect(upstream.json).not.toHaveBeenCalled();
  },
);

it.each([
  "audio/mpeg",
  "video/mp4",
  "text/html",
  "image/svg+xml",
  "application/octet-stream",
  "application/javascript",
])(
  "rejects %s research downloads rather than exposing executable/media artifacts",
  async (type) => {
    upstream.raw.mockResolvedValue({
      headers: new Headers({ "content-type": type }),
      _data: new ArrayBuffer(1),
    });
    const response = await handler(
      request("/api/research-artifacts/source/file"),
    );
    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(
      (await response.text()).includes("Could not download saved research"),
    ).toBe(true);
  },
);

it("preserves private failure status without exposing backend body, storage paths or tokens", async () => {
  upstream.raw.mockRejectedValue({
    response: {
      status: 403,
      statusText: "private-path-and-token",
      _data: { secret: "private-artifact-body" },
    },
  });
  const response = await handler(
    request("/api/research-artifacts/source/file"),
  );
  expect(response.status).toBe(403);
  const body = await response.text();
  expect(body).not.toContain("private-path-and-token");
  expect(body).not.toContain("private-artifact-body");
  expect(body).not.toContain("owner-fixture");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});

it("keeps decoded source and generation identifiers within distinct upstream segments on mutations", async () => {
  upstream.json.mockRejectedValue({
    response: { status: 409, statusText: "Generation not eligible" },
  });
  const response = await handler(
    request(
      "/api/tour-generations/source%2Ftour/generation%2Fone/accept",
      "POST",
    ),
  );
  expect(response.status).toBe(409);
  expect(upstream.json.mock.calls[0]![0]).toBe(
    "http://backend.test/tours/source%2Ftour/generations/generation%2Fone/accept",
  );
  expect(upstream.json.mock.calls[0]![1].retry).toBe(0);
  expect(upstream.json).toHaveBeenCalledTimes(1);
});
