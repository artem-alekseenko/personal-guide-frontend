import { beforeEach, expect, it, vi } from "vitest";
import { defineComponent, h, nextTick, type Component } from "vue";
import { mount as mountComponent, findAll } from "./helpers/render";
import BaseSelector from "../app/components/base/BaseSelector.vue";
import PGButton from "../app/components/ui/PGButton.vue";
import PGChip from "../app/components/ui/PGChip.vue";
import PGSwitch from "../app/components/ui/PGSwitch.vue";
import PGAuthForm from "../app/components/PGAuthForm.vue";

vi.mock("../app/composables/auth/useAuthActions", () => ({
  useAuthActions: () => ({
    loginWithEmail: async () => ({
      success: false,
      errorCode: "auth/invalid-credential",
    }),
    registerWithEmail: async () => ({ success: true }),
  }),
}));

function mount(
  component: Component,
  props: Record<string, unknown> = {},
  text = "",
) {
  const view = mountComponent(
    { render: () => h(component, props, () => text) },
    {},
    {
      PGButton,
      PGAuthSocialButtons: { render: () => h("div") },
      UInput: defineComponent({
        inheritAttrs: false,
        props: ["modelValue"],
        emits: ["update:modelValue"],
        setup(props, { attrs, emit }) {
          return () =>
            h("input", {
              ...attrs,
              value: props.modelValue,
              onInput: (event: { target: { value: string } }) =>
                emit("update:modelValue", event.target.value),
            });
        },
      }),
    },
  );
  return { ...view, all: () => findAll(view.root, () => true) };
}
beforeEach(() => {
  Object.assign(globalThis, {
    useI18n: () => ({ t: (key: string) => key }),
  });
});

it("offers labeled native selector options and emits the selected value", () => {
  const changed = vi.fn();
  const view = mount(BaseSelector, {
    id: "language",
    label: "Language",
    modelValue: "en",
    options: [
      { value: "en", label: "English" },
      { value: "ru", label: "Russian" },
    ],
    "onUpdate:modelValue": changed,
  });
  const select = view.all().find((node) => node.type === "select");
  expect(select).toBeDefined();
  expect(select!.props.id).toBe("language");
  expect(select!.props.value).toBe("en");
  expect(view.all().find((node) => node.type === "label")?.props.for).toBe(
    "language",
  );
  expect(
    select!.children
      .filter((node) => node.type === "option")
      .map((node) => node.props.value),
  ).toEqual(["en", "ru"]);
  select!.props.onChange({ target: { value: "ru" } });
  expect(changed).toHaveBeenCalledWith("ru");
  view.unmount();
});

it.each([false, true])(
  "exposes a selectable chip as a button with pressed state %s",
  (selected) => {
    const clicked = vi.fn();
    const view = mount(
      PGChip,
      { isSelected: selected, onClick: clicked },
      "Architecture",
    );
    const chip = view.all().find((node) => node.type === "button");
    expect(chip).toBeDefined();
    expect(chip!.props.type).toBe("button");
    expect(chip!.props["aria-pressed"]).toBe(selected);
    chip!.props.onClick();
    expect(clicked).toHaveBeenCalledOnce();
    view.unmount();
  },
);

it("names the switch input and emits its changed checked state", () => {
  const changed = vi.fn();
  const view = mount(PGSwitch, {
    modelValue: false,
    label: "Manual position",
    "onUpdate:modelValue": changed,
  });
  const input = view.all().find((node) => node.type === "input")!;
  expect(input.props["aria-label"]).toBe("Manual position");
  expect(input.props.role).toBe("switch");
  input.props.onChange({ target: { checked: true } });
  expect(changed).toHaveBeenCalledWith(true);
  view.unmount();
});

it("preserves submit button type and disables a loading action", () => {
  const view = mount(PGButton, { type: "submit", loading: true }, "Sign in");
  const button = view.all().find((node) => node.type === "button")!;
  expect(button.props.type).toBe("submit");
  expect(button.props.disabled).toBe(true);
  view.unmount();
});

it("keeps auth field labels visible and supplies login autofill semantics", () => {
  const view = mount(PGAuthForm);
  const inputs = view.all().filter((node) => node.type === "input");
  expect(inputs).toHaveLength(2);
  for (const input of inputs) {
    const label = view
      .all()
      .find(
        (node) => node.type === "label" && node.props.for === input.props.id,
      );
    expect(label).toBeDefined();
    expect(label!.text).not.toBe("");
  }
  expect(inputs.map((node) => node.props.autocomplete)).toEqual([
    "email",
    "current-password",
  ]);
  view.unmount();
});

it("uses new-password autofill for both registration fields", async () => {
  const view = mount(PGAuthForm);
  view
    .all()
    .find(
      (node) =>
        node.type === "button" && node.text === "auth.noAccountRegister",
    )!
    .props.onClick();
  await nextTick();
  const passwords = view
    .all()
    .filter((node) => node.type === "input" && node.props.type === "password");
  expect(passwords.map((node) => node.props.autocomplete)).toEqual([
    "new-password",
    "new-password",
  ]);
  view.unmount();
});

it("announces failed authentication as an alert", async () => {
  const view = mount(PGAuthForm);
  await view
    .all()
    .find((node) => node.type === "form")!
    .props.onSubmit({ preventDefault: () => {} });
  await nextTick();
  const error = view
    .all()
    .find((node) => node.text === "auth.errors.invalidCredential");
  expect(error?.props.role).toBe("alert");
  view.unmount();
});
