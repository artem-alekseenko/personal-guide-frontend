import { defineStore } from "pinia";
import { ref } from "vue";
import { useUserStore } from "./userStore";

/** The backend uses one tour lease for text, playback receipts and finish. */
export const useTourRequestStore = defineStore("tourRequests", () => {
  const counts = ref<Record<string, number>>({});
  const queues = new Map<string, Promise<void>>();
  let epoch = 0;
  const reset = () => {
    epoch++;
    queues.clear();
    counts.value = {};
  };
  async function run<T>(tourId: string, task: () => Promise<T>): Promise<T> {
    const owner = useUserStore();
    const uid = owner.user?.uid;
    const current = epoch;
    const previous = queues.get(tourId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const tail = previous.then(() => gate);
    queues.set(tourId, tail);
    counts.value[tourId] = (counts.value[tourId] ?? 0) + 1;
    try {
      await previous;
      if (current !== epoch || owner.user?.uid !== uid)
        throw new Error("The signed-in account changed");
      return await task();
    } finally {
      release();
      if (current === epoch) {
        counts.value[tourId] = Math.max(0, (counts.value[tourId] ?? 1) - 1);
        if (queues.get(tourId) === tail) queues.delete(tourId);
      }
    }
  }
  return {
    run,
    reset,
    isBusy: (tourId: string) => (counts.value[tourId] ?? 0) > 0,
  };
});
