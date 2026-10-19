import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import type { RouteLocationNormalized } from "vue-router";
import middleware from "../app/middleware/auth.global";

const fixture = vi.hoisted(() => {
  vi.stubGlobal("defineNuxtRouteMiddleware", <T>(handler: T) => handler);
  return {
    currentUser: null as Pick<User, "uid"> | null,
    ready: vi.fn<() => Promise<void>>(),
    navigate: vi.fn(),
  };
});
vi.mock("firebase/auth", () => ({
  getAuth: () => ({
    get currentUser() {
      return fixture.currentUser;
    },
    authStateReady: fixture.ready,
  }),
}));

const target: RouteLocationNormalized = {
  path: "/tours/saved-walk",
  fullPath: "/tours/saved-walk?view=map",
  name: undefined,
  hash: "",
  query: { view: "map" },
  params: {},
  matched: [],
  meta: {},
  redirectedFrom: undefined,
};

beforeEach(() => {
  fixture.currentUser = null;
  fixture.ready.mockResolvedValue(undefined);
  vi.stubGlobal("navigateTo", fixture.navigate);
});
afterEach(() => vi.unstubAllGlobals());

it("does not redirect a persisted account while Firebase restores its identity", async () => {
  let restore!: () => void;
  fixture.ready.mockReturnValue(
    new Promise<void>((resolve) => {
      restore = resolve;
    }),
  );
  const navigation = middleware(target, target);
  expect(fixture.navigate).not.toHaveBeenCalled();
  fixture.currentUser = { uid: "restored-owner" };
  restore();
  await navigation;
  expect(fixture.navigate).not.toHaveBeenCalled();
});

it("redirects an anonymous visitor only after restoration, preserving the private target", async () => {
  let restore!: () => void;
  fixture.ready.mockReturnValue(
    new Promise<void>((resolve) => {
      restore = resolve;
    }),
  );
  const navigation = middleware(target, target);
  expect(fixture.navigate).not.toHaveBeenCalled();
  restore();
  await navigation;
  expect(fixture.navigate).toHaveBeenCalledWith(
    { path: "/", query: { next: target.fullPath } },
    { replace: true },
  );
});
