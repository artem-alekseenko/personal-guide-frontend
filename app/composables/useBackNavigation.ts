import { throttle } from "~/utils/throttleDebounce";

type NavigationHistoryEntry = string;

const MAX_HISTORY_SIZE = 10;
const HISTORY_SAVE_THROTTLE_MS = 300;

export const useBackNavigation = () => {
  const route = useRoute();
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const navigationHistory = ref<NavigationHistoryEntry[]>([]);
  const isNavigatingBack = ref<boolean>(false);

  const isPWAStandalone = computed((): boolean => {
    if (!import.meta.client) return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone || // iOS Safari
      document.referrer.includes("android-app://") // Android TWA
    );
  });

  // ----- Storage helpers -----

  const saveNavigationHistoryToStorage = (): void => {
    if (import.meta.client) {
      localStorage.setItem(
        "navigationHistory",
        JSON.stringify(navigationHistory.value),
      );
    }
  };

  const throttledSaveNavigationHistory = throttle(
    saveNavigationHistoryToStorage,
    HISTORY_SAVE_THROTTLE_MS,
  );

  const initNavigationHistory = (): void => {
    if (!import.meta.client) return;

    const saved = localStorage.getItem("navigationHistory");
    if (!saved) return;

    try {
      const parsed = JSON.parse(saved);
      navigationHistory.value = Array.isArray(parsed)
        ? parsed.slice(-MAX_HISTORY_SIZE)
        : [];
    } catch {
      navigationHistory.value = [];
    }
  };

  // ----- History mutation -----

  const clearNavigationHistory = (): void => {
    navigationHistory.value = [];
    if (import.meta.client) {
      localStorage.removeItem("navigationHistory");
    }
  };

  const addToNavigationHistory = (routePath: NavigationHistoryEntry): void => {
    if (routePath.includes("/settings")) return;

    const last = navigationHistory.value[navigationHistory.value.length - 1];
    if (last === routePath) return;

    navigationHistory.value.push(routePath);

    if (navigationHistory.value.length > MAX_HISTORY_SIZE) {
      navigationHistory.value = navigationHistory.value.slice(-MAX_HISTORY_SIZE);
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
      const returnRoute = sessionStorage.getItem("settingsReturnRoute");
      sessionStorage.removeItem("settingsReturnRoute");

      if (navigationHistory.value.length > 0) {
        popFromNavigationHistory();
      }

      if (window.history.length > 1) {
        router.back();
      } else {
        router.replace(returnRoute || "/tours");
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

  watch(isAuthenticated, (newValue, oldValue) => {
    if (oldValue && !newValue) {
      clearNavigationHistory();
    }
  });

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
