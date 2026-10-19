import { expect, it } from "vitest";
import { createSSRApp } from "vue";
import { renderToString } from "@vue/server-renderer";
import TourReadingPanel from "../app/components/tour/TourReadingPanel.vue";
import en from "../i18n/locales/en.json";

async function render(text: string, transcript = text) {
  const app = createSSRApp(TourReadingPanel, {
    text,
    transcript,
    progress: {
      stopPosition: 1,
      totalStops: 3,
      stopName: "Library",
      locationLabel: "guide",
      coordinates: null,
      latestText: text,
      updatedAt: null,
      isFinished: false,
    },
  });
  const t = (key: string) =>
    String(
      key.split(".").reduce((value: any, part) => value?.[part], en) ?? key,
    );
  Object.assign(globalThis, {
    useI18n: () => ({ t, locale: { value: "en" } }),
  });
  app.config.globalProperties.$t = t;
  return renderToString(app);
}

it("shows the latest guide text in full outside closed earlier-text and progress disclosures", async () => {
  const text =
    "Beginning of the explanation. " +
    "More detail. ".repeat(50) +
    "Last words.";
  const earlier = "The story we already read.";
  const html = await render(text, `${earlier} ${text}`);
  const visible = html.slice(0, html.indexOf("<details"));
  expect(visible).toContain("Latest guide text");
  expect(visible).toContain(text);
  expect(visible).not.toContain(earlier);
  const history = html.match(/<details[^>]*>[\s\S]*?<\/details>/)?.[0] ?? "";
  expect(history).toContain("Earlier guide text");
  expect(history).toContain(earlier);
  expect(history).not.toContain(text);
  for (const disclosure of html.matchAll(/<details([^>]*)>/g))
    expect(disclosure[1]).not.toContain("open");
});

it("omits the earlier-text disclosure when only the latest message is recorded", async () => {
  const html = await render("Only the current explanation.");
  expect(html).not.toContain("Earlier guide text");
  expect(html.match(/<details/g)).toHaveLength(1);
});

it("keeps the transcript collapsed when a newer message is not in it yet", async () => {
  const html = await render("A newer explanation.", "An earlier explanation.");
  const visible = html.slice(0, html.indexOf("<details"));
  expect(visible).toContain("A newer explanation.");
  expect(visible).not.toContain("An earlier explanation.");
  expect(html).toContain("An earlier explanation.");
});
