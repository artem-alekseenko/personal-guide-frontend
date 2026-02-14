export const usePageTitle = () => {
  const { t } = useI18n();
  const route = useRoute();
  const tourStore = useTourStore();
  const { isAuthenticated } = useAuth();

  const appName = "Personal Guide";

  const pageTitle = computed((): string => {
    if (route.name === "tours-tourId" && tourStore.tour?.name) {
      return tourStore.tour.name;
    }

    if (route.name === "index") {
      return isAuthenticated.value
          ? t("pages.home.title")
          : t("pages.home.titleLogin");
    }

    const metaTitle = route.meta.title;
    if (typeof metaTitle === "string" && metaTitle.trim()) {
      return metaTitle;
    }

    const routeName = typeof route.name === "string" ? route.name : "";
    if (routeName) {
      const key = `pages.${routeName.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}.title`;
      const translated = t(key);
      if (translated !== key) return translated;
    }

    return t("pages.home.title");
  });

  const tabTitleBase = computed(() => {
    const base = pageTitle.value?.trim();
    return base === appName ? "" : base;
  });

  useHead(() => ({
    title: tabTitleBase.value,
    titleTemplate: (title) => (title ? `${title} · ${appName}` : appName),
  }));

  return { pageTitle };
};
