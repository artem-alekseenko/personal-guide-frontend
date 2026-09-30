import { expect, it } from "vitest";
import { buildTourProgress } from "../shared/utils/tourProgress";

const points = [
  { id: "museum", name: "Museum", lat: "47", lng: "19" },
  { id: "square", name: "Square", lat: "47.001", lng: "19.001" },
  { id: "park", name: "Park", lat: "47.002", lng: "19.002" },
];
const record = (message: string, created_at: string, stop_id = "square") => ({
  type: "SYSTEM_TEXT",
  message,
  created_at,
  point: { lat: "47.001", lng: "19.001" },
  guidance: { stop_id, stop_name: "Square", action: "ARRIVE" },
});
const tour = () => ({
  route: { points },
  status: "STARTED",
  history: [record("Our last story at the square.", "2026-09-30T12:00:00Z")],
  experience: {
    stop_id: "square",
    location_status: "GPS_CONFIRMED",
    turns: [],
  },
});

it("restores route position, last location and guide text from the fetched tour", () => {
  expect(buildTourProgress({ tour: tour() })).toMatchObject({
    totalStops: 3,
    stopPosition: 2,
    stopName: "Square",
    locationLabel: "confirmed",
    coordinates: { lat: "47.001", lng: "19.001" },
    latestText: "Our last story at the square.",
  });
});
it("uses historical guidance when the saved text experience was never initialized", () => {
  const saved = tour();
  const progress = buildTourProgress({
    tour: {
      ...saved,
      experience: { stop_id: null, location_status: "UNCERTAIN", turns: [] },
    },
  });
  expect(progress.stopPosition).toBe(2);
  expect(progress.stopName).toBe("Square");
  expect(progress.locationLabel).toBe("guide");
});
it("labels an explorer's selected stop without counting it as a visit", () => {
  const progress = buildTourProgress({
    tour: tour(),
    view: {
      stop_id: "park",
      stop_name: "Park",
      location_status: "USER_SELECTED",
      stops: points.map((p) => ({ id: p.id, name: p.name })),
      turns: [],
    },
  });
  expect(progress.stopPosition).toBe(3);
  expect(progress.locationLabel).toBe("selected");
});
it("does not revive a previous stop when the live state loses location", () => {
  const progress = buildTourProgress({
    tour: tour(),
    view: {
      stop_id: null,
      stop_name: null,
      location_status: "UNCERTAIN",
      stops: [],
      turns: [],
    },
  });
  expect(progress.stopPosition).toBeNull();
  expect(progress.stopName).toBeNull();
  expect(progress.locationLabel).toBe("unconfirmed");
});
it("uses the newer text reply and never exposes visitor messages as guide words", () => {
  const saved = tour();
  saved.history.push({
    ...record("Private visitor words", "2026-09-30T14:00:00Z"),
    type: "USER_TEXT",
  });
  const progress = buildTourProgress({
    tour: saved,
    view: {
      turns: [
        {
          role: "guide",
          text: "The latest explanation.",
          created_at: "2026-09-30T13:00:00Z",
        },
        {
          role: "visitor",
          text: "Private question",
          created_at: "2026-09-30T14:00:00Z",
        },
      ],
    },
  });
  expect(progress.latestText).toBe("The latest explanation.");
});
it("keeps the last real guide message across a later empty record", () => {
  const progress = buildTourProgress({
    tour: tour(),
    lastRecord: record("Live guide message.", "2026-09-30T13:00:00Z"),
    record: record("", "2026-09-30T13:01:00Z"),
  });
  expect(progress.latestText).toBe("Live guide message.");
});
it("does not infer position from missing GPS or pick the first route stop", () => {
  const progress = buildTourProgress({
    tour: { route: { points }, history: [] },
  });
  expect(progress.stopPosition).toBeNull();
  expect(progress.coordinates).toBeNull();
  expect(progress.latestText).toBeNull();
});
it("supports known legacy IDs but does not guess an index from a repeated name", () => {
  const legacyPoints = points.map(({ id, ...point }) => point);
  expect(
    buildTourProgress({
      tour: { route: { points: legacyPoints } },
      record: record("Story", "2026-09-30T13:00:00Z", "route_point_1"),
    }).stopPosition,
  ).toBe(2);
  expect(
    buildTourProgress({
      tour: { route: { points: legacyPoints } },
      record: record("Story", "2026-09-30T13:00:00Z", "stop_1"),
    }).stopPosition,
  ).toBe(2);
  expect(
    buildTourProgress({
      tour: { route: { points } },
      record: { guidance: { stop_name: "Square" } },
    }).stopPosition,
  ).toBeNull();
});
it("describes a walking target as a destination rather than a visited stop", () => {
  const saved = tour();
  const progress = buildTourProgress({
    tour: saved,
    record: {
      ...record("Keep walking.", "2026-09-30T13:00:00Z"),
      guidance: { stop_id: "park", stop_name: "Park", action: "WALK" },
    },
  });
  expect(progress.stopPosition).toBe(3);
  expect(progress.locationLabel).toBe("heading");
});
it("rejects malformed coordinates and handles legacy string histories", () => {
  const progress = buildTourProgress({
    tour: {
      route: { points },
      history: [
        "Legacy entry",
        {
          ...record("Valid guide text", "not a date"),
          point: { lat: "NaN", lng: "181" },
        },
      ],
    },
  });
  expect(progress.coordinates).toBeNull();
  expect(progress.latestText).toBe("Valid guide text");
  expect(progress.updatedAt).toBeNull();
});
it("finishing early does not claim all stops have been visited", () => {
  const saved = { ...tour(), status: "FINISHED" };
  const progress = buildTourProgress({ tour: saved });
  expect(progress.isFinished).toBe(true);
  expect(progress.stopPosition).toBe(2);
});
