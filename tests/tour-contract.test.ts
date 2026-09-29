import { describe, expect, it, vi } from "vitest";
import { useRouteStore } from "../app/stores/routeStore";
const create = vi.fn().mockResolvedValue({ id: "tour-1" });
vi.mock("../app/composables/api/tours/useCreateTour", () => ({
  useCreateTour: (p: unknown) => create(p),
}));
Object.assign(globalThis, {
  useGuidesStore: () => ({ selectedGuide: { id: "guide-1" } }),
});
const variant = (name: string) => ({
  name,
  provider: "google",
  points: [
    { lat: "1", lng: "2" },
    { lat: "1.001", lng: "2.001" },
    { lat: "1.002", lng: "2.002" },
  ],
  stops: [
    {
      name: "Museum",
      point: { lat: "1", lng: "2" },
      source: "google",
      source_id: "a",
    },
    {
      name: "Square",
      point: { lat: "1.002", lng: "2.002" },
      source: "google",
      source_id: "b",
    },
  ],
});
describe("tour creation contract", () => {
  it("keeps stops separate from geometry and preserves intent", async () => {
    const store = useRouteStore();
    store.setDuration("20");
    store.setTags([{ name: "Art", is_selected: true }]);
    store.setRouteSuggestion({
      routes: [variant("easy")],
      coordinates: [],
      description: "",
      high_places: [],
    });
    await store.fetchCreateRoute();
    const p = create.mock.calls[0]![0];
    expect(p.contract_version).toBe(2);
    expect(p.route.map((x: any) => x.name)).toEqual(["Museum", "Square"]);
    expect(p.route_geometry).toHaveLength(3);
    expect(p.duration_minutes).toBe(20);
    expect(p.personal_context.interests).toEqual(["art"]);
  });
  it("rejects a placeholder route before posting", async () => {
    const store = useRouteStore();
    store.setRouteSuggestion({
      routes: [
        {
          name: "No validated walking route",
          points: [{ lat: "1", lng: "2" }],
        },
      ],
      coordinates: [],
      description: "",
      high_places: [],
    });
    await expect(store.fetchCreateRoute()).rejects.toThrow();
    expect(create).not.toHaveBeenCalled();
  });
  it("creates the selected second variant", async () => {
    const store = useRouteStore();
    store.setRouteSuggestion({
      routes: [variant("highlights"), variant("easy")],
      coordinates: [],
      description: "",
      high_places: [],
    });
    expect(typeof (store as any).selectRoute).toBe("function");
    (store as any).selectRoute(1);
    await store.fetchCreateRoute();
    expect(create.mock.calls[0]![0].route_variant).toBe("easy");
  });
});
it("invalidates a route after the start or duration changes", () => {
  const store = useRouteStore();
  store.setRouteSuggestion({
    routes: [variant("easy")],
    coordinates: [],
    description: "",
    high_places: [],
  });
  store.setDuration("30");
  expect(store.canCreate).toBe(false);
  store.setRouteSuggestion({
    routes: [variant("easy")],
    coordinates: [],
    description: "",
    high_places: [],
  });
  store.setStartPoint({ lat: "1", lng: "2" });
  expect(store.canCreate).toBe(false);
});
it("preserves full provider geometry while accepting legacy sampled points", async () => {
  const store = useRouteStore();
  const full = Array.from({ length: 47 }, (_, i) => ({
    lat: String(1 + i / 1000),
    lng: "2",
  }));
  store.setRouteSuggestion({
    routes: [{ ...variant("easy"), geometry: full }],
    coordinates: [],
    description: "",
    high_places: [],
  });
  expect(store.routeSuggestion!.coordinates).toHaveLength(47);
  await store.fetchCreateRoute();
  expect(create.mock.calls[0]![0].route_geometry).toEqual(full);
});
