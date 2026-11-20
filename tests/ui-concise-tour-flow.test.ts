import { expect, it, vi } from "vitest";
import { h, nextTick } from "vue";
import RouteDurationControl from "../app/components/route/RouteDurationControl.vue";
import PersonalContextForm from "../app/components/tour/PersonalContextForm.vue";
import { findAll, mount } from "./helpers/render";
import { emptyPersonalContext } from "../shared/types/personalContext";

vi.mock("vue", async (original) => ({
  ...(await original<typeof import("vue")>()),
  vModelCheckbox: {},
  vModelSelect: {},
}));

vi.stubGlobal("useI18n", () => ({
  t: (key: string, args?: { count: number }) =>
    args ? `${args.count} min` : key,
}));

it("sets duration from an accessible shortcut while keeping the slider in sync", async () => {
  const update = vi.fn();
  const app = mount(RouteDurationControl, {
    min: 5,
    max: 60,
    modelValue: 20,
    "onUpdate:modelValue": update,
  });
  const buttons = findAll(app.root, (n) => n.type === "button");
  expect(buttons).toHaveLength(4);
  buttons[1]!.props.onClick();
  expect(update).toHaveBeenCalledWith(30);
  app.props.modelValue = 30;
  await nextTick();
  expect(findAll(app.root, (n) => n.type === "input")[0]!.props.value).toBe(30);
  expect(
    findAll(app.root, (n) => n.type === "button")[1]!.props["aria-pressed"],
  ).toBe(true);
  app.unmount();
});

it("keeps additional preference content inside the existing collapsed disclosure", () => {
  const Wrapper = {
    render: () =>
      h(
        PersonalContextForm,
        { modelValue: emptyPersonalContext() },
        { default: () => h("button", { "data-topic": true }, "Art") },
      ),
  };
  const app = mount(Wrapper);
  const disclosure = findAll(app.root, (n) => n.type === "details")[0]!;
  expect(disclosure.props.open).toBeFalsy();
  expect(findAll(disclosure, (n) => "data-topic" in n.props)).toHaveLength(1);
  app.unmount();
});
