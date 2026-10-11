import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAuthActions } from "../app/composables/auth/useAuthActions";
import { useGetTour } from "../app/composables/api/tours/useGetTour";
import { resolveAuthRedirect } from "../app/utils/navigation";

const firebase = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
  google: vi.fn(),
}));
vi.mock("firebase/auth", () => ({
  getAuth: () => ({}),
  GoogleAuthProvider: class {},
  signInWithEmailAndPassword: firebase.login,
  createUserWithEmailAndPassword: firebase.register,
  signInWithPopup: firebase.google,
}));

beforeEach(() => {
  for (const operation of Object.values(firebase))
    operation.mockResolvedValue(undefined);
});
afterEach(() => vi.unstubAllGlobals());

it.each(["loginWithEmail", "registerWithEmail", "loginWithGoogle"] as const)(
  "%s succeeds after authentication even when next is protocol-relative",
  async (action) => {
    vi.stubGlobal("useRoute", () => ({ query: { next: "//example.invalid" } }));
    const navigate = vi.fn((path: string) => {
      if (path.startsWith("//"))
        throw new Error("External navigation rejected");
    });
    vi.stubGlobal("navigateTo", navigate);
    const actions = useAuthActions();
    const result =
      action === "loginWithGoogle"
        ? await actions.loginWithGoogle()
        : await actions[action]("fixture@example.invalid", "fixture-password");
    expect(result).toEqual({ success: true });
    expect(navigate).toHaveBeenCalledWith("/tours", { replace: true });
  },
);

it("does not let a decoded tour ID dispatch a profile read", async () => {
  let profileReads = 0;
  vi.stubGlobal("useNuxtApp", () => ({
    $apiFetch: async (request: string) => {
      const target = new URL(request, "https://frontend.test");
      if (target.pathname === "/api/user-profile") {
        profileReads++;
        return { name: "Private profile" };
      }
      if (target.pathname === "/api/get-tour/..%2Fuser-profile")
        return { id: "requested-tour" };
      throw new Error(`Unexpected API target: ${target.pathname}`);
    },
  }));
  const tour = await useGetTour("../user-profile");
  expect(tour.id).toBe("requested-tour");
  expect(profileReads).toBe(0);
});

it.each([
  { next: "//example.invalid" },
  { next: "/\\example.invalid" },
  { next: "/tours\\other" },
  { next: "/tours\r\nLocation: https://example.invalid" },
  { next: ["//example.invalid", "/tours"] },
  { next: "https://example.invalid" },
])("rejects an unsafe authentication return target: $next", ({ next }) => {
  expect(resolveAuthRedirect(next)).toBe("/tours");
});

it("preserves a valid internal authentication target including its query and fragment", () => {
  expect(resolveAuthRedirect("/guides?tag=art#catalog")).toBe(
    "/guides?tag=art#catalog",
  );
});
