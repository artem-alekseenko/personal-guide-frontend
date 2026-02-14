<template>
  <header
    class="w-full border-b border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
  >
    <div
      class="container mx-auto flex items-center justify-between p-4 md:px-12"
    >
      <!-- Page title with optional back button -->
      <div class="flex items-center space-x-3">
        <!-- Back button (show only on certain pages) -->
        <UButton
          v-if="shouldShowBackButton"
          :aria-label="$t('common.goBack')"
          :class="[
            'transition-colors',
            canNavigateBack
              ? 'text-green-500 hover:bg-gray-100 dark:text-white dark:hover:bg-gray-700'
              : 'cursor-not-allowed text-gray-400 dark:text-gray-600',
          ]"
          :disabled="!canNavigateBack"
          icon="i-heroicons-arrow-left"
          size="sm"
          variant="ghost"
          @click="goBack"
        />

        <h1 class="text-2xl font-extrabold text-gray-900 dark:text-white">
          {{ pageTitle }}
        </h1>
      </div>

      <!-- Navigation and settings -->
      <div v-if="isAuthenticated" class="flex items-center space-x-4">
        <UButton
          v-if="route.name !== 'settings'"
          :aria-label="$t('common.settings')"
          icon="i-heroicons-cog-6-tooth"
          size="lg"
          variant="ghost"
          @click="goToSettings"
        />

        <!-- User avatar -->
        <div class="flex items-center">
          <div
            v-if="!userAvatar || userAvatar === '/default-avatar.png'"
            class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200"
          >
            <span class="text-sm font-medium text-gray-600">
              {{ userName.charAt(0).toUpperCase() }}
            </span>
          </div>
          <UAvatar v-else :alt="userName" :src="userAvatar" size="sm" />
        </div>
      </div>
    </div>
  </header>
</template>

<script lang="ts" setup>
import { useAuth } from "~/composables/useAuth";
import { useTourStore } from "~/stores/tourStore";
import { usePageTitle } from "~/composables/usePageTitle";
import { throttle } from "~/utils/throttleDebounce";

type RouteName = string | symbol | null | undefined;
type NavigationHistoryEntry = string;

const route = useRoute();
const router = useRouter();
const { userName, userAvatar, isAuthenticated } = useAuth();
const tourStore = useTourStore();
const { t } = useI18n();

const MAX_HISTORY_SIZE = 10;
const HISTORY_SAVE_THROTTLE_MS = 300;

const navigationHistory = ref<NavigationHistoryEntry[]>([]);

const { pageTitle } = usePageTitle();

const canGoBack = ref<boolean>(false);

const isPWAStandalone = computed((): boolean => {
  if (!import.meta.client) return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone || // iOS Safari
    document.referrer.includes("android-app://")
  ); // Android TWA
});

const initNavigationHistory = (): void => {
  if (import.meta.client) {
    const savedHistory = localStorage.getItem("navigationHistory");
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        navigationHistory.value = Array.isArray(parsed)
          ? parsed.slice(-MAX_HISTORY_SIZE)
          : [];
      } catch {
        navigationHistory.value = [];
      }
    }
  }
};

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

onUnmounted(() => {
  throttledSaveNavigationHistory.cancel();
});

const clearNavigationHistory = (): void => {
  navigationHistory.value = [];
  if (import.meta.client) {
    localStorage.removeItem("navigationHistory");
  }
};

const addToNavigationHistory = (routePath: NavigationHistoryEntry): void => {
  // Don't add settings to history
  if (routePath.includes("/settings")) {
    return;
  }

  if (
    navigationHistory.value.length > 0 &&
    navigationHistory.value[navigationHistory.value.length - 1] === routePath
  ) {
    return;
  }

  navigationHistory.value.push(routePath);

  if (navigationHistory.value.length > MAX_HISTORY_SIZE) {
    navigationHistory.value = navigationHistory.value.slice(-MAX_HISTORY_SIZE);
  }

  throttledSaveNavigationHistory();
};

const popFromNavigationHistory = (): NavigationHistoryEntry | undefined => {
  const previousRoute = navigationHistory.value.pop();

  saveNavigationHistoryToStorage();

  return previousRoute;
};

const canNavigateBack = computed((): boolean => {
  if (route.name === "settings") {
    return true;
  }

  if (route.name === "index" || route.name === "tours") {
    if (navigationHistory.value.length > 0) {
      const lastRoute =
        navigationHistory.value[navigationHistory.value.length - 1];
      if (lastRoute && !lastRoute.includes(route.path)) {
        return true;
      }
    }

    return false;
  }

  if (navigationHistory.value.length > 0) {
    return true;
  }

  if (import.meta.client && window.history.length > 1) {
    return true;
  }

  if (import.meta.client && document.referrer) {
    return true;
  }

  return isPWAStandalone.value && route.name !== "index";
});

const updateBackButtonState = (): void => {
  if (import.meta.client) {
    const hasHistory = window.history.length > 1;
    const hasReferrer = !!document.referrer;
    const isPWA = isPWAStandalone.value;
    const hasLocalHistory = navigationHistory.value.length > 0;

    canGoBack.value =
      hasHistory ||
      hasReferrer ||
      hasLocalHistory ||
      (isPWA && route.name !== "index");

    console.log("Back button state:", {
      routeName: route.name,
      hasHistory,
      hasReferrer,
      isPWA,
      hasLocalHistory,
      historySize: navigationHistory.value.length,
      canGoBack: canGoBack.value,
    });
  }
};

onMounted(() => {
  initNavigationHistory();
  updateBackButtonState();

  if (import.meta.client) {
    window.addEventListener("popstate", updateBackButtonState);
  }
});

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener("popstate", updateBackButtonState);
  }
});

watch(isAuthenticated, (newValue: boolean, oldValue: boolean) => {
  if (oldValue && !newValue) {
    console.log("🧭 User logged out, clearing navigation history");
    clearNavigationHistory();
  }
});

watch(route, (newRoute, oldRoute) => {
  if (oldRoute && newRoute.path !== oldRoute.path) {
    addToNavigationHistory(oldRoute.fullPath);

    console.log("Navigation history updated:", {
      from: oldRoute.fullPath,
      to: newRoute.fullPath,
      historySize: navigationHistory.value.length,
      history: navigationHistory.value,
    });
  }
  updateBackButtonState();
});

const shouldShowBackButton = computed((): boolean => {
  const excludedPages: RouteName[] = ["index"];

  const isExcluded = excludedPages.includes(route.name);
  const userAuthenticated = isAuthenticated.value;

  if (isExcluded) {
    return false;
  }

  return userAuthenticated;
});

const goToSettings = (): void => {
  router.push("/settings");
};

const goBack = (): void => {
  if (!import.meta.client || !canNavigateBack.value) return;

  if (route.name === "settings") {
    if (navigationHistory.value.length > 0) {
      const previousRoute = popFromNavigationHistory(); // Uses immediate save
      if (previousRoute) {
        router.replace(previousRoute);
        return;
      }
    }

    const returnRoute = sessionStorage.getItem("settingsReturnRoute");
    if (returnRoute) {
      sessionStorage.removeItem("settingsReturnRoute");
      router.replace(returnRoute);
      return;
    }

    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.replace("/tours");
    return;
  }

  if (navigationHistory.value.length > 0) {
    const previousRoute = popFromNavigationHistory(); // Uses immediate save for reliability

    if (previousRoute && !previousRoute.includes(route.path)) {
      router.push(previousRoute);
      return;
    }
  }

  if (route.name === "index") {
    return;
  }

  if (route.name === "tours") {
    if (navigationHistory.value.length > 0) {
      const previousRoute = popFromNavigationHistory(); // Uses immediate save
      if (previousRoute && !previousRoute.includes("/tours")) {
        router.push(previousRoute);
        return;
      }
    }
    return;
  }

  if (isPWAStandalone.value) {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/tours");
    }
  } else {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/tours");
    }
  }
};
</script>
