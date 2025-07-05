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
      <div class="flex items-center space-x-4">
        <!-- Settings icon (hide on settings page) -->
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
import type { RouteLocationNormalized } from "vue-router";

// Type definitions for better reliability
type RouteName = string | symbol | null | undefined;
type NavigationHistoryEntry = string;

const route = useRoute();
const router = useRouter();
const { userName, userAvatar, isAuthenticated } = useAuth();
const tourStore = useTourStore();
const { t } = useI18n();

const MAX_HISTORY_SIZE = 10;
const HISTORY_SAVE_THROTTLE_MS = 300; // Throttle history saves to max once per 300ms

// Local navigation history with explicit typing
const navigationHistory = ref<NavigationHistoryEntry[]>([]);

// Use the page title composable for automatic i18n support
const { pageTitle } = usePageTitle();

// Track browser history state
const canGoBack = ref<boolean>(false);

// Check if app is PWA in standalone mode
const isPWAStandalone = computed((): boolean => {
  if (!import.meta.client) return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone || // iOS Safari
    document.referrer.includes("android-app://")
  ); // Android TWA
});

// Initialize history from localStorage
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

// Save history to localStorage (immediate save - for critical operations like pop)
const saveNavigationHistoryToStorage = (): void => {
  if (import.meta.client) {
    localStorage.setItem(
      "navigationHistory",
      JSON.stringify(navigationHistory.value),
    );
  }
};

// Throttled version of save function to prevent excessive localStorage writes during rapid adds
const throttledSaveNavigationHistory = throttle(
  saveNavigationHistoryToStorage,
  HISTORY_SAVE_THROTTLE_MS,
);

// Auto-cleanup throttled function on component unmount
onUnmounted(() => {
  throttledSaveNavigationHistory.cancel();
});

// Clear navigation history (for logout cleanup)
const clearNavigationHistory = (): void => {
  navigationHistory.value = [];
  if (import.meta.client) {
    localStorage.removeItem("navigationHistory");
  }
};

// Add route to history
const addToNavigationHistory = (routePath: NavigationHistoryEntry): void => {
  // Don't add settings to history
  if (routePath.includes("/settings")) {
    return;
  }

  // Don't add if it's the same route
  if (
    navigationHistory.value.length > 0 &&
    navigationHistory.value[navigationHistory.value.length - 1] === routePath
  ) {
    return;
  }

  navigationHistory.value.push(routePath);

  // Limit history size
  if (navigationHistory.value.length > MAX_HISTORY_SIZE) {
    navigationHistory.value = navigationHistory.value.slice(-MAX_HISTORY_SIZE);
  }

  // Use throttled save for add operations to prevent excessive writes during rapid navigation
  throttledSaveNavigationHistory();
};

// Remove and return the last route from history (with immediate save for reliability)
const popFromNavigationHistory = (): NavigationHistoryEntry | undefined => {
  const previousRoute = navigationHistory.value.pop();

  // Critical: save immediately after pop to prevent data loss during rapid back navigation
  saveNavigationHistoryToStorage();

  return previousRoute;
};

// Check if we can navigate back
const canNavigateBack = computed((): boolean => {
  // Can always go back from settings page
  if (route.name === "settings") {
    return true;
  }

  // For main pages (index, tours) check more strictly
  if (route.name === "index" || route.name === "tours") {
    // If we have entries in our history AND they differ from current page
    if (navigationHistory.value.length > 0) {
      const lastRoute =
        navigationHistory.value[navigationHistory.value.length - 1];
      if (lastRoute && !lastRoute.includes(route.path)) {
        return true;
      }
    }

    // For main pages - more conservative approach
    return false;
  }

  // If we have entries in our history
  if (navigationHistory.value.length > 0) {
    return true;
  }

  // Or if there's browser history
  if (import.meta.client && window.history.length > 1) {
    return true;
  }

  // Or if there's a referrer
  if (import.meta.client && document.referrer) {
    return true;
  }

  // Or if it's PWA and we're not on main page
  return isPWAStandalone.value && route.name !== "index";
});

// Check back capability on mount and route change
const updateBackButtonState = (): void => {
  if (import.meta.client) {
    // Simple logic: show button if there's history or if it's PWA
    const hasHistory = window.history.length > 1;
    const hasReferrer = !!document.referrer;
    const isPWA = isPWAStandalone.value;
    const hasLocalHistory = navigationHistory.value.length > 0;

    canGoBack.value =
      hasHistory ||
      hasReferrer ||
      hasLocalHistory ||
      (isPWA && route.name !== "index");

    // Debug logging
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

  // Listen for browser history changes
  if (import.meta.client) {
    window.addEventListener("popstate", updateBackButtonState);
  }
});

onUnmounted(() => {
  if (import.meta.client) {
    window.removeEventListener("popstate", updateBackButtonState);
  }
});

// Watch for authentication state changes to clear history on logout
watch(isAuthenticated, (newValue: boolean, oldValue: boolean) => {
  // Clear navigation history when user logs out
  if (oldValue && !newValue) {
    console.log("🧭 User logged out, clearing navigation history");
    clearNavigationHistory();
  }
});

// Update state on route change
watch(
  route,
  (newRoute: RouteLocationNormalized, oldRoute: RouteLocationNormalized) => {
    if (oldRoute && newRoute.path !== oldRoute.path) {
      // Add previous route to history
      addToNavigationHistory(oldRoute.fullPath);

      // Debug history
      console.log("Navigation history updated:", {
        from: oldRoute.fullPath,
        to: newRoute.fullPath,
        historySize: navigationHistory.value.length,
        history: navigationHistory.value,
      });
    }
    updateBackButtonState();
  },
);

// Determine when to show back button
const shouldShowBackButton = computed((): boolean => {
  // Don't show button on auth page (main page with login form)
  const excludedPages: RouteName[] = ["index"];

  const isExcluded = excludedPages.includes(route.name);
  const userAuthenticated = isAuthenticated.value;

  // Don't show if it's excluded page
  if (isExcluded) {
    return false;
  }

  // Don't show if user is not authenticated
  if (!userAuthenticated) {
    return false;
  }

  // Always show button for authenticated users on allowed pages
  return true;
});

const goToSettings = (): void => {
  // Simple navigation - middleware will handle auth check
  router.push("/settings");
};

const goBack = (): void => {
  if (!import.meta.client || !canNavigateBack.value) return;

  // Special handling for settings page
  if (route.name === "settings") {
    // First check local history
    if (navigationHistory.value.length > 0) {
      const previousRoute = popFromNavigationHistory(); // Uses immediate save
      if (previousRoute) {
        router.replace(previousRoute);
        return;
      }
    }

    // Then try to return to saved page
    const returnRoute = sessionStorage.getItem("settingsReturnRoute");
    if (returnRoute) {
      sessionStorage.removeItem("settingsReturnRoute");
      router.replace(returnRoute);
      return;
    }

    // Check browser history
    if (window.history.length > 1) {
      router.back();
      return;
    }

    // Fallback to tours page
    router.replace("/tours");
    return;
  }

  // First try to use our local history
  if (navigationHistory.value.length > 0) {
    const previousRoute = popFromNavigationHistory(); // Uses immediate save for reliability

    if (previousRoute && !previousRoute.includes(route.path)) {
      // Check that we're not going back to the same page
      router.push(previousRoute);
      return;
    }
  }

  // For main pages apply special logic
  if (route.name === "index") {
    // Don't go back from main page
    return;
  }

  if (route.name === "tours") {
    // From tours page go back only if there's real history
    if (navigationHistory.value.length > 0) {
      const previousRoute = popFromNavigationHistory(); // Uses immediate save
      if (previousRoute && !previousRoute.includes("/tours")) {
        router.push(previousRoute);
        return;
      }
    }
    // Otherwise don't go anywhere
    return;
  }

  // In PWA standalone mode use smarter logic
  if (isPWAStandalone.value) {
    // If we can go back in history - go back
    if (window.history.length > 1) {
      router.back();
    } else {
      // In PWA without history go to main tours page
      router.push("/tours");
    }
  } else {
    // In regular browser use standard logic
    if (window.history.length > 1) {
      router.back();
    } else {
      // Browser fallback
      router.push("/tours");
    }
  }
};
</script>
