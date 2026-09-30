export type MapPoint = [number, number];
const EARTH_RADIUS = 6371008.8;
const radians = (value: number) => (value * Math.PI) / 180;
const valid = (point: readonly number[]) =>
  point.length === 2 &&
  point.every(Number.isFinite) &&
  Math.abs(point[0]!) <= 180 &&
  Math.abs(point[1]!) <= 90;
function distance(a: MapPoint, b: MapPoint) {
  const h =
    Math.sin(radians(b[1] - a[1]) / 2) ** 2 +
    Math.cos(radians(a[1])) *
      Math.cos(radians(b[1])) *
      Math.sin(radians(b[0] - a[0]) / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(Math.min(1, h)));
}
const interpolate = (a: MapPoint, b: MapPoint, t: number): MapPoint => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];

/** Walk the returned path, using metres of path length rather than a straight line. */
export function createRouteWalk(
  points: readonly MapPoint[],
  start: MapPoint,
  metres: number,
  fromDistance?: number,
) {
  if (
    points.length < 2 ||
    points.some((p) => !valid(p)) ||
    !valid(start) ||
    !Number.isFinite(metres) ||
    metres <= 0
  )
    return null;
  const lengths = points
    .slice(1)
    .map((point, i) => distance(points[i]!, point));
  const offsets = [0];
  for (const length of lengths) offsets.push(offsets.at(-1)! + length);
  const totalDistance = offsets.at(-1)!;
  if (totalDistance < 0.01) return null;
  const at = (metres: number): MapPoint => {
    for (let i = 0; i < lengths.length; i++) {
      if (lengths[i]! > 0 && metres <= offsets[i + 1]!)
        return interpolate(
          points[i]!,
          points[i + 1]!,
          Math.max(0, (metres - offsets[i]!) / lengths[i]!),
        );
    }
    return [...points.at(-1)!];
  };
  let startDistance = 0;
  let nearest = Infinity;
  // Project onto nearby segments in a local metre-scaled plane.
  const scale = Math.cos(radians(start[1]));
  for (let i = 0; i < lengths.length; i++) {
    const a = points[i]!,
      b = points[i + 1]!;
    const x = (b[0] - a[0]) * scale,
      y = b[1] - a[1];
    const denominator = x * x + y * y;
    if (!denominator) continue;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((start[0] - a[0]) * scale * x + (start[1] - a[1]) * y) / denominator,
      ),
    );
    const delta = distance(start, interpolate(a, b, t));
    if (delta < nearest) {
      nearest = delta;
      startDistance = offsets[i]! + lengths[i]! * t;
    }
  }
  // Retain the cursor on loops/crossings only while the marker still matches it.
  if (
    fromDistance !== undefined &&
    Number.isFinite(fromDistance) &&
    fromDistance >= 0 &&
    fromDistance <= totalDistance &&
    distance(start, at(fromDistance)) < 1
  )
    startDistance = fromDistance;
  const endDistance = Math.min(totalDistance, startDistance + metres);
  return {
    startDistance,
    endDistance,
    totalDistance,
    positionAt: (fraction: number) =>
      at(
        startDistance +
          (endDistance - startDistance) * Math.max(0, Math.min(1, fraction)),
      ),
  };
}

/** Directions uses precision-five encoded polylines; stored routes use coordinates. */
export function decodeRouteGeometry(
  geometry: string | { coordinates: MapPoint[] },
): MapPoint[] {
  if (typeof geometry !== "string")
    return geometry.coordinates?.every(valid) ? geometry.coordinates : [];
  const points: MapPoint[] = [];
  let index = 0,
    lat = 0,
    lng = 0;
  const delta = () => {
    let result = 0,
      shift = 0;
    while (index < geometry.length && shift <= 30) {
      const byte = geometry.charCodeAt(index++) - 63;
      if (byte < 0 || byte > 63) return null;
      result |= (byte & 31) << shift;
      if (byte < 32) return result & 1 ? ~(result >>> 1) : result >>> 1;
      shift += 5;
    }
    return null;
  };
  while (index < geometry.length) {
    const dy = delta(),
      dx = delta();
    if (dy === null || dx === null) return [];
    lat += dy;
    lng += dx;
    const point: MapPoint = [lng / 1e5, lat / 1e5];
    if (!valid(point)) return [];
    points.push(point);
  }
  return points;
}
