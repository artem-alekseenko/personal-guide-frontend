import { beforeEach, expect, it, vi } from "vitest";
import * as Vue from "vue";
import { useGeolocationStore } from "../app/stores/geolocationStore";
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
const t = (key: string, params: Record<string, unknown> = {}) =>
  String(
    key
      .split(".")
      .reduce(
        (value: any, part) => value?.[part],
        language === "ru" ? ru : en,
      ) ?? key,
  ).replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ""));
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

it("offers keyboard coordinate entry with bounds validation", async () => {
  const route = useRouteStore();
  const app = render();
  const latitude = findAll(
    app.root,
    (node) => node.type === "input" && node.props.id === "start-latitude",
  )[0];
  const longitude = findAll(
    app.root,
    (node) => node.type === "input" && node.props.id === "start-longitude",
  )[0];
  expect(latitude).toBeDefined();
  expect(longitude).toBeDefined();
  latitude.props.onInput({ target: { value: "91" } });
  longitude.props.onInput({ target: { value: "19" } });
  const form = findAll(app.root, (node) => node.type === "form")[0];
  form.props.onSubmit({ preventDefault() {} });
  await Vue.nextTick();
  expect(route.startPoint).toBeNull();
  expect(findAll(app.root, (node) => node.props.role === "alert")).toHaveLength(
    1,
  );
  latitude.props.onInput({ target: { value: "47.5" } });
  form.props.onSubmit({ preventDefault() {} });
  await Vue.nextTick();
  expect(route.startPoint).toEqual({ lat: "47.5", lng: "19" });
  expect(findAll(app.root, (node) => node.props.role === "alert")).toHaveLength(
    0,
  );
  app.unmount();
});

it("selects current GPS as the start through a named button", async () => {
  const geo = useGeolocationStore();
  geo.longitude = 19.04;
  geo.latitude = 47.49;
  const app = render();
  const gps = findAll(
    app.root,
    (node) =>
      node.type === "button" &&
      findAll(
        node,
        (child) => child.text === t("pages.createRoute.useCurrentLocation"),
      ).length > 0,
  )[0];
  expect(gps).toBeDefined();
  expect(gps.props.disabled).toBe(false);
  gps.props.onClick();
  await Vue.nextTick();
  expect(useRouteStore().startPoint).toEqual({ lat: "47.49", lng: "19.04" });
  app.unmount();
});

it("names the duration control and exposes its minutes on the actual slider", async () => {
  draft("30");
  const app = render();
  const slider = findAll(
    app.root,
    (node) => node.type === "input" && node.props.type === "range",
  )[0];
  expect(slider).toBeDefined();
  expect(
    findAll(
      app.root,
      (node) => node.type === "label" && node.props.for === slider.props.id,
    )[0]?.text,
  ).toBe(t("pages.createRoute.durationLabel"));
  expect(slider.props["aria-valuetext"]).toContain("30");
  slider.props.onInput({ target: { value: "45" } });
  await Vue.nextTick();
  expect(useRouteStore().duration).toBe("45");
  expect(slider.props["aria-valuetext"]).toContain("45");
  app.unmount();
});

it("locks the route draft while creation is pending", async () => {
  const route = draft("30");
  let complete!: (result: any) => void;
  vi.mocked(useCreateTour).mockImplementation(
    () =>
      new Promise((resolve) => {
        complete = resolve;
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
  await Vue.nextTick();
  const draftControls = findAll(
    app.root,
    (node) => node.type === "fieldset",
  )[0];
  expect(draftControls).toBeDefined();
  expect(draftControls.props.disabled).toBe(true);
  expect(draftControls.props.inert).toBe(true);
  const slider = findAll(
    app.root,
    (node) => node.type === "input" && node.props.type === "range",
  )[0];
  slider.props.onInput({ target: { value: "45" } });
  expect(route.duration).toBe("30");
  complete({ id: "created" });
  await pending;
  app.unmount();
});
