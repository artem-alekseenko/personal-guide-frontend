import { expect, it } from "vitest";
import { createSSRApp } from "vue";
import { renderToString } from "@vue/server-renderer";
import RoutePreview from "../app/components/tour/RoutePreview.vue";
import { emptyPersonalContext } from "../app/types/personalContext";
import en from "../i18n/locales/en.json";
it("shows the chosen stop order and supplied time without claiming verified access", async () => {
  const t = (key: string, p: any = {}) => {
    const text = key.split(".").reduce((v: any, k) => v[k], en);
    return String(text).replace(/\{(\w+)\}/g, (_, k) => p[k]);
  };
  Object.assign(globalThis, { useI18n: () => ({ t, te: () => true }) });
  const app = createSSRApp(RoutePreview, {
    route: {
      name: "Art walk",
      points: [],
      total_minutes: 24,
      stops: [
        { name: "Museum", point: { lat: "1", lng: "2" } },
        { name: "Square", point: { lat: "1.001", lng: "2.001" } },
      ],
    },
    context: { ...emptyPersonalContext(), interests: ["art"], pace: "relaxed" },
  });
  app.config.globalProperties.$t = t;
  const html = await renderToString(app);
  expect(html.indexOf("Museum")).toBeLessThan(html.indexOf("Square"));
  expect(html).toContain("Estimated total: 24 minutes");
  expect(html).toContain("Relaxed");
  expect(html).toContain("Art");
  expect(html).toContain("Access and opening conditions are not confirmed");
});
