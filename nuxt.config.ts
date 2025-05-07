// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-04-03",
  app: {
    head: {
      link: [{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
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
  ],
  future: {
    compatibilityVersion: 4,
  },
  devtools: { enabled: false },
  typescript: {
    typeCheck: true,
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
    },
  },
  css: ["~/assets/css/main.css"],
});
