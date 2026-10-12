import { expect, it } from "vitest";
import { createSSRApp } from "vue";
import { renderToString } from "@vue/server-renderer";
import RoutePlacesPanel from "../app/components/tour/RoutePlacesPanel.vue";
import en from "../i18n/locales/en.json";
import ru from "../i18n/locales/ru.json";
const places = [
  {
    id: "school",
    source: "google" as const,
    source_id: "school-provider",
    name: "Public school",
    lat: "47",
    lng: "19",
    types: ["school"],
    address: "Main street",
    distance_to_route_meters: 10,
    along_route_meters: 50,
  },
  {
    id: "building",
    source: "google" as const,
    source_id: "building-provider",
    name: "<script>ordinary building</script>",
    lat: "47.01",
    lng: "19.01",
    types: ["premise"],
    address: null,
    distance_to_route_meters: 3,
    along_route_meters: 500,
  },
];
const discovery = {
  generation_id: "gen-1",
  geometry_hash: "corridor",
  language: "en",
  status: "partial" as const,
  checked_at: "2026-10-12",
  warnings: ["Bounded provider results"],
  discovered_places: places,
  geometry: [],
};
function translator(locale: typeof en | typeof ru) {
  return (key: string) => {
    let value: unknown = locale;
    for (const part of key.split(".")) {
      if (!value || typeof value !== "object" || !(part in value)) return key;
      value = Reflect.get(value, part);
    }
    return typeof value === "string" ? value : key;
  };
}
it.each([en, ru])(
  "renders ordinary public names along the corridor with honest source, access and coverage limits",
  async (locale) => {
    const app = createSSRApp(RoutePlacesPanel, { places, discovery });
    app.config.globalProperties.$t = translator(locale);
    const html = await renderToString(app);
    expect(html).toContain("Public school");
    expect(html).toContain("&lt;script&gt;ordinary building&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain(locale.routePlaces.source);
    expect(html).toContain(locale.routePlaces.caveat);
    expect(html).toContain(locale.routePlaces.status.partial);
    expect(html).toContain("Bounded provider results");
    expect(html).not.toContain("list-decimal");
  },
);
it("renders legitimate empty discovery separately from unavailable coverage", async () => {
  const app = createSSRApp(RoutePlacesPanel, {
    places: [],
    discovery: { ...discovery, status: "unavailable" },
  });
  app.config.globalProperties.$t = translator(en);
  const html = await renderToString(app);
  expect(html).toContain(en.routePlaces.empty);
  expect(html).toContain(en.routePlaces.status.unavailable);
  expect(html).not.toContain(en.routePlaces.ask);
});
