import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

// Exercises development or built Nitro against a local fixture.
const dev = process.argv.includes("--dev");
const requests = [];
const upstream = createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  requests.push({
    method: req.method,
    url: req.url,
    headers: req.headers,
    body: Buffer.concat(chunks).toString(),
  });
  res.setHeader("content-type", "application/json");
  if (req.url === "/guides/")
    res.end(JSON.stringify({ guides: [{ id: "guide-1" }] }));
  else if (req.url === "/tours/tour-1/next")
    res.end(
      JSON.stringify({
        record: { id: "record-1", type: "WAIT", message: "" },
        places: [],
        route_points: [],
        audio_data: null,
      }),
    );
  else if (req.url === "/tours/tour-1/finish")
    res.end(
      JSON.stringify({
        tour: { id: "tour-1", status: "FINISHED" },
        result: "SUCCESS",
      }),
    );
  else {
    res.statusCode = 503;
    res.end(JSON.stringify({ detail: "Fixture unavailable" }));
  }
});
const listen = (server) =>
  new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
await listen(upstream);
const reservation = createServer();
await listen(reservation);
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
let output = "";
const app = spawn(
  process.execPath,
  dev
    ? [
        "node_modules/nuxt/bin/nuxt.mjs",
        "dev",
        "--no-fork",
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
      ]
    : [".output/server/index.mjs"],
  {
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      NUXT_PG_API_BASE_URL: `http://127.0.0.1:${upstream.address().port}`,
      PG_API_GUIDES_URL: "/guides/",
      PG_API_LIST_TOURS_URL: "/tours/",
      PG_API_CREATE_ROUTE_URL: "/tours/",
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
app.stdout.on("data", (chunk) => {
  output += chunk;
});
app.stderr.on("data", (chunk) => {
  output += chunk;
});
const origin = `http://127.0.0.1:${port}`;
try {
  let ready = false;
  for (let attempt = 0; attempt < (dev ? 180 : 100); attempt++) {
    if (app.exitCode !== null) throw new Error(output);
    try {
      const response = await fetch(origin, {
        signal: AbortSignal.timeout(5000),
      });
      if (response.status === 500) throw new Error(await response.text());
      if (response.ok && (await response.text()).includes('id="__nuxt"')) {
        ready = true;
        break;
      }
    } catch (error) {
      if (error.message?.includes("Vite Node IPC")) throw error;
    }
    await delay(dev ? 500 : 100);
  }
  assert.ok(ready, output || "Nitro did not start");
  assert.equal((await fetch(`${origin}/api/guides`)).status, 401);
  assert.equal(
    requests.length,
    0,
    "Unauthenticated traffic must not reach upstream",
  );
  const headers = {
    authorization: "Bearer fixture-token",
    "x-request-id": "smoke-123",
  };
  const guides = await fetch(`${origin}/api/guides`, { headers });
  assert.equal(guides.status, 200);
  assert.deepEqual(await guides.json(), [{ id: "guide-1" }]);
  assert.equal(guides.headers.get("x-request-id"), "smoke-123");
  assert.equal(requests[0].headers.authorization, "Bearer fixture-token");
  const next = await fetch(`${origin}/api/get-tour-record/tour-1`, {
    method: "POST",
    headers: {
      ...headers,
      "content-type": "application/json",
      "idempotency-key": "turn-123",
    },
    body: JSON.stringify({ duration: 0, point: { lat: "47", lng: "19" } }),
  });
  assert.equal(next.status, 200);
  assert.equal((await next.json()).audio_data, null);
  assert.equal(requests.at(-1).headers["idempotency-key"], "turn-123");
  const finished = await fetch(`${origin}/api/finish-tour/tour-1`, {
    method: "POST",
    headers,
  });
  assert.equal((await finished.json()).tour.status, "FINISHED");
  const failed = await fetch(`${origin}/api/list-tours`, { headers });
  assert.equal(failed.status, 503);
  console.log(
    "Nitro smoke checks passed: SPA, authentication, proxy mapping, request IDs, idempotency, silent narration, finish, upstream errors.",
  );
} finally {
  app.kill("SIGTERM");
  await new Promise((resolve) => upstream.close(resolve));
}
