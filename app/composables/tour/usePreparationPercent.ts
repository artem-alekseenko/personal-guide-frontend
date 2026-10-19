import { readonly, shallowRef, watch } from "vue";
import { usePreferredReducedMotion } from "@vueuse/core";
import type { PreparationProgress } from "#shared/types/preparationProgress";

/** Animate recorded progress only; time alone never creates completion. */
export function usePreparationPercent(
  snapshot: () => Pick<
    PreparationProgress,
    "generation_id" | "percent" | "status"
  >,
) {
  const displayed = shallowRef<number | null>(null);
  const reducedMotion = usePreferredReducedMotion();
  watch(
    () =>
      [
        snapshot().generation_id,
        snapshot().percent,
        snapshot().status,
        reducedMotion.value,
      ] as const,
    ([generation, value, status, motion], previous, onCleanup) => {
      const valid =
        typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 100;
      const target = valid
        ? status === "READY"
          ? 100
          : Math.min(99, Math.floor(value))
        : null;
      if (
        generation !== previous?.[0] ||
        target === null ||
        displayed.value === null ||
        target <= displayed.value ||
        status === "FAILED" ||
        status === "CANCELLED" ||
        motion === "reduce"
      ) {
        displayed.value = target;
        return;
      }
      const timer = setInterval(() => {
        displayed.value = Math.min(target, displayed.value! + 1);
        if (displayed.value === target) clearInterval(timer);
      }, 80);
      onCleanup(() => clearInterval(timer));
    },
    { immediate: true },
  );
  return readonly(displayed);
}
