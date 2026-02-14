// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-04-03",
  srcDir: "app/",
  serverDir: "server/",
  app: {
    head: {
      link: [
        {
          rel: "icon",
          type: "image/svg+xml",
          href: "/favicon.svg",
        },
        {
          rel: "stylesheet",
          href: "https://api.mapbox.com/mapbox-gl-js/v3.12.0/mapbox-gl.css",
          type: "text/css",
        },
        {
          rel: "stylesheet",
          href: "https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-directions/v4.3.1/mapbox-gl-directions.css",
          type: "text/css",
        },
      ],
    },
  },
  components: [{ path: "~/components/ui", pathPrefix: false }, "~/components"],
  ssr: false,
  modules: [
    "@vueuse/nuxt",
    "@pinia/nuxt",
    "@nuxt/ui",
    "nuxt-vuefire",
    "pinia-plugin-persistedstate/nuxt",
    "@nuxtjs/i18n",
  ],
  future: {
    compatibilityVersion: 4,
  },
  devtools: { enabled: false },
  typescript: {
    typeCheck: true,
  },
  runtimeConfig: {
    pgApiBaseUrl: process.env.PG_API_BASE_URL || "",
    publicApiPrefixes:
      process.env.PUBLIC_API_PREFIXES || "/api/health,/api/public",
  },
  vuefire: {
    auth: {
      enabled: true,
    },
    config: {
      apiKey: process.env.VUEFIRE_API_KEY,
      authDomain: process.env.VUEFIRE_AUTH_DOMAIN,
      projectId: process.env.VUEFIRE_PROJECT_ID,
      storageBucket: process.env.VUEFIRE_STORAGE_BUCKET,
      messagingSenderId: process.env.VUEFIRE_MESSAGING_SENDER_ID,
      appId: process.env.VUEFIRE_APP_ID,
    },
    appCheck: {
      debug: process.env.NODE_ENV !== "production",
      isTokenAutoRefreshEnabled: true,
      provider: "ReCaptchaV3",
      key: process.env.RECAPTCHA_KEY,
      // Disable for localhost to avoid 401 errors that slow down auth
      ...(process.env.NODE_ENV === "development" && {
        provider: "debug" as any,
      }),
    },
  },
  css: ["~/assets/css/main.css"],
  i18n: {
    restructureDir: "i18n",
    locales: [
      { code: "en", file: "en.json", name: "English" },
      { code: "ru", file: "ru.json", name: "Русский" },
      { code: "fr", file: "fr.json", name: "Français" },
    ],
    defaultLocale: "en",
    langDir: "locales",
    strategy: "no_prefix",
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: "i18n_redirected",
      alwaysRedirect: true,
      fallbackLocale: "en",
    },
  },
});
