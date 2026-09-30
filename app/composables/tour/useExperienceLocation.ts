import { ref, watch, type Ref } from "vue";
import type { Interaction } from "~/types/tourExperience";
type Fix = Pick<Interaction, "point" | "accuracy" | "recorded_at">;

/** Coalesce fixes and keep a clearing update queued until mutations settle. */
export function useExperienceLocation(options: {
  enabled: Readonly<Ref<boolean>>;
  blocked: Readonly<Ref<boolean>>;
  ready: Readonly<Ref<boolean>>;
  hasLocation?: Readonly<Ref<boolean>>;
  fix: Readonly<Ref<Fix>>;
  send: (body: Interaction) => Promise<boolean>;
}) {
  const inFlight = ref(false);
  let lastSignature = "",
    lastAttempt: string | undefined,
    attemptedLocation = false,
    epoch = 0;
  const reset = () => {
    epoch++;
    lastSignature = "";
    lastAttempt = undefined;
    attemptedLocation = false;
    inFlight.value = false;
  };
  const reconcile = () => {
    lastAttempt = undefined;
  };
  async function sync() {
    if (options.blocked.value || inFlight.value || !options.ready.value) return;
    const fix = options.fix.value;
    const age = fix.recorded_at
      ? Date.now() - Date.parse(fix.recorded_at)
      : Infinity;
    const valid =
      options.enabled.value &&
      fix.point &&
      Number.isFinite(fix.accuracy) &&
      fix.accuracy! >= 0 &&
      fix.accuracy! <= 10000 &&
      age >= -30000 &&
      age <= 90000;
    const body: Interaction = valid
      ? { action: "LOCATION_UPDATE", ...fix }
      : { action: "LOCATION_UPDATE" };
    const signature = valid ? JSON.stringify(fix) : "";
    if (signature === lastAttempt) return;
    if (
      signature === lastSignature &&
      !(!valid && (attemptedLocation || options.hasLocation?.value))
    )
      return;
    const current = epoch;
    lastAttempt = signature;
    inFlight.value = true;
    if (valid) attemptedLocation = true;
    try {
      if ((await options.send(body)) && current === epoch) {
        lastSignature = signature;
        if (!valid) attemptedLocation = false;
      }
    } finally {
      if (current === epoch) inFlight.value = false;
    }
  }
  watch(
    [options.enabled, options.blocked, options.ready, options.fix],
    () => {
      void sync();
    },
    { immediate: true, flush: "post" },
  );
  // Settling an in-flight fix also flushes a GPS-off change made during it.
  watch(
    inFlight,
    (busy) => {
      if (
        !busy &&
        (!options.enabled.value ||
          JSON.stringify(options.fix.value) !== lastSignature)
      )
        void sync();
    },
    { flush: "post" },
  );
  return { sync, reset, reconcile };
}
