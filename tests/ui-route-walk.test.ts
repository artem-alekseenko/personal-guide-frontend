import { expect, it, vi, afterEach } from "vitest";
import { effectScope, ref } from "vue";
import {
  createRouteWalk,
  decodeRouteGeometry,
} from "../shared/utils/routeMovement";
import { useRouteWalk } from "../app/composables/map/useRouteWalk";

// At the equator, 0.001 degrees is approximately 111.2 metres.
const path: [number, number][] = [
  [0, 0],
  [0.002, 0],
  [0.002, 0.002],
];
afterEach(() => vi.unstubAllGlobals());

it("advances 300 metres around a corner rather than cutting across the route", () => {
  const walk = createRouteWalk(path, [0, 0], 300)!;
  expect(walk.endDistance).toBeCloseTo(300, 5);
  expect(walk.positionAt(0.5)[0]).toBeCloseTo(0.001349, 6);
  expect(walk.positionAt(0.5)[1]).toBe(0);
  expect(walk.positionAt(1)[0]).toBe(0.002);
  expect(walk.positionAt(1)[1]).toBeCloseTo(0.000698, 6);
});
it("snaps an off-route marker to the closest path segment and caps the move at its end", () => {
  const walk = createRouteWalk(path, [0.0021, 0.001], 300)!;
  expect(walk.positionAt(0)[0]).toBe(0.002);
  expect(walk.positionAt(0)[1]).toBeCloseTo(0.001, 10);
  expect(walk.positionAt(1)).toEqual([0.002, 0.002]);
  expect(walk.endDistance).toBe(walk.totalDistance);
});
it("preserves forward progress on a closed route where the end repeats the start", () => {
  const loop: [number, number][] = [
    [0, 0],
    [0.002, 0],
    [0.002, 0.002],
    [0, 0],
  ];
  const first = createRouteWalk(loop, [0, 0], 10000)!;
  const next = createRouteWalk(
    loop,
    first.positionAt(1),
    300,
    first.endDistance,
  )!;
  expect(next.startDistance).toBe(first.totalDistance);
  expect(next.endDistance).toBe(first.totalDistance);
});
it("rejects unusable paths and never invents a line through invalid geometry", () => {
  expect(createRouteWalk([], [0, 0], 300)).toBeNull();
  expect(
    createRouteWalk(
      [
        [0, 0],
        [0, 0],
      ],
      [0, 0],
      300,
    ),
  ).toBeNull();
  expect(
    createRouteWalk(
      [
        [0, 0],
        [NaN, 1],
        [0.002, 0],
      ],
      [0, 0],
      300,
    ),
  ).toBeNull();
  expect(createRouteWalk(path, [181, 0], 300)).toBeNull();
});
it("decodes provider polylines in longitude/latitude order and rejects malformed input", () => {
  expect(decodeRouteGeometry("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([
    [-120.2, 38.5],
    [-120.95, 40.7],
    [-126.453, 43.252],
  ]);
  expect(decodeRouteGeometry("?")).toEqual([]);
  expect(
    decodeRouteGeometry({
      coordinates: [
        [0, 0],
        [0.002, 0],
      ],
    }),
  ).toEqual([
    [0, 0],
    [0.002, 0],
  ]);
});

function fixture() {
  let frame: FrameRequestCallback | null = null;
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
    frame = fn;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", () => {
    frame = null;
  });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  const scope = effectScope();
  const enabled = ref(true),
    busy = ref(false),
    geometry = ref(path);
  let position: [number, number] | null = [0, 0];
  const updates: [number, number][] = [];
  const walk = scope.run(() =>
    useRouteWalk({
      enabled,
      busy,
      geometry,
      getPosition: () => position,
      setPosition: (point) => {
        position = point;
        updates.push(point);
      },
    }),
  )!;
  const tick = (time: number) => {
    const pending = frame;
    frame = null;
    pending?.(time);
  };
  return {
    walk,
    scope,
    tick,
    updates,
    enabled,
    busy,
    geometry,
    position: () => position,
  };
}
it("animates through intermediate positions and subsequent presses continue from the last position", () => {
  const f = fixture();
  f.walk.move();
  f.tick(0);
  f.tick(1000);
  expect(f.walk.moving.value).toBe(true);
  expect(f.position()?.[1]).toBe(0);
  f.tick(3000);
  expect(f.walk.moving.value).toBe(false);
  expect(f.position()?.[1]).toBeCloseTo(0.000698, 6);
  f.walk.move();
  f.tick(4000);
  f.tick(7000);
  expect(f.position()).toEqual([0.002, 0.002]);
  expect(f.walk.atEnd.value).toBe(true);
  f.scope.stop();
});
it("cancels movement when GPS mode, a request, a new route, or unmount takes over", () => {
  for (const cancel of [
    (f: ReturnType<typeof fixture>) => {
      f.enabled.value = false;
    },
    (f: ReturnType<typeof fixture>) => {
      f.busy.value = true;
    },
    (f: ReturnType<typeof fixture>) => {
      f.geometry.value = [
        [0, 0],
        [0.003, 0],
      ];
    },
    (f: ReturnType<typeof fixture>) => {
      f.scope.stop();
    },
  ]) {
    const f = fixture();
    f.walk.move();
    f.tick(0);
    f.tick(500);
    const point = f.position();
    cancel(f);
    f.tick(3000);
    expect(f.position()).toEqual(point);
    expect(f.walk.moving.value).toBe(false);
    f.scope.stop();
  }
});
it("honours reduced motion and stays inactive outside simulation mode", () => {
  const f = fixture();
  f.enabled.value = false;
  f.walk.move();
  expect(f.updates).toEqual([]);
  f.enabled.value = true;
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  f.walk.move();
  expect(f.walk.moving.value).toBe(false);
  expect(f.position()?.[1]).toBeCloseTo(0.000698, 6);
  f.scope.stop();
});

it("keeps the stopped position and continues forward after an explicit interruption", () => {
  const f = fixture();
  f.walk.move();
  f.tick(0);
  f.tick(1000);
  f.walk.cancel();
  f.tick(3000);
  expect(f.position()?.[0]).toBeCloseTo(0.00089932, 7);
  expect(f.position()?.[1]).toBe(0);
  f.walk.move();
  f.tick(4000);
  f.tick(7000);
  expect(f.position()?.[0]).toBe(0.002);
  expect(f.position()?.[1]).toBeCloseTo(0.00159728, 7);
  f.scope.stop();
});
