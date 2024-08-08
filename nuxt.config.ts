// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    ssr: true,
    devtools: {enabled: true},
    modules: ["@vueuse/nuxt", "@nuxtjs/tailwindcss", "@pinia/nuxt"],

    future: {
        compatibilityVersion: 4,
    },

    compatibilityDate: "2024-07-28",
});
