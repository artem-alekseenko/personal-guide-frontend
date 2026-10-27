import { afterEach, beforeEach, expect, it, vi, type Mock } from "vitest";
import * as Vue from "vue";
import CurrentStopExperience from "../app/components/tour/CurrentStopExperience.vue";
import PGButton from "../app/components/ui/PGButton.vue";
import { useExperienceStore } from "../app/stores/experienceStore";
import { emptyPersonalContext } from "../app/types/personalContext";
import type { Experience, Interaction } from "../app/types/tourExperience";
import en from "../i18n/locales/en.json";

const auth = vi.hoisted(() => ({
  user: undefined as Vue.Ref<{ uid: string } | null> | undefined,
}));
vi.mock("../app/composables/auth/useAuth", () => ({
  useAuth: () => ({
    user: auth.user,
    userPreferences: Vue.ref({ llmType: "DEFAULT" }),
  }),
}));

const geolocation = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("../app/stores/geolocationStore", () => ({
  useGeolocationStore: () => {
    geolocation.read();
    throw new Error("General questions must not request GPS");
  },
}));
type RequestOptions = {
  method?: string;
  body: Interaction & {
    expected_revision: number;
    generation_id: string | null;
  };
  headers: Record<string, string>;
};
let view: Experience;
let api: Mock<(url: string, options?: RequestOptions) => Promise<Experience>>;
let visibility: (() => void) | undefined;
const cleanups: (() => void)[] = [];
const t = (key: string, params: Record<string, unknown> = {}) => {
  const value =
    key
      .split(".")
      .reduce<unknown>(
        (current, part) =>
          current && typeof current === "object"
            ? Reflect.get(current, part)
            : undefined,
        en,
      ) ?? key;
  return String(value).replace(/\{(\w+)\}/g, (_, name) =>
    String(params[name] ?? ""),
  );
};

type BoundaryEvent = {
  target: Element;
  preventDefault: () => void;
  stopPropagation: () => void;
};
// Native Vue model directives and the real PGButton run against this DOM boundary.
class Element {
  props: Record<string, unknown> = {};
  children: Element[] = [];
  parent: Element | null = null;
  text = "";
  value = "";
  checked = false;
  selected = false;
  multiple = false;
  listeners: Record<string, (event: BoundaryEvent) => void> = {};
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
  get selectedIndex() {
    return this.options.findIndex((option) => option.selected);
  }
  set selectedIndex(index: number) {
    this.options.forEach((option, position) => {
      option.selected = position === index;
    });
  }
  addEventListener(name: string, listener: (event: BoundaryEvent) => void) {
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
    node.children = [];
  },
  parentNode: (node) => node.parent,
  nextSibling: (node) =>
    node.parent?.children[node.parent.children.indexOf(node) + 1] ?? null,
  patchProp: (node, key, _old, value: unknown) => {
    node.props[key] = value;
    if (key === "value") {
      node.value = String(value ?? "");
      Reflect.set(node, "_value", value);
    }
    if (key === "checked") node.checked = Boolean(value);
    if (key === "selected") node.selected = Boolean(value);
    if (key === "multiple") node.multiple = Boolean(value);
  },
  insert: (node, parent, anchor) => {
    if (node.parent)
      node.parent.children.splice(node.parent.children.indexOf(node), 1);
    node.parent = parent;
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, node);
  },
  remove: (node) => {
    if (node.parent)
      node.parent.children.splice(node.parent.children.indexOf(node), 1);
    node.parent = null;
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
function button(root: Element, key: string) {
  return all(root).find(
    (node) => node.type === "button" && text(node).trim() === t(key),
  );
}
function textarea(root: Element) {
  const node = all(root).find((node) => node.type === "textarea");
  expect(node).toBeDefined();
  return node!;
}
async function event(node: Element, name: string) {
  const value: BoundaryEvent = {
    target: node,
    preventDefault() {},
    stopPropagation() {},
  };
  node.listeners[name]?.(value);
  const handler = node.props[`on${name[0]!.toUpperCase()}${name.slice(1)}`];
  if (typeof handler === "function") await handler(value);
  await Vue.nextTick();
}
async function typeQuestion(root: Element, value: string) {
  const input = textarea(root);
  input.value = value;
  await event(input, "input");
}
async function submit(root: Element) {
  const form = all(root).find((node) => node.type === "form");
  expect(form).toBeDefined();
  await event(form!, "submit");
}
async function click(root: Element, key: string) {
  const control = button(root, key);
  expect(control).toBeDefined();
  expect(control!.props.disabled).not.toBe(true);
  await event(control!, "click");
  if (control!.props.type === "submit") await submit(root);
}
function mutations() {
  return api.mock.calls.filter(([, options]) => options?.method === "POST");
}
function reply(question: string): Experience {
  return {
    ...structuredClone(view),
    revision: view.revision + 1,
    turns: [
      ...view.turns,
      {
        id: `visitor-${view.revision}`,
        role: "visitor",
        stop_id: "",
        subject_place_id: null,
        kind: "conversation",
        fact_ids: [],
        text: question,
        source_ids: [],
        created_at: "2026-10-12",
      },
      {
        id: `guide-${view.revision}`,
        role: "guide",
        stop_id: "",
        subject_place_id: null,
        kind: "conversation",
        fact_ids: [],
        text: `Reply to ${question}`,
        source_ids: [],
        created_at: "2026-10-12",
      },
    ],
  };
}
async function mount(
  options: {
    generation?: Vue.Ref<string | null>;
    requestBusy?: Vue.Ref<boolean>;
    beforeVisitorAction?: () => Promise<void>;
  } = {},
) {
  await useExperienceStore().load("tour", "owner", options.generation?.value);
  const root = new Element("root");
  const app = renderer.createApp({
    setup: () => () =>
      Vue.h(CurrentStopExperience, {
        tourId: "tour",
        generationId: options.generation?.value,
        requestBusy: options.requestBusy?.value,
        beforeVisitorAction: options.beforeVisitorAction,
      }),
  });
  app.config.globalProperties.$t = t;
  app.component("PGButton", PGButton);
  app.mount(root);
  cleanups.push(() => app.unmount());
  await vi.waitFor(() => {
    const surface = all(root).find((node) => "aria-busy" in node.props);
    expect(surface?.props["aria-busy"]).toBe(false);
  });
  return root;
}
beforeEach(() => {
  auth.user = Vue.ref({ uid: "owner" });
  visibility = undefined;
  geolocation.read.mockClear();
  view = {
    schema_version: 1,
    revision: 3,
    generation_id: null,
    stop_id: "museum",
    stop_name: "Museum",
    stops: [
      { id: "museum", name: "Museum" },
      { id: "square", name: "Square" },
    ],
    location_status: "USER_SELECTED",
    activity: null,
    cue_id: null,
    personal_context: emptyPersonalContext(),
    available_actions: ["ASK_GENERAL", "ASK", "ANSWER"],
    cues: [],
    remaining_minutes: null,
    limitation: null,
    turns: [],
    sources: [],
  };
  api = vi.fn(async (_url: string, options?: RequestOptions) => {
    if (options?.method === "POST") view = reply(options.body.text ?? "");
    return structuredClone(view);
  });
  Object.assign(globalThis, {
    ...Vue,
    Document: class {},
    ShadowRoot: class {},
    useNuxtApp: () => ({ $apiFetch: api }),
    useI18n: () => ({ t, locale: Vue.ref("en") }),
    document: {
      hidden: false,
      addEventListener: (name: string, callback: () => void) => {
        if (name === "visibilitychange") visibility = callback;
      },
      removeEventListener: (name: string) => {
        if (name === "visibilitychange") visibility = undefined;
      },
    },
  });
});
afterEach(() => {
  cleanups.splice(0).forEach((dispose) => dispose());
});

it("submits an unbound question without public-subject or location controls", async () => {
  const root = await mount();
  expect(
    all(root)
      .filter((node) => node.type === "button")
      .map((node) => text(node).trim()),
  ).toEqual([t("experience.ask")]);
  await typeQuestion(root, "Why is the sky blue?");
  expect(button(root, "experience.ask")?.props.disabled).toBe(false);
  await click(root, "experience.ask");
  expect(mutations()).toHaveLength(1);
  expect(mutations()[0]?.[0]).toBe("/api/tour-interactions/tour");
  expect(mutations()[0]?.[1]?.body).toEqual({
    action: "ASK_GENERAL",
    text: "Why is the sky blue?",
    type_llm: "DEFAULT",
    expected_revision: 3,
    generation_id: null,
  });
  expect(text(root)).toContain("Reply to Why is the sky blue?");
  expect(textarea(root).value).toBe("");
  expect(geolocation.read).not.toHaveBeenCalled();
});

it("does not target a preselected stop or answer an active guide question", async () => {
  view.activity = "QUESTION";
  view.cue_id = "observation-prompt";
  view.turns = [
    {
      id: "prompt",
      role: "guide",
      stop_id: "museum",
      text: "What do you notice?",
      source_ids: [],
      created_at: "2026-10-12",
    },
  ];
  const root = await mount();
  await typeQuestion(root, "How do rainbows form?");
  await submit(root);
  expect(mutations()[0]?.[1]?.body).toEqual({
    action: "ASK_GENERAL",
    text: "How do rainbows form?",
    type_llm: "DEFAULT",
    expected_revision: 3,
    generation_id: null,
  });
  expect(useExperienceStore().view).toMatchObject({
    stop_id: "museum",
    activity: "QUESTION",
    cue_id: "observation-prompt",
  });
  expect(text(root)).toContain("What do you notice?");
  expect(text(root)).toContain("Reply to How do rainbows form?");
  expect(textarea(root).value).toBe("");
});

it("blocks empty and whitespace questions without issuing a mutation", async () => {
  const root = await mount();
  expect(button(root, "experience.ask")?.props.disabled).toBe(true);
  await submit(root);
  await typeQuestion(root, " \n ");
  expect(button(root, "experience.ask")?.props.disabled).toBe(true);
  await submit(root);
  expect(mutations()).toHaveLength(0);
});

it("keeps a draft while an external tour request blocks sending", async () => {
  const requestBusy = Vue.ref(true);
  const root = await mount({ requestBusy });
  await typeQuestion(root, "My next question");
  expect(button(root, "experience.ask")?.props.disabled).toBe(true);
  await submit(root);
  expect(mutations()).toHaveLength(0);
  expect(textarea(root).value).toBe("My next question");
  requestBusy.value = false;
  await Vue.nextTick();
  await submit(root);
  expect(text(root)).toContain("Reply to My next question");
});

it("asks without selecting a stop even when route stops are available", async () => {
  view.stop_id = null;
  view.stop_name = null;
  const root = await mount();
  await typeQuestion(root, "How do I learn a new language?");
  expect(button(root, "experience.ask")?.props.disabled).toBe(false);
  expect(all(root).some((node) => node.type === "select")).toBe(false);
  await submit(root);
  expect(mutations()[0]?.[1]?.body).toEqual({
    action: "ASK_GENERAL",
    text: "How do I learn a new language?",
    type_llm: "DEFAULT",
    expected_revision: 3,
    generation_id: null,
  });
  expect(useExperienceStore().view?.stop_id).toBeNull();
  expect(text(root)).toContain("Reply to How do I learn a new language?");
});

it("allows general questions with no current stop and an empty route", async () => {
  view.stop_id = null;
  view.stop_name = null;
  view.stops = [];
  const root = await mount();
  await typeQuestion(root, "What is a prime number?");
  expect(button(root, "experience.ask")?.props.disabled).toBe(false);
  expect(all(root).some((node) => node.type === "select")).toBe(false);
  await submit(root);
  expect(mutations()).toHaveLength(1);
  expect(mutations()[0]?.[1]?.body).toEqual({
    action: "ASK_GENERAL",
    text: "What is a prime number?",
    type_llm: "DEFAULT",
    expected_revision: 3,
    generation_id: null,
  });
  expect(text(root)).toContain("Reply to What is a prime number?");
  expect(textarea(root).value).toBe("");
});

it("retains newer text typed during a delayed general send with a selected stop and activity", async () => {
  view.activity = "QUESTION";
  view.cue_id = "active-question";
  const root = await mount();
  await typeQuestion(root, "First question");
  const delayed = Promise.withResolvers<Experience>();
  api.mockImplementationOnce(() => delayed.promise);
  const sending = submit(root);
  await vi.waitFor(() => expect(mutations()).toHaveLength(1));
  expect(mutations()[0]?.[1]?.body).toEqual({
    action: "ASK_GENERAL",
    text: "First question",
    type_llm: "DEFAULT",
    expected_revision: 3,
    generation_id: null,
  });
  expect(button(root, "experience.ask")?.props.disabled).toBe(true);
  await typeQuestion(root, "Newer question");
  await submit(root);
  expect(mutations()).toHaveLength(1);
  delayed.resolve(reply("First question"));
  await sending;
  expect(text(root)).toContain("Reply to First question");
  expect(textarea(root).value).toBe("Newer question");
  expect(useExperienceStore().view).toMatchObject({
    stop_id: "museum",
    activity: "QUESTION",
    cue_id: "active-question",
  });
});

it("retains a failed request draft and retries the original payload and operation key", async () => {
  const root = await mount();
  await typeQuestion(root, "An uncertain question");
  api.mockRejectedValueOnce(new Error("Connection interrupted"));
  await submit(root);
  expect(textarea(root).value).toBe("An uncertain question");
  expect(text(root)).toContain(t("experience.failed"));
  expect(button(root, "experience.ask")?.props.disabled).toBe(true);
  const original = structuredClone(mutations()[0]?.[1]);
  await typeQuestion(root, "A newer draft");
  await click(root, "experience.retry");
  await vi.waitFor(() =>
    expect(text(root)).toContain("Reply to An uncertain question"),
  );
  expect(mutations()[1]?.[1]).toEqual(original);
  expect(textarea(root).value).toBe("A newer draft");
  expect(useExperienceStore().hasPending).toBe(false);
});

it("blocks sending and retrying an uncertain question until reconciliation succeeds", async () => {
  const root = await mount();
  await typeQuestion(root, "Pending question");
  api.mockRejectedValueOnce(new Error("Connection interrupted"));
  await submit(root);
  useExperienceStore().invalidate("tour");
  await Vue.nextTick();
  expect(button(root, "experience.ask")?.props.disabled).toBe(true);
  expect(button(root, "experience.retry")?.props.disabled).toBe(true);
  expect(text(root)).toContain(t("experience.reconcileRequired"));
  const calls = mutations().length;
  await submit(root);
  expect(mutations()).toHaveLength(calls);
  visibility?.();
  await vi.waitFor(() =>
    expect(button(root, "experience.retry")?.props.disabled).toBe(false),
  );
  expect(useExperienceStore().hasPending).toBe(true);
});

it("reconciles visibility reads without discarding or changing an unknown action", async () => {
  const root = await mount();
  await typeQuestion(root, "Unknown outcome");
  api.mockRejectedValueOnce(new Error("Lost response"));
  await submit(root);
  const original = structuredClone(mutations()[0]?.[1]);
  view = { ...reply("A separately confirmed question"), revision: 5 };
  visibility?.();
  await vi.waitFor(() =>
    expect(text(root)).toContain("Reply to A separately confirmed question"),
  );
  expect(useExperienceStore().hasPending).toBe(true);
  expect(textarea(root).value).toBe("Unknown outcome");
  expect(button(root, "experience.ask")?.props.disabled).toBe(true);
  await click(root, "experience.retry");
  await vi.waitFor(() => expect(useExperienceStore().hasPending).toBe(false));
  expect(mutations()[1]?.[1]).toEqual(original);
});

it("clears an unchanged question only after its retry is confirmed", async () => {
  const root = await mount();
  await typeQuestion(root, "Retry this question");
  api.mockRejectedValueOnce(new Error("Lost response"));
  await submit(root);
  expect(textarea(root).value).toBe("Retry this question");
  await click(root, "experience.retry");
  await vi.waitFor(() =>
    expect(text(root)).toContain("Reply to Retry this question"),
  );
  await vi.waitFor(() => expect(textarea(root).value).toBe(""));
});

it("lets explicit Reload discard an uncertain operation without discarding the draft", async () => {
  const root = await mount();
  await typeQuestion(root, "Keep this question");
  api.mockRejectedValueOnce(new Error("Lost response"));
  await submit(root);
  await click(root, "experience.refresh");
  await vi.waitFor(() =>
    expect(button(root, "experience.ask")?.props.disabled).toBe(false),
  );
  expect(useExperienceStore().hasPending).toBe(false);
  expect(textarea(root).value).toBe("Keep this question");
  expect(button(root, "experience.ask")?.props.disabled).toBe(false);
  expect(mutations()).toHaveLength(1);
});

it("cancels a question before mutation when beforeVisitorAction rejects", async () => {
  const beforeVisitorAction = vi.fn(async () => {
    throw new Error("Visitor action cancelled");
  });
  const root = await mount({ beforeVisitorAction });
  await typeQuestion(root, "Not sent");
  await submit(root);
  expect(beforeVisitorAction).toHaveBeenCalledOnce();
  expect(mutations()).toHaveLength(0);
  expect(textarea(root).value).toBe("Not sent");
});

it("fences preflight cancellation across an account change", async () => {
  const gate = Promise.withResolvers<void>();
  const root = await mount({ beforeVisitorAction: () => gate.promise });
  await typeQuestion(root, "Old account question");
  const pending = submit(root);
  await Vue.nextTick();
  view = {
    ...view,
    turns: [
      {
        id: "new-owner",
        role: "guide",
        stop_id: "museum",
        text: "New account reply",
        source_ids: [],
        created_at: "2026-10-12",
      },
    ],
  };
  auth.user!.value = { uid: "new-owner" };
  await vi.waitFor(() => expect(text(root)).toContain("New account reply"));
  await typeQuestion(root, "New account draft");
  gate.resolve();
  await pending;
  expect(mutations()).toHaveLength(0);
  expect(textarea(root).value).toBe("New account draft");
  expect(text(root)).not.toContain(t("experience.failed"));
});

it("does not render an old account's delayed reply or clear the new account draft", async () => {
  const root = await mount();
  await typeQuestion(root, "Old owner's question");
  const delayed = Promise.withResolvers<Experience>();
  const oldReply = reply("Old owner's question");
  api.mockImplementationOnce(() => delayed.promise);
  const pending = submit(root);
  await vi.waitFor(() => expect(mutations()).toHaveLength(1));
  view = {
    ...view,
    turns: [
      {
        id: "new-owner",
        role: "guide",
        stop_id: "museum",
        text: "New owner's history",
        source_ids: [],
        created_at: "2026-10-12",
      },
    ],
  };
  auth.user!.value = { uid: "new-owner" };
  await vi.waitFor(() => expect(text(root)).toContain("New owner's history"));
  await typeQuestion(root, "New owner's draft");
  delayed.resolve(oldReply);
  await pending;
  expect(text(root)).not.toContain("Reply to Old owner's question");
  expect(textarea(root).value).toBe("New owner's draft");
});

it("reloads accepted generations and supersedes old question retries without comparing package revisions", async () => {
  const generation = Vue.ref<string | null>("old-package");
  view.generation_id = generation.value;
  view.revision = 12;
  view.turns = [
    {
      id: "old",
      role: "guide",
      stop_id: "museum",
      text: "Old package reply",
      source_ids: ["archive"],
      created_at: "2026-10-12",
    },
  ];
  view.sources = [
    {
      id: "archive",
      title: "Old package archive",
      url: "https://example.org/old-package",
      checked_at: "2026-10-12",
    },
  ];
  const root = await mount({ generation });
  await typeQuestion(root, "Old package question");
  api.mockRejectedValueOnce(new Error("Lost text action response"));
  await submit(root);
  expect(useExperienceStore().hasPending).toBe(true);
  const reload = Promise.withResolvers<Experience>();
  api.mockImplementationOnce(() => reload.promise);
  generation.value = "accepted-package";
  await Vue.nextTick();
  expect(useExperienceStore().view).toBeNull();
  expect(useExperienceStore().hasPending).toBe(false);
  expect(text(root)).not.toContain("Old package reply");
  view = {
    ...view,
    generation_id: generation.value,
    revision: 0,
    turns: [
      {
        id: "accepted",
        role: "guide",
        stop_id: "museum",
        text: "Accepted package reply",
        source_ids: ["archive"],
        created_at: "2026-10-12",
      },
    ],
    sources: [],
  };
  reload.resolve(structuredClone(view));
  await vi.waitFor(() =>
    expect(text(root)).toContain("Accepted package reply"),
  );
  expect(useExperienceStore().view?.revision).toBe(0);
  expect(text(root)).toContain(t("experience.earlierSourcesUnavailable"));
  expect(
    all(root).some(
      (node) => node.props.href === "https://example.org/old-package",
    ),
  ).toBe(false);
  await typeQuestion(root, "Accepted package question");
  await submit(root);
  expect(mutations().at(-1)?.[1]?.body).toMatchObject({
    action: "ASK_GENERAL",
    text: "Accepted package question",
    generation_id: "accepted-package",
    expected_revision: 0,
  });
  expect(text(root)).toContain("Reply to Accepted package question");
});

it("ignores an old generation's delayed reply while retaining the accepted generation draft", async () => {
  const generation = Vue.ref<string | null>("old-package");
  view.generation_id = generation.value;
  const root = await mount({ generation });
  await typeQuestion(root, "Old generation question");
  const delayed = Promise.withResolvers<Experience>();
  const oldReply = reply("Old generation question");
  api.mockImplementationOnce(() => delayed.promise);
  const pending = submit(root);
  await vi.waitFor(() => expect(mutations()).toHaveLength(1));
  view = { ...view, generation_id: "accepted-package", revision: 0, turns: [] };
  generation.value = "accepted-package";
  await vi.waitFor(() =>
    expect(useExperienceStore().view?.generation_id).toBe("accepted-package"),
  );
  await typeQuestion(root, "Accepted generation draft");
  delayed.resolve(oldReply);
  await pending;
  expect(text(root)).not.toContain("Reply to Old generation question");
  expect(textarea(root).value).toBe("Accepted generation draft");
});

it("keeps questions blocked after an accepted-generation reload fails and recovers on Reload", async () => {
  const generation = Vue.ref<string | null>("old-package");
  view.generation_id = generation.value;
  const root = await mount({ generation });
  api.mockRejectedValueOnce(new Error("Offline"));
  generation.value = "accepted-package";
  await vi.waitFor(() => expect(text(root)).toContain(t("experience.failed")));
  await typeQuestion(root, "Question after reload");
  expect(button(root, "experience.ask")?.props.disabled).toBe(true);
  await submit(root);
  expect(mutations()).toHaveLength(0);
  view = { ...view, generation_id: generation.value, revision: 0 };
  await click(root, "experience.refresh");
  await vi.waitFor(() =>
    expect(button(root, "experience.ask")?.props.disabled).toBe(false),
  );
  expect(textarea(root).value).toBe("Question after reload");
  await submit(root);
  expect(mutations()[0]?.[1]?.body).toMatchObject({
    action: "ASK_GENERAL",
    generation_id: "accepted-package",
    expected_revision: 0,
  });
  expect(text(root)).toContain("Reply to Question after reload");
});

it("shows exact-place external reviews without presenting them as historical citations", async () => {
  const url =
    "https://www.google.com/maps/search/?api=1&query=1%2C2&query_place_id=exact-pin";
  view.sources = [
    {
      id: "google_maps_reviews:exact-pin",
      title: "Google Maps — place and visitor reviews",
      url,
      checked_at: null,
      kind: "external_review_link",
      attribution: "Google Maps",
    },
  ];
  const root = await mount();
  const link = all(root).find(
    (node) => node.type === "a" && node.props.href === url,
  );
  expect(link).toBeDefined();
  expect(link!.props.rel).toBe("noopener noreferrer");
  expect(link!.props.target).toBe("_blank");
  expect(text(link!)).toContain("Google Maps");
  expect(
    all(link!).find((node) => node.props.translate === "no")?.text,
  ).toBe("Google Maps");
  expect(text(root)).toContain(t("experience.externalReviewsNotice"));
  expect(view.turns).toEqual([]);
  expect(mutations()).toHaveLength(0);

  view.sources = [];
  await useExperienceStore().load("tour", "owner");
  await Vue.nextTick();
  expect(
    all(root).some((node) => node.type === "a" && node.props.href === url),
  ).toBe(false);
  expect(text(root)).not.toContain(t("experience.externalReviewsNotice"));
});
