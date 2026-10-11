import { afterEach, beforeEach, expect, it, vi, type Mock } from "vitest";
import * as Vue from "vue";
import {
  useBackNavigation,
  type BackNavigation,
} from "../app/composables/ui/useBackNavigation";
import { useUserStore } from "../app/stores/userStore";
import { mount } from "./helpers/render";
import type { User } from "firebase/auth";

const fixtureUser = (uid: string): User => {
  // This controlled auth fixture only exercises the UID boundary.
  const user = { uid } as User;
  return user;
};

let route: { fullPath: string; path: string; name: string };
let navigation: BackNavigation;
let router: { back: Mock; replace: Mock; push: Mock };
beforeEach(() => {
  vi.useFakeTimers();
  router = { back: vi.fn(), replace: vi.fn(), push: vi.fn() };
  const session = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => session.get(key) ?? null,
    setItem: (key: string, value: string) => session.set(key, value),
    removeItem: (key: string) => session.delete(key),
  });
  route = Vue.reactive({
    fullPath: "/tours/private",
    path: "/tours/private",
    name: "tours-tourId",
  });
  Object.assign(globalThis, {
    ...Vue,
    useRoute: () => route,
    useRouter: () => router,
  });
  Object.assign(window, {
    history: { length: 1 },
    navigator: {},
    matchMedia: () => ({ matches: false }),
  });
  vi.stubGlobal("document", { referrer: "" });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const render = () =>
  mount({
    setup() {
      navigation = useBackNavigation();
      return () => Vue.h("span", String(navigation.shouldShow.value));
    },
  });

it("does not repopulate cleared private history when logout redirects to login", async () => {
  const user = useUserStore();
  user.setUser(fixtureUser("alice"));
  localStorage.setItem(
    "navigationHistory",
    JSON.stringify({ uid: "alice", paths: ["/guides"] }),
  );
  const app = render();
  user.reset();
  await Vue.nextTick();
  expect(localStorage.getItem("navigationHistory")).toBeNull();
  Object.assign(route, { fullPath: "/", path: "/", name: "index" });
  await Vue.nextTick();
  expect(localStorage.getItem("navigationHistory")).toBeNull();
  app.unmount();
});

it("cancels a trailing history save when the account logs out", async () => {
  const user = useUserStore();
  user.setUser(fixtureUser("alice"));
  const app = render();
  Object.assign(route, {
    fullPath: "/guides",
    path: "/guides",
    name: "guides",
  });
  await Vue.nextTick();
  Object.assign(route, {
    fullPath: "/create-route",
    path: "/create-route",
    name: "create-route",
  });
  await Vue.nextTick();
  user.reset();
  await Vue.nextTick();
  await vi.advanceTimersByTimeAsync(300);
  expect(localStorage.getItem("navigationHistory")).toBeNull();
  app.unmount();
});

it("does not load private navigation history for an unauthenticated mount", () => {
  localStorage.setItem("navigationHistory", JSON.stringify(["/tours/private"]));
  const app = render();
  expect(localStorage.getItem("navigationHistory")).toBeNull();
  app.unmount();
});

it("clears private navigation and settings return state on a direct account switch", async () => {
  const user = useUserStore();
  user.setUser(fixtureUser("alice"));
  localStorage.setItem(
    "navigationHistory",
    JSON.stringify({ uid: "alice", paths: ["/guides"] }),
  );
  sessionStorage.setItem(
    "settingsReturnRoute",
    JSON.stringify({ uid: "alice", path: "/tours/alice-private" }),
  );
  const app = render();
  user.setUser(fixtureUser("bob"));
  await Vue.nextTick();
  expect(navigation.shouldShow.value).toBe(false);
  expect(localStorage.getItem("navigationHistory")).toBeNull();
  expect(sessionStorage.getItem("settingsReturnRoute")).toBeNull();
  Object.assign(route, { fullPath: "/tours", path: "/tours", name: "tours" });
  await Vue.nextTick();
  expect(localStorage.getItem("navigationHistory")).toBeNull();
  app.unmount();
});

it("restores only local route strings and returns to the last valid entry", () => {
  useUserStore().setUser(fixtureUser("alice"));
  localStorage.setItem(
    "navigationHistory",
    JSON.stringify({
      uid: "alice",
      paths: [
        "/",
        "/settings",
        "/guides",
        "https://example.com",
        "//example.com",
        "/\\example.com",
        {},
        null,
        42,
      ],
    }),
  );
  const app = render();
  navigation.goBack();
  expect(router.push).toHaveBeenCalledWith("/guides");
  app.unmount();
});

it("keeps back navigation functional when browser storage is unavailable", async () => {
  useUserStore().setUser(fixtureUser("alice"));
  for (const method of ["getItem", "setItem", "removeItem"] as const) {
    vi.spyOn(localStorage, method).mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });
  }
  const app = render();
  Object.assign(route, {
    fullPath: "/guides",
    path: "/guides",
    name: "guides",
  });
  await Vue.nextTick();
  navigation.goBack();
  expect(router.push).toHaveBeenCalledWith("/tours/private");
  app.unmount();
});

it("does not restore another account's routes after the navigation controller remounts", async () => {
  const user = useUserStore();
  user.setUser(fixtureUser("alice"));
  const first = render();
  Object.assign(route, {
    fullPath: "/guides",
    path: "/guides",
    name: "guides",
  });
  await Vue.nextTick();
  first.unmount();
  user.setUser(fixtureUser("bob"));
  Object.assign(route, {
    fullPath: "/tours/bob",
    path: "/tours/bob",
    name: "tours-tourId",
  });
  const second = render();
  expect(navigation.shouldShow.value).toBe(false);
  expect(localStorage.getItem("navigationHistory")).toBeNull();
  second.unmount();
});

it.each([
  { uid: "alice", path: "/tours/alice", expected: "/tours/alice" },
  { uid: "bob", path: "/tours/bob", expected: "/tours" },
  { uid: "alice", path: "//example.com", expected: "/tours" },
])(
  "returns from settings only to a local route for the current owner: $path",
  ({ uid, path, expected }) => {
    useUserStore().setUser(fixtureUser("alice"));
    Object.assign(route, {
      fullPath: "/settings",
      path: "/settings",
      name: "settings",
    });
    sessionStorage.setItem(
      "settingsReturnRoute",
      JSON.stringify({ uid, path }),
    );
    const app = render();
    navigation.goBack();
    expect(router.replace).toHaveBeenCalledWith(expected);
    expect(sessionStorage.getItem("settingsReturnRoute")).toBeNull();
    app.unmount();
  },
);

it("returns from settings when session storage is blocked", () => {
  useUserStore().setUser(fixtureUser("alice"));
  Object.assign(route, {
    fullPath: "/settings",
    path: "/settings",
    name: "settings",
  });
  vi.spyOn(sessionStorage, "getItem").mockImplementation(() => {
    throw new DOMException("Storage blocked", "SecurityError");
  });
  const app = render();
  navigation.goBack();
  expect(router.replace).toHaveBeenCalledWith("/tours");
  app.unmount();
});
