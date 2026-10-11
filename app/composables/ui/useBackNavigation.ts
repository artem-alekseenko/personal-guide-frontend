import type { ComputedRef } from "vue";
import { throttle } from "~/utils/throttleDebounce";
import { useAuth } from "~/composables/auth/useAuth";
import { isInternalPath } from "~/utils/navigation";

type NavigationHistoryEntry = string;

export interface BackNavigation {
  shouldShow: ComputedRef<boolean>;
  goBack: () => void;
}

const MAX_HISTORY_SIZE = 10;
const HISTORY_SAVE_THROTTLE_MS = 300;

const isHistoryRoute = (value: unknown): value is string => {
  if (!isInternalPath(value)) {
    return false;
  }
  const path = value.split(/[?#]/, 1)[0];
  return (
    path !== "/" && path !== "/settings" && !path?.startsWith("/settings/")
  );
};

export const useBackNavigation = (): BackNavigation => {
  const route = useRoute();
  const router = useRouter();
  const { isAuthenticated, user } = useAuth();

  const navigationHistory = ref<NavigationHistoryEntry[]>([]);
  const isNavigatingBack = ref<boolean>(false);

  const isPWAStandalone = computed((): boolean => {
    if (!import.meta.client) return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator &&
        window.navigator.standalone === true) || // iOS Safari
      document.referrer.includes("android-app://") // Android TWA
    );
  });

  // ----- Storage helpers -----

  const saveNavigationHistoryToStorage = (): void => {
    if (!import.meta.client || !user.value) return;
    try {
      localStorage.setItem(
        "navigationHistory",
        JSON.stringify({ uid: user.value.uid, paths: navigationHistory.value }),
      );
    } catch {
      // Storage is optional; retain the current session's in-memory history.
    }
  };

  const throttledSaveNavigationHistory = throttle(
    saveNavigationHistoryToStorage,
    HISTORY_SAVE_THROTTLE_MS,
  );

  const initNavigationHistory = (): void => {
    if (!import.meta.client) return;
    if (!isAuthenticated.value) {
      clearNavigationHistory();
      return;
    }

    try {
      const saved = localStorage.getItem("navigationHistory");
      if (!saved) return;
      const parsed: unknown = JSON.parse(saved);
      if (
        typeof parsed !== "object" ||
        parsed === null ||
        !("uid" in parsed) ||
        parsed.uid !== user.value?.uid ||
        !("paths" in parsed) ||
        !Array.isArray(parsed.paths)
      ) {
        clearNavigationHistory();
        return;
      }
      navigationHistory.value = parsed.paths
        .filter(isHistoryRoute)
        .slice(-MAX_HISTORY_SIZE);
    } catch {
      navigationHistory.value = [];
    }
  };

  // ----- History mutation -----

  const clearNavigationHistory = (): void => {
    throttledSaveNavigationHistory.cancel();
    navigationHistory.value = [];
    if (import.meta.client) {
      try {
        localStorage.removeItem("navigationHistory");
      } catch {
        // A blocked storage area must not prevent account isolation.
      }
      try {
        sessionStorage.removeItem("settingsReturnRoute");
      } catch {
        // Session storage can be independently unavailable.
      }
    }
  };

  const addToNavigationHistory = (routePath: NavigationHistoryEntry): void => {
    if (!isAuthenticated.value) return;
    if (!isHistoryRoute(routePath)) return;

    const last = navigationHistory.value[navigationHistory.value.length - 1];
    if (last === routePath) return;

    navigationHistory.value.push(routePath);

    if (navigationHistory.value.length > MAX_HISTORY_SIZE) {
      navigationHistory.value =
        navigationHistory.value.slice(-MAX_HISTORY_SIZE);
    }

    throttledSaveNavigationHistory();
  };

  const popFromNavigationHistory = (): NavigationHistoryEntry | undefined => {
    const previous = navigationHistory.value.pop();
    saveNavigationHistoryToStorage();
    return previous;
  };

  // ----- Computed state -----

  const canNavigateBack = computed((): boolean => {
    if (route.name === "settings") return true;

    if (route.name === "index" || route.name === "tours") {
      const last = navigationHistory.value[navigationHistory.value.length - 1];
      return !!last && !last.includes(route.path);
    }

    if (navigationHistory.value.length > 0) return true;
    if (import.meta.client && window.history.length > 1) return true;
    if (import.meta.client && document.referrer) return true;

    return isPWAStandalone.value && route.name !== "index";
  });

  const shouldShow = computed((): boolean => {
    if (route.name === "index") return false;
    if (!isAuthenticated.value) return false;
    return canNavigateBack.value;
  });

  // ----- Navigation action -----

  const goBack = (): void => {
    if (!import.meta.client || !canNavigateBack.value) return;

    isNavigatingBack.value = true;

    if (route.name === "settings") {
      let returnRoute = "/tours";
      try {
        const saved = sessionStorage.getItem("settingsReturnRoute");
        sessionStorage.removeItem("settingsReturnRoute");
        const parsed: unknown = saved ? JSON.parse(saved) : null;
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          "uid" in parsed &&
          parsed.uid === user.value?.uid &&
          "path" in parsed &&
          isHistoryRoute(parsed.path)
        ) {
          returnRoute = parsed.path;
        }
      } catch {
        // Fall back to the tour list when storage is blocked or malformed.
      }

      if (navigationHistory.value.length > 0) {
        popFromNavigationHistory();
      }

      if (window.history.length > 1) {
        router.back();
      } else {
        router.replace(returnRoute);
      }
      return;
    }

    if (navigationHistory.value.length > 0) {
      const previousRoute = popFromNavigationHistory();

      if (previousRoute && !previousRoute.includes(route.path)) {
        router.push(previousRoute);
        return;
      }
    }

    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/tours");
    }
  };

  // ----- Watchers & lifecycle -----

  watch(
    () => user.value?.uid ?? null,
    (uid, previousUid) => {
      if (uid !== previousUid) {
        clearNavigationHistory();
        // Do not add the previous owner's page during the redirect.
        if (previousUid !== null) isNavigatingBack.value = true;
      }
    },
    { flush: "sync" },
  );

  watch(
    () => route.fullPath,
    (newPath, oldPath) => {
      if (!isNavigatingBack.value && oldPath && newPath !== oldPath) {
        addToNavigationHistory(oldPath);
      }
      isNavigatingBack.value = false;
    },
  );

  onMounted(() => {
    initNavigationHistory();
  });

  onUnmounted(() => {
    throttledSaveNavigationHistory.cancel();
  });

  return {
    shouldShow,
    goBack,
  };
};
