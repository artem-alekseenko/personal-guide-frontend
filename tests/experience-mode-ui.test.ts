import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as Vue from "vue";
import { renderToString } from "@vue/server-renderer";
import CurrentStopExperience from "../app/components/tour/CurrentStopExperience.vue";
import CreateRoute from "../app/pages/create-route/index.vue";
import { useExperienceStore } from "../app/stores/experienceStore";
import { useRouteStore } from "../app/stores/routeStore";
import BaseSelector from "../app/components/base/BaseSelector.vue";
import { emptyPersonalContext } from "../app/types/personalContext";
import en from "../i18n/locales/en.json";

vi.mock("../app/composables/auth/useAuth", () => ({
  useAuth: () => ({
    user: Vue.ref({ uid: "owner" }),
    userPreferences: Vue.ref({ llmType: "DEFAULT" }),
  }),
}));
vi.mock("../app/stores/geolocationStore", () => ({
  useGeolocationStore: () => ({
    coordinates: null,
    error: null,
    accuracy: null,
    recordedAt: null,
  }),
}));
vi.mock("../app/components/PGMap.vue", () => ({
  default: { render: () => Vue.h("div") },
}));
vi.mock("#imports", () => ({
  definePageMeta: () => {},
  useGuidesStore: () => ({
    selectedGuide: { id: "guide", name: "Guide", interaction_mode: "leading" },
  }),
}));

let view: any;
let api: ReturnType<typeof vi.fn>;
let visibility: (() => void) | undefined;
const cleanups: (() => void)[] = [];
const t = (key: string, params: Record<string, unknown> = {}) => {
  const value =
    key.split(".").reduce((result: any, part) => result?.[part], en) ?? key;
  return String(value).replace(/\{(\w+)\}/g, (_, name) =>
    String(params[name] ?? ""),
  );
};

// Vue's native model directives run against this small DOM boundary.
class Element {
  props: Record<string, any> = {};
  children: Element[] = [];
  parent: Element | null = null;
  text = "";
  value: any = "";
  checked = false;
  selected = false;
  multiple = false;
  listeners: Record<string, (event: any) => void> = {};
  constructor(public type: string) {}
  getRootNode() {
    return document;
  }
  get tagName() {
    return this.type.toUpperCase();
  }
  get options() {
    return this.children.filter((child) => child.type === "option");
  }
  addEventListener(name: string, listener: (event: any) => void) {
    this.listeners[name] = listener;
  }
  removeEventListener(name: string) {
    delete this.listeners[name];
  }
}
const renderer = Vue.createRenderer<Element, Element>({
  createElement: (type) => new Element(type),
  createText: (text) => Object.assign(new Element("#text"), { text }),
  createComment: () => new Element("#comment"),
  setText: (node, text) => {
    node.text = text;
  },
  setElementText: (node, text) => {
    node.text = text;
  },
  parentNode: (node) => node.parent,
  nextSibling: (node) =>
    node.parent?.children[node.parent.children.indexOf(node) + 1] ?? null,
  patchProp: (node, key, _old, value) => {
    node.props[key] = value;
    if (["value", "checked", "multiple"].includes(key))
      (node as any)[key] = value;
    if (key === "value") (node as any)._value = value;
  },
  insert: (node, parent, anchor) => {
    node.parent = parent;
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, node);
  },
  remove: (node) => {
    if (node.parent)
      node.parent.children.splice(node.parent.children.indexOf(node), 1);
  },
});
function all(node: Element): Element[] {
  return [node, ...node.children.flatMap(all)];
}
function text(node: Element): string {
  return all(node)
    .map((child) => child.text)
    .join(" ");
}
async function mount(
  beforeMount?: () => void,
  generation?: Vue.Ref<string | null>,
) {
  view.navigation = { status: "unavailable", instructions: [], warnings: [] };
  await useExperienceStore().load("tour", "owner", generation?.value);
  beforeMount?.();
  const root = new Element("root");
  const app = renderer.createApp({
    setup: () => () =>
      Vue.h(CurrentStopExperience, {
        tourId: "tour",
        guideMode: "leading",
        generationId: generation?.value,
      }),
  });
  app.config.globalProperties.$t = t;
  app.component("BaseSelector", BaseSelector);
  app.mount(root);
  cleanups.push(() => app.unmount());
  await Vue.nextTick();
  await Vue.nextTick();
  await Vue.nextTick();
  return root;
}
function button(root: Element, label: string) {
  return all(root).find(
    (node) => node.type === "button" && text(node).trim() === label,
  )!;
}
function modeSelector(root: Element) {
  return all(root).find(
    (node) =>
      node.type === "select" &&
      node.options.some((option) => option.props.value === "leading"),
  )!;
}
function chooseMode(root: Element, mode: string) {
  const select = modeSelector(root);
  for (const option of select.options)
    option.selected = option.props.value === mode;
  select.value = mode;
  if (select.listeners.change) select.listeners.change({ target: select });
  select.props.onChange?.({ target: select });
}
async function render(component: any, props: any = {}) {
  const app = Vue.createSSRApp(component, props);
  app.config.globalProperties.$t = t;
  app.component("BaseSelector", BaseSelector);
  app.component("PGButton", { render: () => Vue.h("button") });
  app.component("ClientOnly", {
    render() {
      return this.$slots.default?.();
    },
  });
  for (const name of ["UIcon", "PGChip", "USlider"])
    app.component(name, { render: () => Vue.h("div") });
  return (await renderToString(app)).replaceAll("&#39;", "'");
}
beforeEach(() => {
  view = {
    schema_version: 1,
    revision: 3,
    generation_id: null,
    stop_id: "museum",
    stop_name: "Museum",
    stops: [{ id: "museum", name: "Museum" }],
    location_status: "USER_SELECTED",
    activity: null,
    cue_id: null,
    interaction_mode: "leading",
    personal_context: {
      ...emptyPersonalContext(),
      enabled: true,
      interaction_mode: "guide",
      interests: ["art"],
      step_free: true,
      note: "Keep this context",
    },
    available_actions: ["ASK", "PHOTO", "BREAK", "DONE"],
    cues: [
      {
        id: "photo",
        kind: "PHOTO",
        text: "A provider photo suggestion",
        limitations: [],
      },
    ],
    remaining_minutes: 12,
    limitation: null,
    turns: [],
    sources: [],
    navigation: {
      status: "available",
      target_name: "Museum",
      instructions: ["Follow the supplied path"],
      warnings: [],
    },
  };
  api = vi.fn(async (_url: string, options?: any) => {
    if (options?.method === "POST") {
      view = {
        ...view,
        revision: view.revision + 1,
        personal_context: options.body.context ?? view.personal_context,
        interaction_mode:
          options.body.context?.interaction_mode === "interactive"
            ? "interactive"
            : "leading",
      };
    }
    return structuredClone(view);
  });
  Object.assign(globalThis, {
    ...Vue,
    Document: class {},
    ShadowRoot: class {},
    useRouteStore,
    useNuxtApp: () => ({ $apiFetch: api }),
    useI18n: () => ({ t, locale: Vue.ref("en"), te: () => true }),
    useRouter: () => ({ push: vi.fn() }),
    navigateTo: vi.fn(),
    useGuidesStore: () => ({
      selectedGuide: {
        id: "guide",
        name: "Guide",
        interaction_mode: "leading",
      },
    }),
    document: {
      hidden: false,
      addEventListener: (_name: string, callback: () => void) => {
        visibility = callback;
      },
      removeEventListener: () => {
        visibility = undefined;
      },
    },
  });
});
afterEach(() => {
  cleanups.splice(0).forEach((dispose) => dispose());
});

it("shows the server's effective style separately from the context after forgetting memories", async () => {
  await useExperienceStore().load("tour", "owner");
  const html = await render(CurrentStopExperience, {
    tourId: "tour",
    guideMode: "interactive",
  });
  expect(html).toContain("Current style: Just guide me");
  expect(html).toContain("Guide's style: Explore together");
  expect(html).toContain("Ask a question or share what you notice");
  expect(html).toContain("Photo pause");
  expect(html).toContain("Take a break");
  expect(html).toContain("Follow the supplied path");
  expect(html).toContain("A provider photo suggestion");
});

it("hydrates a cached preference and applies a change with all context fields without saving a profile", async () => {
  view.personal_context.interaction_mode = "interactive";
  const root = await mount();
  const select = modeSelector(root);
  expect(select).toBeDefined();
  await vi.waitFor(() => expect(select.props.value).toBe("interactive"));
  chooseMode(root, "leading");
  await Vue.nextTick();
  await button(root, t("experience.applyContext")).props.onClick();
  const body = api.mock.calls.find(
    (call: any[]) => call[1]?.method === "POST",
  )?.[1]?.body;
  expect(body.context).toMatchObject({
    interaction_mode: "leading",
    interests: ["art"],
    step_free: true,
    note: "Keep this context",
  });
  expect(
    api.mock.calls.every((call: any[]) => !call[0].includes("user-profile")),
  ).toBe(true);
  expect(text(root)).toContain("Current style: Just guide me");
});

it("blocks applying style changes and retries until required reconciliation succeeds", async () => {
  const root = await mount();
  const store = useExperienceStore() as any;
  store.hasPending = true;
  store.needsReconciliation = true;
  await Vue.nextTick();
  expect(button(root, t("experience.applyContext")).props.disabled).toBe(true);
  expect(button(root, t("experience.retry")).props.disabled).toBe(true);
  expect(text(root)).toContain(
    "Refresh this walk before making another change.",
  );
});

it("reconciles automatic visibility reads without discarding an uncertain action", async () => {
  const root = await mount();
  api.mockImplementationOnce(async () => {
    throw new Error("Connection interrupted");
  });
  await button(root, t("experience.applyContext")).props.onClick();
  expect(useExperienceStore().hasPending).toBe(true);
  view = { ...view, revision: 5, interaction_mode: "interactive" };
  visibility?.();
  await vi.waitFor(() => expect(useExperienceStore().view?.revision).toBe(5));
  expect(useExperienceStore().hasPending).toBe(true);
  expect(text(root)).toContain("Current style: Explore together");
});

it("preserves a visitor's context draft while a cached panel reload is pending", async () => {
  view.personal_context.interaction_mode = "interactive";
  let complete!: (result: any) => void;
  const root = await mount(() =>
    api.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    ),
  );
  chooseMode(root, "leading");
  await Vue.nextTick();
  view = {
    ...view,
    personal_context: {
      ...view.personal_context,
      note: "Later server context",
    },
  };
  complete(structuredClone(view));
  await vi.waitFor(() =>
    expect(useExperienceStore().view?.personal_context.note).toBe(
      "Later server context",
    ),
  );
  await Vue.nextTick();
  expect(modeSelector(root).props.value).toBe("leading");
  await button(root, t("experience.applyContext")).props.onClick();
  const body = api.mock.calls.find(
    (call: any[]) => call[1]?.method === "POST",
  )?.[1]?.body;
  expect(body.context).toMatchObject({
    interaction_mode: "leading",
    note: "Keep this context",
    interests: ["art"],
    step_free: true,
  });
});

it("keeps newer context edits when an apply response arrives", async () => {
  const root = await mount();
  chooseMode(root, "interactive");
  await Vue.nextTick();
  let complete!: (result: any) => void;
  api.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const pending = button(root, t("experience.applyContext")).props.onClick();
  await vi.waitFor(() => expect(complete).toBeDefined());
  chooseMode(root, "leading");
  await Vue.nextTick();
  complete({
    ...structuredClone(view),
    revision: 4,
    personal_context: {
      ...view.personal_context,
      interaction_mode: "interactive",
    },
  });
  await pending;
  await Vue.nextTick();
  expect(modeSelector(root).props.value).toBe("leading");
  await button(root, t("experience.applyContext")).props.onClick();
  expect(api.mock.calls.at(-1)?.[1]?.body.context.interaction_mode).toBe(
    "leading",
  );
});

it("preserves unapplied context edits across a refresh", async () => {
  const root = await mount();
  chooseMode(root, "interactive");
  await Vue.nextTick();
  view.personal_context = { ...view.personal_context, note: "Remote change" };
  await button(root, t("experience.refresh")).props.onClick();
  await Vue.nextTick();
  expect(modeSelector(root).props.value).toBe("interactive");
  await button(root, t("experience.applyContext")).props.onClick();
  expect(api.mock.calls.at(-1)?.[1]?.body.context.note).toBe(
    "Keep this context",
  );
});

it("preserves an edit back to the original context during apply", async () => {
  const root = await mount();
  chooseMode(root, "interactive");
  await Vue.nextTick();
  let complete!: (result: any) => void;
  api.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const pending = button(root, t("experience.applyContext")).props.onClick();
  await vi.waitFor(() => expect(complete).toBeDefined());
  chooseMode(root, "guide");
  await Vue.nextTick();
  complete({
    ...structuredClone(view),
    revision: 4,
    personal_context: {
      ...view.personal_context,
      interaction_mode: "interactive",
    },
  });
  await pending;
  await Vue.nextTick();
  expect(modeSelector(root).props.value).toBe("guide");
});

it("reloads accepted text generations and supersedes old retries without comparing revisions across packages", async () => {
  const generation = Vue.ref<string | null>("old-package");
  view.generation_id = generation.value;
  view.revision = 12;
  view.cues[0].text = "Old package suggestion";
  const root = await mount(undefined, generation);
  api.mockRejectedValueOnce(new Error("Lost text action response"));
  await button(root, t("experience.applyContext")).props.onClick();
  const store = useExperienceStore();
  expect(store.hasPending).toBe(true);
  const reload = Promise.withResolvers<unknown>();
  api.mockImplementationOnce(() => reload.promise);
  generation.value = "accepted-package";
  await Vue.nextTick();
  expect(store.view).toBeNull();
  expect(store.hasPending).toBe(false);
  expect(store.needsReconciliation).toBe(true);
  expect(text(root)).not.toContain("Old package suggestion");
  view = {
    ...view,
    generation_id: generation.value,
    revision: 0,
    cues: [{ ...view.cues[0], text: "Accepted package suggestion" }],
  };
  reload.resolve(structuredClone(view));
  await vi.waitFor(() =>
    expect(text(root)).toContain("Accepted package suggestion"),
  );
  expect(store.view?.revision).toBe(0);
  expect(store.needsReconciliation).toBe(false);
  await button(root, t("experience.actionPHOTO")).props.onClick();
  expect(api.mock.calls.at(-1)?.[1]?.body).toMatchObject({
    generation_id: "accepted-package",
    expected_revision: 0,
  });
});

it("keeps text actions blocked after an accepted-generation reload fails", async () => {
  const generation = Vue.ref<string | null>("old-package");
  view.generation_id = generation.value;
  const root = await mount(undefined, generation);
  api.mockRejectedValueOnce(new Error("Offline"));
  generation.value = "accepted-package";
  await vi.waitFor(() => expect(useExperienceStore().view).toBeNull());
  const store = useExperienceStore();
  expect(store.needsReconciliation).toBe(true);
  expect(store.ready).toBe(false);
  const calls = api.mock.calls.length;
  await expect(store.act({ action: "PHOTO" })).rejects.toThrow();
  expect(api.mock.calls).toHaveLength(calls);
  expect(button(root, t("experience.actionPHOTO"))).toBeUndefined();
  view = { ...view, generation_id: generation.value, revision: 0 };
  await button(root, t("experience.refresh")).props.onClick();
  await Vue.nextTick();
  expect(button(root, t("experience.actionPHOTO")).props.disabled).toBe(false);
});
