<script setup>
import { ref, onMounted, nextTick, watch } from "vue";

useHead({
  title: "Excel to JSON - Dashboard",
  script: [
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js",
      defer: true,
    },
    // renderjson for collapsible JSON view
    {
      src: "https://cdn.jsdelivr.net/npm/renderjson@1.4.0/renderjson.min.js",
      defer: true,
    },
  ],
  link: [
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
    },
  ],
});

// State
const step = ref(0);
const steps = ["Upload", "Mapeamento", "Resultado"];
const jsonData = ref(null);
const jsonContainer = ref(null);
const fileName = ref("");

// Intermediate State for Mapping
const rawHeaders = ref([]);
const rawRows = ref([]); // Store raw values arrays
const columnMap = ref([]); // Array of { original: string, key: string, enabled: boolean }

// Methods
const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  fileName.value = file.name.replace(/\.[^/.]+$/, "");

  // Ensure ExcelJS is loaded
  if (typeof window.ExcelJS === "undefined") {
    alert(
      "Biblioteca ExcelJS ainda não foi carregada. Tente novamente em alguns segundos."
    );
    return;
  }

  const workbook = new window.ExcelJS.Workbook();
  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      const buffer = e.target.result;
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.getWorksheet(1);

      if (!worksheet) {
        alert("Planilha vazia ou inválida.");
        return;
      }

      let headers = [];

      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          // Headers
          headers = row.values.slice(1);
        }
      });

      // Process rows to clean values array
      const cleanRows = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const vals = [];
        // We iterate based on detected headers count to align content
        // If headers length is 5, we grab 5 cols
        const colCount = headers.length;
        for (let i = 1; i <= colCount; i++) {
          let val = row.getCell(i).value;
          if (val && typeof val === "object") {
            if (val.text) val = val.text;
            else if (val.result) val = val.result;
          }
          vals.push(val);
        }
        cleanRows.push(vals);
      });

      rawHeaders.value = headers;
      rawRows.value = cleanRows;

      // Generate Default Map
      columnMap.value = headers.map((h) => {
        const original = h ? String(h).trim() : "";
        // Sanitize for key (snake_case default)
        let key = original
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "") // remove accents
          .replace(/\s+/g, "_")
          .replace(/[^\w_]/g, "");

        if (!key) key = `col_${Math.random().toString(36).substr(2, 4)}`;

        return {
          original: original || "(Sem nome)",
          key: key,
          enabled: true,
        };
      });

      step.value = 1; // Go to Mapping
    } catch (err) {
      console.error(err);
      alert("Erro ao processar arquivo excel: " + err.message);
    }
  };

  reader.readAsArrayBuffer(file);
};

const processMapping = async () => {
  // Generate Final JSON
  const finalData = rawRows.value.map((rowVals) => {
    const obj = {};
    columnMap.value.forEach((mapItem, index) => {
      if (mapItem.enabled && mapItem.key) {
        obj[mapItem.key] = rowVals[index];
      }
    });
    return obj;
  });

  jsonData.value = finalData;
  step.value = 2; // Result

  await nextTick();
  renderJsonView();
};

const renderJsonView = () => {
  if (!jsonContainer.value || !jsonData.value) return;
  jsonContainer.value.innerHTML = "";

  if (typeof window.renderjson === "undefined") {
    jsonContainer.value.innerText = JSON.stringify(jsonData.value, null, 2);
    return;
  }
  window.renderjson.set_show_to_level(2);
  jsonContainer.value.appendChild(window.renderjson(jsonData.value));
};

const copyToClipboard = async () => {
  if (!jsonData.value) return;
  try {
    await navigator.clipboard.writeText(
      JSON.stringify(jsonData.value, null, 2)
    );
    alert("JSON copiado!");
  } catch (err) {
    console.error("Erro ao copiar", err);
  }
};

const downloadJson = () => {
  if (!jsonData.value) return;
  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(jsonData.value, null, 2));
  const downloadAnchorNode = document.createElement("a");
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute(
    "download",
    (fileName.value || "data") + ".json"
  );
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
};

const backToMapping = () => {
  step.value = 1;
};

const reset = () => {
  step.value = 0;
  jsonData.value = null;
  fileName.value = "";
  rawHeaders.value = [];
  rawRows.value = [];
  columnMap.value = [];
};

watch(step, async (newVal) => {
  if (newVal === 2) {
    await nextTick();
    renderJsonView();
  }
});
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
          JSON
        </div>
        <div>
          <h1 class="font-bold text-lg tracking-wide uppercase">XLS to JSON</h1>
          <p
            class="text-[10px] text-slate-400 font-mono tracking-widest uppercase"
          >
            Tool
          </p>
        </div>
      </div>

      <!-- Navigation Steps -->
      <nav class="flex-1 py-8 px-4 space-y-1 overflow-y-auto">
        <div
          v-for="(s, index) in steps"
          :key="index"
          class="relative group"
        >
          <div
            v-if="index < steps.length - 1"
            class="absolute left-3.5 top-8 bottom-[-8px] w-px bg-white/10 group-hover:bg-white/20 transition-colors"
          ></div>

          <div
            class="flex items-center gap-4 p-3 rounded-sm transition-all duration-300"
            :class="
              step === index
                ? 'bg-white/10 border-l-2 border-white'
                : step > index
                ? 'text-green-400'
                : 'text-slate-500'
            "
          >
            <div
              class="w-7 h-7 flex items-center justify-center text-xs font-bold border rounded-sm transition-all z-10 bg-slate-900"
              :class="
                step === index
                  ? 'border-white text-white'
                  : step > index
                  ? 'border-green-500 text-green-400'
                  : 'border-slate-700 text-slate-600'
              "
            >
              <span v-if="step > index">✓</span>
              <span v-else>{{ index + 1 }}</span>
            </div>
            <span class="text-xs font-bold uppercase tracking-widest">{{
              s
            }}</span>
          </div>
        </div>
      </nav>

      <!-- Footer -->
      <div
        class="p-6 border-t border-white/10 text-xs text-slate-500 text-center"
      >
        &copy; 2026 Tools
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
          J
        </div>
        <span class="font-bold uppercase tracking-wider text-sm">XLS2JSON</span>
      </div>
    </header>

    <!-- CONTENT -->
    <main
      class="flex-1 relative flex flex-col h-full overflow-hidden bg-white dark:bg-slate-950 w-full"
    >
      <!-- Top Bar -->
      <div
        v-if="step > 0"
        class="h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sm:px-10 bg-white dark:bg-slate-950 flex-shrink-0 z-10"
      >
        <h2
          class="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-tight hidden sm:block"
        >
          {{ step === 1 ? "Mapeamento de Dados" : "Resultado JSON" }}
        </h2>
        <div class="flex items-center gap-3 ml-auto">
          <button
            v-if="step === 1"
            @click="reset"
            class="px-4 py-2 border border-slate-300 dark:border-slate-700 hover:border-slate-500 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors mr-2"
          >
            Cancelar
          </button>
          <button
            v-if="step === 1"
            @click="processMapping"
            class="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all rounded-sm"
          >
            Gerar JSON
          </button>
          <div
            v-if="step === 2"
            class="flex gap-2"
          >
            <button
              @click="backToMapping"
              class="px-4 py-2 border border-slate-300 dark:border-slate-700 hover:border-slate-500 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors"
            >
              Editar
            </button>
            <button
              @click="reset"
              class="px-4 py-2 border border-slate-300 dark:border-slate-700 hover:border-slate-500 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors"
            >
              Novo
            </button>
            <button
              @click="copyToClipboard"
              class="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all rounded-sm flex items-center gap-2"
            >
              Copiar
            </button>
            <button
              @click="downloadJson"
              class="px-6 py-2 bg-emerald-600 text-white text-xs font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all rounded-sm flex items-center gap-2"
            >
              Baixar
            </button>
          </div>
        </div>
      </div>

      <div
        class="flex-1 overflow-auto p-6 sm:p-10 relative scroll-smooth flex flex-col"
      >
        <!-- STEP 0: Upload -->
        <div
          v-if="step === 0"
          class="h-full flex flex-col items-center justify-center m-auto"
        >
          <div
            class="w-full max-w-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-6 sm:p-12 text-center rounded-sm"
          >
            <div
              class="mb-8 inline-flex p-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-3xl shadow-sm rotate-3 transform transition hover:rotate-6"
            >
              📊
            </div>
            <h1
              class="text-3xl font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-tight"
            >
              Convert to JSON
            </h1>
            <p class="text-slate-500 mb-10 max-w-md mx-auto">
              Carregue sua planilha excel (.xlsx) para converter automaticamente
              para JSON.
            </p>

            <label
              class="block w-full h-48 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-500 dark:hover:border-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer relative group"
            >
              <input
                type="file"
                class="hidden"
                accept=".xlsx"
                @change="handleFileUpload"
              />
              <div
                class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
              >
                <span
                  class="text-2xl text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-transform group-hover:-translate-y-1 mb-2"
                  >↓</span
                >
                <span
                  class="text-sm font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300"
                  >Arraste ou Clique</span
                >
              </div>
            </label>
          </div>
        </div>

        <!-- STEP 1: Mapping -->
        <div
          v-if="step === 1"
          class="max-w-4xl mx-auto w-full"
        >
          <div
            class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm overflow-hidden"
          >
            <div
              class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center"
            >
              <span
                class="text-xs font-bold uppercase tracking-widest text-slate-500"
                >Colunas Encontradas: {{ rawHeaders.length }}</span
              >
              <span class="text-xs font-mono text-slate-400"
                >Total de Linhas: {{ rawRows.length }}</span
              >
            </div>
            <div
              class="divide-y divide-slate-100 dark:divide-slate-800 max-h-[60vh] overflow-y-auto"
            >
              <div
                v-for="(col, index) in columnMap"
                :key="index"
                class="p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div class="flex items-center h-5">
                  <input
                    type="checkbox"
                    v-model="col.enabled"
                    class="w-4 h-4 text-slate-900 border-slate-300 rounded focus:ring-slate-900"
                  />
                </div>
                <div class="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      class="block text-[10px] uppercase font-bold text-slate-400 mb-1"
                      >Coluna Original</label
                    >
                    <div
                      class="text-sm font-medium text-slate-700 dark:text-slate-300 truncate"
                      :title="col.original"
                    >
                      {{ col.original }}
                    </div>
                  </div>
                  <div>
                    <label
                      class="block text-[10px] uppercase font-bold text-slate-400 mb-1"
                      >Nome do Atributo (Key)</label
                    >
                    <input
                      type="text"
                      v-model="col.key"
                      :disabled="!col.enabled"
                      class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-sm px-3 py-1.5 text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-slate-500 disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- STEP 2: Result -->
        <div
          v-if="step === 2"
          class="w-full h-full flex flex-col"
        >
          <div
            class="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm overflow-hidden relative shadow-inner"
          >
            <div
              ref="jsonContainer"
              class="w-full h-full overflow-auto p-4 font-mono text-sm json-viewer"
            ></div>
          </div>
          <div
            class="mt-4 text-xs text-slate-400 font-mono flex justify-between"
          >
            <span
              >{{ jsonData ? jsonData.length : 0 }} registros encontrados</span
            >
            <span>{{ fileName }}.json</span>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style>
/* RenderJSON Styles - Global Scope needed for library generated DOM */
.renderjson a {
  text-decoration: none;
  color: inherit;
}
.renderjson .disclosure {
  color: #ef4444; /* red for arrows */
  font-size: 150%;
  margin-right: 5px;
  cursor: pointer;
}
.renderjson .syntax {
  color: #64748b;
}
.renderjson .string {
  color: #10b981; /* green */
}
.renderjson .number {
  color: #f59e0b; /* orange */
}
.renderjson .boolean {
  color: #8b5cf6; /* purple */
}
.renderjson .key {
  color: #3b82f6; /* blue */
  font-weight: bold;
}
.renderjson .keyword {
  color: #ef4444;
}
.renderjson .object.syntax,
.renderjson .array.syntax {
  color: #475569;
}

/* Dark Mode overrides if parent is dark */
.dark .renderjson .key {
  color: #60a5fa;
}
.dark .renderjson .string {
  color: #34d399;
}
.dark .renderjson .number {
  color: #fbbf24;
}
.dark .renderjson .disclosure {
  color: #f87171;
}
.dark .renderjson .syntax {
  color: #94a3b8;
}
</style>
