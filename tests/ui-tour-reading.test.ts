import { expect, it } from "vitest";
import { createSSRApp } from "vue";
import { renderToString } from "@vue/server-renderer";
import TourReadingPanel from "../app/components/tour/TourReadingPanel.vue";
import en from "../i18n/locales/en.json";

it("shows the entire guide text before a closed progress disclosure", async () => {
  const text =
    "Beginning of the explanation. " +
    "More detail. ".repeat(50) +
    "Last words.";
  const app = createSSRApp(TourReadingPanel, {
    text,
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
  const html = await renderToString(app);
  expect(html.indexOf("Beginning of the explanation.")).toBeLessThan(
    html.indexOf("<details"),
  );
  expect(html.indexOf("Last words.")).toBeLessThan(html.indexOf("<details"));
  expect(html).toMatch(/<details[^>]*><summary/);
  expect(html.split("<details")[1]?.split(">")[0]).not.toContain("open");
  expect(html.split("<details")[0]).not.toContain("h-60");
});
