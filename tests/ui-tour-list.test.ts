import { expect, it, vi } from "vitest";
import { onBeforeUnmount, reactive } from "vue";
import Tours from "../app/pages/tours/index.vue";
import { mount, findAll } from "./helpers/render";
vi.mock("#imports", () => ({ definePageMeta: () => {} }));

it("keeps a tour with a missing guide visible alongside other tours", () => {
  Object.assign(globalThis, {
    onBeforeUnmount,
    useRouter: () => ({ push: vi.fn() }),
    useRouteStore: () =>
      reactive({
        allTours: [
          { id: "missing", name: "Orphaned walk", guide: null },
          { id: "normal", name: "Normal walk", guide: { name: "Guide" } },
        ],
        fetchListTours: vi.fn(),
        stopPolling: vi.fn(),
        isLoading: false,
        error: null,
      }),
  });
  const app = mount(
    Tours,
    {},
    {
      UIcon: { template: "<span />" },
      PGButton: { template: "<button><slot /></button>" },
      PGTourCard: {
        props: ["guideName", "name"],
        template: "<article>{{ name }}: {{ guideName }}</article>",
      },
    },
  );
  const cards = findAll(app.root, (node) => node.type === "article");
  expect(cards.map((node) => node.text)).toEqual([
    "Orphaned walk: pages.tours.missingGuide",
    "Normal walk: Guide",
  ]);
  app.unmount();
});
