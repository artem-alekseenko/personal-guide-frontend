import { expect, it } from "vitest";
import { createSSRApp } from "vue";
import { renderToString } from "@vue/server-renderer";
import TourProgressSummary from "../app/components/tour/TourProgressSummary.vue";
import en from "../i18n/locales/en.json";
import ru from "../i18n/locales/ru.json";

const progress = {
  stopPosition: 2,
  totalStops: 4,
  stopName: "Library",
  locationLabel: "confirmed",
  coordinates: { lat: "47.5", lng: "19.1" },
  latestText: "The library was built for the city's readers.",
  updatedAt: "2026-09-30T10:00:00Z",
  isFinished: false,
};
async function render(overrides = {}, messages: typeof en | typeof ru = en) {
  const app = createSSRApp(TourProgressSummary, {
    progress: { ...progress, ...overrides },
  });
  app.config.globalProperties.$t = (
    key: string,
    params: Record<string, unknown> = {},
  ) =>
    String(
      key.split(".").reduce((value: any, part) => value?.[part], messages) ??
        key,
    ).replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ""));
  Object.assign(globalThis, {
    useI18n: () => ({ locale: { value: messages === ru ? "ru" : "en" } }),
  });
  return renderToString(app);
}

it("shows recorded route position with an accessible position meter", async () => {
  const html = await render();
  expect(html).toContain("Stop 2 of 4");
  expect(html).toMatch(/<meter[^>]*aria-label="Route position"/);
  expect(html).toMatch(/<meter[^>]*value="2"/);
  expect(html).toMatch(/<meter[^>]*max="4"/);
  expect(html).toMatch(/<meter[^>]*aria-valuetext="Stop 2 of 4"/);
  expect(html).toContain("Last confirmed stop");
  expect(html).toContain("Library");
  expect(html).toContain("Last recorded location");
  expect(html).toContain("47.5, 19.1");
  expect(html).toContain('datetime="2026-09-30T10:00:00Z"');
});

it("states unknown route position, location and missing guide text", async () => {
  const html = await render({
    stopPosition: null,
    stopName: null,
    coordinates: null,
    latestText: null,
    updatedAt: null,
    locationLabel: "unconfirmed",
  });
  expect(html).toContain("Route position not recorded");
  expect(html).not.toContain("<meter");
  expect(html).toContain("No recorded location yet");
  expect(html).toContain("No guide text recorded yet");
  expect(html).not.toContain("<time");
});

it("renders persisted text immediately from supplied reload data", async () => {
  const html = await render({
    latestText: "An earlier recorded story",
    locationLabel: "guide",
  });
  expect(html).toContain("Latest guide text");
  expect(html).toContain("An earlier recorded story");
  expect(html).toContain("Guide&#39;s last stop");
  expect(html).not.toContain("heard");
});

it("labels a walking guidance target as heading to without implying arrival", async () => {
  const html = await render({ locationLabel: "heading", stopName: "Square" });
  expect(html).toContain("Heading to");
  expect(html).toContain("Square");
  expect(html).not.toContain("Last confirmed stop");
});

it("labels the latest recorded update without assigning it to the location fix", async () => {
  const html = await render();
  expect(html).toContain("Last recorded update");
  expect(html.indexOf("Last recorded update")).toBeLessThan(
    html.indexOf("Last recorded location"),
  );
});

it("marks a selected stop without presenting its location as confirmed", async () => {
  const html = await render({ locationLabel: "selected" });
  expect(html).toContain("Selected stop");
  expect(html).toContain("Manually selected; location not confirmed");
  expect(html).not.toContain("Last confirmed stop");
});

it("escapes untrusted stop names, coordinates and guide text", async () => {
  const html = await render({
    stopName: '<img src=x onerror="alert(1)">',
    coordinates: { lat: "<script>", lng: "19" },
    latestText: '<script>alert("unsafe")</script>',
  });
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<img");
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("&lt;img");
});

it("shows the tail of a long guide reply with the full text available in a disclosure", async () => {
  const latestText = Array.from(
    { length: 40 },
    (_, index) => `word${index + 1}`,
  ).join(" ");
  const html = await render({ latestText });
  const beforeDetails = html.split("<details")[0];
  expect(beforeDetails).toContain("word6 word7");
  expect(beforeDetails).not.toContain("word1 word2");
  expect(html).toContain("<details");
  expect(html).toContain("Read full guide text");
  expect(html).toContain(latestText);
});

it("keeps finished state separate from route position", async () => {
  const html = await render({ isFinished: true });
  expect(html).toContain("Walk finished");
  expect(html).toContain("Stop 2 of 4");
  expect(html).not.toContain("Stop 4 of 4");
});

it("renders route position and recording labels in Russian", async () => {
  const html = await render({}, ru);
  expect(html).toContain("Остановка 2 из 4");
  expect(html).toContain("Последнее записанное местоположение");
  expect(html).toContain("Последний текст гида");
});
