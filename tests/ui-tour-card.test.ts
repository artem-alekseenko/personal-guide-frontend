import { beforeEach, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import PGTourCard from "../app/components/PGTourCard.vue";
import { findAll, mount } from "./helpers/render";
const resize = vi.hoisted(() => ({
  callbacks: [] as Function[],
  disconnected: vi.fn(),
}));
beforeEach(() => {
  resize.callbacks.length = 0;
  Object.assign(globalThis, {
    getComputedStyle: () => ({ lineHeight: "24px" }),
    ResizeObserver: class {
      constructor(callback: Function) {
        resize.callbacks.push(callback);
      }
      observe() {}
      disconnect() {
        resize.disconnected();
      }
    },
  });
});
const flush = async () => {
  await nextTick();
  await nextTick();
  await nextTick();
};
const hasToggle = (root: any) =>
  findAll(root, (node) => node.props.class === "tour-card__toggle").length > 0;
it("offers Show more when a polled description becomes longer", async () => {
  const app = mount(
    PGTourCard,
    {
      description: "Preparing",
      status: "GENERATING",
      name: "Tour",
      generatingPercent: 1,
      generatingText: "",
      tourId: "tour",
      imageUrl: "",
      guideName: "Guide",
    },
    { NuxtLink: { template: "<a><slot /></a>" } },
  );
  await flush();
  expect(hasToggle(app.root)).toBe(false);
  app.props.description = "A long generated description. ".repeat(100);
  await flush();
  expect(hasToggle(app.root)).toBe(true);
  app.props.description = "Short";
  await flush();
  expect(hasToggle(app.root)).toBe(false);
  app.unmount();
  expect(resize.disconnected).toHaveBeenCalledOnce();
});
it("rechecks truncation when the available text width changes", async () => {
  const app = mount(PGTourCard, {
    description: "Short",
    status: "GENERATING",
    name: "Tour",
    generatingPercent: 1,
    generatingText: "",
    tourId: "tour",
    imageUrl: "",
    guideName: "Guide",
  });
  await flush();
  const text = findAll(
    app.root,
    (node) =>
      node.type === "p" &&
      String(node.props.class).includes("tour-card__description"),
  )[0];
  Object.defineProperty(text, "scrollHeight", { get: () => 240 });
  expect(resize.callbacks.length).toBe(1);
  resize.callbacks[0]();
  await flush();
  expect(hasToggle(app.root)).toBe(true);
  app.unmount();
});
