/**
 * Composable for managing page titles with i18n support
 * Automatically updates both page header and browser tab title
 */

export const usePageTitle = () => {
  const { t, locale } = useI18n();
  const route = useRoute();
  const tourStore = useTourStore();

  // Get the current page title based on route and tour data
  const getPageTitle = (): string => {
    // For specific tour page show tour name
    if (route.name === "tours-tourId" && tourStore.tour) {
      return tourStore.tour.name;
    }

    // Try to get title from route meta first (for backward compatibility)
    const metaTitle = route.meta.title as string;
    if (metaTitle) {
      return metaTitle;
    }

    // Auto-generate translation key based on route name
    const routeName = route.name as string;
    if (routeName) {
      // Convert route name to translation key format
      // e.g., "create-route" -> "pages.createRoute.title"
      const translationKey = `pages.${routeName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())}.title`;

      // Try to get translation
      const translatedTitle = t(translationKey);

      // If translation exists and is not the same as the key, use it
      if (translatedTitle !== translationKey) {
        return translatedTitle;
      }
    }

    // Fallback to home page title
    return t("pages.home.title");
  };

  // Reactive page title that updates when locale changes
  const pageTitle = computed((): string => {
    return getPageTitle();
  });

  // Update browser tab title
  const updateTabTitle = (title?: string) => {
    const finalTitle = title || pageTitle.value;
    useHead({
      title: finalTitle,
    });
  };

  // Watch for changes and update tab title
  watch(
    pageTitle,
    (newTitle) => {
      updateTabTitle(newTitle);
    },
    { immediate: true },
  );

  // Watch for locale changes to update titles
  watch(locale, () => {
    // Force recomputation of page title
    nextTick(() => {
      updateTabTitle();
    });
  });

  // Watch for route changes to update titles
  watch(
    () => route.name,
    () => {
      nextTick(() => {
        updateTabTitle();
      });
    },
  );

  // Watch for tour changes to update titles
  watch(
    () => tourStore.tour,
    () => {
      nextTick(() => {
        updateTabTitle();
      });
    },
  );

  return {
    pageTitle,
    updateTabTitle,
    getPageTitle,
  };
};
