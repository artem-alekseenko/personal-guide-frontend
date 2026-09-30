import { ref } from "vue";

export function useTourLoader(
  fetch: () => Promise<unknown>,
  isReady: () => boolean,
) {
  const loading = ref(true);
  const failed = ref(false);
  let active = true;
  let pending: Promise<void> | undefined;

  function load(): Promise<void> {
    if (!active) return Promise.resolve();
    if (pending) return pending;
    loading.value = true;
    failed.value = false;
    pending = (async () => {
      try {
        await fetch();
        if (active) failed.value = !isReady();
      } catch {
        if (active) failed.value = true;
      } finally {
        if (active) loading.value = false;
        pending = undefined;
      }
    })();
    return pending;
  }

  return {
    loading,
    failed,
    load,
    dispose: () => {
      active = false;
    },
  };
}
