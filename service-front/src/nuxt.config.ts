// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  devtools: { enabled: true },
  ssr: false,

  modules: [
    ["@nuxt/icon", {}],
    ["@nuxt/scripts", {}],
    ["@vueuse/nuxt", {}],
    ["@pinia/nuxt", {}],
  ],

  app: {
    baseURL: "/tools/",
    head: {
      script: [{ src: "https://cdn.tailwindcss.com" }],
    },
  },

  runtimeConfig: {
    public: {
      stripeKey: process.env.NUXT_PUBLIC_STRIPE_KEY || "",
      stripePriceId: process.env.NUXT_PUBLIC_STRIPE_PRICE_ID || "",
    },
  },
});
