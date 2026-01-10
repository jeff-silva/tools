<script setup>
import { useClipboard } from "@vueuse/core";

definePageMeta({
  title: "Data Converter",
  description: "Conversor universal de dados (Excel, JSON, XML, CSV)",
  icon: "ph:arrows-left-right-duotone",
  menu: true,
  tags: [],
  badge: "V2.0",
  color: "bg-blue-500",
});

useHead({
  title: "Data Converter - Dashboard",
  script: [
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js",
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
const steps = ["Importar", "Mapeamento", "Exportar"];
const fileName = ref("dados_convertidos");

// Import State
const importMode = ref("file"); // 'file' | 'text'
const textContent = ref("");
const dragActive = ref(false);

// Data State
const rawHeaders = ref([]);
const rawRows = ref([]); // Array of arrays
const columnMap = ref([]); // { original, key, enabled }

// Export State
const selectedFormat = ref("json"); // json, xml, csv, xlsx
const convertedData = ref(null); // String or Blob (for excel)
const convertedDataPreview = ref("");

// VueUse
const { copy, copied } = useClipboard();

// --- PARSERS ---

const parseExcelBuffer = async (buffer) => {
  const workbook = new window.ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) throw new Error("Planilha vazia");

  let headers = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) headers = row.values.slice(1);
  });

  const rows = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const vals = [];
    const colCount = headers.length;
    for (let i = 1; i <= colCount; i++) {
      let val = row.getCell(i).value;
      if (val && typeof val === "object") {
        if (val.text) val = val.text;
        else if (val.result) val = val.result;
      }
      vals.push(val);
    }
    rows.push(vals);
  });
  return { headers, rows };
};

const parseJSON = (text) => {
  const data = JSON.parse(text);
  if (!Array.isArray(data))
    throw new Error("JSON deve ser uma lista de objetos");
  if (data.length === 0) throw new Error("JSON vazio");

  // Extract generic headers from all objects to ensure we catch all keys
  const allKeys = new Set();
  data.forEach((obj) => Object.keys(obj).forEach((k) => allKeys.add(k)));
  const headers = Array.from(allKeys);

  const rows = data.map((obj) => headers.map((h) => obj[h]));
  return { headers, rows };
};

const parseCSV = (text) => {
  // Simple CSV parser (handles quotes)
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("CSV inválido ou muito curto");

  const parseLine = (line) => {
    const result = [];
    let curVal = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuote = !inQuote;
      } else if (char === "," && !inQuote) {
        result.push(curVal);
        curVal = "";
      } else {
        curVal += char;
      }
    }
    result.push(curVal);
    return result.map((v) => v.replace(/^"|"$/g, "").replace(/""/g, '"'));
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map((l) => parseLine(l));
  return { headers, rows };
};

const parseXML = (text) => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(text, "text/xml");
  const root = xmlDoc.documentElement;
  // Assume list of items. Look for child elements of root
  const items = Array.from(root.children);
  if (items.length === 0) throw new Error("XML sem itens");

  // Discover headers
  const allKeys = new Set();
  items.forEach((item) => {
    Array.from(item.children).forEach((child) => allKeys.add(child.tagName));
  });
  const headers = Array.from(allKeys);

  const rows = items.map((item) => {
    return headers.map((header) => {
      const el = Array.from(item.children).find((c) => c.tagName === header);
      return el ? el.textContent : "";
    });
  });
  return { headers, rows };
};

// --- HANDLERS ---

const processData = (headers, rows) => {
  rawHeaders.value = headers;
  rawRows.value = rows;

  // Generate Column Map
  columnMap.value = headers.map((h) => {
    const original = h ? String(h).trim() : "";
    let key = original
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^\w_]/g, "");

    if (!key) key = `col_${Math.random().toString(36).substr(2, 4)}`;

    return {
      original: original || "(Sem nome)",
      key: key,
      enabled: true,
    };
  });
  step.value = 1;
};

const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  fileName.value = file.name.replace(/\.[^/.]+$/, "");

  try {
    if (file.name.endsWith(".xlsx")) {
      if (typeof window.ExcelJS === "undefined")
        throw new Error("ExcelJS carregando...");
      const reader = new FileReader();
      reader.onload = async (e) => {
        const { headers, rows } = await parseExcelBuffer(e.target.result);
        processData(headers, rows);
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Text based (JSON, CSV, XML)
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        let res;
        if (file.name.endsWith(".json")) res = parseJSON(text);
        else if (file.name.endsWith(".csv")) res = parseCSV(text);
        else if (file.name.endsWith(".xml")) res = parseXML(text);
        else throw new Error("Formato não suportado");
        processData(res.headers, res.rows);
      };
      reader.readAsText(file);
    }
  } catch (err) {
    alert("Erro: " + err.message);
  }
};

const handlePasteProcess = () => {
  if (!textContent.value) return;
  const text = textContent.value.trim();
  try {
    let res;
    if (text.startsWith("[") || text.startsWith("{")) {
      res = parseJSON(text);
    } else if (text.startsWith("<")) {
      res = parseXML(text);
    } else {
      // Assume CSV
      res = parseCSV(text);
    }
    processData(res.headers, res.rows);
  } catch (err) {
    alert("Falha ao processar texto: " + err.message);
  }
};

// --- EXPORT ---

const processedData = computed(() => {
  return rawRows.value.map((rowVals) => {
    const obj = {};
    columnMap.value.forEach((mapItem, index) => {
      if (mapItem.enabled && mapItem.key) {
        obj[mapItem.key] = rowVals[index];
      }
    });
    return obj;
  });
});

const generateExport = async () => {
  const data = processedData.value;
  let result = null;

  if (selectedFormat.value === "json") {
    result = JSON.stringify(data, null, 2);
    convertedData.value = result;
    convertedDataPreview.value =
      result.split("\n").slice(0, 20).join("\n") + "...";
  } else if (selectedFormat.value === "csv") {
    const keys = columnMap.value.filter((c) => c.enabled).map((c) => c.key);
    const headerRow = keys.join(",") + "\n";
    const rows = data
      .map((row) => {
        return keys
          .map((k) => {
            let val =
              row[k] === undefined || row[k] === null ? "" : String(row[k]);
            if (val.includes(",") || val.includes('"') || val.includes("\n")) {
              val = `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          })
          .join(",");
      })
      .join("\n");
    result = headerRow + rows;
    convertedData.value = result;
    convertedDataPreview.value =
      result.split("\n").slice(0, 20).join("\n") + "...";
  } else if (selectedFormat.value === "xml") {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<root>\n';
    data.forEach((row) => {
      xml += "  <item>\n";
      for (const [key, val] of Object.entries(row)) {
        xml += `    <${key}>${val}</${key}>\n`;
      }
      xml += "  </item>\n";
    });
    xml += "</root>";
    result = xml;
    convertedData.value = result;
    convertedDataPreview.value =
      result.split("\n").slice(0, 20).join("\n") + "...";
  } else if (selectedFormat.value === "xlsx") {
    convertedDataPreview.value = "[Binário] Processando arquivo Excel...";
    if (typeof window.ExcelJS === "undefined") return;

    const wb = new window.ExcelJS.Workbook();
    const ws = wb.addWorksheet("Dados");

    const keys = columnMap.value.filter((c) => c.enabled).map((c) => c.key);
    ws.addRow(keys);

    data.forEach((row) => {
      ws.addRow(keys.map((k) => row[k]));
    });

    const buffer = await wb.xlsx.writeBuffer();
    convertedData.value = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    convertedDataPreview.value =
      "[Binário] Arquivo Excel pronto para download (" +
      (convertedData.value.size / 1024).toFixed(2) +
      " KB)";
  }
};

const copyContent = () => {
  if (selectedFormat.value === "xlsx") {
    alert("Não é possível copiar conteúdo binário.");
    return;
  }
  if (convertedData.value) {
    copy(convertedData.value);
    alert("Copiado!");
  }
};

const downloadFile = () => {
  if (!convertedData.value) return;

  const mimeTypes = {
    json: "application/json",
    csv: "text/csv",
    xml: "application/xml",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };

  let blob = convertedData.value;
  if (!(blob instanceof Blob)) {
    blob = new Blob([blob], { type: mimeTypes[selectedFormat.value] });
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName.value || "export"}.${selectedFormat.value}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const backToMapping = () => {
  step.value = 1;
};

const reset = () => {
  step.value = 0;
  convertedData.value = null;
  fileName.value = "dados";
  rawHeaders.value = [];
  rawRows.value = [];
  columnMap.value = [];
  textContent.value = "";
  selectedFormat.value = "json";
};

watch(selectedFormat, () => {
  if (step.value === 2) {
    generateExport();
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
      <div class="h-16 flex items-center px-8 border-b border-white/10">
        <div
          class="w-8 h-8 bg-white text-slate-900 flex items-center justify-center font-bold text-lg mr-3 rounded-sm"
        >
          <icon
            name="ph:arrows-left-right-duotone"
            class="w-5 h-5"
          />
        </div>
        <div>
          <h1 class="font-bold text-lg tracking-wide uppercase">Converter</h1>
          <p
            class="text-[10px] text-slate-400 font-mono tracking-widest uppercase"
          >
            Tool
          </p>
        </div>
      </div>
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
          C
        </div>
        <span class="font-bold uppercase tracking-wider text-sm"
          >Converter</span
        >
      </div>
    </header>

    <!-- CONTENT -->
    <main
      class="flex-1 relative flex flex-col h-full overflow-hidden bg-white dark:bg-slate-950 w-full"
    >
      <!-- TOP BAR -->
      <div
        v-if="step > 0"
        class="h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sm:px-10 bg-white dark:bg-slate-950 flex-shrink-0 z-10"
      >
        <h2
          class="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-tight hidden sm:block"
        >
          {{ step === 1 ? "Mapeamento" : "Exportar" }}
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
            @click="
              () => {
                generateExport();
                step = 2;
              }
            "
            class="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all rounded-sm"
          >
            Continuar
          </button>

          <div
            v-if="step === 2"
            class="flex gap-2"
          >
            <button
              @click="backToMapping"
              class="px-4 py-2 border border-slate-300 dark:border-slate-700 hover:border-slate-500 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors"
            >
              Voltar
            </button>
            <button
              @click="reset"
              class="px-4 py-2 border border-slate-300 dark:border-slate-700 hover:border-slate-500 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors"
            >
              Novo
            </button>
            <button
              @click="copyContent"
              class="hidden sm:flex px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all rounded-sm items-center gap-2"
            >
              Copiar
            </button>
            <button
              @click="downloadFile"
              class="px-6 py-2 bg-emerald-600 text-white text-xs font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all rounded-sm flex items-center gap-2"
            >
              Baixar
            </button>
          </div>
        </div>
      </div>

      <!-- MAIN AREA -->
      <div
        class="flex-1 overflow-auto p-6 sm:p-10 relative scroll-smooth flex flex-col"
      >
        <!-- STEP 0: IMPORT -->
        <div
          v-if="step === 0"
          class="h-full flex flex-col items-center justify-center m-auto w-full max-w-4xl"
        >
          <!-- Tabs -->
          <div class="flex gap-4 mb-6">
            <button
              @click="importMode = 'file'"
              class="pb-2 border-b-2 text-sm font-bold uppercase tracking-widest transition-colors"
              :class="
                importMode === 'file'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              "
            >
              Arquivo
            </button>
            <button
              @click="importMode = 'text'"
              class="pb-2 border-b-2 text-sm font-bold uppercase tracking-widest transition-colors"
              :class="
                importMode === 'text'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              "
            >
              Texto / Colar
            </button>
          </div>

          <!-- File Method -->
          <div
            v-if="importMode === 'file'"
            class="w-full max-w-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-6 sm:p-12 text-center rounded-sm"
          >
            <div
              class="mb-8 inline-flex p-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-3xl shadow-sm"
            >
              📂
            </div>
            <h1
              class="text-3xl font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-tight"
            >
              Importar Dados
            </h1>
            <p class="text-slate-500 mb-10 max-w-md mx-auto">
              Suporta Excel (.xlsx), CSV, JSON e XML
            </p>
            <label
              class="block w-full h-48 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-slate-500 dark:hover:border-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer relative group rounded-sm"
            >
              <input
                type="file"
                class="hidden"
                accept=".xlsx,.csv,.json,.xml"
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

          <!-- Text Method -->
          <div
            v-if="importMode === 'text'"
            class="w-full max-w-2xl flex flex-col gap-4"
          >
            <div class="relative w-full">
              <textarea
                v-model="textContent"
                class="w-full h-64 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-sm p-4 font-mono text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none"
                placeholder="Cole de dados aqui (JSON array, CSV ou XML)..."
              ></textarea>
              <div
                class="absolute bottom-4 right-4 text-[10px] text-slate-400 uppercase font-bold tracking-widest"
              >
                Auto-Detectar Formato
              </div>
            </div>
            <button
              @click="handlePasteProcess"
              class="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase tracking-widest rounded-sm transition-colors shadow-lg"
            >
              Processar Texto
            </button>
          </div>
        </div>

        <!-- STEP 1: MAPPING -->
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
                      >Original</label
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
                      >Atributo (Key)</label
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

        <!-- STEP 2: EXPORT -->
        <div
          v-if="step === 2"
          class="max-w-4xl mx-auto w-full flex flex-col md:flex-row gap-8"
        >
          <div class="w-full md:w-1/3 space-y-6">
            <div
              class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-6"
            >
              <h3
                class="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4"
              >
                Formato de Saída
              </h3>
              <div class="space-y-3">
                <label
                  v-for="fmt in ['json', 'xml', 'csv', 'xlsx']"
                  :key="fmt"
                  class="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  :class="{
                    'ring-2 ring-slate-900 dark:ring-white border-transparent':
                      selectedFormat === fmt,
                  }"
                >
                  <input
                    type="radio"
                    name="format"
                    :value="fmt"
                    v-model="selectedFormat"
                    class="text-slate-900 focus:ring-slate-900"
                  />
                  <div class="flex-1">
                    <div class="font-bold text-sm uppercase">{{ fmt }}</div>
                  </div>
                </label>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <button
                @click="copyContent"
                class="px-4 py-3 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-700 transition-all rounded-sm flex items-center justify-center gap-2"
              >
                <icon
                  name="ph:copy"
                  class="w-4 h-4"
                />
                Copiar
              </button>
              <button
                @click="downloadFile"
                class="px-4 py-3 bg-emerald-600 text-white text-xs font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all rounded-sm flex items-center justify-center gap-2"
              >
                <icon
                  name="ph:download-simple"
                  class="w-4 h-4"
                />
                Baixar
              </button>
            </div>
          </div>

          <div
            class="flex-1 bg-slate-900 text-slate-300 rounded-sm overflow-hidden flex flex-col font-mono text-xs border border-slate-800 shadow-2xl"
          >
            <div
              class="px-4 py-2 border-b border-slate-800 bg-slate-950 flex justify-between items-center"
            >
              <span
                class="uppercase tracking-widest font-bold text-[10px] text-slate-500"
                >Preview ({{ selectedFormat }})</span
              >
            </div>
            <div class="flex-1 overflow-auto p-4 custom-scrollbar">
              <pre>{{ convertedDataPreview }}</pre>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: #1e293b;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
</style>
