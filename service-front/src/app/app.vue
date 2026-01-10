<script setup>
const route = useRoute();
</script>

<template>
  <div>
    <nuxt-page />

    <nuxt-link
      v-if="route.path !== '/'"
      to="/"
      class="fixed bottom-6 right-6 z-50 w-12 h-12 flex items-center justify-center bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-full shadow-xl hover:shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300 border border-white/10 dark:border-slate-200"
      title="Voltar ao Início"
    >
      <Icon
        name="ph:house-duotone"
        class="w-6 h-6"
      />
    </nuxt-link>
  </div>
</template>
