import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRenderer,
  createSSRApp,
  defineComponent,
  h,
  getCurrentInstance,
  nextTick,
  onMounted,
  markRaw,
  onUnmounted,
  reactive,
} from "vue";
import { renderToString } from "@vue/server-renderer";
import App from "../app/app.vue";
import NotificationModal from "../app/components/ui/NotificationModal.vue";
import ModalOverlay from "../app/components/base/ModalOverlay.vue";
import { useNotification } from "../app/composables/ui/useNotification";

// Vue owns component rendering; only the unavailable browser host is replaced.
vi.mock("vue", async (original) => {
  const vue = await original<typeof import("vue")>();
  return {
    ...vue,
    Transition: (_: unknown, { slots }: any) => slots.default?.(),
  };
});

const t = (key: string, values: Record<string, unknown> = {}) =>
  `${key}${Object.keys(values).length ? ` ${JSON.stringify(values)}` : ""}`;
let body: HostElement;
let documentHost: { body: HostElement; activeElement: HostElement | null };
const cleanup: (() => void)[] = [];

class HostElement {
  children: HostElement[] = [];
  parent: HostElement | null = null;
  props: Record<string, any> = {};
  style = { overflow: "" };
  constructor(public tag: string) {
    markRaw(this);
  }
  matches(selector: string) {
    return selector === ":disabled" && this.disabled;
  }
  get disabled() {
    return !!this.props.disabled;
  }
  get tabIndex() {
    return Number(this.props.tabindex ?? (this.tag === "button" ? 0 : -1));
  }
  get isConnected(): boolean {
    return this === body || !!this.parent?.isConnected;
  }
  focus() {
    documentHost.activeElement = this;
  }
  getAttribute(key: string) {
    return this.props[key] ?? null;
  }
  hasAttribute(key: string) {
    return this.props[key] != null && this.props[key] !== false;
  }
  getClientRects() {
    return this.props.hidden ? [] : [{}];
  }
  contains(node: HostElement | null): boolean {
    return this === node || this.children.some((child) => child.contains(node));
  }
  closest() {
    return this.props.hidden || this.props.inert
      ? this
      : this.parent?.closest();
  }
  querySelectorAll() {
    const all: HostElement[] = [];
    const visit = (node: HostElement) => {
      for (const child of node.children) {
        if (
          ["button", "input", "select", "textarea", "a"].includes(child.tag) ||
          child.hasAttribute("tabindex")
        )
          all.push(child);
        visit(child);
      }
    };
    visit(this);
    return all;
  }
}

const renderer = createRenderer<HostElement, HostElement>({
  createElement: (tag) => new HostElement(tag),
  createText: () => new HostElement("text"),
  createComment: () => new HostElement("comment"),
  setText: () => {},
  setElementText: () => {},
  parentNode: (node) => node.parent,
  nextSibling: (node) =>
    node.parent?.children[node.parent.children.indexOf(node) + 1] ?? null,
  patchProp: (node, key, _old, value) => {
    node.props[key] = value;
  },
  insert: (node, parent, anchor) => {
    if (node.parent)
      node.parent.children.splice(node.parent.children.indexOf(node), 1);
    node.parent = parent;
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, node);
  },
  remove: (node) => {
    node.parent?.children.splice(node.parent.children.indexOf(node), 1);
    node.parent = null;
  },
  querySelector: () => body,
});

function mount(component: any, props: any, slots?: any) {
  const app = renderer.createApp({ render: () => h(component, props, slots) });
  app.component("UIcon", defineComponent({ render: () => h("span") }));
  if (component === App) {
    const passthrough = defineComponent({
      inheritAttrs: false,
      setup:
        (_, { slots }) =>
        () =>
          slots.default?.(),
    });
    for (const name of ["UApp", "NuxtLayout", "NuxtPage", "AuthLoader"])
      app.component(name, passthrough);
    app.component("NotificationModal", NotificationModal);
  }
  const container = new HostElement("root");
  container.parent = body;
  app.mount(container);
  cleanup.push(() => app.unmount());
  return app;
}
function overlay() {
  return body.children.find(
    (node) => node.props.role === "dialog" || node.props.role === "alertdialog",
  )!;
}
function key(value: string, shiftKey = false) {
  const event = {
    key: value,
    shiftKey,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  };
  overlay().props.onKeydown(event);
  return event;
}

beforeEach(() => {
  body = new HostElement("body");
  documentHost = { body, activeElement: null };
  Object.assign(globalThis, {
    document: documentHost,
    onMounted,
    onUnmounted,
    nextTick,
    useI18n: () => ({ t }),
  });
  mount(
    defineComponent({
      setup() {
        useNotification();
        return () => null;
      },
    }),
    {},
  );
  useNotification().hideNotification();
});
afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose());
  vi.useRealTimers();
});

describe("notification policy", () => {
  it("uses the captured translator outside setup and follows locale changes", async () => {
    let locale = "en";
    Object.assign(globalThis, {
      useI18n: () => {
        if (!getCurrentInstance())
          throw new Error("I18n requires component setup");
        return { t: (key: string) => `${locale}:${key}` };
      },
    });
    mount(App, {});
    const notification = useNotification();
    notification.showError({});
    expect(notification.notification.value.title).toBe(
      "en:notifications.errorTitle",
    );
    locale = "ru";
    notification.showError({});
    expect(notification.notification.value.title).toBe(
      "ru:notifications.errorTitle",
    );
    await nextTick();
  });
  it("honors secondary close policy through the app without interfering with later auto-close", async () => {
    vi.useFakeTimers();
    const notification = useNotification();
    notification.showInfo({
      showSecondaryAction: true,
      closeOnSecondaryAction: false,
      autoClose: true,
      autoCloseDuration: 100,
    });
    mount(App, {});
    await nextTick();
    const buttons = overlay()
      .querySelectorAll()
      .filter((node) => node.tag === "button");
    buttons[0]!.props.onClick();
    expect(notification.notification.value.open).toBe(true);
    vi.advanceTimersByTime(100);
    expect(notification.notification.value.open).toBe(false);
  });

  it("keeps callback replacements open through the app and closes actions once", async () => {
    const notification = useNotification();
    const close = vi.fn();
    notification.showInfo({
      onClose: close,
      onPrimaryAction: () => notification.showError({ message: "Replacement" }),
    });
    mount(App, {});
    await nextTick();
    overlay()
      .querySelectorAll()
      .find((node) => node.tag === "button")!
      .props.onClick();
    await nextTick();
    expect(notification.notification.value.open).toBe(true);
    expect(notification.notification.value.message).toBe("Replacement");
    expect(close).not.toHaveBeenCalled();
    notification.showInfo({ onClose: close });
    await nextTick();
    overlay()
      .querySelectorAll()
      .find((node) => node.tag === "button")!
      .props.onClick();
    expect(close).toHaveBeenCalledExactlyOnceWith("primary-action");
  });

  it("retains a secondary action notification when closing is disabled", () => {
    const notification = useNotification();
    let handled = false;
    notification.showInfo({
      closeOnSecondaryAction: false,
      onSecondaryAction: () => {
        handled = true;
      },
    });
    notification.handleSecondaryAction();
    expect(handled).toBe(true);
    expect(notification.notification.value.open).toBe(true);
  });

  it("does not dismiss a replacement notification opened by a callback", () => {
    const notification = useNotification();
    notification.showInfo({
      onSecondaryAction: () =>
        notification.showError({ message: "Replacement" }),
    });
    notification.handleSecondaryAction();
    expect(notification.notification.value.open).toBe(true);
    expect(notification.notification.value.message).toBe("Replacement");
  });

  it("localizes defaults and never displays private response bodies or exception text", () => {
    const notification = useNotification();
    notification.showApiError(
      {
        message: "Private visitor question",
        stack: "secret stack",
        response: {
          status: 500,
          statusText: "Provider secret",
          data: { request: { visitor_message: "private" } },
          headers: new Headers({ "x-request-id": "safe-id" }),
        },
      },
      "Could not plan the route",
    );
    const state = notification.notification.value;
    expect(state.title).toBe("notifications.errorTitle");
    expect(state.message).toBe("notifications.errorMessage");
    expect(state.subtitle).toContain("notifications.contextPlanRoute");
    expect(state.details).toContain("500");
    expect(state.details).toContain("safe-id");
    expect(JSON.stringify(state)).not.toMatch(
      /Private|private|secret|Provider/,
    );
  });

  it("forwards loading and auto-close options through the application shell", async () => {
    useNotification().showInfo({
      primaryButtonLoading: true,
      autoClose: true,
      autoCloseDuration: 12,
      closeOnSecondaryAction: false,
    });
    const app = createSSRApp(App);
    const passthrough = defineComponent({
      inheritAttrs: false,
      setup:
        (_, { slots }) =>
        () =>
          slots.default?.(),
    });
    for (const name of ["UApp", "NuxtLayout", "NuxtPage", "AuthLoader"])
      app.component(name, passthrough);
    app.component("NotificationModal", NotificationModal);
    app.component("UIcon", passthrough);
    const context: any = {};
    await renderToString(app, context);
    expect(context.teleports.body).toContain("disabled");
  });
});

describe("modal keyboard and cleanup", () => {
  it("focuses an initial-open modal and cycles through details plus enabled actions", async () => {
    const trigger = new HostElement("button");
    trigger.parent = body;
    trigger.focus();
    body.style.overflow = "scroll";
    const props = reactive({
      open: true,
      type: "error",
      title: "Error",
      message: "Try again",
      details: "Status 500",
      showSecondaryAction: true,
    });
    mount(NotificationModal, props);
    await nextTick();
    const buttons = overlay()
      .querySelectorAll()
      .filter((node) => node.tag === "button");
    expect(buttons).toHaveLength(3);
    expect(documentHost.activeElement).toBe(buttons[2]);
    expect(body.style.overflow).toBe("hidden");
    const tab = key("Tab");
    expect(tab.preventDefault).toHaveBeenCalledOnce();
    expect(documentHost.activeElement).toBe(buttons[0]);
    key("Tab", true);
    expect(documentHost.activeElement).toBe(buttons[2]);
    props.open = false;
    await nextTick();
    expect(documentHost.activeElement).toBe(trigger);
    expect(body.style.overflow).toBe("scroll");
  });

  it("ignores disabled actions, closes with Escape and restores focus on unmount", async () => {
    const trigger = new HostElement("button");
    trigger.parent = body;
    trigger.focus();
    const closed: string[] = [];
    const props = reactive({
      open: true,
      type: "error",
      title: "Error",
      message: "Try again",
      details: "Status 500",
      primaryButtonLoading: true,
      onClose: (reason: string) => closed.push(reason),
    });
    const app = mount(NotificationModal, props);
    await nextTick();
    expect(documentHost.activeElement?.props.class).toBe("details-toggle");
    key("Tab");
    expect(documentHost.activeElement?.props.class).toBe("details-toggle");
    key("Escape");
    expect(closed).toEqual(["escape"]);
    app.unmount();
    cleanup.pop();
    expect(documentHost.activeElement).toBe(trigger);
    expect(body.style.overflow).toBe("");
  });

  it("contains keyboard focus even when a dialog has no enabled controls", async () => {
    mount(
      ModalOverlay,
      { open: true },
      { default: () => h("button", { disabled: true }) },
    );
    await nextTick();
    expect(documentHost.activeElement).toBe(overlay());
    expect(key("Tab").preventDefault).toHaveBeenCalledOnce();
  });
});

describe("notification timers", () => {
  it("does not schedule client timers during SSR", async () => {
    vi.useFakeTimers();
    const app = createSSRApp(NotificationModal, {
      open: true,
      type: "info",
      title: "Info",
      message: "Hello",
      autoClose: true,
      autoCloseDuration: 100,
    });
    app.component("UIcon", defineComponent({ render: () => h("span") }));
    await renderToString(app);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels auto-close immediately when an action closes the modal", async () => {
    vi.useFakeTimers();
    const close = vi.fn();
    mount(NotificationModal, {
      open: true,
      type: "info",
      title: "Info",
      message: "Hello",
      autoClose: true,
      autoCloseDuration: 100,
      onClose: close,
    });
    await nextTick();
    overlay()
      .querySelectorAll()
      .find((node) => node.tag === "button")!
      .props.onClick();
    vi.advanceTimersByTime(100);
    expect(close).toHaveBeenCalledExactlyOnceWith("primary-action");
  });
  it("applies auto-close through the app and calls onClose only once", async () => {
    vi.useFakeTimers();
    const close = vi.fn();
    useNotification().showInfo({
      autoClose: true,
      autoCloseDuration: 100,
      onClose: close,
    });
    mount(App, {});
    await nextTick();
    vi.advanceTimersByTime(100);
    expect(useNotification().notification.value.open).toBe(false);
    expect(close).toHaveBeenCalledExactlyOnceWith("primary-action");
  });

  it("restarts identical replacement notifications through the app", async () => {
    vi.useFakeTimers();
    const options = {
      message: "Hello",
      autoClose: true,
      autoCloseDuration: 100,
    };
    useNotification().showInfo(options);
    mount(App, {});
    await nextTick();
    vi.advanceTimersByTime(60);
    useNotification().showInfo(options);
    await nextTick();
    vi.advanceTimersByTime(40);
    expect(useNotification().notification.value.open).toBe(true);
    vi.advanceTimersByTime(60);
    expect(useNotification().notification.value.open).toBe(false);
  });

  it("auto-closes initial-open notifications", async () => {
    vi.useFakeTimers();
    const close = vi.fn();
    mount(NotificationModal, {
      open: true,
      type: "info",
      title: "Info",
      message: "Hello",
      autoClose: true,
      autoCloseDuration: 100,
      onClose: close,
    });
    await nextTick();
    vi.advanceTimersByTime(100);
    expect(close).toHaveBeenCalledWith("primary-action");
  });

  it("restarts replacement notifications and cancels timers when disabled or unmounted", async () => {
    vi.useFakeTimers();
    const close = vi.fn();
    const props = reactive({
      open: false,
      type: "info",
      title: "Info",
      message: "First",
      autoClose: true,
      autoCloseDuration: 100,
      onClose: close,
    });
    const app = mount(NotificationModal, props);
    props.open = true;
    await nextTick();
    vi.advanceTimersByTime(60);
    props.message = "Replacement";
    await nextTick();
    vi.advanceTimersByTime(40);
    expect(close).not.toHaveBeenCalled();
    props.autoClose = false;
    await nextTick();
    vi.advanceTimersByTime(100);
    expect(close).not.toHaveBeenCalled();
    props.autoClose = true;
    await nextTick();
    app.unmount();
    cleanup.pop();
    vi.advanceTimersByTime(100);
    expect(close).not.toHaveBeenCalled();
  });
});
