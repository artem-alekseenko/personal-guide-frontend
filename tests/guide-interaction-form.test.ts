import { expect, it } from "vitest";
import { createSSRApp, type ComponentInternalInstance, type VNode } from "vue";
import { renderToString } from "@vue/server-renderer";
import PersonalContextForm from "../app/components/tour/PersonalContextForm.vue";
import BaseSelector from "../app/components/base/BaseSelector.vue";
import { emptyPersonalContext } from "../app/types/personalContext";
import en from "../i18n/locales/en.json";
import ru from "../i18n/locales/ru.json";

async function render(
  messages: typeof en | typeof ru,
  guideMode?: string,
  context = { ...emptyPersonalContext(), enabled: false },
) {
  const t = (key: string, params: Record<string, string> = {}) =>
    String(
      key.split(".").reduce((value: any, part) => value?.[part], messages) ??
        key,
    ).replace(/\{(\w+)\}/g, (_, name) => params[name] ?? "");
  Object.assign(globalThis, { useI18n: () => ({ t }) });
  const app = createSSRApp(PersonalContextForm, {
    modelValue: context,
    guideMode,
  });
  app.component("BaseSelector", BaseSelector);
  app.config.globalProperties.$t = t;
  return renderToString(app);
}
it.each([
  [en, "Introvert", "Extravert"],
  [ru, "Интроверт", "Экстраверт"],
])(
  "offers only introvert and extravert choices even without personal memory",
  async (messages, introvert, extravert) => {
    const html = await render(messages as typeof en);
    expect(html).toContain("<select");
    expect(html).toContain(String(introvert));
    expect(html).toContain(String(extravert));
    expect(html.match(/<option\b/g)).toHaveLength(2);
    expect(html).not.toContain('<option value="guide"');
    expect(html).toMatch(/<select[^>]*value="interactive"/);
  },
);
it.each(["leading", "interactive"])(
  "displays inherited style %s without changing the saved context",
  async (mode) => {
    const context = emptyPersonalContext();
    const html = await render(en, mode, context);
    expect(html).toMatch(new RegExp(`<select[^>]*value="${mode}"`));
    expect(context.interaction_mode).toBe("guide");
  },
);

it("removes free-text questions while retaining structured walk preferences", async () => {
  const context = {
    ...emptyPersonalContext(),
    known_topics: "Saved knowledge",
    note: "Saved note",
    purpose: "Saved purpose",
  };
  const html = await render(en, "leading", context);
  expect(html).not.toContain("<textarea");
  expect(html).not.toContain('maxlength="500"');
  expect(html).not.toContain(en.experience.purpose);
  expect(html).not.toContain(en.experience.known);
  expect(html).not.toContain(en.experience.note);
  expect(html).toContain(en.experience.familiarity);
  expect(html).toContain(en.experience.depth);
  expect(html).toContain(en.experience.pace);
  expect(context).toMatchObject({
    known_topics: "Saved knowledge",
    note: "Saved note",
    purpose: "Saved purpose",
  });
});

it.each(["leading", "interactive"])(
  "changes only the interaction preference to %s through the selector's model event",
  async (mode) => {
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
    control!.props!["onUpdate:modelValue"](mode);
    expect(updated).toEqual({ ...original, interaction_mode: mode });
    expect(original.interaction_mode).toBe("guide");
  },
);
