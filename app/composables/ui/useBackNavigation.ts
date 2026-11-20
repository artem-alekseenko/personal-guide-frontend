import { computed, onMounted, ref, watch, type ComputedRef } from "vue";
import { useAuth } from "~/composables/auth/useAuth";
import { isInternalPath } from "~/utils/navigation";

export interface BackNavigation {
  shouldShow: ComputedRef<boolean>;
  goBack: () => Promise<void>;
}

const MAX_HISTORY_SIZE = 10;
const isHistoryRoute = (value: unknown): value is string => {
  if (!isInternalPath(value)) return false;
  const path = value.split(/[?#]/, 1)[0]?.replace(/\/$/, "");
  return !!path && path !== "/settings" && !path.startsWith("/settings/");
};

export const useBackNavigation = (): BackNavigation => {
  const router = useRouter();
  const route = router.currentRoute;
  const { isAuthenticated, user } = useAuth();
  const history = ref<string[]>([]);
  const navigating = ref(false);
  let skipOwnerTransition = false;

  const save = () => {
    if (!import.meta.client || !user.value) return;
    try {
      localStorage.setItem(
        "navigationHistory",
        JSON.stringify({ uid: user.value.uid, paths: history.value }),
      );
    } catch {
      // Storage is optional.
    }
  };
  const clear = () => {
    history.value = [];
    if (!import.meta.client) return;
    for (const [storageName, key] of [
      ["localStorage", "navigationHistory"],
      ["sessionStorage", "settingsReturnRoute"],
    ] as const) {
      try {
        globalThis[storageName].removeItem(key);
      } catch {
        /* Storage is optional. */
      }
    }
  };
  onMounted(() => {
    if (!import.meta.client) return;
    if (!isAuthenticated.value) {
      clear();
      return;
    }
    try {
      const saved: unknown = JSON.parse(
        localStorage.getItem("navigationHistory") ?? "null",
      );
      if (saved === null) return;
      if (
        typeof saved !== "object" ||
        !("uid" in saved) ||
        saved.uid !== user.value?.uid ||
        !("paths" in saved) ||
        !Array.isArray(saved.paths)
      ) {
        clear();
        return;
      }
      history.value = saved.paths
        .filter(isHistoryRoute)
        .slice(-MAX_HISTORY_SIZE);
    } catch {
      history.value = [];
    }
  });

  const shouldShow = computed(
    () =>
      isAuthenticated.value &&
      route.value.path !== "/" &&
      route.value.path.replace(/\/$/, "") !== "/tours",
  );

  watch(
    () => user.value?.uid ?? null,
    (uid, previousUid) => {
      if (uid !== previousUid) {
        clear();
        skipOwnerTransition = previousUid !== null;
      }
    },
    { flush: "sync" },
  );

  watch(
    () => route.value.fullPath,
    (to, from) => {
      if (skipOwnerTransition) {
        skipOwnerTransition = false;
        return;
      }
      if (navigating.value || !isAuthenticated.value || to === from) return;
      const previousIndex = history.value.lastIndexOf(to);
      if (previousIndex >= 0) {
        history.value = history.value.slice(0, previousIndex);
      } else if (isHistoryRoute(from) && history.value.at(-1) !== from) {
        history.value = [...history.value, from].slice(-MAX_HISTORY_SIZE);
      }
      save();
    },
    { flush: "sync" },
  );

  const goBack = async () => {
    if (!import.meta.client || !shouldShow.value || navigating.value) return;
    let target = route.value.meta?.backToTours
      ? "/tours"
      : (history.value.findLast((path) => path !== route.value.fullPath) ??
        "/tours");
    if (route.value.name === "settings") {
      try {
        const saved: unknown = JSON.parse(
          sessionStorage.getItem("settingsReturnRoute") ?? "null",
        );
        sessionStorage.removeItem("settingsReturnRoute");
        if (
          saved &&
          typeof saved === "object" &&
          "uid" in saved &&
          saved.uid === user.value?.uid &&
          "path" in saved &&
          isHistoryRoute(saved.path)
        )
          target = saved.path;
      } catch {
        /* Use in-memory history when storage is unavailable. */
      }
    }
    const uid = user.value?.uid;
    const index = history.value.lastIndexOf(target);
    const remaining =
      index >= 0 ? history.value.slice(0, index) : history.value;
    navigating.value = true;
    try {
      // Only use browser history when Vue Router identifies the expected entry.
      if (window.history.state?.back === target) {
        await new Promise<void>((resolve) => {
          const remove = router.afterEach((to, _from, failure) => {
            remove();
            if (!failure && to.fullPath === target && user.value?.uid === uid) {
              history.value = remaining;
              save();
            }
            resolve();
          });
          router.back();
        });
        return;
      }
      const failure = await router.replace(target);
      if (!failure && user.value?.uid === uid) {
        history.value = remaining;
        save();
      }
    } finally {
      navigating.value = false;
    }
  };
  return { shouldShow, goBack };
};
