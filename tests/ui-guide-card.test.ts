import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createSSRApp, nextTick } from "vue";
import { renderToString } from "@vue/server-renderer";
import PGGuide from "../app/components/PGGuide.vue";
import PGButton from "../app/components/ui/PGButton.vue";
import { useGuidesStore } from "../app/stores/guidesStore";
import { useRouteStore } from "../app/stores/routeStore";
import type { IGuide, ITour } from "../app/types";
import type { GuideInteractionMode } from "../shared/types/guideInteraction";
import type { TestNode } from "./helpers/render";
import { findAll, mount } from "./helpers/render";
import en from "../i18n/locales/en.json";

const push = vi.fn();
const cleanups: (() => void)[] = [];
const t = (key: string, params: Record<string, unknown> = {}) => {
  const value = key.split(".").reduce<unknown>((result, part) => {
    if (typeof result !== "object" || result === null) return undefined;
    return (result as Record<string, unknown>)[part];
  }, en);
  return String(value ?? key).replace(/\{(\w+)\}/g, (_, name: string) =>
    String(params[name] ?? ""),
  );
};

beforeEach(() => {
  vi.stubGlobal("useRouter", () => ({ push }));
  vi.stubGlobal("useRouteStore", useRouteStore);
});
afterEach(() => {
  cleanups.splice(0).forEach((unmount) => unmount());
  vi.unstubAllGlobals();
});

function guide(overrides: Partial<IGuide> = {}): IGuide {
  return {
    id: "guide-one",
    name: "Александра Константиновна",
    avatar: "",
    context: "An interest in neighborhood architecture and everyday stories.",
    skills: "Architecture, local history",
    tags: [{ id: "architecture", name: "Architecture" }],
    tours: [],
    ...overrides,
  };
}

function tour(overrides: Partial<ITour> = {}): ITour {
  return {
    id: 1,
    name: "My riverside route",
    description: "A route saved by the owner.",
    image: "/owner-tour.jpg",
    route: "",
    context: "",
    history: [],
    status: "GENERATING",
    settings: [],
    tags: [],
    ...overrides,
  };
}

function render(guideData: IGuide) {
  const app = mount(PGGuide, { guide: guideData }, { PGButton }, t);
  cleanups.push(app.unmount);
  return app;
}

function text(root: TestNode): string {
  return findAll(root, () => true)
    .map((node) => node.text)
    .join(" ");
}

function element(root: TestNode, type: string): TestNode {
  const found = findAll(root, (node) => node.type === type)[0];
  if (!found) throw new Error(`Missing ${type}`);
  return found;
}

async function disclose(root: TestNode, open: boolean) {
  const details = element(root, "details");
  details.props.onToggle({ currentTarget: { open } });
  await nextTick();
}

function draft() {
  const route = useRouteStore();
  route.setStartPoint({ lat: "47", lng: "19" });
  route.personalContext.note = "Keep my route draft";
  route.toggleInterest("art");
  route.setRouteSuggestion({
    routes: [
      {
        name: "Existing draft",
        points: [
          { lat: "47", lng: "19" },
          { lat: "47.1", lng: "19.1" },
        ],
      },
    ],
    description: "Existing draft description",
    high_places: [],
    coordinates: [
      [19, 47],
      [19.1, 47.1],
    ],
  });
  return route;
}

const modes: (GuideInteractionMode | undefined)[] = [
  undefined,
  "leading",
  "interactive",
];
it.each(modes)(
  "chooses the current guide and clears the draft without losing its %s style",
  async (interactionMode) => {
    const route = draft();
    const guides = useGuidesStore();
    guides.setSelectedGuide(guide({ id: "previous-guide" }));
    const app = render(guide({ id: "first-rendered-guide" }));
    const chosen = guide({
      id: "chosen-guide",
      interaction_mode: interactionMode,
    });
    app.props.guide = chosen;
    await nextTick();

    element(app.root, "button").props.onClick();

    expect(guides.selectedGuide).toEqual({
      ...chosen,
      interaction_mode: interactionMode ?? "interactive",
    });
    expect(route.startPoint).toBeNull();
    expect(route.routeSuggestion).toBeNull();
    expect(route.personalContext.note).toBe("");
    expect(route.personalContext.interests).toEqual([]);
    expect(route.tags.every((tag) => !tag.is_selected)).toBe(true);
    expect(push).toHaveBeenCalledExactlyOnceWith("/create-route");
  },
);

it("opens and closes guide details without changing selection or the route draft", async () => {
  const route = draft();
  const guides = useGuidesStore();
  guides.setSelectedGuide(guide({ id: "already-selected" }));
  const beforeDraft = JSON.stringify({
    startPoint: route.startPoint,
    suggestion: route.routeSuggestion,
    context: route.personalContext,
    tags: route.tags,
  });
  const selected = guides.selectedGuide;
  const ownedTour = tour();
  const app = render(guide({ tours: [ownedTour] }));

  expect(text(app.root)).not.toContain(ownedTour.name);
  await disclose(app.root, true);
  expect(text(app.root)).toContain(ownedTour.name);
  expect(text(app.root)).toContain(ownedTour.description);
  await disclose(app.root, false);

  expect(guides.selectedGuide).toBe(selected);
  expect(
    JSON.stringify({
      startPoint: route.startPoint,
      suggestion: route.routeSuggestion,
      context: route.personalContext,
      tags: route.tags,
    }),
  ).toBe(beforeDraft);
  expect(push).not.toHaveBeenCalled();
});

it("recovers a failed avatar when its URL changes and keeps the new guide identity", async () => {
  const app = render(guide({ avatar: "/broken-avatar.jpg" }));
  const avatar = element(app.root, "img");
  avatar.props.onError();
  await nextTick();
  expect(findAll(app.root, (node) => node.type === "img")).toHaveLength(0);
  expect(text(app.root)).toContain("А");
  expect(text(element(app.root, "h3"))).toBe("Александра Константиновна");

  app.props.guide = guide({ avatar: "/replacement-avatar.jpg" });
  await nextTick();
  expect(element(app.root, "img").props.src).toBe("/replacement-avatar.jpg");
  element(app.root, "img").props.onError();
  await nextTick();

  const nextGuide = guide({
    id: "another-guide",
    name: "БорисОченьДлинноеИмяБезПробелов",
    avatar: "/replacement-avatar.jpg",
  });
  app.props.guide = nextGuide;
  await nextTick();
  expect(element(app.root, "img").props.alt).toBe(nextGuide.name);
  expect(text(element(app.root, "h3"))).toBe(nextGuide.name);
  expect(element(app.root, "summary").props["aria-label"]).toContain(
    nextGuide.name,
  );
});

it("shows only owner-provided tour images on disclosure and replaces broken images", async () => {
  const app = render(guide({ tours: [tour()] }));
  expect(findAll(app.root, (node) => node.type === "img")).toHaveLength(0);
  await disclose(app.root, true);
  const image = element(app.root, "img");
  expect(image.props.alt).toBe("My riverside route");
  expect(image.props.loading).toBe("lazy");
  image.props.onError();
  await nextTick();
  expect(findAll(app.root, (node) => node.type === "img")).toHaveLength(0);
  expect(text(app.root)).toContain("My riverside route");

  app.props.guide = guide({ tours: [tour({ image: "/new-tour-image.jpg" })] });
  await nextTick();
  expect(element(app.root, "img").props.src).toBe("/new-tour-image.jpg");

  app.props.guide = guide({ id: "different-guide", tours: [] });
  await nextTick();
  expect(element(app.root, "details").props.open).toBe(false);
  expect(text(app.root)).not.toContain("My riverside route");
});

it("escapes untrusted identity, biography, skills and tags as plain text", async () => {
  const unsafe = '<script>alert("guide")</script><img src=x onerror=alert(1)>';
  const app = createSSRApp(PGGuide, {
    guide: guide({
      name: unsafe,
      context: unsafe,
      skills: unsafe,
      tags: [{ id: "unsafe", name: unsafe }],
    }),
  });
  app.component("PGButton", PGButton);
  app.config.globalProperties.$t = t;
  const html = await renderToString(app);

  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<img src=x");
  expect(html).toContain("&lt;script&gt;");
  expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
});
