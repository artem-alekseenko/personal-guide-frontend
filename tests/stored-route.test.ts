import { it, expect, vi } from "vitest";
it("renders every stored geometry point without asking a routing provider", async () => {
  const path = "../app/utils/storedRoute";
  const { renderStoredRoute } = await import(path);
  const map = {
    getSource: vi.fn(),
    addSource: vi.fn(),
    getLayer: vi.fn(),
    addLayer: vi.fn(),
    fitBounds: vi.fn(),
  };
  const points = Array.from({ length: 47 }, (_, i) => [
    2 + i / 1000,
    1 + i / 1000,
  ]);
  expect(renderStoredRoute(map, points)).toBe(true);
  expect(map.addSource.mock.calls[0][1].data.geometry.coordinates).toEqual(
    points,
  );
  expect(map.addLayer.mock.calls.map(([layer]) => layer.id)).toEqual([
    "pg-stored-route-outline",
    "pg-stored-route",
  ]);
});
it("clears stored geometry when directions are invalidated", async () => {
  Object.assign(globalThis, {
    useRuntimeConfig: () => ({ public: { mapboxGlAccessToken: "" } }),
  });
  const { shallowRef } = await import("vue");
  const { useMapboxDirections } =
    await import("../app/composables/map/useMapboxDirections");
  const map = {
    getLayer: vi.fn().mockReturnValue({}),
    getSource: vi.fn().mockReturnValue({}),
    removeLayer: vi.fn(),
    removeSource: vi.fn(),
  };
  useMapboxDirections(shallowRef(map as any)).clearDirections();
  expect(map.removeLayer).toHaveBeenCalledWith("pg-stored-route");
  expect(map.removeSource).toHaveBeenCalledWith("pg-stored-route");
});
