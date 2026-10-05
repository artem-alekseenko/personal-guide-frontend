import { it, expect, vi } from "vitest";
import { useAuth } from "../app/composables/auth/useAuth";
import { useUserStore } from "../app/stores/userStore";
const api = vi.hoisted(() => ({
  update: vi.fn(),
  profile: vi.fn(),
  user: { value: { uid: "alice" } },
}));
vi.mock("vuefire", async () => {
  const { ref } = await import("vue");
  return { useCurrentUser: () => ref(api.user.value) };
});
vi.mock("../app/composables/api/useUserApi", () => ({
  useUserApi: () => ({
    updateUserProfile: api.update,
    fetchUserProfile: api.profile,
  }),
}));
it("reports a failed settings save and restores the prior preferences", async () => {
  const store = useUserStore();
  store.setUser({ uid: "alice" } as any);
  api.update.mockRejectedValue(new Error("Offline"));
  const auth = useAuth();
  await expect(auth.updateUserPreferences({ language: "ru" })).rejects.toThrow(
    "Offline",
  );
  expect(store.userPreferences.language).toBe("en");
});

it("keeps a saved language when the initial profile read finishes later", async () => {
  const store = useUserStore();
  store.setUser({ uid: "alice" } as any);
  let resolveProfile!: (value: unknown) => void;
  api.profile.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveProfile = resolve;
      }),
  );
  const loading = store.loadServerPreferences();
  api.update.mockResolvedValueOnce({ language: "ru" });
  await useAuth().updateUserPreferences({ language: "ru" });
  resolveProfile({ language: "en", personal_context: null });
  await loading;
  expect(store.userPreferences.language).toBe("ru");
  expect(store.guestLanguage).toBe("ru");
  expect(store.serverPreferencesLoaded).toBe(true);
});

it("rolls back a failed language change without losing later voice and model edits", async () => {
  const store = useUserStore();
  store.setUser({ uid: "alice" } as any);
  let rejectSave!: (error: Error) => void;
  api.update.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectSave = reject;
      }),
  );
  const auth = useAuth();
  const saving = auth.updateUserPreferences({ language: "ru" });
  const rejected = expect(saving).rejects.toThrow("Offline");
  await auth.updateUserPreferences({ voiceType: "MOCK", llmType: "GEMINI" });
  rejectSave(new Error("Offline"));
  await rejected;
  expect(store.userPreferences).toMatchObject({
    language: "en",
    voiceType: "MOCK",
    llmType: "GEMINI",
  });
});

it("does not roll back a newer local language selection after an earlier save fails", async () => {
  const store = useUserStore();
  store.setUser({ uid: "alice" } as any);
  let rejectSave!: (error: Error) => void;
  api.update.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectSave = reject;
      }),
  );
  const auth = useAuth();
  const saving = auth.updateUserPreferences({ language: "ru" });
  const rejected = expect(saving).rejects.toThrow("Offline");
  await auth.updateUserPreferences({ language: "en" }, false);
  await auth.updateUserPreferences({ language: "ru" }, false);
  rejectSave(new Error("Offline"));
  await rejected;
  expect(store.userPreferences.language).toBe("ru");
});

it("does not clear a newer account session's save when the old save finishes", async () => {
  const store = useUserStore();
  store.setUser({ uid: "alice" } as any);
  let rejectOld!: (error: Error) => void;
  let resolveNew!: () => void;
  api.update.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectOld = reject;
      }),
  );
  const auth = useAuth();
  const oldSave = auth.updateUserPreferences({ language: "ru" });
  const rejected = expect(oldSave).rejects.toThrow("Offline");
  store.setUser(null);
  store.setUser({ uid: "alice" } as any);
  api.update.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        resolveNew = resolve;
      }),
  );
  const newSave = auth.updateUserPreferences({ language: "ru" });
  rejectOld(new Error("Offline"));
  await rejected;
  expect(store.userPreferences.language).toBe("ru");
  expect(store.isSavingPreferences).toBe(true);
  resolveNew();
  await newSave;
  expect(store.isSavingPreferences).toBe(false);
});
