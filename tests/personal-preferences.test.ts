import { beforeEach, expect, it, vi } from "vitest";
import { useUserStore } from "../app/stores/userStore";
import { useRouteStore } from "../app/stores/routeStore";
import { emptyPersonalContext } from "../app/types/personalContext";
const api = vi.hoisted(() => ({ profile: vi.fn(), update: vi.fn() }));
vi.mock("../app/composables/api/useUserApi", () => ({
  useUserApi: () => ({
    fetchUserProfile: api.profile,
    updateUserProfile: api.update,
  }),
}));
vi.mock("../app/composables/api/tours/useCreateTour", () => ({
  useCreateTour: async () => ({ id: "created" }),
}));
vi.mock("../app/composables/api/tours/useListTours", () => ({
  useListTours: async () => [{ id: "existing" }],
}));
beforeEach(() => {
  api.profile.mockReset();
  api.update.mockReset();
});
it("uses saved context for a new route without sharing mutable profile data", async () => {
  const user = useUserStore();
  user.setUser({ uid: "alice" } as any);
  api.profile.mockResolvedValue({
    language: "en",
    personal_context: {
      ...emptyPersonalContext(),
      interests: ["art"],
      pace: "relaxed",
    },
  });
  await user.loadServerPreferences();
  const route = useRouteStore();
  await route.initializePersonalContext();
  expect(route.personalContext.interests).toEqual(["art"]);
  expect(route.personalContext.pace).toBe("relaxed");
  route.personalContext.interests.push("science");
  expect(user.savedPersonalContext?.interests).toEqual(["art"]);
});
it("does not overwrite form edits with a delayed profile response", async () => {
  const user = useUserStore();
  user.setUser({ uid: "alice" } as any);
  let resolve!: (value: unknown) => void;
  api.profile.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const route = useRouteStore();
  const loading = route.initializePersonalContext();
  route.personalContext.note = "My edit";
  resolve({
    language: "en",
    personal_context: { ...emptyPersonalContext(), note: "Saved" },
  });
  await loading;
  expect(route.personalContext.note).toBe("My edit");
});
it("clears saved context on an account change and ignores the old response", async () => {
  const user = useUserStore();
  user.setUser({ uid: "alice" } as any);
  let resolve!: (value: unknown) => void;
  api.profile.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const loading = user.loadServerPreferences();
  user.setUser({ uid: "bob" } as any);
  resolve({
    language: "ru",
    personal_context: { ...emptyPersonalContext(), note: "Alice" },
  });
  await loading;
  expect(user.savedPersonalContext).toBeNull();
});
it("uses the latest saved preferences on the next walk but preserves an unfinished draft", async () => {
  const user = useUserStore();
  user.setUser({ uid: "alice" } as any);
  api.profile.mockResolvedValue({
    language: "en",
    personal_context: { ...emptyPersonalContext(), note: "First" },
  });
  const route = useRouteStore();
  await route.initializePersonalContext();
  route.personalContext.note = "Draft edit";
  user.setSavedPersonalContext({
    ...emptyPersonalContext(),
    note: "New saved preference",
  });
  await route.initializePersonalContext();
  expect(route.personalContext.note).toBe("Draft edit");
  Object.assign(globalThis, {
    useGuidesStore: () => ({ selectedGuide: { id: "guide" } }),
  });
  route.setRouteSuggestion({
    description: "",
    high_places: [],
    coordinates: [],
    routes: [
      {
        name: "walk",
        points: [
          { lat: "1", lng: "2" },
          { lat: "1.001", lng: "2.001" },
        ],
        stops: [
          { name: "First", point: { lat: "1", lng: "2" } },
          { name: "Second", point: { lat: "1.001", lng: "2.001" } },
        ],
      },
    ],
  });
  await route.fetchCreateRoute();
  await route.initializePersonalContext();
  expect(route.personalContext.note).toBe("New saved preference");
  expect(route.canCreate).toBe(false);
});
it("does not restore old saved context after a newer explicit save or clear", async () => {
  const user = useUserStore();
  user.setUser({ uid: "alice" } as any);
  let resolve!: (value: unknown) => void;
  api.profile.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r;
      }),
  );
  const loading = user.loadServerPreferences();
  user.setSavedPersonalContext(null);
  resolve({
    language: "en",
    personal_context: { ...emptyPersonalContext(), note: "Old preference" },
  });
  await loading;
  expect(user.savedPersonalContext).toBeNull();
});
it("retries a failed profile read without overwriting draft edits", async () => {
  const user = useUserStore();
  user.setUser({ uid: "alice" } as any);
  api.profile.mockRejectedValueOnce(new Error("Offline"));
  const route = useRouteStore();
  await route.initializePersonalContext();
  route.personalContext.note = "My unsaved edit";
  api.profile.mockResolvedValueOnce({
    language: "en",
    personal_context: { ...emptyPersonalContext(), note: "Saved" },
  });
  await route.initializePersonalContext();
  expect(user.serverPreferencesLoaded).toBe(true);
  expect(route.personalContext.note).toBe("My unsaved edit");
});
it("preserves an unfinished draft when the visitor returns from a refreshed tour list", async () => {
  const user = useUserStore();
  user.setUser({ uid: "alice" } as any);
  api.profile.mockResolvedValue({
    language: "en",
    personal_context: emptyPersonalContext(),
  });
  const route = useRouteStore();
  await route.initializePersonalContext();
  route.personalContext.note = "Draft";
  route.setStartPoint({ lat: "47", lng: "19" });
  await route.fetchListTours();
  route.stopPolling();
  await route.initializePersonalContext();
  expect(route.personalContext.note).toBe("Draft");
  expect(route.startPoint).toEqual({ lat: "47", lng: "19" });
});
it("snapshots a preference save and updates the account cache when its view is gone", async () => {
  const user = useUserStore();
  user.setUser({ uid: "alice" } as any);
  const context = { ...emptyPersonalContext(), note: "Save this" };
  let resolveProfile!: (value: unknown) => void;
  let resolveSave!: () => void;
  api.profile.mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolveProfile = r;
      }),
  );
  api.update.mockImplementationOnce(
    () =>
      new Promise<void>((r) => {
        resolveSave = r;
      }),
  );
  let active = true;
  const saving = user.savePersonalContext(context, () => active);
  context.note = "Later form edit";
  resolveProfile({ name: "Alice", language: "en" });
  await vi.waitFor(() => expect(api.update).toHaveBeenCalled());
  active = false;
  resolveSave();
  expect(await saving).toBe(true);
  expect(user.savedPersonalContext?.note).toBe("Save this");
  expect(user.isSavingPreferences).toBe(false);
});
it("does not apply a late preference save to a different account", async () => {
  const user = useUserStore();
  user.setUser({ uid: "alice" } as any);
  api.profile.mockResolvedValueOnce({ name: "Alice", language: "en" });
  let resolveSave!: () => void;
  api.update.mockImplementationOnce(
    () =>
      new Promise<void>((r) => {
        resolveSave = r;
      }),
  );
  const saving = user.savePersonalContext(emptyPersonalContext());
  await vi.waitFor(() => expect(api.update).toHaveBeenCalled());
  user.setUser({ uid: "bob" } as any);
  resolveSave();
  await saving;
  expect(user.savedPersonalContext).toBeNull();
});

it("ignores a save from an earlier session of the same account", async () => {
  const user = useUserStore();
  user.setUser({ uid: "alice" } as any);
  api.profile.mockResolvedValue({ name: "Alice", language: "en" });
  let resolveOldSave!: () => void;
  let resolveNewSave!: () => void;
  api.update.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        resolveOldSave = resolve;
      }),
  );
  const oldSave = user.savePersonalContext({
    ...emptyPersonalContext(),
    note: "Old session",
  });
  await vi.waitFor(() => expect(api.update).toHaveBeenCalledTimes(1));
  user.setUser(null);
  user.setUser({ uid: "alice" } as any);
  api.update.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        resolveNewSave = resolve;
      }),
  );
  const newSave = user.savePersonalContext({
    ...emptyPersonalContext(),
    note: "New session",
  });
  await vi.waitFor(() => expect(api.update).toHaveBeenCalledTimes(2));
  resolveOldSave();
  await oldSave;
  expect(user.savedPersonalContext).toBeNull();
  expect(user.isSavingPreferences).toBe(true);
  resolveNewSave();
  await newSave;
  expect(user.savedPersonalContext?.note).toBe("New session");
  expect(user.isSavingPreferences).toBe(false);
});
