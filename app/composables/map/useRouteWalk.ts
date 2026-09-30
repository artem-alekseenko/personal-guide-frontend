import { computed, onScopeDispose, ref, watch, type Ref } from "vue";
import { createRouteWalk, type MapPoint } from "#shared/utils/routeMovement";

/** Local simulation only. No GPS writes, narration requests or playback effects. */
export function useRouteWalk(input: {
  enabled: Readonly<Ref<boolean>>;
  busy: Readonly<Ref<boolean>>;
  geometry: Readonly<Ref<readonly MapPoint[]>>;
  getPosition: () => MapPoint | null;
  setPosition: (position: MapPoint) => void;
}) {
  const moving = ref(false),
    atEnd = ref(false);
  let frame: number | null = null;
  let cursor: number | undefined;
  const cancel = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    moving.value = false;
  };
  const reset = () => {
    cancel();
    cursor = undefined;
    atEnd.value = false;
  };
  const usable = computed(() => {
    const first = input.geometry.value[0];
    return !!first && !!createRouteWalk(input.geometry.value, first, 300);
  });
  const canMove = computed(
    () =>
      input.enabled.value &&
      !input.busy.value &&
      !moving.value &&
      !atEnd.value &&
      usable.value,
  );
  const move = () => {
    if (!canMove.value) return;
    const start = input.getPosition() ?? input.geometry.value[0];
    const walk = start
      ? createRouteWalk(input.geometry.value, start, 300, cursor)
      : null;
    if (!walk) return;
    const place = (fraction: number) => {
      input.setPosition(walk.positionAt(fraction));
      cursor =
        walk.startDistance + (walk.endDistance - walk.startDistance) * fraction;
    };
    const finish = () => {
      place(1);
      moving.value = false;
      frame = null;
      atEnd.value = walk.endDistance >= walk.totalDistance;
    };
    if (globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    moving.value = true;
    place(0);
    let began: number | null = null;
    const tick: FrameRequestCallback = (time) => {
      began ??= time;
      const fraction = Math.min(1, Math.max(0, (time - began) / 3000));
      place(fraction);
      if (fraction === 1) finish();
      else frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
  };
  watch(input.geometry, reset, { flush: "sync" });
  watch(
    input.enabled,
    (enabled) => {
      if (!enabled) reset();
    },
    { flush: "sync" },
  );
  watch(
    input.busy,
    (busy) => {
      if (busy) cancel();
    },
    { flush: "sync" },
  );
  onScopeDispose(cancel);
  return { moving, atEnd, canMove, move, cancel, reset };
}
