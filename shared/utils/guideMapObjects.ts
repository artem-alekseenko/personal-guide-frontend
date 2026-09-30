import type { ProgressPoint } from "./tourProgress";

export interface GuideMapObject {
  name: string;
  coordinates: [number, number];
  stopPosition: number | null;
}
const normalize = (value: string) =>
  value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
function coordinates(point: ProgressPoint): [number, number] | null {
  if (!point.lat?.trim() || !point.lng?.trim()) return null;
  const lat = Number(point.lat),
    lng = Number(point.lng);
  return Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
    ? [lng, lat]
    : null;
}

/** Resolve subjects only against backend-provided places and known route coordinates. */
export function guideMapObjects(input: {
  text: string;
  stopId?: string | null;
  places?: readonly ProgressPoint[];
  route: readonly ProgressPoint[];
}): GuideMapObject[] {
  const result = new Map<string, GuideMapObject>();
  const add = (point: ProgressPoint, position: number | null) => {
    const name = point.name?.trim(),
      coords = coordinates(point);
    if (!name || !coords) return;
    const key = JSON.stringify([coords, normalize(name)]);
    const previous = result.get(key);
    result.set(key, {
      name: previous?.name ?? name,
      coordinates: coords,
      stopPosition: position ?? previous?.stopPosition ?? null,
    });
  };
  for (const point of input.places ?? []) {
    const coords = coordinates(point);
    const matches = coords
      ? input.route.flatMap((stop, i) => {
          const candidate = coordinates(stop);
          return candidate &&
            normalize(stop.name ?? "") === normalize(point.name ?? "") &&
            candidate[0] === coords[0] &&
            candidate[1] === coords[1]
            ? [i]
            : [];
        })
      : [];
    add(point, matches.length === 1 ? matches[0]! + 1 : null);
  }
  const names = input.route.map((point) => normalize(point.name ?? ""));
  const text = normalize(input.text);
  input.route.forEach((point, i) => {
    const name = names[i]!;
    if (name.length < 3 || names.filter((other) => other === name).length !== 1)
      return;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (
      new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "u").test(
        text,
      )
    )
      add(point, i + 1);
  });
  // Guidance/turn stop IDs provide context when the reply uses "this building".
  // A named subject elsewhere takes precedence over the stop at the visitor's feet.
  if (result.size === 0 && input.stopId) {
    let index = input.route.findIndex(
      (point, i) => (point.id || `route_point_${i}`) === input.stopId,
    );
    if (index < 0) {
      const match = /^stop_(\d+)$/.exec(input.stopId);
      const candidate = match ? Number(match[1]) : -1;
      if (
        candidate >= 0 &&
        candidate < input.route.length &&
        !input.route[candidate]?.id
      )
        index = candidate;
    }
    if (index >= 0) add(input.route[index]!, index + 1);
  }
  return [...result.values()];
}
