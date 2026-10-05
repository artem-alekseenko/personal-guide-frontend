import { beforeEach, expect, it, vi } from "vitest";
import * as Vue from "vue";
import UserSettings from "../app/components/UserSettings.vue";
import SettingsSavingOverlay from "../app/components/SettingsSavingOverlay.vue";
import { mount, findAll } from "./helpers/render";

const auth = vi.hoisted(() => ({ current: null as any }));
vi.mock("../app/composables/auth/useAuth", () => ({
  useAuth: () => auth.current,
}));
vi.mock("../app/composables/ui/useToastNotifications", () => ({
  useToastNotifications: () => ({
    showSettingsSaved: vi.fn(),
    showSettingsError: vi.fn(),
  }),
}));
const selector = Vue.defineComponent({
  props: ["preferences"],
  emits: ["update:preferences"],
  setup(props, { emit }) {
    return () =>
      Vue.h("select", {
        value: props.preferences.language,
        onChange: (event: any) =>
          emit("update:preferences", {
            ...props.preferences,
            language: event.target.value,
          }),
      });
  },
});
beforeEach(() => {
  auth.current = {
    profile: Vue.ref({ email: "visitor@example.com" }),
    stats: Vue.ref(null),
    userPreferences: Vue.ref({
      language: "ru",
      voiceType: "DEFAULT",
      llmType: "DEFAULT",
    }),
    userName: Vue.ref("Visitor"),
    userAvatar: Vue.ref(null),
    isSavingPreferences: Vue.ref(true),
    updateUserPreferences: vi.fn(async () => {}),
    logout: vi.fn(async () => {}),
  };
  Object.assign(globalThis, {
    ...Vue,
    useI18n: () => ({ t: (key: string) => key }),
    navigateTo: vi.fn(),
  });
});
const render = () =>
  mount(
    UserSettings,
    {},
    {
      SettingsSavingOverlay,
      LanguageSelector: selector,
      LlmTypeSelector: selector,
      VoiceTypeSelector: selector,
    },
  );
it("removes settings controls from keyboard interaction while a save is pending", async () => {
  const app = render();
  const controls = findAll(app.root, (node) => node.type === "fieldset")[0];
  expect(controls).toBeDefined();
  expect(controls.props.disabled).toBe(true);
  expect(controls.props.inert).toBe(true);
  expect(
    findAll(app.root, (node) => node.props.role === "status"),
  ).toHaveLength(1);
  auth.current.isSavingPreferences.value = false;
  await Vue.nextTick();
  expect(controls.props.disabled).toBe(false);
  expect(controls.props.inert).toBe(false);
  app.unmount();
});
it("ignores preference and reset events during an existing save", async () => {
  const app = render();
  const select = findAll(app.root, (node) => node.type === "select")[0];
  await select.props.onChange({ target: { value: "en" } });
  const reset = findAll(
    app.root,
    (node) => node.type === "button" && node.text === "common.reset",
  )[0];
  await reset.props.onClick();
  await Vue.nextTick();
  expect(auth.current.updateUserPreferences).not.toHaveBeenCalled();
  expect(select.props.value).toBe("ru");
  app.unmount();
});
