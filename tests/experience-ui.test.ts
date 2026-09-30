import { expect, it, vi } from "vitest";
import { createSSRApp, ref } from "vue";
import { renderToString } from "@vue/server-renderer";
import CurrentStopExperience from "../app/components/tour/CurrentStopExperience.vue";
import { useExperienceStore } from "../app/stores/experienceStore";
import { emptyPersonalContext } from "../app/types/personalContext";
import en from "../i18n/locales/en.json";
const auth = vi.hoisted(() => ({ uid: "owner" }));
vi.mock("../app/composables/auth/useAuth", () => ({
  useAuth: () => ({
    user: ref({ uid: auth.uid }),
    userPreferences: ref({ llmType: "DEFAULT" }),
  }),
}));
vi.mock("../app/stores/geolocationStore", () => ({
  useGeolocationStore: () => ({
    coordinates: null,
    error: null,
    accuracy: null,
    recordedAt: null,
  }),
}));
const t = (key: string, params: Record<string, unknown> = {}) => {
  const value = key.split(".").reduce((v: any, part) => v?.[part], en) ?? key;
  return String(value).replace(/\{(\w+)\}/g, (_, p) => String(params[p] ?? ""));
};
async function render(overrides = {}) {
  const view = {
    schema_version: 1,
    revision: 0,
    generation_id: null,
    stop_id: "museum",
    stop_name: "Museum",
    stops: [
      { id: "museum", name: "Museum" },
      { id: "square", name: "Square" },
    ],
    location_status: "USER_SELECTED",
    activity: null,
    cue_id: null,
    personal_context: emptyPersonalContext(),
    available_actions: ["ASK", "MORE"],
    cues: [],
    remaining_minutes: 12,
    limitation: null,
    turns: [
      {
        id: "earlier",
        stop_id: "square",
        role: "guide",
        text: "A previous answer.",
        source_ids: ["old-source"],
        created_at: "2026-09-30",
      },
    ],
    sources: [
      {
        id: "old-source",
        title: "Square archive",
        url: "https://example.org/square",
        checked_at: "2026-09-30",
      },
    ],
    navigation: {
      status: "available",
      target_name: "Square",
      instructions: ["Follow the provider path", "Second instruction"],
      walking_minutes: 4,
      warnings: [],
    },
    ...overrides,
  };
  Object.assign(globalThis, {
    useNuxtApp: () => ({ $apiFetch: async () => view }),
    useI18n: () => ({ t, locale: ref("en") }),
  });
  await useExperienceStore().load("tour", "owner");
  const app = createSSRApp(CurrentStopExperience, { tourId: "tour" });
  app.config.globalProperties.$t = t;
  return renderToString(app);
}
it("offers discoverable navigation and associates earlier answers with their stop and source", async () => {
  const html = await render();
  expect(html).toContain("Directions to the next stop");
  expect(html).toContain("About 4 minutes walking");
  expect(html).toContain("Next instruction");
  expect(html).toContain('href="https://example.org/square"');
  expect(html).toContain("At Square");
});
it("does not imply current-stop sources support an unresolved earlier answer", async () => {
  const html = await render({
    sources: [
      {
        id: "current",
        title: "Museum source",
        url: "javascript:alert(1)",
        checked_at: "2026-09-30",
      },
    ],
  });
  expect(html).toContain(
    "Supporting links for this earlier reply are unavailable",
  );
  expect(html).not.toContain('href="javascript:');
});
