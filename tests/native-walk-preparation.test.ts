import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import type { User } from "firebase/auth";
import NativeTourCard from "../app/components/tour/NativeTourCard.vue";
import { useUserStore } from "../app/stores/userStore";
import { preparationSnapshot } from "./helpers/preparationProgress";
import { findAll, mount, type TestNode } from "./helpers/render";

const api = vi.hoisted(() => ({ detail: vi.fn(), source: vi.fn() }));
vi.mock("../app/composables/api/tours/useTourResearchApi", () => ({
  useTourResearchApi: () => api,
}));
vi.mock("../app/components/tour/TourResearchControls.vue", () => ({
  default: defineComponent({
    setup: () => () => h("button", "Research controls"),
  }),
}));
const text = (root: TestNode) =>
  findAll(root, () => true)
    .map((n) => n.text)
    .join(" ");
async function flush() {
  for (let i = 0; i < 12; i++) await Promise.resolve();
  await nextTick();
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("document", {
    visibilityState: "visible",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  useUserStore().user = { uid: "firebase-owner" } as User;
  vi.stubGlobal("useNuxtApp", () => ({ $apiFetch: vi.fn() }));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("shows and polls native research progress, then refreshes the prepared tour without reloading", async () => {
  const progress = preparationSnapshot({
    generation_id: "generation",
    status: "RUNNING",
    percent: 37,
    stops: [],
    total_stops: 0,
  });
  api.detail.mockResolvedValue({ generation: { owner_id: "owner" }, progress });
  const updated = vi.fn();
  const tour = {
    id: "walk",
    user_id: "owner",
    name: "48-minute walk",
    status: "GENERATING",
    latest_generation_id: "generation",
    playback_generation_id: null,
    preparation_progress: progress,
    route: { walking_plan: { duration_seconds: 2640, distance_meters: 3119 } },
  };
  const app = mount(
    NativeTourCard,
    { tour, onUpdated: updated },
    {
      NuxtLink: defineComponent({
        props: ["to"],
        setup:
          (props, { slots }) =>
          () =>
            h("a", { href: props.to }, slots.default?.()),
      }),
    },
  );
  try {
    await flush();
    expect(
      findAll(app.root, (n) => n.type === "progress")[0]?.props.value,
    ).toBe(37);
    expect(text(app.root)).toContain("nativeWalk.viewPreparation");
    expect(text(app.root)).toContain("Research controls");
    expect(api.detail).toHaveBeenCalled();
    const advanced = {
      ...progress,
      percent: 73,
      updated_at: "2026-11-02T12:01:00Z",
    };
    api.detail.mockResolvedValue({
      generation: { owner_id: "owner" },
      progress: advanced,
    });
    await vi.advanceTimersByTimeAsync(1000);
    await flush();
    await vi.advanceTimersByTimeAsync(3000);
    await flush();
    expect(
      findAll(app.root, (n) => n.type === "progress")[0]?.props.value,
    ).toBe(73);
    api.detail.mockResolvedValue({
      generation: { owner_id: "owner" },
      progress: {
        ...advanced,
        status: "READY",
        percent: 100,
        updated_at: "2026-11-02T12:02:00Z",
      },
    });
    await vi.advanceTimersByTimeAsync(1000);
    await flush();
    expect(updated).toHaveBeenCalledOnce();
    app.props.tour = {
      ...tour,
      status: "GENERATED",
      playback_generation_id: "generation",
    };
    await nextTick();
    expect(text(app.root)).toContain("nativeWalk.preparationReady");
    expect(text(app.root)).toContain("nativeWalk.openWalk");
    expect(text(app.root)).not.toContain("nativeWalk.viewPreparation");
  } finally {
    app.unmount();
  }
});
