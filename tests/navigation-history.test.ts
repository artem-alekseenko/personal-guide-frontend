import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as Vue from "vue";
import { useBackNavigation } from "../app/composables/ui/useBackNavigation";
import { useUserStore } from "../app/stores/userStore";
import { mount } from "./helpers/render";

let route: ReturnType<
  typeof Vue.reactive<{ fullPath: string; path: string; name: string }>
>;
beforeEach(() => {
  vi.useFakeTimers();
  route = Vue.reactive({
    fullPath: "/tours/private",
    path: "/tours/private",
    name: "tours-tourId",
  });
  Object.assign(globalThis, {
    ...Vue,
    useRoute: () => route,
    useRouter: () => ({ back: vi.fn(), replace: vi.fn(), push: vi.fn() }),
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
  vi.unstubAllGlobals();
});
const render = () =>
  mount({
    setup() {
      const navigation = useBackNavigation();
      return () => Vue.h("span", String(navigation.shouldShow.value));
    },
  });

it("does not repopulate cleared private history when logout redirects to login", async () => {
  const user = useUserStore();
  user.setUser({ uid: "alice" } as any);
  localStorage.setItem("navigationHistory", JSON.stringify(["/guides"]));
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
  user.setUser({ uid: "alice" } as any);
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
