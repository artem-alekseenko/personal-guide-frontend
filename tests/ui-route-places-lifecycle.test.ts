import { beforeEach, expect, it, vi } from "vitest";
import { computed, effectScope, nextTick, ref } from "vue";
import type { User } from "firebase/auth";
import type { ICreatedTour } from "../app/types";
import type { Experience } from "../app/types/tourExperience";
import { emptyPersonalContext } from "../app/types/personalContext";
import { useUserStore } from "../app/stores/userStore";
import { useRoutePlaces } from "../app/composables/tour/useRoutePlaces";
const api = vi.fn();
const place = {
  id: "school",
  name: "Public school",
  lat: "47",
  lng: "19",
  source: "google" as const,
  source_id: "g-school",
  types: ["school"],
  address: null,
  distance_to_route_meters: 5,
  along_route_meters: 500,
};
const discovery = {
  generation_id: "gen-1",
  geometry_hash: "accepted-corridor",
  language: "en",
  checked_at: "2026-10-12",
  status: "partial" as const,
  warnings: [],
  discovered_places: [place],
  geometry: [
    { lat: "47", lng: "19" },
    { lat: "47.01", lng: "19.01" },
  ],
  geometry_provider: "google",
};
beforeEach(() => {
  api.mockReset();
  Object.assign(globalThis, { useNuxtApp: () => ({ $apiFetch: api }) });
  useUserStore().user = { uid: "owner" } as User;
});
it("displays the full accepted corridor cache independently of selected-stop/GPS updates and fences logout", async () => {
  const tour = ref<ICreatedTour>({
    id: "tour",
    name: "Walk",
    image: "",
    description: "",
    guide_id: "guide",
    user_id: "backend-owner",
    context: "",
    history: [],
    created_at: "2026-10-12",
    generated_at: null,
    finished_at: null,
    status: "READY",
    settings: [],
    tags: [],
    guide: null,
    playback_generation_id: "gen-1",
    generating_percent: 100,
    generating_string: "",
    route: {
      id: "route",
      name: "Walk",
      context: "",
      points: [{ id: "museum", name: "Museum", lat: "46", lng: "18" }],
      geometry: [
        { lat: "46", lng: "18" },
        { lat: "46.01", lng: "18.01" },
      ],
      discovery,
      discovered_places: [place],
    },
  });
  const experience = ref<Experience>({
    schema_version: 1,
    revision: 0,
    generation_id: "gen-1",
    stop_id: "museum",
    stop_name: "Museum",
    stops: [{ id: "museum", name: "Museum" }],
    location_status: "USER_SELECTED",
    activity: null,
    cue_id: null,
    personal_context: emptyPersonalContext(),
    turns: [],
    available_actions: [],
    sources: [],
    cues: [],
    remaining_minutes: null,
    limitation: null,
  });
  const owner = ref<string | null>("owner");
  const lifecycle = effectScope();
  const controller = lifecycle.run(() =>
    useRoutePlaces({
      tour: computed(() => tour.value),
      ownerId: computed(() => owner.value),
      language: computed(() => "en"),
      experience: computed(() => experience.value),
    }),
  )!;
  expect(controller.places.value).toEqual([place]);
  expect(controller.discovery.value?.geometry).toEqual(discovery.geometry);
  expect(tour.value.route.geometry?.[0]?.lat).toBe("46");
  experience.value = {
    ...experience.value,
    revision: 1,
    stop_id: "square",
    location_status: "GPS_CONFIRMED",
  };
  await nextTick();
  expect(controller.places.value).toEqual([place]);
  expect(api).not.toHaveBeenCalled();
  experience.value = {
    ...experience.value,
    route_places: [{ ...place, name: "School updated" }],
    route_discovery: discovery,
  };
  expect(controller.places.value[0]?.name).toBe("School updated");
  owner.value = null;
  useUserStore().user = null;
  await nextTick();
  expect(controller.places.value).toEqual([]);
  expect(controller.discovery.value).toBeNull();
  lifecycle.stop();
});

it("starts the current language discovery only after the previous immutable operation settles", async () => {
  const first = Promise.withResolvers<typeof discovery>();
  const second = Promise.withResolvers<typeof discovery>();
  api
    .mockImplementationOnce(() => first.promise)
    .mockImplementationOnce(() => second.promise);
  const tour = ref({
    id: "tour",
    playback_generation_id: "gen-1",
    route: { geometry: [], points: [] },
  } as unknown as ICreatedTour);
  const language = ref("en");
  const lifecycle = effectScope();
  const controller = lifecycle.run(() =>
    useRoutePlaces({
      tour: computed(() => tour.value),
      ownerId: computed(() => "owner"),
      language: computed(() => language.value),
      experience: computed(() => null),
    }),
  )!;
  try {
    for (let i = 0; i < 24; i++) await Promise.resolve();
    language.value = "ru";
    await nextTick();
    expect(api).toHaveBeenCalledTimes(1);
    first.resolve(discovery);
    for (let i = 0; i < 24; i++) await Promise.resolve();
    expect(api).toHaveBeenCalledTimes(2);
    expect(api.mock.calls[1]![1].body.language).toBe("ru");
    expect(api.mock.calls[1]![1].headers["Idempotency-Key"]).not.toBe(
      api.mock.calls[0]![1].headers["Idempotency-Key"],
    );
    expect(controller.busy.value).toBe(true);
    expect(controller.discovery.value).toBeNull();
    second.resolve({ ...discovery, language: "ru" });
    for (let i = 0; i < 24; i++) await Promise.resolve();
    expect(controller.discovery.value?.language).toBe("ru");
    expect(controller.places.value[0]?.id).toBe("school");
    expect(controller.busy.value).toBe(false);
    expect(controller.failed.value).toBe(false);
  } finally {
    first.resolve(discovery);
    second.resolve({ ...discovery, language: "ru" });
    lifecycle.stop();
  }
});
