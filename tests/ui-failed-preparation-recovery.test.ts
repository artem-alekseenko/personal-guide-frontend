import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  defineComponent,
  effectScope,
  h,
  shallowRef,
  type EffectScope,
} from "vue";
import type { User } from "firebase/auth";
import type { ICreatedTour } from "../app/types";
import type { PreparationProgress } from "../shared/types/preparationProgress";
import { useTourPreparationProgress } from "../app/composables/tour/useTourPreparationProgress";
import TourPreparationProgress from "../app/components/tour/TourPreparationProgress.vue";
import PGTourCard from "../app/components/PGTourCard.vue";
import { useRouteStore } from "../app/stores/routeStore";
import { useUserStore } from "../app/stores/userStore";
import {
  preparationDetail,
  preparationSnapshot,
} from "./helpers/preparationProgress";
import { findAll, mount, type TestNode } from "./helpers/render";
import en from "../i18n/locales/en.json";

const api = vi.hoisted(() => ({ list: vi.fn() }));
vi.mock("../app/composables/api/tours/useListTours", () => ({
  useListTours: api.list,
}));
const fetch = vi.fn();
const scopes: EffectScope[] = [];
const apps: { unmount: () => void }[] = [];
let visibility = "visible";
let visibilityChanged: () => void;
let latest: PreparationProgress;
const failed = () =>
  preparationSnapshot({
    status: "FAILED",
    percent: 95,
    error: "worker_conflict",
  });
const ready = () =>
  preparationSnapshot({
    status: "READY",
    phase: "PUBLICATION",
    percent: 100,
    error: null,
    updated_at: "2026-10-12T12:03:00Z",
  });
const source = (): ICreatedTour =>
  ({
    id: "tour",
    user_id: "backend-owner",
    latest_generation_id: "generation-1",
    status: latest.status === "READY" ? "GENERATED" : "DRAFT",
    preparation_progress: latest,
    preparation_error: latest.error,
    name: "Walk",
    description: "",
    image: "",
    route: { points: [] },
    history: [],
    generating_percent: latest.percent,
  }) as unknown as ICreatedTour;
const text = (node: TestNode): string =>
  [node.text, ...node.children.map(text)].join(" ");
const translate = (key: string) => {
  let value: unknown = en;
  for (const part of key.split("."))
    value =
      value && typeof value === "object" ? Reflect.get(value, part) : undefined;
  return String(value ?? key);
};
async function flush() {
  for (let i = 0; i < 30; i++) await Promise.resolve();
}
function consumer(onRecovered?: (value: ICreatedTour) => void) {
  const tour = shallowRef({
    id: "tour",
    user_id: "backend-owner",
    latest_generation_id: "generation-1",
    preparation_progress: latest,
  });
  const uid = shallowRef<string | null>("firebase-owner");
  const visible = shallowRef(true);
  const scope = effectScope();
  scopes.push(scope);
  const state = scope.run(() =>
    useTourPreparationProgress(tour, uid, shallowRef("en"), {
      visible,
      onRecovered,
    }),
  )!;
  return { state, tour, uid, visible, scope };
}
beforeEach(() => {
  vi.useFakeTimers();
  latest = failed();
  visibility = "visible";
  const stored = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
    removeItem: (key: string) => stored.delete(key),
  });
  vi.stubGlobal("document", {
    get visibilityState() {
      return visibility;
    },
    addEventListener: (_event: string, callback: () => void) => {
      visibilityChanged = callback;
    },
    removeEventListener: vi.fn(),
  });
  fetch
    .mockReset()
    .mockImplementation((path: string) =>
      Promise.resolve(
        path.startsWith("/api/get-tour/")
          ? source()
          : preparationDetail(latest),
      ),
    );
  api.list.mockReset();
  Object.assign(globalThis, { useNuxtApp: () => ({ $apiFetch: fetch }) });
});
afterEach(() => {
  apps.splice(0).forEach((app) => app.unmount());
  scopes.splice(0).forEach((scope) => scope.stop());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("rechecks a visible failed snapshot after 15 seconds and confirms recovered source metadata", async () => {
  const recovered = vi.fn();
  const app = consumer(recovered);
  await flush();
  latest = ready();
  await vi.advanceTimersByTimeAsync(14_999);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(app.state.progress.value?.percent).toBe(95);
  await vi.advanceTimersByTimeAsync(1);
  expect(app.state.progress.value).toMatchObject({
    status: "READY",
    percent: 100,
    error: null,
  });
  expect(recovered).toHaveBeenCalledWith(
    expect.objectContaining({
      status: "GENERATED",
      latest_generation_id: "generation-1",
    }),
  );
  expect(fetch.mock.calls.some(([path]) => path === "/api/get-tour/tour")).toBe(
    true,
  );
  const count = fetch.mock.calls.length;
  await vi.advanceTimersByTimeAsync(60_000);
  expect(fetch).toHaveBeenCalledTimes(count);
  expect(
    fetch.mock.calls.every(([, options]) => options?.method !== "POST"),
  ).toBe(true);
});

it.each(["PENDING", "RUNNING"] as const)(
  "keeps metadata recovery needed through FAILED → %s → READY",
  async (status) => {
    const recovered = vi.fn();
    const app = consumer(recovered);
    await flush();
    latest = preparationSnapshot({
      status,
      percent: 95,
      error: null,
      updated_at: "2026-10-12T12:02:30Z",
    });
    await vi.advanceTimersByTimeAsync(15_000);
    expect(app.state.progress.value?.status).toBe(status);
    expect(recovered).not.toHaveBeenCalled();
    latest = ready();
    await vi.advanceTimersByTimeAsync(1000);
    expect(app.state.progress.value).toMatchObject({
      status: "READY",
      percent: 100,
    });
    expect(
      fetch.mock.calls.filter(([path]) => path === "/api/get-tour/tour"),
    ).toHaveLength(1);
    expect(recovered).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "GENERATED",
        latest_generation_id: "generation-1",
        preparation_progress: expect.objectContaining({ status: "READY" }),
      }),
    );
    const count = fetch.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetch).toHaveBeenCalledTimes(count);
    expect(
      fetch.mock.calls.every(([, options]) => options?.method !== "POST"),
    ).toBe(true);
  },
);

it("retains failure and 95 percent while polling slowly without purchasing captions", async () => {
  const app = consumer();
  await flush();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(app.state.progress.value).toMatchObject({
    status: "FAILED",
    percent: 95,
    error: "worker_conflict",
  });
  expect(
    fetch.mock.calls.every(([, options]) => options?.method !== "POST"),
  ).toBe(true);
});

it("suspends failed polling offscreen, hidden, logged out and disposed", async () => {
  const app = consumer();
  await flush();
  app.visible.value = false;
  await vi.advanceTimersByTimeAsync(30_000);
  expect(fetch).toHaveBeenCalledTimes(1);
  app.visible.value = true;
  await flush();
  expect(fetch).toHaveBeenCalledTimes(2);
  visibility = "hidden";
  visibilityChanged();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(fetch).toHaveBeenCalledTimes(2);
  visibility = "visible";
  visibilityChanged();
  await flush();
  expect(fetch).toHaveBeenCalledTimes(3);
  app.uid.value = null;
  await vi.advanceTimersByTimeAsync(30_000);
  expect(fetch).toHaveBeenCalledTimes(3);
  app.scope.stop();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(fetch).toHaveBeenCalledTimes(3);
});

it.each(["owner", "generation", "hidden"])(
  "ignores a late recovered source after %s changes",
  async (change) => {
    const recovered = vi.fn();
    const app = consumer(recovered);
    await flush();
    latest = ready();
    let resolve!: (value: ICreatedTour) => void;
    fetch.mockImplementation((path: string) =>
      path.startsWith("/api/get-tour/")
        ? new Promise<ICreatedTour>((done) => {
            resolve = done;
          })
        : Promise.resolve(preparationDetail(latest)),
    );
    await vi.advanceTimersByTimeAsync(15_000);
    if (change === "owner") app.uid.value = null;
    if (change === "generation")
      app.tour.value = {
        ...app.tour.value,
        latest_generation_id: "generation-2",
        preparation_progress: preparationSnapshot({
          generation_id: "generation-2",
        }),
      };
    if (change === "hidden") app.visible.value = false;
    resolve(source());
    await flush();
    expect(recovered).not.toHaveBeenCalled();
  },
);

it("retries source confirmation rather than marking metadata recovery complete after a failed read", async () => {
  const recovered = vi.fn();
  const app = consumer(recovered);
  await flush();
  latest = ready();
  let sourceFails = true;
  fetch.mockImplementation((path: string) =>
    path.startsWith("/api/get-tour/") && sourceFails
      ? Promise.reject(new Error("offline"))
      : Promise.resolve(
          path.startsWith("/api/get-tour/")
            ? source()
            : preparationDetail(latest),
        ),
  );
  await vi.advanceTimersByTimeAsync(15_000);
  expect(app.state.progress.value?.status).toBe("FAILED");
  expect(app.state.refreshFailed.value).toBe(true);
  sourceFails = false;
  await vi.advanceTimersByTimeAsync(15_000);
  expect(app.state.progress.value?.status).toBe("READY");
  expect(recovered).toHaveBeenCalledOnce();
});

it("offers factual status refresh independently of an uncertain paid-caption receipt", async () => {
  const storageKey =
    'pg-preparation-caption-["firebase-owner","backend-owner","tour"]';
  const receipt = JSON.stringify({
    version: 1,
    key: "original-key",
    generationId: "generation-1",
    body: { lang: "en", message_variant: 4 },
  });
  sessionStorage.setItem(storageKey, receipt);
  const app = consumer();
  await flush();
  const caption = vi.fn();
  const view = mount(
    TourPreparationProgress,
    {
      progress: app.state.progress.value,
      captionUncertain: true,
      refreshing: true,
      statusRefreshing: false,
      onRefresh: caption,
      onRefreshStatus: app.state.refreshStatus,
    },
    {},
    translate,
  );
  apps.push(view);
  const button = findAll(
    view.root,
    (node) => "data-refresh-status" in node.props,
  )[0]!;
  expect(button).toBeDefined();
  expect(button.props.disabled).toBe(false);
  button.props.onClick();
  await flush();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(
    fetch.mock.calls.every(([, options]) => options?.method !== "POST"),
  ).toBe(true);
  expect(caption).not.toHaveBeenCalled();
  expect(app.state.captionUncertain.value).toBe(true);
  expect(sessionStorage.getItem(storageKey)).toBe(receipt);
});

it("refreshes list metadata and restores card navigation when its failed generation recovers", async () => {
  vi.stubGlobal("getComputedStyle", () => ({ lineHeight: "24px" }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(
        private callback: (entries: { isIntersecting: boolean }[]) => void,
      ) {}
      observe() {
        this.callback([{ isIntersecting: true }]);
      }
      disconnect() {}
    },
  );
  useUserStore().user = { uid: "firebase-owner" } as User;
  const routes = useRouteStore();
  api.list.mockResolvedValue([source()]);
  await routes.fetchListTours();
  const Link = defineComponent({
    props: ["to"],
    setup(props, { slots }) {
      return () => h("a", { href: props.to }, slots.default?.());
    },
  });
  let view!: ReturnType<typeof mount>;
  const updated = vi.fn(async () => {
    await routes.fetchListTours();
    const tour = routes.allTours[0]!;
    view.props.status = tour.status;
    view.props.preparationProgress = tour.preparation_progress;
    view.props.preparationError = tour.preparation_error;
  });
  view = mount(
    PGTourCard,
    {
      name: "Walk",
      description: "",
      generatingText: "Failed",
      tourId: "tour",
      imageUrl: "",
      guideName: "Guide",
      status: "DRAFT",
      latestGenerationId: "generation-1",
      preparationProgress: failed(),
      preparationError: "worker_conflict",
      onUpdated: updated,
    },
    { NuxtLink: Link },
    translate,
  );
  apps.push(view);
  await flush();
  expect(
    findAll(
      view.root,
      (node) => node.type === "a" && node.props.href === "/tours/tour",
    ),
  ).toHaveLength(0);
  latest = preparationSnapshot({
    status: "RUNNING",
    percent: 95,
    error: null,
    updated_at: "2026-10-12T12:02:30Z",
  });
  await vi.advanceTimersByTimeAsync(15_000);
  expect(updated).not.toHaveBeenCalled();
  latest = ready();
  api.list.mockResolvedValue([source()]);
  await vi.advanceTimersByTimeAsync(1000);
  await flush();
  expect(updated).toHaveBeenCalledOnce();
  expect(routes.allTours[0]!.status).toBe("GENERATED");
  expect(
    findAll(
      view.root,
      (node) => node.type === "a" && node.props.href === "/tours/tour",
    ),
  ).toHaveLength(1);
  expect(
    fetch.mock.calls.every(([, options]) => options?.method !== "POST"),
  ).toBe(true);
  routes.stopPolling();
});

it("keeps the ordinary in-progress status-refresh button factual-only", async () => {
  latest = preparationSnapshot();
  const app = consumer();
  await flush();
  const caption = vi.fn();
  const view = mount(
    TourPreparationProgress,
    {
      progress: app.state.progress.value,
      captionUncertain: false,
      onRefresh: caption,
      onRefreshStatus: app.state.refreshStatus,
    },
    {},
    translate,
  );
  apps.push(view);
  const button = findAll(
    view.root,
    (node) => "data-refresh-progress" in node.props,
  )[0]!;
  button.props.onClick();
  await flush();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(caption).not.toHaveBeenCalled();
  expect(
    fetch.mock.calls.every(([, options]) => options?.method !== "POST"),
  ).toBe(true);
});
