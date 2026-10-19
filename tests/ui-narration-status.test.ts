import { expect, it, vi } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import TourNarrationStatus from "../app/components/tour/TourNarrationStatus.vue";
import { findAll, mount, type TestNode } from "./helpers/render";
import en from "../i18n/locales/en.json";

const Button = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () => h("button", attrs, slots.default?.());
  },
});
const t = (key: string, values: Record<string, unknown> = {}) => {
  let value: unknown = en;
  for (const part of key.split(".")) {
    value =
      value && typeof value === "object" && part in value
        ? Reflect.get(value, part)
        : key;
  }
  return String(value).replace(/\{(\w+)\}/g, (_, name: string) =>
    String(values[name] ?? ""),
  );
};
const text = (node: TestNode): string =>
  [node.text, ...node.children.map(text)].join(" ");
const byId = (root: TestNode, id: string) =>
  findAll(root, (node) => node.props["data-testid"] === id)[0]!;

it("shows whole-story progress without duration controls or explanatory hints", () => {
  const view = mount(
    TourNarrationStatus,
    {
      record: {
        story: {
          story_id: "story",
          chunk_index: 1,
          chunk_count: 4,
          sentence_count: 5,
          total_sentences: 20,
          is_final: false,
        },
      },
      notice: null,
      bufferStatus: "prepared",
      busy: false,
    },
    { PGButton: Button },
    t,
  );
  expect(text(byId(view.root, "story-progress"))).toContain("Part 2 of 4");
  expect(text(byId(view.root, "story-progress"))).toContain(
    "5 sentences in this part",
  );
  expect(text(byId(view.root, "story-progress"))).toContain(
    "20 in the whole story",
  );
  expect(findAll(view.root, (node) => node.type === "select")).toEqual([]);
  expect(text(view.root)).not.toContain(en.narration.duration);
  expect(text(view.root)).not.toContain(en.narration.fullHint);
  expect(text(view.root)).not.toContain(en.narration.shortHint);
  expect(
    findAll(
      view.root,
      (node) => node.props["data-testid"] === "next-nearby-story",
    ),
  ).toEqual([]);
  expect(text(byId(view.root, "story-buffer-status"))).toContain(
    "has not started",
  );
  view.unmount();
});

it("omits the active-audio notice and resume button while retaining other status messages", async () => {
  const view = mount(
    TourNarrationStatus,
    {
      record: null,
      notice: {
        message: "",
        playback_block: {
          reason: "active_segment_unacknowledged",
          active_segment_id: "original",
          active_delivery_state: "GENERATED",
        },
      },
      bufferStatus: "idle",
      busy: false,
    },
    { PGButton: Button },
    t,
  );
  expect(
    findAll(
      view.root,
      (node) => node.props["data-testid"] === "narration-status",
    ),
  ).toHaveLength(0);
  expect(text(view.root)).not.toContain(
    "An earlier audio segment is still active.",
  );
  expect(
    findAll(
      view.root,
      (node) => node.props["data-testid"] === "resume-active-story",
    ),
  ).toHaveLength(0);
  expect(
    findAll(
      view.root,
      (node) => node.props["data-testid"] === "next-nearby-story",
    ),
  ).toEqual([]);
  view.props.notice = {
    message: "",
    narration_status: "insufficient_supported_story",
  };
  await nextTick();
  expect(text(byId(view.root, "narration-reason"))).toContain(
    "No complete full story was delivered",
  );
  expect(
    findAll(
      view.root,
      (node) => node.props["data-testid"] === "resume-active-story",
    ),
  ).toEqual([]);
  view.unmount();
});

it("offers existing preparation controls for an unprepared full story without starting generation", () => {
  const prepare = vi.fn();
  const view = mount(
    TourNarrationStatus,
    {
      record: null,
      notice: {
        message: "",
        narration_status: "insufficient_supported_story",
        playback_block: {
          reason: "requires_prepared_generation",
          active_segment_id: null,
          active_delivery_state: null,
        },
      },
      bufferStatus: "idle",
      busy: false,
      canPrepare: true,
      onPrepare: prepare,
    },
    { PGButton: Button },
    t,
  );
  expect(text(byId(view.root, "narration-reason"))).toContain(
    "prepared, accepted research generation",
  );
  expect(prepare).not.toHaveBeenCalled();
  byId(view.root, "open-story-preparation").props.onClick();
  expect(prepare).toHaveBeenCalledOnce();
  view.unmount();
});

it("omits the explanation-status section for a complete response", () => {
  const view = mount(
    TourNarrationStatus,
    {
      record: {
        message: "One. Two. Three. Four. Five. Six. Seven.",
        narration_status: "full_supported_fallback",
        story: {
          story_id: "complete-story",
          chunk_index: 0,
          chunk_count: 1,
          sentence_count: 7,
          total_sentences: 7,
          is_final: true,
        },
      },
      notice: null,
      bufferStatus: "idle",
      busy: false,
    },
    { PGButton: Button },
    t,
  );
  expect(
    findAll(
      view.root,
      (node) => node.props["data-testid"] === "narration-status",
    ),
  ).toHaveLength(0);
  expect(text(view.root)).not.toContain("Complete explanation.");
  expect(text(view.root)).not.toContain(
    "A complete explanation using the available supported material is ready.",
  );
  expect(text(view.root)).not.toContain("Part 1 of 1");
  expect(findAll(view.root, (node) => node.type === "select")).toEqual([]);
  view.unmount();
});
