import { expect, it, vi } from "vitest";
import { createSSRApp, ref } from "vue";
import { renderToString } from "@vue/server-renderer";
import CurrentStopExperience from "../app/components/tour/CurrentStopExperience.vue";
import PGButton from "../app/components/ui/PGButton.vue";
import { useExperienceStore } from "../app/stores/experienceStore";
import { emptyPersonalContext } from "../app/types/personalContext";
import type { Experience, ExperienceSource } from "../app/types/tourExperience";
import en from "../i18n/locales/en.json";

vi.mock("../app/composables/auth/useAuth", () => ({
  useAuth: () => ({
    user: ref({ uid: "owner" }),
    userPreferences: ref({ llmType: "DEFAULT" }),
  }),
}));
const t = (key: string, params: Record<string, unknown> = {}) => {
  const value =
    key
      .split(".")
      .reduce<unknown>(
        (current, part) =>
          current && typeof current === "object"
            ? Reflect.get(current, part)
            : undefined,
        en,
      ) ?? key;
  return String(value).replace(/\{(\w+)\}/g, (_, p) => String(params[p] ?? ""));
};
async function render(
  overrides: Partial<Experience> = {},
  previousSources?: ExperienceSource[],
) {
  let view: Experience = {
    schema_version: 1,
    revision: 1,
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
    available_actions: ["ASK_GENERAL"],
    cues: [],
    remaining_minutes: null,
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
    ...overrides,
  };
  Object.assign(globalThis, {
    useNuxtApp: () => ({ $apiFetch: async () => structuredClone(view) }),
    useI18n: () => ({ t, locale: ref("en") }),
  });
  const store = useExperienceStore();
  if (previousSources) {
    const current = view;
    view = { ...view, revision: 0, sources: previousSources };
    await store.load("tour", "owner");
    view = current;
  }
  await store.load("tour", "owner");
  const app = createSSRApp(CurrentStopExperience, { tourId: "tour" });
  app.config.globalProperties.$t = t;
  app.component("PGButton", PGButton);
  return renderToString(app);
}

it("keeps earlier answers and their own supporting sources without place labels", async () => {
  const html = await render();
  expect(html).toContain("A previous answer.");
  expect(html).not.toContain(t("experience.turnStop", { stop: "Square" }));
  expect(html).not.toContain(t("experience.turnStop", { stop: "Museum" }));
  expect(html).not.toContain("<select");
  expect(html).toContain('href="https://example.org/square"');
  expect(html).toContain('rel="noopener noreferrer"');
});

it("keeps supporting links for history after the current source list changes", async () => {
  const html = await render({ sources: [] }, [
    {
      id: "old-source",
      title: "Earlier archive",
      url: "https://example.org/earlier",
      checked_at: "2026-09-30",
    },
  ]);
  expect(html).toContain("A previous answer.");
  expect(html).toContain('href="https://example.org/earlier"');
  expect(html).not.toContain(t("experience.earlierSourcesUnavailable"));
});

it("does not imply unrelated current sources support an unresolved earlier answer", async () => {
  const html = await render({
    sources: [
      {
        id: "current",
        title: "Museum source",
        url: "https://example.org/museum",
        checked_at: "2026-09-30",
      },
    ],
  });
  expect(html).toContain(t("experience.earlierSourcesUnavailable"));
  expect(html).not.toContain('href="https://example.org/museum"');
});

it.each(["javascript:alert(1)", "data:text/html,<script>alert(1)</script>"])(
  "renders unsafe cited source URLs as text, not links: %s",
  async (url) => {
    const html = await render({
      sources: [
        {
          id: "old-source",
          title: "Untrusted <img src=x onerror=untrusted()>",
          url,
          checked_at: "2026-09-30",
        },
      ],
    });
    expect(html).toContain("Untrusted &lt;img src=x onerror=untrusted()&gt;");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("href=");
  },
);

it("escapes conversation content and suppresses intentional silence", async () => {
  const html = await render({
    turns: [
      {
        id: "silent",
        role: "guide",
        stop_id: "",
        kind: "conversation",
        text: " \n ",
        source_ids: [],
        created_at: "2026-10-12",
      },
      {
        id: "visitor",
        role: "visitor",
        stop_id: "",
        kind: "conversation",
        text: "<script>untrusted()</script>",
        source_ids: [],
        created_at: "2026-10-12",
      },
    ],
  });
  expect(html).toContain("&lt;script&gt;untrusted()&lt;/script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).not.toContain(t("experience.guide"));
  expect(html).toContain(t("experience.you"));
});

it("does not add a place label to history after that stop disappears", async () => {
  const html = await render({ stops: [{ id: "museum", name: "Museum" }] });
  const conversation = html.match(/<ol\b[\s\S]*?<\/ol>/)?.[0];
  expect(conversation).toContain("A previous answer.");
  expect(conversation).not.toContain(t("experience.earlierStop"));
  expect(conversation).not.toContain(
    t("experience.turnStop", { stop: "Museum" }),
  );
});
