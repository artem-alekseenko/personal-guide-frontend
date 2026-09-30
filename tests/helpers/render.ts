import { createRenderer, h, reactive, type Component } from "vue";

export interface TestNode {
  type: string;
  props: Record<string, any>;
  style: Record<string, any>;
  children: TestNode[];
  parent?: TestNode;
  text: string;
  scrollHeight: number;
  classList: {
    contains: (name: string) => boolean;
    add: (...names: string[]) => void;
    remove: (...names: string[]) => void;
  };
}
function node(type: string, text = ""): TestNode {
  const el: any = { type, text, props: {}, style: {}, children: [] };
  el.classList = {
    contains: (name: string) =>
      String(el.props.class ?? "")
        .split(" ")
        .includes(name),
    add: (...names: string[]) => {
      el.props.class = [
        ...new Set([...String(el.props.class ?? "").split(" "), ...names]),
      ].join(" ");
    },
    remove: (...names: string[]) => {
      el.props.class = String(el.props.class ?? "")
        .split(" ")
        .filter((name) => !names.includes(name))
        .join(" ");
    },
  };
  Object.defineProperty(el, "scrollHeight", {
    get: () => Math.max(24, Math.ceil(el.text.length / 30) * 24),
    configurable: true,
  });
  return el;
}
const renderer = createRenderer<TestNode, TestNode>({
  createElement: (type) => node(type),
  createText: (text) => node("#text", text),
  createComment: (text) => node("#comment", text),
  setText: (el, text) => {
    el.text = text;
  },
  setElementText: (el, text) => {
    el.text = text;
  },
  parentNode: (el) => el.parent ?? null,
  nextSibling: (el) =>
    el.parent?.children[el.parent.children.indexOf(el) + 1] ?? null,
  patchProp: (el, key, _old, value) => {
    el.props[key] = value;
  },
  insert: (el, parent, anchor) => {
    if (el.parent)
      el.parent.children = el.parent.children.filter((child) => child !== el);
    el.parent = parent;
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    if (index < 0) parent.children.push(el);
    else parent.children.splice(index, 0, el);
  },
  remove: (el) => {
    if (el.parent)
      el.parent.children = el.parent.children.filter((child) => child !== el);
  },
});
export function findAll(
  root: TestNode,
  predicate: (node: TestNode) => boolean,
): TestNode[] {
  return [
    ...(predicate(root) ? [root] : []),
    ...root.children.flatMap((child) => findAll(child, predicate)),
  ];
}
export function mount(
  component: Component,
  props: Record<string, any> = {},
  components: Record<string, Component> = {},
  t: (key: string) => string = (key) => key,
) {
  const root = node("root");
  const state = reactive(props);
  const app = renderer.createApp({ render: () => h(component, state) });
  app.config.globalProperties.$t = t;
  for (const [name, stub] of Object.entries(components))
    app.component(name, stub);
  const vm = app.mount(root);
  return { root, props: state, vm, unmount: () => app.unmount() };
}
