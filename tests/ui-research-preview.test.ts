import { beforeEach, expect, it, vi } from "vitest";
import { nextTick, onBeforeUnmount, reactive } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import type { User } from "firebase/auth";
import TourResearchPreviewAction from "../app/components/tour/TourResearchPreviewAction.vue";
import TourResearchPreviewWarning from "../app/components/tour/TourResearchPreviewWarning.vue";
import PGTourCard from "../app/components/PGTourCard.vue";
import PGButton from "../app/components/ui/PGButton.vue";
import Tours from "../app/pages/tours/index.vue";
import { useUserStore } from "../app/stores/userStore";
import { useResearchPreviewStore } from "../app/stores/researchPreviewStore";
import { useTourRequestStore } from "../app/stores/tourRequestStore";
import { findAll, mount, type TestNode } from "./helpers/render";
import en from "../i18n/locales/en.json";
import ru from "../i18n/locales/ru.json";

vi.mock("#imports", () => ({ definePageMeta: () => {} }));

const api = vi.fn();
const navigate = vi.fn();
let language = "en";
const t = (key: string, params: Record<string, unknown> = {}) =>
  String(
    key
      .split(".")
      .reduce(
        (value: any, part) => value?.[part],
        language === "ru" ? ru : en,
      ) ?? key,
  ).replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ""));
const text = (root: TestNode) =>
  findAll(root, (node) => node.type !== "#comment")
    .map((node) => node.text)
    .join(" ");
const button = (root: TestNode, label: string) =>
  findAll(
    root,
    (node) => node.type === "button" && text(node).includes(label),
  )[0]!;
const components = {
  PGButton: {
    props: ["disabled", "loading"],
    template: '<button :disabled="disabled"><slot /></button>',
  },
  NuxtLink: { template: "<a><slot /></a>" },
};
const metadata = {
  source_tour_id: "source/tour",
  source_generation_id: "generation-1",
  unverified: true as const,
  available_stop_ids: ["clock"],
  missing_stop_ids: ["park"],
  captured_at: "2026-10-11T12:00:00Z",
};
const result = () => ({
  id: "new/draft?walk",
  user_id: "backend-owner-id",
  research_preview: metadata,
});
const render = (researchStatus = "RUNNING") =>
  mount(
    TourResearchPreviewAction,
    {
      tourId: "source/tour",
      generationId: "generation-1",
      status: "GENERATING",
      researchStatus,
    },
    components,
    t,
  );
async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
  await nextTick();
}
beforeEach(() => {
  language = "en";
  api.mockReset();
  navigate.mockReset();
  Object.assign(globalThis, {
    useNuxtApp: () => ({ $apiFetch: api }),
    navigateTo: navigate,
    getComputedStyle: () => ({ lineHeight: "24px" }),
  });
  useUserStore().user = { uid: "owner" } as User;
});

it.each(["PENDING", "RUNNING"])(
  "confirms %s research stopping before making a single authenticated mutation",
  async (status) => {
    api.mockResolvedValue(result());
    const app = render(status);
    await nextTick();
    button(app.root, en.researchPreview.stopAndTry).props.onClick();
    await nextTick();
    expect(api).not.toHaveBeenCalled();
    expect(text(app.root)).toContain(en.researchPreview.confirmStop);
    expect(text(app.root)).toContain(en.researchPreview.warning);
    expect(text(app.root)).toContain(en.researchPreview.noAutomaticPlayback);
    await button(app.root, en.researchPreview.confirm).props.onClick();
    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledWith(
      "/api/research-preview/source%2Ftour",
      expect.objectContaining({
        method: "POST",
        body: { generation_id: "generation-1" },
        retry: 0,
        headers: { "Idempotency-Key": expect.any(String) },
      }),
    );
    expect(navigate).toHaveBeenCalledWith("/tours/new%2Fdraft%3Fwalk");
    app.unmount();
  },
);

it.each(["FAILED", "CANCELLED", "READY"])(
  "offers saved research in %s state without claiming preparation is complete",
  async (status) => {
    const app = render(status);
    await nextTick();
    button(app.root, en.researchPreview.trySaved).props.onClick();
    await nextTick();
    expect(text(app.root)).toContain(en.researchPreview.confirmSaved);
    expect(text(app.root)).not.toContain(en.researchPreview.confirmStop);
    button(app.root, en.common.cancel).props.onClick();
    await nextTick();
    expect(api).not.toHaveBeenCalled();
    app.unmount();
  },
);

it("keeps a visible retry and immutable payload/key after uncertainty, even after generation changes and remount", async () => {
  api.mockRejectedValueOnce(new Error("network"));
  const app = render("FAILED");
  button(app.root, en.researchPreview.trySaved).props.onClick();
  await nextTick();
  await button(app.root, en.researchPreview.confirm).props.onClick();
  expect(findAll(app.root, (node) => node.props.role === "alert")).toHaveLength(
    1,
  );
  expect(navigate).not.toHaveBeenCalled();
  const original = api.mock.calls[0]![1];
  app.unmount();
  api.mockResolvedValue(result());
  const retry = render("CANCELLED");
  retry.props.generationId = "generation-2";
  button(retry.root, en.researchPreview.trySaved).props.onClick();
  await nextTick();
  await button(retry.root, en.buttons.tryAgain).props.onClick();
  const retried = api.mock.calls[1]![1];
  expect(retried.body).toEqual(original.body);
  expect(retried.headers).toEqual(original.headers);
  expect(navigate).toHaveBeenCalledTimes(1);
  retry.unmount();
});

it("blocks duplicate submissions shared across two controls for the same tour", async () => {
  const { promise, resolve } = Promise.withResolvers<unknown>();
  api.mockReturnValue(promise);
  const first = render();
  const second = render();
  for (const app of [first, second]) {
    button(app.root, en.researchPreview.stopAndTry).props.onClick();
  }
  await nextTick();
  const confirm = button(first.root, en.researchPreview.confirm);
  const pending = confirm.props.onClick();
  await button(second.root, en.researchPreview.confirm).props.onClick();
  await confirm.props.onClick();
  await flush();
  expect(api).toHaveBeenCalledTimes(1);
  expect(button(second.root, en.researchPreview.confirm).props.disabled).toBe(
    true,
  );
  resolve(result());
  await pending;
  expect(navigate).toHaveBeenCalledTimes(1);
  first.unmount();
  second.unmount();
});

it("serializes preview creation behind other mutations of the source tour", async () => {
  const { promise, resolve: release } = Promise.withResolvers<void>();
  const previous = useTourRequestStore().run("source/tour", () => promise);
  await flush();
  api.mockResolvedValue(result());
  const pending = useResearchPreviewStore().start(
    "source/tour",
    "generation-1",
  );
  await flush();
  expect(api).not.toHaveBeenCalled();
  release();
  await previous;
  await pending;
  expect(api).toHaveBeenCalledTimes(1);
});

it("fences late responses and queued requests through an owner switch, including a switch back", async () => {
  const { promise, resolve } = Promise.withResolvers<unknown>();
  api.mockReturnValue(promise);
  const app = render();
  button(app.root, en.researchPreview.stopAndTry).props.onClick();
  await nextTick();
  const pending = button(app.root, en.researchPreview.confirm).props.onClick();
  await flush();
  useUserStore().user = { uid: "other" } as User;
  useUserStore().user = { uid: "owner" } as User;
  resolve(result());
  await pending;
  expect(navigate).not.toHaveBeenCalled();
  expect(useResearchPreviewStore().forTour("source/tour")).toBeUndefined();
  await nextTick();
  expect(text(app.root)).not.toContain(en.researchPreview.confirmStop);
  app.unmount();

  const { promise: gate, resolve: release } = Promise.withResolvers<void>();
  const previous = useTourRequestStore().run("source/tour", () => gate);
  await flush();
  const queued = useResearchPreviewStore().start("source/tour", null);
  useUserStore().user = { uid: "other" } as User;
  useUserStore().user = { uid: "owner" } as User;
  release();
  await previous;
  expect(await queued).toBeNull();
  expect(api).toHaveBeenCalledTimes(1);
});

it("never navigates when the backend returns the source tour or mismatched preview provenance", async () => {
  const app = render("FAILED");
  button(app.root, en.researchPreview.trySaved).props.onClick();
  await nextTick();
  api.mockResolvedValue({ ...result(), id: "source/tour" });
  await button(app.root, en.researchPreview.confirm).props.onClick();
  api.mockResolvedValue({
    ...result(),
    research_preview: { ...metadata, source_tour_id: "other-tour" },
  });
  await button(app.root, en.buttons.tryAgain).props.onClick();
  expect(navigate).not.toHaveBeenCalled();
  expect(text(app.root)).toContain(en.researchPreview.failed);
  app.unmount();
});

it("opens an authenticated preview whose backend owner ID differs from the Firebase UID", async () => {
  api.mockResolvedValue(result());
  const app = render("FAILED");
  button(app.root, en.researchPreview.trySaved).props.onClick();
  await nextTick();
  await button(app.root, en.researchPreview.confirm).props.onClick();
  expect(result().user_id).not.toBe(useUserStore().user?.uid);
  expect(navigate).toHaveBeenCalledWith("/tours/new%2Fdraft%3Fwalk");
  expect(findAll(app.root, (node) => node.props.role === "alert")).toHaveLength(
    0,
  );
  app.unmount();
});

it.each(["en", "ru"])(
  "shows persistent unverified coverage and route-only gaps in %s",
  async (locale) => {
    language = locale;
    const messages = locale === "ru" ? ru : en;
    const app = mount(
      TourResearchPreviewWarning,
      {
        preview: { ...metadata, available_stop_ids: [] },
        stops: [{ id: "park", name: "Saved park", lat: "1", lng: "2" }],
      },
      {},
      t,
    );
    await nextTick();
    expect(text(app.root)).toContain(messages.researchPreview.warning);
    expect(text(app.root)).toContain(messages.researchPreview.routeOnly);
    expect(text(app.root)).toContain("Saved park");
    expect(text(app.root)).toContain(
      t("researchPreview.coverage", { available: 0, missing: 1 }),
    );
    app.unmount();
  },
);

it("shows preview warning on a tour card instead of a false prepared/research status", async () => {
  const app = mount(
    PGTourCard,
    {
      tourId: "draft",
      status: "GENERATED",
      name: "Walk",
      description: "",
      guideName: "Guide",
      imageUrl: "",
      researchPreview: metadata,
      generatingText: "Tour fully prepared",
      routeStops: [{ id: "park", name: "Park", lat: "1", lng: "2" }],
    },
    components,
    t,
  );
  await nextTick();
  expect(text(app.root)).toContain(en.researchPreview.warning);
  expect(text(app.root)).toContain("Park");
  expect(text(app.root)).not.toContain("Tour fully prepared");
  expect(text(app.root)).not.toContain(en.researchPreview.trySaved);
  app.unmount();
});

it.each([
  { status: "GENERATING", researchStatus: "PENDING", stopping: true },
  { status: "GENERATING", researchStatus: "RUNNING", stopping: true },
  { status: "GENERATING", researchStatus: "FAILED", stopping: false },
  { status: "GENERATING", researchStatus: "CANCELLED", stopping: false },
  { status: "GENERATING", researchStatus: "READY", stopping: false },
  { status: "GENERATED", researchStatus: null, stopping: false },
  { status: "STARTED", researchStatus: "RUNNING", stopping: true },
  { status: "FINISHED", researchStatus: "READY", stopping: false },
])(
  "opens saved research from the real list/card button for $status/$researchStatus",
  async ({ status, researchStatus, stopping }) => {
    const progress = researchStatus
      ? {
          generation_id: "generation-1",
          status: researchStatus,
          phase: "RESEARCH",
          active_researchers: 0,
          completed_stops: 0,
          total_stops: 2,
          turns_started: 0,
          turns_completed: 0,
          tool_calls_completed: 0,
          sources_count: 0,
          source_bytes: 0,
          claims_count: 0,
          word_count: 0,
          archive_bytes: 0,
          error: null,
          updated_at: null,
          stops: [],
        }
      : null;
    const source = {
      id: "source/tour",
      status,
      name: "Original walk",
      description: "",
      image: "",
      guide: null,
      latest_generation_id: "generation-1",
      route: { points: [] },
      preparation_progress: progress,
      preparation_error: researchStatus === "FAILED" ? "Research failed" : null,
    };
    const routes = reactive({
      allTours: [source],
      fetchListTours: vi.fn(),
      stopPolling: vi.fn(),
      isLoading: false,
      error: null,
    });
    Object.assign(globalThis, {
      onBeforeUnmount,
      useRouter: () => ({ push: vi.fn() }),
      useRouteStore: () => routes,
    });
    api.mockResolvedValue(result());
    const app = mount(
      Tours,
      {},
      { PGTourCard, PGButton, NuxtLink: components.NuxtLink },
      t,
    );
    await flush();
    const trigger = button(
      app.root,
      stopping ? en.researchPreview.stopAndTry : en.researchPreview.trySaved,
    );
    expect(trigger.props.disabled).toBe(false);
    trigger.props.onClick();
    await flush();
    expect(api).not.toHaveBeenCalled();
    expect(text(app.root)).toContain(
      stopping
        ? en.researchPreview.confirmStop
        : en.researchPreview.confirmSaved,
    );
    button(app.root, en.researchPreview.confirm).props.onClick();
    await flush();
    expect(api).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/tours/new%2Fdraft%3Fwalk");
    expect(routes.allTours[0]).toEqual(source);
    expect(api.mock.calls.map(([path]) => path)).toEqual([
      "/api/research-preview/source%2Ftour",
    ]);
    app.unmount();
  },
);

it("keeps the shared navigation lock through the handoff and retries the saved draft after a remount", async () => {
  const { promise, resolve } = Promise.withResolvers<void>();
  api.mockResolvedValue(result());
  navigate.mockReturnValue(promise);
  const first = render("FAILED");
  const second = render("FAILED");
  for (const app of [first, second])
    button(app.root, en.researchPreview.trySaved).props.onClick();
  await flush();
  const pending = button(
    first.root,
    en.researchPreview.confirm,
  ).props.onClick();
  await flush();
  expect(button(second.root, en.researchPreview.openSaved).props.disabled).toBe(
    true,
  );
  await button(second.root, en.researchPreview.openSaved).props.onClick();
  expect(navigate).toHaveBeenCalledTimes(1);
  resolve();
  await pending;
  first.unmount();
  second.unmount();

  navigate.mockRejectedValueOnce(new Error("navigation unavailable"));
  const retry = render("READY");
  button(retry.root, en.researchPreview.openSaved).props.onClick();
  await flush();
  await button(retry.root, en.researchPreview.openSaved).props.onClick();
  expect(text(retry.root)).toContain(en.researchPreview.openingFailed);
  expect(api).toHaveBeenCalledTimes(1);
  retry.unmount();

  navigate.mockResolvedValue(undefined);
  const recovery = render("READY");
  expect(text(recovery.root)).toContain(en.researchPreview.openingFailed);
  button(recovery.root, en.researchPreview.openSaved).props.onClick();
  await flush();
  await button(recovery.root, en.buttons.tryAgain).props.onClick();
  expect(api).toHaveBeenCalledTimes(1);
  expect(navigate).toHaveBeenCalledTimes(3);
  recovery.unmount();
});

it.each(["false", "router-abort"])(
  "does not claim success after a %s navigation result",
  async (kind) => {
    if (kind === "router-abort") {
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: "/draft", component: { template: "<div />" } }],
      });
      router.beforeEach(() => false);
      navigate.mockResolvedValue(await router.push("/draft"));
    } else navigate.mockResolvedValue(false);
    api.mockResolvedValue(result());
    const app = render("FAILED");
    button(app.root, en.researchPreview.trySaved).props.onClick();
    await flush();
    await button(app.root, en.researchPreview.confirm).props.onClick();
    expect(text(app.root)).toContain(en.researchPreview.openingFailed);
    expect(button(app.root, en.buttons.tryAgain).props.disabled).toBe(false);
    navigate.mockResolvedValue(undefined);
    await button(app.root, en.buttons.tryAgain).props.onClick();
    expect(api).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(2);
    app.unmount();
  },
);

it("fences a response when the mounted action changes to another tour", async () => {
  const { promise, resolve } = Promise.withResolvers<unknown>();
  api.mockReturnValue(promise);
  const app = render("FAILED");
  button(app.root, en.researchPreview.trySaved).props.onClick();
  await flush();
  const pending = button(app.root, en.researchPreview.confirm).props.onClick();
  await flush();
  app.props.tourId = "other-tour";
  resolve(result());
  await pending;
  expect(navigate).not.toHaveBeenCalled();
  expect(text(app.root)).not.toContain(en.researchPreview.confirmSaved);
  expect(useResearchPreviewStore().forTour("source/tour")?.result?.id).toBe(
    result().id,
  );
  app.unmount();
});

it("rejects a preview that does not match the immutable requested research generation", async () => {
  api.mockResolvedValue({
    ...result(),
    research_preview: { ...metadata, source_generation_id: "wrong-generation" },
  });
  const app = render("FAILED");
  button(app.root, en.researchPreview.trySaved).props.onClick();
  await flush();
  await button(app.root, en.researchPreview.confirm).props.onClick();
  expect(navigate).not.toHaveBeenCalled();
  expect(text(app.root)).toContain(en.researchPreview.failed);
  app.unmount();
});

it("requires an explicit new-draft action for newer research and preserves uncertain retries", async () => {
  const store = useResearchPreviewStore();
  api.mockResolvedValueOnce(result());
  await store.open("source/tour", "generation-1", async () => {});
  const originalKey = api.mock.calls[0]![1].headers["Idempotency-Key"];
  await store.open("source/tour", "generation-2", async () => {});
  expect(api).toHaveBeenCalledTimes(1);
  expect(store.forTour("source/tour")?.result?.id).toBe(result().id);

  api.mockRejectedValueOnce(new Error("Unknown network outcome"));
  await expect(
    store.openNew("source/tour", "generation-2", async () => {}),
  ).rejects.toThrow("Unknown network outcome");
  const pendingKey = api.mock.calls[1]![1].headers["Idempotency-Key"];
  expect(pendingKey).not.toBe(originalKey);
  api.mockResolvedValueOnce({
    ...result(),
    id: "second-draft",
    research_preview: { ...metadata, source_generation_id: "generation-2" },
  });
  await store.openNew("source/tour", "generation-3", async () => {});
  expect(api.mock.calls[2]![1].headers["Idempotency-Key"]).toBe(pendingKey);
  expect(api.mock.calls[2]![1].body).toEqual({ generation_id: "generation-2" });
  expect(store.forTour("source/tour")?.result?.id).toBe("second-draft");
});

it("cancelling a new-version draft confirmation leaves opening the saved draft unchanged", async () => {
  api.mockResolvedValueOnce(result());
  await useResearchPreviewStore().open(
    "source/tour",
    "generation-1",
    async () => {},
  );
  const app = render("FAILED");
  app.props.generationId = "generation-2";
  await flush();
  button(app.root, en.researchPreview.newDraft).props.onClick();
  await flush();
  button(app.root, en.common.cancel).props.onClick();
  await flush();
  button(app.root, en.researchPreview.openSaved).props.onClick();
  await flush();
  await button(app.root, en.researchPreview.openSaved).props.onClick();
  expect(api).toHaveBeenCalledTimes(1);
  expect(navigate).toHaveBeenCalledWith("/tours/new%2Fdraft%3Fwalk");
  app.unmount();
});
