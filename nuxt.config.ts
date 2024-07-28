// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: [
    "@vueuse/nuxt",
  ],

  future: {
    compatibilityVersion: 4,
  },

  compatibilityDate: "2024-07-28",
});
