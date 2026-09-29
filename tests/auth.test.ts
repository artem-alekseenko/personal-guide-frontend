import { it, expect, vi } from "vitest";
import { useAuth } from "../app/composables/auth/useAuth";
import { useUserStore } from "../app/stores/userStore";
const api = vi.hoisted(() => ({
  update: vi.fn(),
  user: { value: { uid: "alice" } },
}));
vi.mock("vuefire", async () => {
  const { ref } = await import("vue");
  return { useCurrentUser: () => ref(api.user.value) };
});
vi.mock("../app/composables/api/useUserApi", () => ({
  useUserApi: () => ({ updateUserProfile: api.update }),
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
