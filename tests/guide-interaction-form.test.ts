import { expect, it } from "vitest";
import { createSSRApp, type ComponentInternalInstance, type VNode } from "vue";
import { renderToString } from "@vue/server-renderer";
import PersonalContextForm from "../app/components/tour/PersonalContextForm.vue";
import BaseSelector from "../app/components/base/BaseSelector.vue";
import { emptyPersonalContext } from "../app/types/personalContext";
import en from "../i18n/locales/en.json";
import ru from "../i18n/locales/ru.json";

async function render(messages: typeof en | typeof ru, guideMode?: string) {
  const t = (key: string, params: Record<string, string> = {}) =>
    String(
      key.split(".").reduce((value: any, part) => value?.[part], messages) ??
        key,
    ).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? "");
  Object.assign(globalThis, { useI18n: () => ({ t }) });
  const app = createSSRApp(PersonalContextForm, {
    modelValue: { ...emptyPersonalContext(), enabled: false },
    guideMode,
  });
  app.component("BaseSelector", BaseSelector);
  app.config.globalProperties.$t = t;
  return renderToString(app);
}
it.each([
  [en, "Guide's style", "Explore together", "Just guide me"],
  [ru, "Стиль гида", "Исследовать вместе", "Просто рассказывайте"],
])(
  "offers translated interaction choices even without personal memory",
  async (messages, guide, interactive, leading) => {
    const html = await render(messages as typeof en);
    expect(html).toContain("<select");
    expect(html).toContain(String(guide).replaceAll("'", "&#39;"));
    expect(html).toContain(String(interactive));
    expect(html).toContain(String(leading));
    expect(html).toMatch(/<select[^>]*value="guide"/);
  },
);
it("shows the supplied guide default without replacing the stored guide preference", async () => {
  const html = await render(en, "leading");
  expect(html).toContain("Guide&#39;s style: Just guide me");
  expect(html).toMatch(/<select[^>]*value="guide"/);
});

it("changes only the interaction preference through the selector's model event", async () => {
  const original = {
    ...emptyPersonalContext(),
    enabled: false,
    interests: ["engineering"],
    excluded_topics: ["politics"],
    purpose: "Observe the bridges",
    note: "Keep this note",
    step_free: true,
    pace: "relaxed" as const,
  };
  let updated: unknown;
  let instance!: ComponentInternalInstance;
  Object.assign(globalThis, { useI18n: () => ({ t: (key: string) => key }) });
  const app = createSSRApp(PersonalContextForm, {
    modelValue: original,
    "onUpdate:modelValue": (value: unknown) => {
      updated = value;
    },
  });
  app.component("BaseSelector", BaseSelector);
  app.config.globalProperties.$t = (key: string) => key;
  app.mixin({
    created() {
      if (this.$options.__name === "PersonalContextForm") instance = this.$;
    },
  });
  await renderToString(app);
  function selector(node: VNode): VNode | undefined {
    if (node.type === BaseSelector) return node;
    if (Array.isArray(node.children))
      for (const child of node.children) {
        if (typeof child === "object" && child !== null) {
          const found = selector(child as VNode);
          if (found) return found;
        }
      }
  }
  const control = selector(instance.subTree);
  expect(control).toBeDefined();
  control!.props!["onUpdate:modelValue"]("leading");
  expect(updated).toEqual({ ...original, interaction_mode: "leading" });
  expect(original.interaction_mode).toBe("guide");
});
