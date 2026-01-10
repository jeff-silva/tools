<script setup>
useHead({
  title: "Tools Dashboard",
  link: [
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
    },
  ],
});

const tools = [
  {
    name: "Excert",
    description: "Gerador de Certificados Automático",
    route: "/excert",
    icon: "🎓", // Using emoji for simplicity, or we could use SVG
    badge: "Beta",
    color: "bg-indigo-500",
  },
  {
    name: "Excel to JSON",
    description: "Conversor de planilhas para JSON",
    route: "/excel-to-json",
    icon: "📊",
    badge: "V1.0",
    color: "bg-emerald-500",
  },
];
</script>

<template>
  <div
    class="flex flex-col md:flex-row h-screen w-full bg-gray-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 overflow-hidden font-sans"
  >
    <!-- SIDEBAR -->
    <aside
      class="hidden md:flex w-72 flex-col bg-slate-900 text-white flex-shrink-0 border-r border-slate-800 z-20"
    >
      <!-- Brand -->
      <div class="h-16 flex items-center px-8 border-b border-white/10">
        <div
          class="w-8 h-8 bg-white text-slate-900 flex items-center justify-center font-bold text-lg mr-3 rounded-sm"
        >
          T
        </div>
        <div>
          <h1 class="font-bold text-lg tracking-wide uppercase">Tools</h1>
          <p
            class="text-[10px] text-slate-400 font-mono tracking-widest uppercase"
          >
            Suite
          </p>
        </div>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 py-8 px-4 space-y-1 overflow-y-auto">
        <div
          class="flex items-center gap-4 p-3 rounded-sm bg-white/10 border-l-2 border-white text-white mb-2"
        >
          <div
            class="w-7 h-7 flex items-center justify-center text-xs font-bold border border-white rounded-sm bg-slate-900"
          >
            🏠
          </div>
          <span class="text-xs font-bold uppercase tracking-widest"
            >Dashboard</span
          >
        </div>

        <div
          class="pt-4 pb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500"
        >
          Apps
        </div>

        <NuxtLink
          v-for="tool in tools"
          :key="tool.route"
          :to="tool.route"
          class="flex items-center gap-4 p-3 rounded-sm text-slate-500 hover:text-white hover:bg-slate-800 transition-all group"
        >
          <div
            class="w-7 h-7 flex items-center justify-center text-xs font-bold border border-slate-700 group-hover:border-slate-500 rounded-sm bg-slate-900"
          >
            {{ tool.name.charAt(0) }}
          </div>
          <span
            class="text-xs font-bold uppercase tracking-widest group-hover:translate-x-1 transition-transform"
            >{{ tool.name }}</span
          >
        </NuxtLink>
      </nav>

      <!-- Footer -->
      <div
        class="p-6 border-t border-white/10 text-xs text-slate-500 text-center"
      >
        &copy; 2026 Jeff Tools
      </div>
    </aside>

    <!-- MOBILE HEADER -->
    <header
      class="md:hidden h-16 bg-slate-900 text-white flex items-center justify-between px-4 flex-shrink-0 z-30 shadow-md w-full"
    >
      <div class="flex items-center gap-3">
        <div
          class="w-8 h-8 bg-white text-slate-900 flex items-center justify-center font-bold text-sm rounded-sm"
        >
          T
        </div>
        <span class="font-bold uppercase tracking-wider text-sm"
          >Dashboard</span
        >
      </div>
    </header>

    <!-- MAIN CONTENT -->
    <main
      class="flex-1 relative flex flex-col h-full overflow-hidden bg-white dark:bg-slate-950 w-full"
    >
      <!-- Top Bar -->
      <div
        class="h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sm:px-10 bg-white dark:bg-slate-950 flex-shrink-0 z-10"
      >
        <h2
          class="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-tight hidden sm:block"
        >
          Visão Geral
        </h2>
        <div class="flex items-center gap-3 ml-auto">
          <div class="text-xs font-mono text-slate-400">
            <span
              class="w-2 h-2 inline-block rounded-full bg-green-500 mr-2"
            ></span>
            Sistema Online
          </div>
        </div>
      </div>

      <div class="flex-1 overflow-auto p-6 sm:p-10 relative scroll-smooth">
        <div
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          <!-- Cards -->
          <NuxtLink
            v-for="(tool, index) in tools"
            :key="index"
            :to="tool.route"
            class="group relative bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-600 rounded-sm p-6 transition-all hover:shadow-lg flex flex-col h-48 overflow-hidden"
          >
            <div
              class="absolute top-0 left-0 w-1 h-full scale-y-0 group-hover:scale-y-100 transition-transform origin-top z-10"
              :class="tool.color"
            ></div>

            <div class="flex justify-between items-start mb-4">
              <div
                class="text-4xl filter grayscale group-hover:grayscale-0 transition-all duration-500 scale-90 group-hover:scale-100 transform origin-left"
              >
                {{ tool.icon }}
              </div>
              <span
                class="px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[10px] font-mono uppercase tracking-widest text-slate-500 rounded-sm"
                >{{ tool.badge }}</span
              >
            </div>

            <h3
              class="font-bold text-lg text-slate-800 dark:text-white mb-2 uppercase tracking-tight"
            >
              {{ tool.name }}
            </h3>
            <p class="text-sm text-slate-500 line-clamp-2 mb-4 flex-1">
              {{ tool.description }}
            </p>

            <div
              class="flex items-center text-xs font-bold uppercase tracking-widest text-slate-400 group-hover:text-slate-800 dark:group-hover:text-white transition-colors"
            >
              Acessar Ferramenta
              <span
                class="ml-2 transform group-hover:translate-x-1 transition-transform"
                >→</span
              >
            </div>
          </NuxtLink>

          <!-- Coming Soon Card -->
          <div
            class="group relative bg-slate-50/50 dark:bg-slate-900/50 border border-dashed border-slate-200 dark:border-slate-800 rounded-sm p-6 flex flex-col h-48 items-center justify-center text-center opacity-70"
          >
            <span class="text-2xl mb-3 grayscale opacity-50">🔨</span>
            <h3
              class="font-bold text-sm text-slate-400 dark:text-slate-500 mb-1 uppercase tracking-tight"
            >
              Em Breve
            </h3>
            <p class="text-xs text-slate-400">
              Mais ferramentas em desenvolvimento
            </p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
