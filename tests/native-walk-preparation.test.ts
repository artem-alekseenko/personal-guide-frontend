import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import type { User } from "firebase/auth";
import NativeWalkPreparation from "../app/components/tour/NativeWalkPreparation.vue";
import NativeTourCard from "../app/components/tour/NativeTourCard.vue";
import { useUserStore } from "../app/stores/userStore";
import { preparationSnapshot } from "./helpers/preparationProgress";
import { findAll, mount, type TestNode } from "./helpers/render";

const metadata = vi.fn();
const api = vi.hoisted(() => ({ detail: vi.fn(), source: vi.fn() }));
vi.mock("../app/composables/api/tours/useTourResearchApi", () => ({
  useTourResearchApi: () => api,
}));
vi.mock("../app/components/tour/TourResearchControls.vue", () => ({
  default: defineComponent({
    setup: () => () => h("button", "Research controls"),
  }),
}));
const links = {
  NuxtLink: defineComponent({
    props: ["to"],
    setup:
      (props, { slots }) =>
      () =>
        h("a", { href: props.to }, slots.default?.()),
  }),
};
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
  metadata.mockReset();
  api.source.mockReset();
  vi.stubGlobal("useI18n", () => ({
    t: (key: string, params?: Record<string, string>) =>
      params ? Object.values(params).join(": ") : key,
  }));
  vi.stubGlobal("document", {
    visibilityState: "visible",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  useUserStore().user = { uid: "firebase-owner" } as User;
  vi.stubGlobal("useNuxtApp", () => ({ $apiFetch: metadata }));
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
    expect(text(app.root)).not.toContain("Research controls");
    expect(findAll(app.root, (n) => n.type === "details")).toHaveLength(0);
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
    expect(text(app.root)).toContain("tourGeneration.statuses.READY");
    expect(text(app.root)).toContain("nativeWalk.openWalk");
    expect(text(app.root)).not.toContain("nativeWalk.viewPreparation");
  } finally {
    app.unmount();
  }
});

it("keeps checking after 100% until the prepared tour is visible, including a failed refresh", async () => {
  const progress = preparationSnapshot({
    generation_id: "generation",
    status: "READY",
    percent: 100,
    stops: [],
    total_stops: 0,
  });
  const tour = {
    id: "walk",
    user_id: "owner",
    status: "GENERATING",
    latest_generation_id: "generation",
    playback_generation_id: null,
    preparation_progress: progress,
    route: { walking_plan: { duration_seconds: 1800, distance_meters: 2000 } },
  };
  const published = {
    ...tour,
    status: "GENERATED",
    playback_generation_id: "generation",
  };
  api.detail.mockResolvedValue({ generation: { owner_id: "owner" }, progress });
  api.source
    .mockReset()
    .mockResolvedValueOnce(tour)
    .mockRejectedValueOnce(new Error("Temporary read failure"))
    .mockResolvedValue(published);
  const updated = vi.fn();
  const app = mount(NativeTourCard, { tour, onUpdated: updated }, links);
  try {
    await flush();
    expect(text(app.root)).toContain("nativeWalk.viewPreparation");
    // The initial terminal notification can fetch a still-GENERATING tour.
    updated.mockClear();
    updated.mockImplementation(() => {
      app.props.tour = published;
    });
    await vi.advanceTimersByTimeAsync(5000);
    await flush();
    expect(api.source).toHaveBeenCalledTimes(3);
    expect(updated).toHaveBeenCalledOnce();
    expect(text(app.root)).toContain("tourGeneration.statuses.READY");
    expect(text(app.root)).toContain("nativeWalk.openWalk");
    expect(
      findAll(app.root, (n) => "data-preparation-details" in n.props),
    ).toHaveLength(0);
    const reads = api.detail.mock.calls.length;
    await vi.advanceTimersByTimeAsync(5000);
    expect(api.detail).toHaveBeenCalledTimes(reads);
  } finally {
    app.unmount();
  }
});

it("does not apply publication from a previous account", async () => {
  const progress = preparationSnapshot({
    generation_id: "generation",
    status: "READY",
    percent: 100,
  });
  const tour = {
    id: "walk",
    user_id: "owner",
    status: "GENERATING",
    latest_generation_id: "generation",
    playback_generation_id: null,
    preparation_progress: progress,
    route: { walking_plan: { duration_seconds: 1800, distance_meters: 2000 } },
  };
  api.detail.mockResolvedValue({ generation: { owner_id: "owner" }, progress });
  let resolve!: (value: unknown) => void;
  api.source.mockReset().mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const updated = vi.fn();
  const app = mount(NativeTourCard, { tour, onUpdated: updated }, links);
  try {
    await flush();
    expect(api.source).toHaveBeenCalledOnce();
    updated.mockClear();
    useUserStore().user = { uid: "different-account" } as User;
    await flush();
    resolve({
      ...tour,
      status: "GENERATED",
      playback_generation_id: "generation",
    });
    await flush();
    await vi.advanceTimersByTimeAsync(5000);
    expect(updated).not.toHaveBeenCalled();
    expect(api.source).toHaveBeenCalledOnce();
  } finally {
    app.unmount();
  }
});

it("presents a prepared tour with saved city/place names and an opening action and a compact generation summary", async () => {
  const progress = preparationSnapshot({
    generation_id: "generation",
    status: "READY",
    percent: 100,
  });
  const tour = {
    id: "walk",
    user_id: "owner",
    name: "34-minute walk",
    status: "GENERATED",
    latest_generation_id: "generation",
    playback_generation_id: "generation",
    preparation_progress: progress,
    route: {
      walking_plan: {
        revision: "route",
        intent: { language: "en" },
        duration_seconds: 1920,
        distance_meters: 2309,
      },
    },
  };
  api.detail.mockResolvedValue({ generation: { owner_id: "owner" }, progress });
  metadata.mockResolvedValue({
    generation_id: "generation",
    route_revision: "route",
    language: "en",
    subjects: [
      { id: "city", name: "Novi Sad", kind: "city" },
      { id: "library", name: "City Library", kind: "building" },
      { id: "unresearched", name: "Unresearched place", kind: "building" },
    ],
    coverage: [
      { subject_id: "library", status: "accepted", claim_ids: ["claim"] },
    ],
  });
  const app = mount(NativeTourCard, { tour }, links);
  try {
    await flush();
    const heading = findAll(app.root, (n) => n.type === "h2")[0]!;
    expect(text(heading)).toContain("Novi Sad");
    expect(text(heading)).toContain("City Library");
    expect(text(heading)).not.toContain("Unresearched place");
    expect(text(heading)).not.toContain("34-minute walk");
    const nodes = findAll(app.root, () => true);
    const open = nodes.find((n) => n.type === "a")!;
    const summary = nodes.find((n) => "data-tour-generation" in n.props)!;
    expect(open.props.href).toBe("/tours/walk");
    expect(text(open)).toContain("nativeWalk.openWalk");
    expect(nodes.indexOf(open)).toBeLessThan(nodes.indexOf(summary));
    expect(findAll(app.root, (n) => n.type === "details")).toHaveLength(0);
    expect(metadata).toHaveBeenCalledOnce();
    expect(metadata.mock.calls[0]![0]).toBe("/api/native-walk/walk/knowledge");
    app.props.tour = { ...tour, name: "My favourite evening walk" };
    await nextTick();
    expect(text(heading)).toContain("My favourite evening walk");
    expect(metadata).toHaveBeenCalledOnce();
  } finally {
    app.unmount();
  }
});

it("discards a saved title arriving after the account changes", async () => {
  const progress = preparationSnapshot({
    generation_id: "generation",
    status: "READY",
    percent: 100,
  });
  const tour = {
    id: "walk",
    user_id: "owner",
    name: "34-minute walk",
    status: "GENERATED",
    latest_generation_id: "generation",
    playback_generation_id: "generation",
    preparation_progress: progress,
    route: {
      walking_plan: {
        revision: "route",
        intent: { language: "en" },
        duration_seconds: 1920,
        distance_meters: 2309,
      },
    },
  };
  api.detail.mockResolvedValue({ generation: { owner_id: "owner" }, progress });
  let resolve!: (value: unknown) => void;
  metadata.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const app = mount(NativeTourCard, { tour }, links);
  try {
    await flush();
    useUserStore().user = { uid: "different-account" } as User;
    await flush();
    resolve({
      generation_id: "generation",
      route_revision: "route",
      language: "en",
      subjects: [{ id: "city", name: "Novi Sad", kind: "city" }],
    });
    await flush();
    expect(text(app.root)).not.toContain("Novi Sad");
    expect(metadata).toHaveBeenCalledOnce();
  } finally {
    app.unmount();
  }
});

it("shows a concise summary and keeps technical preparation closed on the detail page", async () => {
  const progress = preparationSnapshot({
    generation_id: "generation",
    status: "RUNNING",
    percent: 37,
    stops: [],
  });
  api.detail.mockResolvedValue({ generation: { owner_id: "owner" }, progress });
  const app = mount(NativeWalkPreparation, {
    tour: {
      id: "walk",
      status: "GENERATING",
      latest_generation_id: "generation",
      preparation_progress: progress,
    },
  });
  await flush();
  expect(
    findAll(app.root, (n) => "data-tour-generation" in n.props),
  ).toHaveLength(1);
  const details = findAll(
    app.root,
    (n) => "data-preparation-details" in n.props,
  )[0]!;
  expect(details.props.open).toBeFalsy();
  expect(findAll(details, (n) => n.type === "progress")).toHaveLength(1);
  expect(findAll(app.root, (n) => n.type === "progress")).toHaveLength(2);
  app.unmount();
});
