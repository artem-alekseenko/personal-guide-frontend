import { expect, it, vi } from "vitest";
import { reactive, toRefs, nextTick } from "vue";
import { mount, findAll } from "./helpers/render";
import Guides from "../app/pages/guides/index.vue";

const { state } = vi.hoisted(() => ({ state: { store: null as any } }));
vi.mock("#imports", () => ({
  definePageMeta: () => {},
  useGuidesStore: () => state.store,
}));
vi.mock("../app/components/PGGuide.vue", () => ({
  default: { template: "<div />" },
}));

it.each([null, "offline"])(
  "offers retry for an empty catalog or failure (%s)",
  async (error) => {
    Object.assign(globalThis, { storeToRefs: toRefs });
    state.store = reactive({
      guidesList: [],
      isGuidesListLoading: false,
      error,
      fetchGuidesList: vi.fn(),
    });
    const app = mount(
      Guides,
      {},
      {
        PGButton: { template: "<button><slot /></button>" },
        NuxtLink: { template: "<a><slot /></a>" },
      },
    );
    await nextTick();
    const message = error ? "common.loadFailed" : "pages.guides.empty";
    expect(findAll(app.root, (node) => node.text === message)).toHaveLength(1);
    const retry = findAll(app.root, (node) => node.type === "button")[0];
    retry.props.onClick();
    expect(state.store.fetchGuidesList).toHaveBeenCalledTimes(2);
    app.unmount();
  },
);
