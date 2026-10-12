import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { nextTick, reactive } from "vue";
import type { IGuide } from "../app/types";
import { mount, findAll } from "./helpers/render";
import type { TestNode } from "./helpers/render";
import GuideCatalog from "../app/components/guides/GuideCatalog.vue";
import en from "../i18n/locales/en.json";

interface GuidesState {
  guidesList: IGuide[];
  isGuidesListLoading: boolean;
  error: string | null;
  selectedGuide: IGuide | null;
  isGuidesCacheValid: boolean;
  fetchGuidesList: Mock;
  setSelectedGuide: Mock;
}
const { state, resetDraft, navigate } = vi.hoisted(() => ({
  state: { store: null as GuidesState | null },
  resetDraft: vi.fn(),
  navigate: vi.fn(),
}));
vi.mock("../app/stores/guidesStore", () => ({
  useGuidesStore: () => state.store,
}));

const guides: IGuide[] = [
  {
    id: "legacy",
    name: "Mira",
    context: "Riverside gardens",
    skills: "Botanical sketches",
    avatar: "",
    tags: [
      { id: "nature", name: " Nature " },
      { id: "empty", name: "" },
      { id: "blank", name: "   " },
    ],
    tours: [],
  },
  {
    id: "leading",
    name: "Leo",
    context: "Riverside gardens",
    skills: "Botanical sketches",
    avatar: "",
    tags: [
      { id: "nature", name: "nature" },
      { id: "architecture", name: "Architecture" },
    ],
    tours: [],
    interaction_mode: "leading",
  },
  {
    id: "history",
    name: "Ada",
    context: "Old town stories",
    skills: "Urban history",
    avatar: "",
    tags: [{ id: "history", name: "History" }],
    tours: [],
    interaction_mode: "interactive",
  },
  {
    id: "untagged",
    name: "Niko",
    context: "Quiet streets",
    skills: "City walks",
    avatar: "",
    tags: [],
    tours: [],
    interaction_mode: "leading",
  },
];
const cleanups: (() => void)[] = [];
const components = {
  NuxtLink: { template: '<a :href="to"><slot /></a>', props: ["to"] },
};
function t(key: string, params: Record<string, unknown> = {}): string {
  let value: unknown = en;
  for (const part of key.split(".")) {
    if (typeof value !== "object" || value === null || !(part in value))
      return key;
    value = (value as Record<string, unknown>)[part];
  }
  return String(value).replace(/\{(\w+)\}/g, (_, name: string) =>
    String(params[name] ?? ""),
  );
}
function text(node: TestNode): string {
  if (node.type === "#comment") return "";
  return [node.text, ...node.children.map(text)].join("").trim();
}
function button(root: TestNode, label: string): TestNode {
  const found = findAll(
    root,
    (node) => node.type === "button" && text(node) === label,
  )[0];
  expect(found, `Expected accessible button: ${label}`).toBeDefined();
  return found!;
}
async function click(root: TestNode, label: string) {
  button(root, label).props.onClick();
  await nextTick();
}
async function search(root: TestNode, value: string) {
  const input = findAll(
    root,
    (node) => node.type === "input" && node.props.type === "search",
  )[0]!;
  input.props.onInput({ target: { value } });
  await nextTick();
}
function names(root: TestNode): string[] {
  return findAll(
    root,
    (node) =>
      node.type === "h3" && guides.some((guide) => guide.name === node.text),
  ).map((node) => node.text);
}
function catalog(props: Record<string, unknown> = {}) {
  const app = mount(
    GuideCatalog,
    {
      guides,
      loading: false,
      error: null,
      selectedGuideId: "history",
      ...props,
    },
    components,
    t,
  );
  cleanups.push(app.unmount);
  return app;
}
beforeEach(() => {
  state.store = reactive({
    guidesList: [],
    isGuidesListLoading: false,
    error: null,
    selectedGuide: guides[2]!,
    isGuidesCacheValid: false,
    fetchGuidesList: vi.fn(),
    setSelectedGuide: vi.fn(),
  });
  Object.assign(globalThis, {
    useRouter: () => ({ push: navigate }),
    useRouteStore: () => ({ reset: resetDraft }),
  });
});
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

describe("guide catalog discovery", () => {
  it("composes search, topic and normalized guide style without selecting or fetching", async () => {
    const app = catalog();
    await nextTick();
    expect(
      findAll(
        app.root,
        (node) =>
          node.type === "button" && text(node).toLowerCase() === "nature",
      ),
    ).toHaveLength(1);
    await search(app.root, "  BOTANICAL  ");
    await click(app.root, "Nature");
    await click(app.root, t("pages.guides.styles.interactive"));
    expect(names(app.root)).toEqual(["Mira"]);
    const resultStatus = findAll(
      app.root,
      (node) => node.props["aria-live"] === "polite",
    )[0]!;
    expect(resultStatus.props.role).toBe("status");
    expect(text(resultStatus)).toBe(
      t("pages.guides.results", { count: 1, total: 4 }),
    );
    await click(app.root, t("pages.guides.styles.leading"));
    expect(names(app.root)).toEqual(["Leo"]);
    expect(state.store!.selectedGuide?.id).toBe("history");
    expect(state.store!.setSelectedGuide).not.toHaveBeenCalled();
    expect(state.store!.fetchGuidesList).not.toHaveBeenCalled();
    expect(resetDraft).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("clears every filter after a zero-match combination and restores the available catalog", async () => {
    const app = catalog();
    await search(app.root, "riverside");
    await click(app.root, t("pages.guides.styles.leading"));
    await click(app.root, "History");
    expect(names(app.root)).toEqual([]);
    expect(
      findAll(
        app.root,
        (node) =>
          node.type === "button" && text(node) === t("buttons.tryAgain"),
      ),
    ).toHaveLength(0);
    const resetButtons = findAll(
      app.root,
      (node) =>
        node.type === "button" && text(node) === t("pages.guides.clearFilters"),
    );
    resetButtons.at(-1)!.props.onClick();
    await nextTick();
    expect(names(app.root)).toEqual(["Mira", "Leo", "Ada", "Niko"]);
    expect(
      button(app.root, t("pages.guides.allStyles")).props["aria-pressed"],
    ).toBe(true);
    expect(
      button(app.root, t("pages.guides.allTopics")).props["aria-pressed"],
    ).toBe(true);
    expect(
      findAll(app.root, (node) => node.type === "input")[0]!.props.value,
    ).toBe("");
    await click(app.root, t("pages.guides.styles.interactive"));
    expect(names(app.root)).toEqual(["Mira", "Ada"]);
  });

  it.each<{ query: string; expected: string[] }>([
    { query: "mira", expected: ["Mira"] },
    { query: "quiet streets", expected: ["Niko"] },
    { query: "urban history", expected: ["Ada"] },
    { query: "architecture", expected: ["Leo"] },
  ])(
    "searches real guide profile fields ($query)",
    async ({ query, expected }) => {
      const app = catalog();
      await search(app.root, query);
      expect(names(app.root)).toEqual(expected);
    },
  );

  it.each([
    { loading: true, error: null, guides: [] },
    { loading: false, error: "offline", guides },
    { loading: false, error: null, guides: [] },
  ])(
    "does not confuse unavailable data with zero search matches ($loading, $error)",
    async (props) => {
      const app = catalog();
      await search(app.root, "missing");
      app.props.loading = props.loading;
      app.props.error = props.error;
      app.props.guides = props.guides;
      await nextTick();
      expect(names(app.root)).toEqual([]);
      expect(findAll(app.root, (node) => node.type === "input")).toHaveLength(
        0,
      );
      expect(
        findAll(
          app.root,
          (node) =>
            node.type === "button" &&
            text(node) === t("pages.guides.clearFilters"),
        ),
      ).toHaveLength(0);
      if (props.loading) {
        expect(
          findAll(app.root, (node) => node.props["aria-busy"] === true),
        ).toHaveLength(1);
        expect(
          findAll(app.root, (node) => node.props.role === "status"),
        ).toHaveLength(1);
        expect(
          findAll(app.root, (node) => node.type === "button"),
        ).toHaveLength(0);
      } else {
        expect(button(app.root, t("buttons.tryAgain"))).toBeDefined();
        expect(
          findAll(
            app.root,
            (node) => node.type === "a" && node.props.href === "/tours",
          ),
        ).toHaveLength(1);
        expect(
          findAll(
            app.root,
            (node) => node.props.role === (props.error ? "alert" : "status"),
          ),
        ).toHaveLength(1);
      }
    },
  );
});
