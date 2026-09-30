import { expect, it } from "vitest";
import { buildTourProgress } from "../shared/utils/tourProgress";

const points = [
  { id: "museum", name: "City Museum", lat: "47", lng: "19" },
  { id: "square", name: "Old Square", lat: "47.001", lng: "19.001" },
  { id: "park", name: "River Park", lat: "47.002", lng: "19.002" },
];
const tour = { id: "tour", user_id: "owner", route: { points }, history: [] };
const record = {
  type: "SYSTEM_TEXT",
  message: "This building tells a remarkable story.",
  created_at: "2026-09-30T13:00:00Z",
  // This is the visitor position, not the narrated object's position.
  point: { lat: "47.1", lng: "19.1" },
  guidance: { stop_id: "museum", action: "ARRIVE" },
};
const museum = { name: "City Museum", coordinates: [19, 47], stopPosition: 1 };

it("highlights the guide's identified stop even when the provider returns no places", () => {
  expect(
    buildTourProgress({ tour, record: { ...record, places: [] } }).guideObjects,
  ).toEqual([museum]);
});
it("highlights explicit off-route objects using their returned coordinates", () => {
  const result = buildTourProgress({
    tour,
    record: {
      ...record,
      message: "Look at the statue.",
      places: [{ name: "Bronze Statue", lat: "47.003", lng: "19.003" }],
    },
  });
  expect(result.guideObjects).toEqual([
    {
      name: "Bronze Statue",
      coordinates: [19.003, 47.003],
      stopPosition: null,
    },
  ]);
});
it("prefers named subjects over the visitor's current stop when the answer is about another place", () => {
  expect(
    buildTourProgress({
      tour,
      record: {
        ...record,
        message: "City Museum and River Park have very different stories.",
        guidance: { stop_id: "square", action: "ANSWER" },
      },
    }).guideObjects,
  ).toEqual([
    museum,
    { name: "River Park", coordinates: [19.002, 47.002], stopPosition: 3 },
  ]);
});
it("deduplicates a returned route place and its name mentioned in the text", () => {
  expect(
    buildTourProgress({
      tour,
      record: {
        ...record,
        message: "City Museum.",
        places: [{ name: "City Museum", lat: "47.000", lng: "19.000" }],
      },
    }).guideObjects,
  ).toEqual([museum]);
});
it("preserves the identity of a returned object sharing a route stop's coordinates", () => {
  expect(
    buildTourProgress({
      tour,
      record: {
        ...record,
        message: "Look at the Bronze Statue.",
        places: [{ name: "Bronze Statue", lat: "47", lng: "19" }],
      },
    }).guideObjects,
  ).toEqual([
    { name: "Bronze Statue", coordinates: [19, 47], stopPosition: null },
  ]);
});
it("keeps distinct co-located subjects when both are discussed", () => {
  expect(
    buildTourProgress({
      tour,
      record: {
        ...record,
        message: "The Bronze Statue stands outside City Museum.",
        places: [{ name: "Bronze Statue", lat: "47", lng: "19" }],
      },
    }).guideObjects,
  ).toEqual([
    { name: "Bronze Statue", coordinates: [19, 47], stopPosition: null },
    museum,
  ]);
});
it("does not use the retained stop of an operational text reply as its subject", () => {
  const view = {
    turns: [
      {
        role: "guide",
        kind: "navigation" as const,
        stop_id: "museum",
        text: "You have about 12 minutes left.",
        created_at: "2026-09-30T14:00:00Z",
      },
    ],
  };
  expect(buildTourProgress({ tour, record, view }).guideObjects).toEqual([]);
  expect(
    buildTourProgress({
      tour,
      record,
      view: {
        turns: [{ ...view.turns[0]!, text: "Continue toward River Park." }],
      },
    }).guideObjects,
  ).toEqual([
    { name: "River Park", coordinates: [19.002, 47.002], stopPosition: 3 },
  ]);
});
it("requires story evidence for contextual text fallback when backend fact IDs are available", () => {
  const turn = {
    role: "guide",
    kind: "story" as const,
    stop_id: "museum",
    fact_ids: [] as string[],
    text: "You have about 12 minutes left in your planned tour.",
    created_at: "2026-09-30T14:00:00Z",
  };
  expect(
    buildTourProgress({ tour, record, view: { turns: [turn] } }).guideObjects,
  ).toEqual([]);
  expect(
    buildTourProgress({
      tour,
      record,
      view: {
        turns: [
          {
            ...turn,
            text: "This building opened in the nineteenth century.",
            fact_ids: ["museum-history"],
          },
        ],
      },
    }).guideObjects,
  ).toEqual([museum]);
});
it("does not use the visitor position or infer coordinates for unknown objects", () => {
  expect(
    buildTourProgress({
      tour,
      record: {
        ...record,
        message: "Look at the mysterious tower.",
        guidance: null,
        places: [
          { name: "Tower", lat: "", lng: "19" },
          { name: "Tower", lat: "91", lng: "19" },
        ],
      },
    }).guideObjects,
  ).toEqual([]);
});

it("does not treat an answer's contextual stop as the subject of an unmapped question", () => {
  expect(
    buildTourProgress({
      tour,
      record: {
        ...record,
        message: "That distant statue has an interesting story.",
        guidance: { stop_id: "museum", action: "ANSWER" },
        places: [],
      },
    }).guideObjects,
  ).toEqual([]);
});
it("matches whole Russian place names without matching a word fragment", () => {
  const russianTour = {
    ...tour,
    route: { points: [{ name: "Парк", lat: "47", lng: "19" }] },
  };
  expect(
    buildTourProgress({
      tour: russianTour,
      record: { ...record, guidance: null, message: "Здесь парковка." },
    }).guideObjects,
  ).toEqual([]);
  expect(
    buildTourProgress({
      tour: russianTour,
      record: { ...record, guidance: null, message: "Посмотрите на ПАРК." },
    }).guideObjects,
  ).toEqual([{ name: "Парк", coordinates: [19, 47], stopPosition: 1 }]);
});
it("does not guess between route objects with the same name", () => {
  const repeated = {
    ...tour,
    route: { points: points.map((p) => ({ ...p, name: "Museum" })) },
  };
  expect(
    buildTourProgress({
      tour: repeated,
      record: { ...record, guidance: null, message: "Museum." },
    }).guideObjects,
  ).toEqual([]);
});
it("uses the latest text reply's stop instead of a newly selected but undiscussed stop", () => {
  expect(
    buildTourProgress({
      tour,
      record,
      view: {
        stop_id: "park",
        stop_name: "River Park",
        turns: [
          {
            role: "guide",
            stop_id: "square",
            text: "Its cobbles are much older.",
            created_at: "2026-09-30T14:00:00Z",
          },
          {
            role: "visitor",
            stop_id: "park",
            text: "River Park?",
            created_at: "2026-09-30T15:00:00Z",
          },
        ],
      },
    }).guideObjects,
  ).toEqual([
    { name: "Old Square", coordinates: [19.001, 47.001], stopPosition: 2 },
  ]);
});
it("restores the historical guide subject and supports known legacy stop IDs", () => {
  const saved = {
    ...tour,
    route: { points: points.map(({ id, ...point }) => point) },
    history: [{ ...record, guidance: { stop_id: "route_point_1" } }],
  };
  expect(buildTourProgress({ tour: saved }).guideObjects).toEqual([
    { name: "Old Square", coordinates: [19.001, 47.001], stopPosition: 2 },
  ]);
});
it("clears previous highlights for a new reply with no resolvable subject but preserves silence", () => {
  const saved = { ...tour, history: [record] };
  expect(
    buildTourProgress({
      tour: saved,
      record: {
        ...record,
        message: "A new unrelated topic",
        guidance: null,
        created_at: "2026-09-30T14:00:00Z",
      },
    }).guideObjects,
  ).toEqual([]);
  expect(
    buildTourProgress({
      tour: saved,
      record: { type: "WAIT", message: "", created_at: "2026-09-30T14:00:00Z" },
    }).guideObjects,
  ).toEqual([museum]);
});
it("does not highlight a selected stop before any guide message exists", () => {
  expect(
    buildTourProgress({ tour, view: { stop_id: "museum", turns: [] } })
      .guideObjects,
  ).toEqual([]);
});
