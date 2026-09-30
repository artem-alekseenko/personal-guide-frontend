import { expect, it, vi } from "vitest";
import { emptyPersonalContext } from "../app/types/personalContext";
import { useGuidesStore } from "../app/stores/guidesStore";
import { useUserStore } from "../app/stores/userStore";
import {
  normalizeGuideInteractionMode,
  normalizeInteractionPreference,
} from "#shared/types/guideInteraction";
import { normalizePersonalContext } from "#shared/types/personalContext";

const api = vi.hoisted(() => ({ profile: vi.fn(), update: vi.fn() }));
vi.mock("../app/composables/api/useUserApi", () => ({
  useUserApi: () => ({
    fetchUserProfile: api.profile,
    updateUserProfile: api.update,
  }),
}));

it("starts each new context with the guide's style and independent interests", () => {
  const first = emptyPersonalContext();
  const second = emptyPersonalContext();
  expect(first).toHaveProperty("interaction_mode", "guide");
  first.interests.push("art");
  expect(second.interests).toEqual([]);
});

it.each([
  [undefined, "interactive", "guide"],
  ["leading", "leading", "leading"],
  ["interactive", "interactive", "interactive"],
  ["guide", "interactive", "guide"],
  ["unknown", "interactive", "guide"],
])(
  "normalizes wire mode %s at the guide and preference boundaries",
  (value, guide, preference) => {
    expect(normalizeGuideInteractionMode(value)).toBe(guide);
    expect(normalizeInteractionPreference(value)).toBe(preference);
  },
);

it("keeps explicit interaction and operational choices while copying context topics", () => {
  const source = {
    ...emptyPersonalContext(),
    interaction_mode: "leading" as const,
    enabled: false,
    interests: ["engineering"],
    excluded_topics: ["politics"],
    purpose: "See the bridges",
    known_topics: "Local history",
    note: "Keep this note",
    knowledge_level: "SPECIALIST" as const,
    detail_level: "DEEP" as const,
    step_free: true,
    pace: "relaxed" as const,
  };
  const result = normalizePersonalContext(source);
  expect(result).toEqual(source);
  result.interests.push("art");
  result.excluded_topics.push("nature");
  expect(source.interests).toEqual(["engineering"]);
  expect(source.excluded_topics).toEqual(["politics"]);
});

it("defaults legacy guide cards while preserving an explicit leading card", () => {
  const store = useGuidesStore();
  const legacy = { id: "legacy", name: "Old guide" } as any;
  store.setGuidesList([
    legacy,
    { id: "quiet", interaction_mode: "leading" } as any,
  ]);
  expect(store.guidesList.map((guide) => guide.interaction_mode)).toEqual([
    "interactive",
    "leading",
  ]);
  store.setSelectedGuide(legacy);
  expect(store.selectedGuide?.interaction_mode).toBe("interactive");
  expect(legacy).not.toHaveProperty("interaction_mode");
});

it("normalizes a saved legacy preference without dropping its other fields", () => {
  const user = useUserStore();
  const legacy = {
    ...emptyPersonalContext(),
    note: "Keep this",
    interests: ["science"],
    step_free: true,
  } as any;
  delete legacy.interaction_mode;
  user.setSavedPersonalContext(legacy);
  expect(user.savedPersonalContext).toMatchObject({
    interaction_mode: "guide",
    note: "Keep this",
    interests: ["science"],
    step_free: true,
  });
  legacy.interests.push("art");
  expect(user.savedPersonalContext?.interests).toEqual(["science"]);
});

it("saves a normalized full context only through the explicit profile action", async () => {
  const user = useUserStore();
  user.setUser({ uid: "owner" } as any);
  const legacy = {
    ...emptyPersonalContext(),
    enabled: false,
    pace: "relaxed",
    note: "Retain me",
  } as any;
  delete legacy.interaction_mode;
  user.setSavedPersonalContext(legacy);
  expect(api.update).not.toHaveBeenCalled();
  api.profile.mockResolvedValue({ name: "Owner", language: "en" });
  api.update.mockResolvedValue({});
  await user.savePersonalContext(legacy);
  expect(api.update).toHaveBeenCalledWith("Owner", "en", {
    ...legacy,
    interaction_mode: "guide",
  });
});
