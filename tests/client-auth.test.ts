import { it, expect, vi } from "vitest";
const firebase = vi.hoisted(() => ({
  currentUser: {
    uid: "alice",
    getIdToken: vi.fn().mockResolvedValue("alice-token"),
  } as any,
}));
vi.mock("firebase/auth", () => ({ getAuth: () => firebase }));
it("never sends a Firebase bearer token to a foreign /api/ URL", async () => {
  let onRequest: any;
  Object.assign(globalThis, {
    location: { origin: "https://frontend.test" },
    defineNuxtPlugin: (fn: any) => fn,
    $fetch: {
      create: (options: any) => {
        onRequest = options.onRequest;
        return {};
      },
    },
  });
  const plugin = (await import("../app/plugins/01-api-fetch.client")).default;
  (plugin as any)();
  const options: any = {};
  await onRequest({ request: "https://foreign.test/api/steal", options });
  expect(options.headers).toBeUndefined();
  expect(firebase.currentUser.getIdToken).not.toHaveBeenCalled();
  const local: any = {};
  await onRequest({ request: "/api/list-tours", options: local });
  expect(local.headers.get("Authorization")).toBe("Bearer alice-token");
});
it("uses a new token when the account changes while another token request is pending", async () => {
  let onRequest: any;
  Object.assign(globalThis, {
    location: { origin: "https://frontend.test" },
    defineNuxtPlugin: (fn: any) => fn,
    $fetch: {
      create: (options: any) => {
        onRequest = options.onRequest;
        return {};
      },
    },
  });
  const plugin = (await import("../app/plugins/01-api-fetch.client")).default;
  (plugin as any)();
  let resolve!: (token: string) => void;
  firebase.currentUser = {
    uid: "alice",
    getIdToken: () =>
      new Promise((r) => {
        resolve = r;
      }),
  };
  const old = onRequest({ request: "/api/list-tours", options: {} });
  firebase.currentUser = {
    uid: "bob",
    getIdToken: () => Promise.resolve("bob-token"),
  };
  const options: any = {};
  await onRequest({ request: "/api/list-tours", options });
  expect(options.headers.get("Authorization")).toBe("Bearer bob-token");
  resolve("alice-token");
  await expect(old).rejects.toThrow("Authentication changed");
});
