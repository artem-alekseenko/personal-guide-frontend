import { guideMapObjects, type GuideMapObject } from "./guideMapObjects";

export interface ProgressPoint {
  lat: string;
  lng: string;
  id?: string | null;
  name?: string | null;
}
export interface ProgressRecord {
  places?: readonly ProgressPoint[];
  type?: string;
  message?: string;
  point?: ProgressPoint;
  created_at?: string;
  guidance?: {
    stop_id?: string | null;
    stop_name?: string | null;
    action?: string;
  } | null;
}
export interface ProgressState {
  stop_id?: string | null;
  stop_name?: string | null;
  location_status?: string;
  last_position?: ProgressPoint | null;
  last_fix_at?: string | null;
  revision?: number;
  stops?: readonly { id: string; name: string }[];
  turns?: readonly {
    role: string;
    kind?: "story" | "navigation";
    fact_ids?: readonly string[];
    text: string;
    created_at: string;
    stop_id?: string | null;
  }[];
}
export interface ProgressTour {
  id?: string;
  user_id?: string;
  status?: string;
  route: { points: readonly ProgressPoint[] };
  history?: readonly (ProgressRecord | string)[];
  experience?: ProgressState;
}
export interface TourProgress {
  guideObjects?: GuideMapObject[];
  stopPosition: number | null;
  totalStops: number;
  stopName: string | null;
  locationLabel: "confirmed" | "selected" | "unconfirmed" | "guide" | "heading";
  coordinates: { lat: string; lng: string } | null;
  latestText: string | null;
  updatedAt: string | null;
  isFinished: boolean;
}
export interface ProgressInput {
  tour: ProgressTour;
  view?: ProgressState | null;
  record?: ProgressRecord | null;
  lastRecord?: ProgressRecord | null;
}

export function isGuideText(record?: ProgressRecord | null): boolean {
  return (
    !!record?.message?.trim() &&
    ["SYSTEM_TEXT", "MOVE", "WAIT"].includes(record.type ?? "")
  );
}
function timestamp(value?: string | null): number {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? time : -Infinity;
}
function newest<T extends { created_at?: string | null }>(
  items: readonly T[],
): T | undefined {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const first = timestamp(a.item.created_at),
        second = timestamp(b.item.created_at);
      return first === second ? b.index - a.index : second > first ? 1 : -1;
    })[0]?.item;
}
function coordinates(
  point?: ProgressPoint | null,
): TourProgress["coordinates"] {
  if (!point || !point.lat?.trim() || !point.lng?.trim()) return null;
  const lat = Number(point.lat),
    lng = Number(point.lng);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    return null;
  return { lat: point.lat, lng: point.lng };
}

/** Summarize returned data; selecting a stop never establishes a physical visit. */
export function buildTourProgress({
  tour,
  view,
  record,
  lastRecord,
}: ProgressInput): TourProgress {
  const history = (tour.history ?? []).filter(
    (entry): entry is ProgressRecord =>
      typeof entry === "object" && entry !== null,
  );
  const records = [
    ...history,
    ...(lastRecord ? [lastRecord] : []),
    ...(record ? [record] : []),
  ];
  const state = view ?? tour.experience;
  const routeStops = tour.route.points.map((point, index) => ({
    id: point.id || `route_point_${index}`,
    name: point.name ?? "",
  }));
  const stops = view?.stops?.length ? view.stops : routeStops;
  const historicalGuidance = newest(
    history.filter(
      (entry) => entry.guidance?.stop_id || entry.guidance?.stop_name,
    ),
  )?.guidance;
  const liveGuidance =
    record?.guidance?.stop_id || record?.guidance?.stop_name
      ? record.guidance
      : lastRecord?.guidance;
  const guidance = liveGuidance ?? historicalGuidance;
  // A live text view is authoritative even when it explicitly clears the stop.
  const initializedState =
    !!state &&
    (!!state.stop_id ||
      !!state.stop_name ||
      !!state.last_fix_at ||
      !!state.turns?.length ||
      (state.revision ?? 0) > 0);
  const useState = !!view || (!liveGuidance && initializedState);
  const stopId = useState ? state?.stop_id : guidance?.stop_id;
  let index = stopId ? stops.findIndex((stop) => stop.id === stopId) : -1;
  // Generation packages use stop_{index} for legacy points lacking explicit IDs.
  if (index < 0 && !view?.stops?.length && stopId?.startsWith("stop_")) {
    const match = /^stop_(\d+)$/.exec(stopId);
    const candidate = match ? Number(match[1]) : -1;
    if (
      candidate >= 0 &&
      candidate < tour.route.points.length &&
      !tour.route.points[candidate]?.id
    )
      index = candidate;
  }
  const status = useState ? state?.location_status : null;
  const locationLabel: TourProgress["locationLabel"] =
    status === "GPS_CONFIRMED"
      ? "confirmed"
      : status === "USER_SELECTED"
        ? "selected"
        : useState
          ? "unconfirmed"
          : guidance?.action === "WALK"
            ? "heading"
            : "guide";
  const replies = [
    ...records.filter(isGuideText).map((entry) => ({
      text: entry.message!.trim(),
      created_at: entry.created_at,
      // ANSWER/LOCATE/WAIT stop IDs can describe visitor context, not the subject.
      stopId:
        !entry.guidance?.action ||
        ["ARRIVE", "CONTINUE", "WALK"].includes(entry.guidance.action)
          ? entry.guidance?.stop_id
          : null,
      places: entry.places,
    })),
    ...(state?.turns ?? [])
      .filter((turn) => turn.role === "guide" && turn.text.trim())
      .map((turn) => ({
        text: turn.text.trim(),
        created_at: turn.created_at,
        // Some operational replies are marked story but deliberately carry no facts.
        stopId:
          turn.kind === "navigation" || turn.fact_ids?.length === 0
            ? null
            : turn.stop_id,
        places: undefined,
      })),
  ];
  const reply = newest(replies);
  const locations = records
    .map((entry) => ({
      point: coordinates(entry.point),
      created_at: entry.created_at,
    }))
    .filter((entry) => entry.point !== null);
  const savedPosition = coordinates(tour.experience?.last_position);
  if (savedPosition)
    locations.push({
      point: savedPosition,
      created_at: tour.experience?.last_fix_at ?? undefined,
    });
  const location = newest(locations);
  const update = newest([
    ...(reply ? [reply] : []),
    ...(location ? [location] : []),
  ]);
  return {
    guideObjects: reply
      ? guideMapObjects({ ...reply, route: tour.route.points })
      : [],
    stopPosition: index >= 0 ? index + 1 : null,
    totalStops: stops.length,
    stopName:
      (useState ? state?.stop_name : guidance?.stop_name)?.trim() ||
      (index >= 0 ? stops[index]?.name?.trim() : null) ||
      null,
    locationLabel,
    coordinates: location?.point ?? null,
    latestText: reply?.text ?? null,
    updatedAt:
      update && timestamp(update.created_at) !== -Infinity
        ? update.created_at!
        : null,
    isFinished: tour.status === "FINISHED",
  };
}
