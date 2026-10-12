import { beforeEach, expect, it, vi } from "vitest";
import type { User } from "firebase/auth";
import { useRoutePlacesStore } from "../app/stores/routePlacesStore";
import { useUserStore } from "../app/stores/userStore";
import { useTourRequestStore } from "../app/stores/tourRequestStore";

const api = vi.fn();
const scope = {
  tourId: "tour/a",
  ownerId: "owner",
  generationId: "gen-1",
  language: "en",
  geometry: "[]",
};
const discovery = {
  generation_id: "gen-1",
  geometry_hash: "provider-corridor",
  language: "en",
  checked_at: "2026-10-12T12:00:00Z",
  status: "partial" as const,
  warnings: ["Bounded provider results"],
  discovered_places: [],
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
it("scans once per identity, reuses accepted corridor cache, and never polls on repeated GPS-driven renders", async () => {
  const store = useRoutePlacesStore();
  api.mockResolvedValue(discovery);
  await store.ensure(scope);
  for (let i = 0; i < 5; i++) await store.ensure({ ...scope });
  expect(api).toHaveBeenCalledTimes(1);
  expect(api).toHaveBeenCalledWith(
    "/api/tour-route-places/tour%2Fa",
    expect.objectContaining({
      method: "POST",
      retry: 0,
      body: { generation_id: "gen-1", language: "en" },
    }),
  );
  await store.ensure(
    { ...scope, tourId: "cached", geometry: "unproven-different-geometry" },
    discovery,
  );
  expect(api).toHaveBeenCalledTimes(1);
  expect(store.result?.geometry).toEqual(discovery.geometry);
});
it("retains the original body and key after uncertainty and a preference or generation change", async () => {
  const store = useRoutePlacesStore();
  api.mockRejectedValueOnce(new Error("Lost response"));
  await expect(store.ensure(scope)).rejects.toThrow();
  const original = api.mock.calls[0]![1];
  await store.ensure({ ...scope, generationId: "gen-2", language: "ru" });
  expect(api).toHaveBeenCalledTimes(1);
  expect(store.hasPending).toBe(true);
  api.mockResolvedValueOnce(discovery);
  await store.retry();
  expect(api.mock.calls[1]![1]).toEqual(original);
  expect(store.hasPending).toBe(false);
});
it("failed reconciliation cannot discard the pending operation", async () => {
  const store = useRoutePlacesStore();
  api.mockRejectedValueOnce(new Error("Lost response"));
  await expect(store.ensure(scope)).rejects.toThrow();
  const original = api.mock.calls[0]![1];
  api.mockRejectedValueOnce(new Error("Offline read"));
  await expect(store.reconcile(scope)).rejects.toThrow();
  expect(store.hasPending).toBe(true);
  api.mockResolvedValueOnce(discovery);
  await store.retry();
  expect(api.mock.calls.at(-1)![1]).toEqual(original);
});
it("reconciles a committed result without issuing a second paid mutation", async () => {
  const store = useRoutePlacesStore();
  api.mockRejectedValueOnce(new Error("Lost response"));
  await expect(store.ensure(scope)).rejects.toThrow();
  const key = api.mock.calls[0]![1].headers["Idempotency-Key"];
  api.mockResolvedValueOnce({
    route: { discovery: { ...discovery, request_id: key } },
  });
  await store.reconcile(scope);
  expect(
    api.mock.calls.filter(([, options]) => options?.method === "POST"),
  ).toHaveLength(1);
  expect(store.result?.geometry_hash).toBe("provider-corridor");
  expect(store.hasPending).toBe(false);
});
it("does not reuse an unbound draft discovery for a pinned generation", async () => {
  const store = useRoutePlacesStore();
  api.mockResolvedValue(discovery);
  await store.ensure(scope, { ...discovery, generation_id: null });
  expect(api).toHaveBeenCalledTimes(1);
});
it("fences queued mutations after logout and late responses after tour switches", async () => {
  const store = useRoutePlacesStore();
  const gate = Promise.withResolvers<void>();
  const blocking = useTourRequestStore().run(scope.tourId, () => gate.promise);
  await Promise.resolve();
  const pending = store.ensure(scope);
  const cancelled = expect(pending).rejects.toThrow();
  useUserStore().user = null;
  store.reset();
  gate.resolve();
  await blocking;
  await cancelled;
  expect(api).not.toHaveBeenCalled();

  useUserStore().user = { uid: "owner" } as User;
  const response = Promise.withResolvers<typeof discovery>();
  api.mockImplementationOnce(() => response.promise);
  const late = store.ensure(scope);
  await Promise.resolve();
  api.mockResolvedValueOnce({ ...discovery, geometry_hash: "other" });
  await store.ensure({ ...scope, tourId: "other" });
  response.resolve(discovery);
  await late;
  expect(store.result?.geometry_hash).toBe("other");
});

it("a successful read without our receipt retains the original uncertain paid request", async () => {
  const store = useRoutePlacesStore();
  api.mockRejectedValueOnce(new Error("Lost response"));
  await expect(store.ensure(scope)).rejects.toThrow();
  const original = api.mock.calls[0]![1];
  api.mockResolvedValueOnce({ route: { discovery: null } });
  api.mockRejectedValueOnce(new Error("Outcome remains unknown"));
  await expect(store.reconcile(scope)).rejects.toThrow();
  expect(
    api.mock.calls
      .filter(([, options]) => options?.method === "POST")
      .map(([, options]) => options),
  ).toEqual([original, original]);
  expect(store.hasPending).toBe(true);
  api.mockResolvedValueOnce(discovery);
  await store.retry();
  expect(api.mock.calls.at(-1)![1]).toEqual(original);
  expect(store.hasPending).toBe(false);
});

it("retains a lost discovery operation across tour navigation and temporary empty selection", async () => {
  const store = useRoutePlacesStore();
  api.mockRejectedValueOnce(new Error("Lost discovery response"));
  await expect(store.ensure(scope)).rejects.toThrow();
  const original = api.mock.calls[0]![1];
  store.clearSelection();
  expect(store.hasPending).toBe(false);
  api.mockResolvedValueOnce({ ...discovery, geometry_hash: "other-corridor" });
  await store.ensure({ ...scope, tourId: "other" });
  await store.ensure(scope);
  expect(store.hasPending).toBe(true);
  expect(store.failed).toBe(true);
  expect(store.result).toBeNull();
  api.mockResolvedValueOnce(discovery);
  await store.retry();
  const originalTourCalls = api.mock.calls.filter(
    ([path]) => path === "/api/tour-route-places/tour%2Fa",
  );
  expect(
    originalTourCalls.map(([, options]) => options.headers["Idempotency-Key"]),
  ).toEqual([
    original.headers["Idempotency-Key"],
    original.headers["Idempotency-Key"],
  ]);
  expect(originalTourCalls[1]![1].body).toEqual(original.body);
  expect(store.hasPending).toBe(false);
  expect(store.result?.geometry_hash).toBe("provider-corridor");
});
