import { beforeEach, expect, it, vi, type Mock } from "vitest";
import {
  nextTick,
  onBeforeUnmount,
  reactive,
  ref,
  shallowRef,
  type Ref,
} from "vue";
import type { User } from "firebase/auth";
import TourResearchControls from "../app/components/tour/TourResearchControls.vue";
import TourResearchPreviewAction from "../app/components/tour/TourResearchPreviewAction.vue";
import PGTourCard from "../app/components/PGTourCard.vue";
import Tours from "../app/pages/tours/index.vue";
import { useUserStore } from "../app/stores/userStore";
import { findAll, mount, type TestNode } from "./helpers/render";
import en from "../i18n/locales/en.json";
import ru from "../i18n/locales/ru.json";
import type { ICreatedTour } from "../app/types";
import type { PreparationProgress } from "../shared/types/preparationProgress";
import type {
  GenerationSummary,
  ResearchActionKind,
  ResearchEnrichment,
  ResearchFile,
  ResearchPendingAction,
} from "../shared/types/researchLifecycle";

interface LifecycleFixture {
  sourceTour: Ref<ICreatedTour | null>;
  generations: Ref<GenerationSummary[]>;
  selectedGenerationId: Ref<string | null>;
  selectedGeneration: Ref<GenerationSummary | null>;
  progress: Ref<PreparationProgress | null>;
  files: Ref<ResearchFile[]>;
  enrichment: Ref<ResearchEnrichment | null>;
  loading: Ref<boolean>;
  busy: Ref<boolean>;
  failed: Ref<boolean>;
  actionFailed: Ref<boolean>;
  pending: Ref<ResearchPendingAction | null>;
  canCancel: Ref<boolean>;
  canFinishEarly: Ref<boolean>;
  canRegenerate: Ref<boolean>;
  canAccept: Ref<boolean>;
  previewBlocked: Ref<boolean>;
  mutationBlocked: Ref<boolean>;
  refresh: Mock<() => Promise<void>>;
  selectGeneration: Mock<(id: string) => Promise<void>>;
  run: Mock<(kind: ResearchActionKind) => Promise<boolean>>;
  retry: Mock<() => Promise<boolean>>;
  downloadFile: Mock<(file: ResearchFile) => Promise<void>>;
}

const fixture = vi.hoisted(() => {
  let state: LifecycleFixture;
  return {
    get lifecycle() {
      return state;
    },
    set lifecycle(value: LifecycleFixture) {
      state = value;
    },
  };
});
vi.mock("#imports", () => ({ definePageMeta: () => {} }));
vi.mock("../app/composables/tour/useTourResearchLifecycle", () => ({
  useTourResearchLifecycle: () => fixture.lifecycle,
}));
let language: "en" | "ru" = "en";
const t = (key: string, params: Record<string, unknown> = {}) => {
  let value: unknown = language === "ru" ? ru : en;
  for (const part of key.split(".")) {
    value =
      value && typeof value === "object" && part in value
        ? Reflect.get(value, part)
        : undefined;
  }
  return String(value ?? key).replace(/\{(\w+)\}/g, (_, name) =>
    String(params[name] ?? ""),
  );
};
const text = (root: TestNode): string =>
  [root.text, ...root.children.map(text)].join(" ");
const button = (root: TestNode, label: string) =>
  findAll(
    root,
    (node) => node.type === "button" && text(node).includes(label),
  )[0]!;
const confirmationButton = (root: TestNode) => {
  const group = findAll(root, (node) => node.props.role === "group")[0]!;
  return findAll(group, (node) => node.type === "button")[0]!;
};
const actionable = (root: TestNode, label: string) =>
  findAll(
    root,
    (node) =>
      node.type === "button" &&
      text(node).includes(label) &&
      !node.props.disabled,
  );
const components = {
  PGButton: {
    props: ["disabled", "loading"],
    template: '<button :disabled="disabled"><slot /></button>',
  },
  NuxtLink: { template: "<a><slot /></a>" },
};
const generation = (
  id = "generation-1",
  status: GenerationSummary["status"] = "RUNNING",
): GenerationSummary => ({
  generation_id: id,
  tour_id: "source",
  owner_id: "backend-owner",
  status,
  stage: "RESEARCH",
  sequence: 1,
  created_at: "2026-10-11T10:00:00Z",
  updated_at: "2026-10-11T11:00:00Z",
});
const file = {
  artifact_id: "private-file",
  generation_id: "generation-1",
  kind: "raw_research",
  content_type: "application/json",
  byte_size: 123,
  created_at: "2026-10-11T11:00:00Z",
  url: "https://private.invalid/must-not-render",
};
function lifecycle(): LifecycleFixture {
  const selected = generation();
  return {
    sourceTour: ref<ICreatedTour | null>(null),
    generations: ref<GenerationSummary[]>([selected]),
    selectedGenerationId: shallowRef<string | null>(selected.generation_id),
    selectedGeneration: ref<GenerationSummary | null>(selected),
    progress: ref<PreparationProgress | null>(null),
    files: ref([file]),
    enrichment: ref<ResearchEnrichment | null>({
      status: "running",
      reason: null,
      rounds: 2,
      updated_at: null,
      error: null,
      items: [{ unknown: true }],
    }),
    loading: shallowRef(false),
    busy: shallowRef(false),
    failed: shallowRef(false),
    actionFailed: shallowRef(false),
    pending: ref<ResearchPendingAction | null>(null),
    canCancel: shallowRef(true),
    canRegenerate: shallowRef(true),
    canAccept: shallowRef(true),
    canFinishEarly: shallowRef(true),
    previewBlocked: shallowRef(false),
    mutationBlocked: shallowRef(false),
    refresh: vi.fn(async () => {}),
    selectGeneration: vi.fn(async (_id: string) => {}),
    run: vi.fn(async (_kind: ResearchActionKind) => true),
    retry: vi.fn(async () => true),
    downloadFile: vi.fn(async (_file: ResearchFile) => {}),
  };
}
const render = (updated = vi.fn()) =>
  mount(
    TourResearchControls,
    {
      tourId: "source",
      status: "GENERATING",
      latestGenerationId: "generation-1",
      onUpdated: updated,
    },
    components,
    t,
  );
async function open(root: TestNode) {
  const details = findAll(root, (node) => node.type === "details")[0]!;
  details.props.onToggle({ target: { open: true } });
  await nextTick();
}
beforeEach(() => {
  language = "en";
  fixture.lifecycle = lifecycle();
  Object.assign(globalThis, {
    useNuxtApp: () => ({ $apiFetch: vi.fn() }),
    navigateTo: vi.fn(),
    getComputedStyle: () => ({ lineHeight: "24px" }),
  });
  useUserStore().user = { uid: "owner" } as User;
});

it("keeps preview prominent while lazily reading the closed research disclosure", async () => {
  const app = render();
  expect(button(app.root, en.researchPreview.stopAndTry)).toBeDefined();
  expect(
    findAll(app.root, (node) => node.type === "details")[0]!.props.open,
  ).toBe(false);
  expect(findAll(app.root, (node) => node.type === "select")).toHaveLength(0);
  expect(fixture.lifecycle.refresh).not.toHaveBeenCalled();
  expect(fixture.lifecycle.run).not.toHaveBeenCalled();
  await open(app.root);
  expect(fixture.lifecycle.refresh).toHaveBeenCalledTimes(1);
  expect(findAll(app.root, (node) => node.type === "select")).toHaveLength(1);
  expect(fixture.lifecycle.run).not.toHaveBeenCalled();
  app.unmount();
});

it("requires confirmation before starting paid research and locks competing inputs", async () => {
  const updated = vi.fn();
  const app = render(updated);
  await open(app.root);
  button(app.root, en.researchControls.actions.regenerate).props.onClick();
  await nextTick();
  expect(fixture.lifecycle.run).not.toHaveBeenCalled();
  expect(button(app.root, en.researchPreview.stopAndTry).props.disabled).toBe(
    true,
  );
  expect(
    findAll(app.root, (node) => node.type === "select")[0]!.props.disabled,
  ).toBe(true);
  await confirmationButton(app.root).props.onClick();
  expect(updated).toHaveBeenCalledTimes(1);
  app.unmount();
});

it("cancels paid-research confirmation without issuing a mutation", async () => {
  const app = render();
  await open(app.root);
  button(app.root, en.researchControls.actions.regenerate).props.onClick();
  await nextTick();
  button(app.root, en.common.cancel).props.onClick();
  await nextTick();
  expect(fixture.lifecycle.run).not.toHaveBeenCalled();
  expect(button(app.root, en.researchPreview.stopAndTry).props.disabled).toBe(
    false,
  );
  app.unmount();
});

it("keeps stale history and files visible after read failure without reporting empty success", async () => {
  const app = render();
  await open(app.root);
  fixture.lifecycle.failed.value = true;
  fixture.lifecycle.actionFailed.value = true;
  await nextTick();
  expect(findAll(app.root, (node) => node.type === "option")).toHaveLength(1);
  expect(text(app.root)).toContain(en.researchControls.readFailed);
  expect(text(app.root)).toContain(en.researchControls.actionFailed);
  expect(button(app.root, en.researchControls.download).props.disabled).toBe(
    false,
  );
  expect(text(app.root)).not.toContain(en.researchControls.noFiles);
  expect(text(app.root)).not.toContain(en.researchControls.noGenerations);
  expect(button(app.root, en.researchControls.refresh).props.disabled).toBe(
    false,
  );
  app.unmount();
});

it("blocks conflicting changes during uncertainty but leaves refresh and immutable retry actionable", async () => {
  const updated = vi.fn();
  fixture.lifecycle.pending.value = {
    kind: "regenerate",
    generationId: null,
    key: "must-not-show-key",
    busy: false,
    failed: true,
  };
  fixture.lifecycle.previewBlocked.value = true;
  fixture.lifecycle.mutationBlocked.value = true;
  fixture.lifecycle.actionFailed.value = true;
  fixture.lifecycle.retry.mockResolvedValue(false);
  const app = render(updated);
  await open(app.root);
  for (const label of Object.values(en.researchControls.actions))
    expect(actionable(app.root, label)).toHaveLength(0);
  expect(button(app.root, en.researchPreview.stopAndTry).props.disabled).toBe(
    true,
  );
  expect(
    findAll(app.root, (node) => node.type === "select")[0]!.props.disabled,
  ).toBe(true);
  expect(button(app.root, en.researchControls.refresh).props.disabled).toBe(
    false,
  );
  expect(button(app.root, en.researchControls.retry).props.disabled).toBe(
    false,
  );
  expect(text(app.root)).not.toContain("must-not-show-key");
  await button(app.root, en.researchControls.retry).props.onClick();
  expect(updated).not.toHaveBeenCalled();
  fixture.lifecycle.retry.mockResolvedValue(true);
  await button(app.root, en.researchControls.retry).props.onClick();
  expect(updated).toHaveBeenCalledTimes(1);
  app.unmount();
});

it.each(["tour", "account", "unmount"])(
  "does not emit an old mutation result after a %s scope change",
  async (scope) => {
    const operation = Promise.withResolvers<boolean>();
    fixture.lifecycle.run.mockReturnValue(operation.promise);
    const updated = vi.fn();
    const app = render(updated);
    await open(app.root);
    button(app.root, en.researchControls.actions.cancel).props.onClick();
    await nextTick();
    const work = confirmationButton(app.root).props.onClick();
    if (scope === "tour") app.props.tourId = "another";
    if (scope === "account")
      useUserStore().user = { uid: "another-owner" } as User;
    if (scope === "unmount") app.unmount();
    await nextTick();
    operation.resolve(true);
    await work;
    expect(updated).not.toHaveBeenCalled();
    if (scope !== "unmount") app.unmount();
  },
);

it("uses labeled native history selection and authenticated downloads without rendering upstream URLs", async () => {
  const app = render();
  await open(app.root);
  const select = findAll(app.root, (node) => node.type === "select")[0]!;
  expect(
    findAll(
      app.root,
      (node) => node.type === "label" && node.props.for === select.props.id,
    ),
  ).toHaveLength(1);
  await select.props.onChange({ target: { value: "generation-2" } });
  expect(fixture.lifecycle.selectGeneration).toHaveBeenCalledWith(
    "generation-2",
  );
  await button(app.root, en.researchControls.download).props.onClick();
  expect(fixture.lifecycle.downloadFile).toHaveBeenCalledWith(file);
  expect(findAll(app.root, (node) => node.type === "a")).toHaveLength(0);
  expect(text(app.root)).not.toContain(file.url);
  expect(text(app.root)).not.toContain("unknown");
  expect(fixture.lifecycle.run).not.toHaveBeenCalled();
  app.unmount();
});

it("keeps unavailable ordinary acceptance disabled and cancels confirmation when selection changes", async () => {
  fixture.lifecycle.canAccept.value = false;
  const app = render();
  await open(app.root);
  expect(actionable(app.root, en.researchControls.actions.accept)).toHaveLength(
    0,
  );
  expect(fixture.lifecycle.run).not.toHaveBeenCalled();
  button(app.root, en.researchControls.actions.cancel).props.onClick();
  await nextTick();
  fixture.lifecycle.selectedGenerationId.value = "new-latest";
  await nextTick();
  expect(text(app.root)).not.toContain(
    en.researchControls.confirmations.cancel,
  );
  app.unmount();
});

it("localizes controls and confirmation in Russian", async () => {
  language = "ru";
  const app = render();
  await open(app.root);
  button(app.root, ru.researchControls.actions.regenerate).props.onClick();
  await nextTick();
  expect(text(app.root)).toContain(ru.researchControls.details);
  expect(text(app.root)).toContain(
    ru.researchControls.confirmations.regenerate,
  );
  expect(text(app.root)).toContain(ru.researchControls.archiveNotice);
  expect(text(app.root)).toContain(ru.researchControls.enrichmentNotice);
  app.unmount();
});

it("suppresses lifecycle controls on experimental cards", async () => {
  const app = mount(
    PGTourCard,
    {
      tourId: "draft",
      status: "GENERATED",
      name: "Draft",
      description: "",
      imageUrl: "",
      guideName: "Guide",
      generatingText: "",
      researchPreview: {
        source_tour_id: "source",
        source_generation_id: "generation-1",
        unverified: true,
        available_stop_ids: [],
        missing_stop_ids: [],
        captured_at: "2026-10-11T11:00:00Z",
      },
    },
    components,
    t,
  );
  await nextTick();
  expect(findAll(app.root, (node) => node.type === "details")).toHaveLength(0);
  expect(text(app.root)).toContain(en.researchPreview.title);
  expect(fixture.lifecycle.refresh).not.toHaveBeenCalled();
  app.unmount();
});

it("guards an already-open preview confirmation when another lifecycle operation blocks it", async () => {
  const api = vi.fn();
  Object.assign(globalThis, { useNuxtApp: () => ({ $apiFetch: api }) });
  const app = mount(
    TourResearchPreviewAction,
    { tourId: "source", status: "GENERATING", blocked: false },
    components,
    t,
  );
  button(app.root, en.researchPreview.stopAndTry).props.onClick();
  await nextTick();
  app.props.blocked = true;
  await nextTick();
  const confirm = button(app.root, en.researchPreview.confirm);
  expect(confirm.props.disabled).toBe(true);
  await confirm.props.onClick();
  expect(api).not.toHaveBeenCalled();
  app.unmount();
});

it("refreshes the list only after a confirmed mutation, not inspection or failed mutation", async () => {
  const routes = reactive({
    allTours: [
      {
        id: "source",
        status: "GENERATED",
        name: "Original",
        description: "",
        image: "",
        guide: null,
        latest_generation_id: "generation-1",
        route: { points: [] },
      },
    ],
    fetchListTours: vi.fn(),
    stopPolling: vi.fn(),
    isLoading: false,
    error: null,
  });
  Object.assign(globalThis, {
    onBeforeUnmount,
    useRouter: () => ({ push: vi.fn() }),
    useRouteStore: () => routes,
  });
  const app = mount(Tours, {}, { ...components, PGTourCard }, t);
  await nextTick();
  routes.fetchListTours.mockClear();
  await open(app.root);
  await button(app.root, en.researchControls.refresh).props.onClick();
  expect(routes.fetchListTours).not.toHaveBeenCalled();
  fixture.lifecycle.run.mockResolvedValueOnce(false);
  button(app.root, en.researchControls.actions.cancel).props.onClick();
  await nextTick();
  await confirmationButton(app.root).props.onClick();
  expect(routes.fetchListTours).not.toHaveBeenCalled();
  button(app.root, en.researchControls.actions.cancel).props.onClick();
  await nextTick();
  await confirmationButton(app.root).props.onClick();
  expect(routes.fetchListTours).toHaveBeenCalledTimes(1);
  app.unmount();
});

it("does not offer actionable finish-early when the lifecycle eligibility gate is closed", async () => {
  fixture.lifecycle.canFinishEarly.value = false;
  const app = render();
  await open(app.root);
  expect(
    actionable(app.root, en.researchControls.actions["finish-early"]),
  ).toHaveLength(0);
  await nextTick();
  expect(text(app.root)).not.toContain(
    en.researchControls.confirmations["finish-early"],
  );
  expect(fixture.lifecycle.run).not.toHaveBeenCalled();
  app.unmount();
});

it("shows explicit empty results only after a successful inspection", async () => {
  fixture.lifecycle.generations.value = [];
  fixture.lifecycle.selectedGeneration.value = null;
  fixture.lifecycle.files.value = [];
  fixture.lifecycle.enrichment.value = null;
  const app = render();
  await open(app.root);
  expect(text(app.root)).toContain(en.researchControls.noGenerations);
  expect(text(app.root)).toContain(en.researchControls.noFiles);
  expect(text(app.root)).toContain(en.researchControls.noEnrichment);
  fixture.lifecycle.failed.value = true;
  await nextTick();
  expect(text(app.root)).not.toContain(en.researchControls.noGenerations);
  expect(text(app.root)).not.toContain(en.researchControls.noFiles);
  expect(text(app.root)).not.toContain(en.researchControls.noEnrichment);
  app.unmount();
});
