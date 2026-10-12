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
async function render(overrides = {}, props = {}) {
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
      current_maneuver: "Follow the provider path",
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
  const app = createSSRApp(CurrentStopExperience, { tourId: "tour", ...props });
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
it("shows stop evidence readiness independently of tour preparation and suppresses intentional silence", async () => {
  const html = await render({
    language: "en",
    story_readiness: {
      status: "EXHAUSTED", eligible_fact_count: 4, unspoken_fact_count: 0,
      unchecked_account_count: 2, prepared_story_available: false,
    },
    turns: [{ id: "silent", role: "guide", stop_id: "museum", text: "  ", source_ids: [], created_at: "2026-10-12" }],
  });
  expect(html).toContain(en.experience.readiness.EXHAUSTED);
  expect(html).toContain("Eligible facts: 4; not yet told: 0; unchecked accounts: 2.");
  expect(html).toContain(en.experience.preparedStoryMissing);
  expect(html).toContain("Experience language: en");
  expect(html).not.toContain("<strong>AI guide</strong>");
});
it("never substitutes the first overview instruction for an authoritative current maneuver", async () => {
  const html = await render({
    navigation: { status: "available", current_maneuver: "Cross at the lights", instructions: ["Later turn", "Future crossing"] },
  });
  expect(html).toContain("<p>Cross at the lights</p>");
  expect(html).toContain(en.experience.allInstructions);
  const noCurrent = await render({
    navigation: { status: "available", current_maneuver: null, instructions: ["Later turn"] },
  });
  expect(noCurrent).not.toContain(en.experience.nextInstruction);
});
it("keeps remote travel distinct from local walking and exposes route-wide places without a selected-stop change", async () => {
  const html = await render({
    navigation: { status: "remote_travel", route_context: "remote_travel", instructions: ["Do not walk across the country"] },
  }, {
    routePlaces: [{ id: "school", name: "Public school", source: "google", source_id: "g1", lat: "47", lng: "19", types: ["school"], address: null, distance_to_route_meters: 10, along_route_meters: 500 }],
  });
  expect(html).toContain(en.experience.navigationStatus.remote_travel);
  expect(html).not.toContain("Do not walk across the country");
  expect(html).toContain("Public school");
  expect(html).toContain(en.routePlaces.caveat);
  expect(html).toContain("Museum");
});
