import { beforeEach, expect, it, vi } from "vitest";
import * as Vue from "vue";
import { useRouteStore } from "../app/stores/routeStore";
import { mount, findAll } from "./helpers/render";
import CreateRoute from "../app/pages/create-route/index.vue";
import en from "../i18n/locales/en.json";
import ru from "../i18n/locales/ru.json";
import { useCreateTour } from "../app/composables/api/tours/useCreateTour";
vi.mock("../app/composables/api/tours/useCreateTour", () => ({
  useCreateTour: vi.fn(),
}));

vi.mock("#imports", () => ({
  definePageMeta: () => {},
  useGuidesStore: () => ({ selectedGuide: { id: "guide", name: "Guide" } }),
}));
vi.mock("../app/utils/pages/create-route/mainButtonText", () => ({
  getMainButtonText: (state: string) => state,
}));
vi.mock("../app/components/PGMap.vue", () => ({
  default: { template: '<div class="map-stub" />' },
}));
vi.mock("../app/components/tour/PersonalContextForm.vue", () => ({
  default: { template: "<div />" },
}));
const empty = { template: "<div />" };
let language = "en";
const push = vi.fn();
const t = (key: string) =>
  String(
    key
      .split(".")
      .reduce(
        (value: any, part) => value?.[part],
        language === "ru" ? ru : en,
      ) ?? key,
  );
beforeEach(() => {
  language = "en";
  Object.assign(globalThis, {
    ...Vue,
    useRouteStore,
    useGuidesStore: () => ({ selectedGuide: { id: "guide", name: "Guide" } }),
    useRouter: () => ({ push }),
    navigateTo: vi.fn(),
    useI18n: () => ({ t, te: () => true }),
  });
});
const render = () =>
  mount(
    CreateRoute,
    {},
    {
      ClientOnly: { template: "<div><slot /></div>" },
      PGButton: {
        props: ["disabled"],
        template: '<button :disabled="disabled"><slot /></button>',
      },
      PGChip: { template: "<button><slot /></button>" },
      USlider: empty,
      UIcon: empty,
    },
    t,
  );
function draft(minutes: string) {
  const route = useRouteStore();
  route.setStartPoint({ lat: "47", lng: "19" });
  route.setDuration(minutes);
  route.setRouteSuggestion({
    routes: [
      {
        name: "Draft",
        points: [
          { lat: "47", lng: "19" },
          { lat: "47.001", lng: "19.001" },
        ],
        stops: [
          { name: "First", point: { lat: "47", lng: "19" } },
          { name: "Second", point: { lat: "47.001", lng: "19.001" } },
        ],
      },
    ],
  } as any);
  return route;
}
it.each(["5", "30"])(
  "restores a %s-minute draft and keeps its creation action enabled",
  async (minutes) => {
    const route = draft(minutes);
    const app = render();
    await Vue.nextTick();
    expect(route.duration).toBe(minutes);
    expect(route.selectedRoute?.name).toBe("Draft");
    const button = findAll(
      app.root,
      (node) =>
        node.type === "button" &&
        findAll(node, (child) => child.text === "ROUTE_RECEIVED").length > 0,
    )[0];
    expect(button).toBeDefined();
    expect(button.props.disabled).toBe(false);
    app.unmount();
  },
);
it("renders Russian interest labels without changing their backend names", async () => {
  language = "ru";
  draft("30");
  const app = render();
  await Vue.nextTick();
  const text = findAll(app.root, () => true)
    .map((node) => node.text)
    .join(" ");
  expect(text).toContain("Природа");
  expect(text).not.toContain("For child");
  app.unmount();
});

it("keeps a late created tour without redirecting after leaving the page", async () => {
  const route = draft("30");
  let resolve!: () => void;
  vi.mocked(useCreateTour).mockImplementation(
    () =>
      new Promise<any>((done) => {
        resolve = () => done({ id: "created" });
      }),
  );
  const app = render();
  const button = findAll(
    app.root,
    (node) =>
      node.type === "button" &&
      findAll(node, (child) => child.text === "ROUTE_RECEIVED").length > 0,
  )[0];
  const pending = button.props.onClick();
  app.unmount();
  resolve();
  await pending;
  expect(route.actualTour?.id).toBe("created");
  expect(push).not.toHaveBeenCalled();
});
