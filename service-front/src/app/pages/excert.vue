<script setup>
definePageMeta({
  title: "Excert",
  description: "Gerador de Certificados Automático",
  icon: "ph:certificate-duotone",
  menu: true,
  tags: [],
  badge: "Beta",
  color: "bg-indigo-500",
});

useHead({
  title: "Gerador de Certificados - Dashboard",
  script: [
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.3.0/exceljs.min.js",
      defer: true,
    },
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js",
      defer: true,
    },
    {
      src: "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js",
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

const step = ref(0);
const steps = ["Excel", "Modelo", "Colunas", "Mapeamento", "Download"];
const excelHeaders = ref([]);
const excelRows = ref([]);
const selectedFields = ref([]);

const currentFieldIndex = ref(0);
const textObject = ref(null); // Current active field object (fabric object)
const fieldConfigs = reactive({}); // Stores config: { header: { left, top, width, ... } }

const drawingRect = ref(null);
const isDrawing = ref(false);
const origX = ref(0);
const origY = ref(0);

const templateUrl = ref(null);

let canvas = null;

const currentProps = reactive({
  fontSize: 40,
  fill: "#000000",
  textAlign: "center",
  width: 0,
});

const generatedImages = ref([]);
const isGenerating = ref(false);

const canvasScale = ref(1);
const canvasDimensions = reactive({ width: 800, height: 600 });
const canvasStage = ref(null); // Template Ref
let resizeObserver = null;

const currentField = computed(() => {
  return selectedFields.value[currentFieldIndex.value] || "";
});

const isLastField = computed(() => {
  return currentFieldIndex.value >= selectedFields.value.length - 1;
});

const nextEmptyFieldIndex = computed(() => {
  if (selectedFields.value.length === 0) return -1;
  const currentMapped = Object.keys(fieldConfigs);
  return selectedFields.value.findIndex(f => !currentMapped.includes(f));
});

const handleFileUpload = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

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
    const buffer = e.target.result;
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet(1);

    const rows = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) {
        excelHeaders.value = row.values.slice(1);
      } else {
        // Map row values
        const rowData = row.values.slice(1).map((val) => {
          if (val && typeof val === "object") {
            if (val instanceof Date) {
              return val.toLocaleDateString("pt-BR");
            }
            if (val.text) return val.text;
            return val.text || val.toString();
          }
          return val;
        });
        rows.push(rowData);
      }
    });

    excelRows.value = rows;
    if (excelHeaders.value.length > 0) {
      step.value = 1; // Go to Model Selection
    } else {
      alert("Não foi possível ler os cabeçalhos do arquivo.");
    }
  };

  reader.readAsArrayBuffer(file);
};

const useDefaultTemplate = () => {
  // Use the file from public/assets
  // baseURL is /tools/, so we prepend it
  templateUrl.value = "/tools/assets/excert/default-model.svg";
  step.value = 2; // Move to Columns
};

const handleTemplateUpload = (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    templateUrl.value = e.target.result;
    step.value = 2; // Move to Columns
  };
  reader.readAsDataURL(file);
};

const goToColumns = () => {
  step.value = 2;
};

const goToMapping = () => {
  if (selectedFields.value.length === 0) return;

  // Set to -1 to ensure switchTab(0) detects a change
  currentFieldIndex.value = -1;

  // Reset configs is tricky if we want to persist, but original code resets:
  // this.fieldConfigs = {}
  // Maybe we keep it? User might want to re-map. Original says:
  Object.keys(fieldConfigs).forEach((key) => delete fieldConfigs[key]);

  initCanvas();
};

const initCanvas = async () => {
  step.value = 3;
  await nextTick();

  if (typeof window.fabric === "undefined") {
    console.error("Fabric.js not loaded");
    alert("Fabric.js não carregado. Tente recarregar a página.");
    return;
  }

  if (canvas) {
    canvas.dispose();
  }

  // Init fabric
  canvas = new window.fabric.Canvas("certificateCanvas", {
    width: 800,
    height: 600,
    selection: false,
  });

  // Load Image
  window.fabric.Image.fromURL(
    templateUrl.value,
    (img) => {
      if (!img) {
        alert("Erro na imagem");
        return;
      }

      canvas.setWidth(img.width);
      canvas.setHeight(img.height);
      canvas.setBackgroundImage(img, canvas.renderAll.bind(canvas));

      // Store dims
      canvasDimensions.width = img.width;
      canvasDimensions.height = img.height;

      // Calculate initial scale
      updateLayoutScale();

      // Start at first tab
      switchTab(0);
    },
    { crossOrigin: null }
  );
};

const switchTab = (index) => {
  // 0. Safety
  if (index === currentFieldIndex.value) return;

  // 1. Identify fields
  const oldField = selectedFields.value[currentFieldIndex.value];
  const newField = selectedFields.value[index];

  // 2. Save current state
  if (oldField && textObject.value) {
    saveConfigForField(oldField);
  }

  // 3. Update Index
  currentFieldIndex.value = index;

  // 4. Clear Canvas safely
  const objects = canvas.getObjects();
  canvas.remove(...objects);
  textObject.value = null;

  // 5. Draw Ghosts
  selectedFields.value.forEach((field, idx) => {
    if (idx !== index) {
      const cfg = fieldConfigs[field];
      if (cfg) {
        const t = new window.fabric.Textbox(getSampleValue(field), {
          left: cfg.left,
          top: cfg.top,
          width: cfg.width,
          fontSize: cfg.fontSize,
          textAlign: cfg.textAlign,
          fill: cfg.fill,
          opacity: 0.5,
          selectable: false,
          evented: false,
          originX: "center",
          originY: "center",
        });
        canvas.add(t);
      }
    }
  });

  // 6. Restore Active Field or Enable Drawing
  const savedConfig = fieldConfigs[newField];

  if (savedConfig) {
    // Restoration
    isDrawing.value = false;
    disableDrawingMode();

    // Restore props
    currentProps.fontSize = savedConfig.fontSize;
    currentProps.fill = savedConfig.fill;
    currentProps.textAlign = savedConfig.textAlign;
    currentProps.width = savedConfig.width;

    spawnTextbox(savedConfig);
  } else {
    // New Mapping
    currentProps.fontSize = 40;
    currentProps.fill = "#000000";
    currentProps.textAlign = "center";
    enableDrawingMode();
  }

  canvas.requestRenderAll();
};

const saveConfigForField = (fieldName) => {
  if (!textObject.value) return;

  // fabric object is in textObject.value, assume it's valid
  const obj = textObject.value;
  const scaledWidth = obj.width * obj.scaleX;

  fieldConfigs[fieldName] = {
    left: obj.left,
    top: obj.top,
    width: scaledWidth,
    fontSize: obj.fontSize,
    fill: obj.fill,
    textAlign: obj.textAlign,
  };
};

const saveCurrentConfig = () => {
  saveConfigForField(currentField.value);
};

const getSampleValue = (header) => {
  if (!header) return "...";
  const idx = excelHeaders.value.indexOf(header);
  if (excelRows.value.length > 0 && idx > -1) {
    const val = excelRows.value[0][idx];
    return val ? String(val) : `[${header}]`;
  }
  return `[${header}]`;
};

const enableDrawingMode = () => {
  if (!canvas) return;
  disableDrawingMode();

  canvas.discardActiveObject();
  canvas.requestRenderAll();

  canvas.defaultCursor = "crosshair";
  canvas.selection = false;
  canvas.skipTargetFind = true;

  canvas.on("mouse:down", startDrawing);
  canvas.on("mouse:move", processDrawing);
  canvas.on("mouse:up", endDrawing);
};

const disableDrawingMode = () => {
  if (!canvas) return;

  canvas.defaultCursor = "default";
  canvas.selection = false;
  canvas.skipTargetFind = false;

  canvas.off("mouse:down", startDrawing);
  canvas.off("mouse:move", processDrawing);
  canvas.off("mouse:up", endDrawing);
};

const startDrawing = (o) => {
  if (textObject.value) return;
  const pointer = canvas.getPointer(o.e);
  origX.value = pointer.x;
  origY.value = pointer.y;
  isDrawing.value = true;

  drawingRect.value = new window.fabric.Rect({
    left: origX.value,
    top: origY.value,
    originX: "left",
    originY: "top",
    width: pointer.x - origX.value,
    height: pointer.y - origY.value,
    fill: "rgba(99, 102, 241, 0.3)",
    stroke: "#4f46e5",
    strokeWidth: 2,
    selectable: false,
  });
  canvas.add(drawingRect.value);
};

const processDrawing = (o) => {
  if (!isDrawing.value) return;
  const pointer = canvas.getPointer(o.e);

  if (origX.value > pointer.x) {
    drawingRect.value.set({ left: Math.abs(pointer.x) });
  }
  if (origY.value > pointer.y) {
    drawingRect.value.set({ top: Math.abs(pointer.y) });
  }

  drawingRect.value.set({ width: Math.abs(origX.value - pointer.x) });
  drawingRect.value.set({ height: Math.abs(origY.value - pointer.y) });

  canvas.renderAll();
};

const endDrawing = (o) => {
  if (!isDrawing.value) return;
  isDrawing.value = false;

  const width = drawingRect.value.width;
  const height = drawingRect.value.height;
  const left = drawingRect.value.left;
  const top = drawingRect.value.top + height / 2;

  canvas.remove(drawingRect.value);
  drawingRect.value = null;

  if (width < 20) return;

  disableDrawingMode();

  const config = {
    left: left + width / 2,
    top: top,
    width: width,
    fontSize: 40,
    fill: "#000000",
    textAlign: "center",
  };

  currentProps.fontSize = config.fontSize;
  currentProps.fill = config.fill;
  currentProps.textAlign = config.textAlign;
  currentProps.width = config.width;

  spawnTextbox(config);
};

const spawnTextbox = (config) => {
  const textValue = getSampleValue(currentField.value);

  const tObj = new window.fabric.Textbox(textValue, {
    left: config.left,
    top: config.top,
    originX: "center",
    originY: "center",
    width: config.width,
    fontFamily: "Inter",
    fontSize: config.fontSize,
    fill: config.fill,
    textAlign: config.textAlign,
    transparentCorners: false,
    cornerColor: "#0f172a",
    cornerStyle: "circle",
    borderColor: "#0f172a",
  });

  canvas.add(tObj);
  canvas.setActiveObject(tObj);
  textObject.value = tObj;

  tObj.on("modified", () => {
    currentProps.fontSize = tObj.fontSize;
    currentProps.width = tObj.getScaledWidth();
  });
};

const goToNextField = () => {
  if (textObject.value) {
    saveConfigForField(currentField.value);
  }
  const idx = nextEmptyFieldIndex.value;
  if(idx !== -1) {
    switchTab(idx);
  }
};

const resetTextObject = () => {
  if (textObject.value) {
    canvas.remove(textObject.value);
    textObject.value = null;

    delete fieldConfigs[currentField.value];
  }
  enableDrawingMode();
};

const adjustFontSize = (delta) => {
  if (textObject.value) {
    currentProps.fontSize += delta;
    updateActiveObject();
  }
};

const setAlignment = (align) => {
  currentProps.textAlign = align;
  updateActiveObject();
};

const updateActiveObject = () => {
  if (textObject.value) {
    textObject.value.set({
      fontSize: currentProps.fontSize,
      fill: currentProps.fill,
      width: currentProps.width,
      textAlign: currentProps.textAlign,
      scaleX: 1,
      scaleY: 1,
    });
    canvas.renderAll();
  }
};

const generateCertificates = async () => {
  if (textObject.value) saveCurrentConfig();

  if (Object.keys(fieldConfigs).length === 0) {
    alert("Você precisa mapear pelo menos um campo antes de gerar.");
    return;
  }

  isGenerating.value = true;
  generatedImages.value = [];

  setTimeout(async () => {
    // 1. Clear Canvas
    canvas.getObjects().forEach((o) => canvas.remove(o));

    // 2. Create the "Template" Textboxes
    const map = {};
    selectedFields.value.forEach((header) => {
      const conf = fieldConfigs[header];
      if (!conf) return;

      const box = new window.fabric.Textbox("", {
        ...conf,
        fill: conf.fill,
        selectable: false,
        originX: "center",
        originY: "center",
      });
      canvas.add(box);
      map[header] = box;
    });

    // 3. Loop
    excelRows.value.forEach((row) => {
      let hasContent = false;
      selectedFields.value.forEach((header) => {
        const obj = map[header];
        if (obj) {
          const colIndex = excelHeaders.value.indexOf(header);
          const val = row[colIndex] || "";

          obj.set({ text: String(val) });
          hasContent = true;
        }
      });

      if (!hasContent) return;

      canvas.renderAll();
      const dataURL = canvas.toDataURL({
        format: "png",
        quality: 0.9,
      });

      const nameIdx = excelHeaders.value.findIndex(
        (h) =>
          h.toLowerCase().includes("nome") ||
          h.toLowerCase().includes("name") ||
          h.toLowerCase().includes("aluno")
      );

      let fileName = "certificado";
      if (nameIdx > -1 && row[nameIdx]) {
        fileName += "_" + String(row[nameIdx]).replace(/[^a-z0-9]/gi, "_");
      } else {
        fileName += "_" + Math.random().toString(36).substr(2, 5);
      }

      generatedImages.value.push({
        name: fileName,
        url: dataURL,
      });
    });

    isGenerating.value = false;
    step.value = 4;
  }, 100);
};

const downloadZip = () => {
  if (typeof window.JSZip === "undefined") {
    alert("Biblioteca JSZip não carregada.");
    return;
  }
  const zip = new window.JSZip();

  generatedImages.value.forEach((img) => {
    const base64Data = img.url.replace(/^data:image\/(png|jpg);base64,/, "");
    zip.file(`${img.name}.png`, base64Data, { base64: true });
  });

  zip.generateAsync({ type: "blob" }).then(function (content) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(content);
    link.download = "certificados.zip";
    link.click();
  });
};

const backToAdjust = () => {
  currentFieldIndex.value = -1;
  initCanvas();
  step.value = 3;
};

const reset = () => {
  window.location.reload();
};

const updateLayoutScale = () => {
  if (!canvasStage.value) return;

  const stageWidth = canvasStage.value.clientWidth;
  const stageHeight = canvasStage.value.clientHeight;

  if (stageWidth <= 0 || stageHeight <= 0) return;

  const imgW = canvasDimensions.width;
  const imgH = canvasDimensions.height;
  const padding = 32;

  const availableW = Math.max(0, stageWidth - padding);
  const availableH = Math.max(0, stageHeight - padding);

  const scaleW = availableW / imgW;
  const scaleH = availableH / imgH;

  let scale = Math.min(scaleW, scaleH);

  if (scale > 1) scale = 1;
  if (scale < 0.1) scale = 0.1;

  canvasScale.value = scale || 1;
};

onMounted(() => {
  window.addEventListener("resize", updateLayoutScale);

  if (canvasStage.value) {
    resizeObserver = new ResizeObserver(() => updateLayoutScale());
    resizeObserver.observe(canvasStage.value);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", updateLayoutScale);
  if (resizeObserver) resizeObserver.disconnect();
  if (canvas) canvas.dispose();
});
</script>

<template>
  <div
    class="flex flex-col md:flex-row h-screen w-full bg-gray-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 overflow-hidden font-sans"
  >
    <!-- SIDEBAR (Desktop) -->
    <aside
      class="hidden md:flex w-72 flex-col bg-slate-900 text-white flex-shrink-0 border-r border-slate-800 z-20"
    >
      <!-- Brand -->
      <div class="h-16 flex items-center px-8 border-b border-white/10">
        <div
          class="w-8 h-8 bg-white text-slate-900 flex items-center justify-center font-bold text-lg mr-3 rounded-sm"
        >
          EX
        </div>
        <div>
          <h1 class="font-bold text-lg tracking-wide uppercase">Excert</h1>
          <p
            class="text-[10px] text-slate-400 font-mono tracking-widest uppercase"
          >
            Beta
          </p>
        </div>
      </div>

      <!-- Steps Nav -->
      <nav class="flex-1 py-8 px-4 space-y-1 overflow-y-auto">
        <div
          v-for="(s, index) in steps"
          :key="index"
          class="relative group"
        >
          <!-- Connector Line -->
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
        &copy; 2026 Excert
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
        <span class="font-bold uppercase tracking-wider text-sm">{{
          steps[step]
        }}</span>
      </div>
      <div class="text-xs font-mono text-slate-400">Step {{ step + 1 }}/5</div>
    </header>

    <!-- MAIN CONTENT -->
    <main
      class="flex-1 relative flex flex-col h-full overflow-hidden bg-white dark:bg-slate-950 w-full"
    >
      <!-- Top Bar (Contextual Actions) -->
      <div
        v-if="step > 0 && step < 4"
        class="h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sm:px-10 bg-white dark:bg-slate-950 flex-shrink-0 z-10"
      >
        <h2
          class="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-tight hidden sm:block"
        >
          {{
            step === 1
              ? "Biblioteca de Modelos"
              : step === 2
              ? "Seleção de Dados"
              : "Editor de Mapeamento"
          }}
        </h2>

        <!-- Navigation Buttons -->
        <div class="flex items-center gap-3 ml-auto">
          <button
            v-if="step === 2 && selectedFields.length > 0"
            @click="goToMapping"
            class="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all rounded-sm"
          >
            Continuar
          </button>
          <button
            v-if="step === 3"
            @click="generateCertificates"
            :disabled="Object.keys(fieldConfigs).length !== selectedFields.length"
            class="px-6 py-2 bg-emerald-600 text-white text-xs font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all rounded-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-400 dark:disabled:bg-slate-700"
            :title="Object.keys(fieldConfigs).length !== selectedFields.length ? 'Mapeie todos os campos antes de finalizar' : 'Gerar Certificados'"
          >
            <span>Finalizar</span>
            <svg
              class="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              ></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- Scrollable Workspace -->
      <div class="flex-1 overflow-auto p-6 sm:p-10 relative scroll-smooth">
        <!-- STEP 0: Upload -->
        <div
          v-if="step === 0"
          class="h-full flex flex-col items-center justify-center"
        >
          <div
            class="w-full max-w-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-6 sm:p-12 text-center rounded-sm"
          >
            <div
              class="mb-8 inline-flex p-4 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-3xl shadow-sm rotate-3 transform transition hover:rotate-6"
            >
              📂
            </div>
            <h1
              class="text-3xl font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-tight"
            >
              Iniciar Projeto
            </h1>
            <p class="text-slate-500 mb-10 max-w-md mx-auto">
              Carregue sua fonte de dados (.xlsx) para começar a automação.
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

        <!-- STEP 1: Templates -->
        <div
          v-if="step === 1"
          class="max-w-5xl mx-auto"
        >
          <h3
            class="text-xl font-bold text-slate-900 dark:text-white mb-2 uppercase tracking-tight block sm:hidden"
          >
            Selecione o Modelo
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
            <!-- Default -->
            <div
              @click="useDefaultTemplate"
              class="group cursor-pointer border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-600 transition-all p-2 rounded-sm"
            >
              <div
                class="aspect-video bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-4 overflow-hidden border border-slate-100 dark:border-slate-800"
              >
                <img
                  :src="'/tools/assets/excert/default-model.svg'"
                  alt="Modelo padrão"
                  class="w-full h-full object-contain opacity-80 shadow-lg group-hover:scale-105 transition-transform duration-500"
                />
              </div>
              <div class="pt-4 px-2 pb-2 flex justify-between items-center">
                <span class="font-bold text-sm uppercase tracking-wide"
                  >Modelo Padrão</span
                >
                <span
                  class="text-[10px] font-mono text-slate-400 px-2 py-1 bg-slate-100 dark:bg-slate-800"
                  >Classic</span
                >
              </div>
            </div>

            <!-- Upload -->
            <label
              class="group cursor-pointer border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-600 transition-all p-2 rounded-sm relative"
            >
              <input
                type="file"
                class="hidden"
                accept="image/*"
                @change="handleTemplateUpload"
              />
              <div
                class="aspect-video bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center gap-4 border border-dashed border-slate-200 dark:border-slate-700 group-hover:bg-slate-100 dark:group-hover:bg-slate-700 transition py-12"
              >
                <div
                  class="w-12 h-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white transition-colors"
                >
                  +
                </div>
                <span
                  class="text-xs font-bold uppercase tracking-widest text-slate-500"
                  >Fazer Upload</span
                >
              </div>
              <div class="pt-4 px-2 pb-2 flex justify-between items-center">
                <span class="font-bold text-sm uppercase tracking-wide"
                  >Personalizado</span
                >
                <span
                  class="text-[10px] font-mono text-slate-400 px-2 py-1 bg-slate-100 dark:bg-slate-800"
                  >JPG/PNG</span
                >
              </div>
            </label>
          </div>
        </div>

        <!-- STEP 2: Columns -->
        <div
          v-if="step === 2"
          class="max-w-4xl mx-auto h-full flex flex-col"
        >
          <div class="flex-1">
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <label
                v-for="(header, index) in excelHeaders"
                :key="index"
                class="relative p-4 border border-slate-200 dark:border-slate-800 cursor-pointer bg-white dark:bg-slate-900 hover:border-slate-400 dark:hover:border-slate-600 transition-all group"
              >
                <div class="flex items-center gap-3">
                  <div class="relative flex items-center">
                    <input
                      type="checkbox"
                      :value="header"
                      v-model="selectedFields"
                      class="peer appearance-none w-5 h-5 border border-slate-300 dark:border-slate-600 checked:bg-slate-900 dark:checked:bg-white checked:border-transparent transition-all rounded-sm"
                    />
                    <svg
                      class="absolute w-3.5 h-3.5 text-white dark:text-slate-900 pointer-events-none opacity-0 peer-checked:opacity-100 left-0.5 top-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="3"
                        d="M5 13l4 4L19 7"
                      ></path>
                    </svg>
                  </div>
                  <span
                    class="font-mono text-sm group-hover:text-slate-900 dark:group-hover:text-white transition-colors select-none truncate"
                    :title="header"
                    >{{ header }}</span
                  >
                </div>
              </label>
            </div>
          </div>
          <div
            class="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-500"
          >
            {{ selectedFields.length }} Colunas Selecionadas
          </div>
        </div>

        <!-- STEP 3: Mapping (Split Editor) -->
        <div
          v-show="step === 3"
          class="w-full min-h-full lg:h-full flex flex-col lg:flex-row gap-6"
        >
          <!-- Canvas Wrapper -->
          <div
            ref="canvasStage"
            class="w-full lg:flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex justify-center items-center overflow-hidden rounded-sm relative shadow-inner p-2 sm:p-4 min-h-[35vh] sm:min-h-[500px]"
          >
            <!-- Scalable Container -->
            <div
              :style="{
                width: canvasDimensions.width + 'px',
                height: canvasDimensions.height + 'px',
                transform: `scale(${canvasScale})`,
                transformOrigin: 'center center',
                transition: 'transform 0.1s ease-out',
              }"
              class="relative shadow-xl"
            >
              <canvas id="certificateCanvas"></canvas>

              <!-- Instruction Overlay -->
              <div
                v-if="selectedFields.length > 0 && !textObject"
                class="absolute top-4 left-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur border border-slate-200 dark:border-slate-700 p-3 text-xs shadow-sm max-w-[200px] sm:max-w-xs pointer-events-none z-10"
              >
                <strong
                  class="uppercase text-[10px] tracking-wider block mb-1 text-slate-500"
                  >Dica</strong
                >
                Desenhe um retângulo na imagem para posicionar o campo
                <b>{{ selectedFields[currentFieldIndex] }}</b
                >.
              </div>
            </div>
          </div>

          <!-- Tools sidebar -->
          <div
            class="w-full lg:w-80 flex flex-col gap-px bg-slate-200 dark:bg-slate-800 p-px border border-slate-200 dark:border-slate-800 rounded-sm overflow-hidden"
          >
            <!-- Field Tabs List -->
            <div
              class="bg-white dark:bg-slate-950 p-4 max-h-48 overflow-y-auto border-b border-slate-100 dark:border-slate-800"
            >
              <h4
                class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3"
              >
                Campos
              </h4>
              <div class="space-y-1">
                <button
                  v-for="(field, idx) in selectedFields"
                  :key="idx"
                  @click="switchTab(idx)"
                  class="w-full flex items-center justify-between px-3 py-2 text-xs font-medium border rounded-sm transition-all text-left"
                  :class="
                    currentFieldIndex === idx
                      ? 'bg-slate-50 dark:bg-slate-800 border-slate-900 dark:border-white text-slate-900 dark:text-white'
                      : 'border-transparent text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900'
                  "
                >
                  <span class="truncate">{{ field }}</span>
                  <span
                    class="w-2 h-2 rounded-full"
                    :class="
                      fieldConfigs[field]
                        ? 'bg-emerald-500'
                        : 'bg-slate-200 dark:bg-slate-700'
                    "
                  ></span>
                </button>
              </div>
            </div>

            <!-- Properties -->
            <div class="flex-1 bg-white dark:bg-slate-950 p-6 flex flex-col">
              <h4
                class="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-6 flex justify-between items-center"
              >
                Propriedades
                <span
                  v-if="!textObject"
                  class="text-orange-500 text-[9px] border border-orange-200 bg-orange-50 px-1 py-0.5 rounded-sm"
                  >Nenhuma seleção</span
                >
              </h4>

              <div
                class="space-y-6"
                :class="{
                  'opacity-30 pointer-events-none filter grayscale':
                    !textObject,
                }"
              >
                <!-- Font Size -->
                <div>
                  <label
                    class="flex justify-between text-[10px] font-bold uppercase tracking-wider mb-2"
                    >Tamanho
                    <span class="text-slate-400"
                      >{{ currentProps.fontSize }}px</span
                    ></label
                  >
                  <div class="flex items-center gap-2">
                    <button
                      @click="adjustFontSize(-2)"
                      class="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      -
                    </button>
                    <input
                      type="range"
                      v-model.number="currentProps.fontSize"
                      @input="updateActiveObject"
                      min="10"
                      max="200"
                      class="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-slate-900 dark:accent-white"
                    />
                    <button
                      @click="adjustFontSize(2)"
                      class="w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-sm flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      +
                    </button>
                  </div>
                </div>

                <!-- Alignment -->
                <div>
                  <label
                    class="text-[10px] font-bold uppercase tracking-wider mb-2 block"
                    >Alinhamento</label
                  >
                  <div
                    class="flex border border-slate-200 dark:border-slate-800 rounded-sm overflow-hidden"
                  >
                    <button
                      @click="setAlignment('left')"
                      class="flex-1 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                      :class="
                        currentProps.textAlign === 'left'
                          ? 'bg-slate-100 dark:bg-slate-800 text-black dark:text-white'
                          : 'text-slate-400'
                      "
                    >
                      <svg
                        class="w-4 h-4 mx-auto"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M4 6h16M4 12h10M4 18h16"
                        ></path>
                      </svg>
                    </button>
                    <button
                      @click="setAlignment('center')"
                      class="border-l border-r border-slate-200 dark:border-slate-800 flex-1 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                      :class="
                        currentProps.textAlign === 'center'
                          ? 'bg-slate-100 dark:bg-slate-800 text-black dark:text-white'
                          : 'text-slate-400'
                      "
                    >
                      <svg
                        class="w-4 h-4 mx-auto"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M4 6h16M4 12h16M4 18h16"
                        ></path>
                      </svg>
                    </button>
                    <button
                      @click="setAlignment('right')"
                      class="flex-1 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                      :class="
                        currentProps.textAlign === 'right'
                          ? 'bg-slate-100 dark:bg-slate-800 text-black dark:text-white'
                          : 'text-slate-400'
                      "
                    >
                      <svg
                        class="w-4 h-4 mx-auto"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M4 6h16M10 12h10M4 18h16"
                        ></path>
                      </svg>
                    </button>
                  </div>
                </div>

                <!-- Color -->
                <div>
                  <label
                    class="text-[10px] font-bold uppercase tracking-wider mb-2 block"
                    >Cor</label
                  >
                  <div class="flex items-center gap-3">
                    <input
                      type="color"
                      v-model="currentProps.fill"
                      @input="updateActiveObject"
                      class="w-8 h-8 p-0 border-0 rounded-sm cursor-pointer ring-1 ring-slate-200 dark:ring-slate-700"
                    />
                    <span class="text-xs font-mono text-slate-500">{{
                      currentProps.fill
                    }}</span>
                  </div>
                </div>

                <div class="pt-4 flex flex-col gap-2">
                  <button
                    v-if="nextEmptyFieldIndex !== -1 && textObject"
                    @click="goToNextField"
                    class="w-full py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 border border-slate-900 dark:border-white text-xs font-bold uppercase hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors rounded-sm flex items-center justify-center gap-2"
                  >
                    <span>Próximo Campo</span>
                    →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- RESULTS SCREEN -->
        <div
          v-if="step === 4"
          class="h-full flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-950 to-white"
        >
          <div
            class="max-w-xl w-full bg-white dark:bg-slate-900 p-12 border border-slate-200 dark:border-slate-800 shadow-xl relative overflow-hidden"
          >
            <div
              class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-900 via-slate-500 to-slate-900 dark:from-white dark:via-slate-500 dark:to-white"
            ></div>

            <div
              class="mb-8 w-20 h-20 bg-slate-900 text-white mx-auto flex items-center justify-center text-3xl font-serif"
            >
              ✓
            </div>

            <h2
              class="text-4xl font-bold text-slate-900 dark:text-white mb-4 tracking-tighter"
            >
              Processo Concluído
            </h2>
            <p class="text-slate-500 dark:text-slate-400 mb-10 text-lg">
              Foram gerados
              <strong class="text-slate-900 dark:text-white">{{
                generatedImages.length
              }}</strong>
              documentos com sucesso.
            </p>

            <div class="flex flex-col gap-3">
              <button
                @click="downloadZip"
                class="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold uppercase tracking-widest hover:opacity-90 transition shadow-lg flex items-center justify-center gap-3"
              >
                <svg
                  class="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  ></path>
                </svg>
                Baixar ZIP
              </button>
              <div class="grid grid-cols-2 gap-3">
                <button
                  @click="backToAdjust"
                  class="py-3 border border-slate-300 dark:border-slate-700 font-bold uppercase text-xs tracking-widest hover:border-slate-900 dark:hover:border-white transition-colors"
                >
                  Voltar
                </button>
                <button
                  @click="reset"
                  class="py-3 border border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold uppercase text-xs tracking-widest transition-colors"
                >
                  Novo Projeto
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- LOADER -->
        <transition name="fade">
          <div
            v-if="isGenerating"
            class="absolute inset-0 z-50 bg-white/90 dark:bg-slate-950/95 backdrop-blur-sm flex flex-col items-center justify-center"
          >
            <div
              class="w-24 h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mb-4"
            >
              <div
                class="h-full bg-slate-900 dark:bg-white animate-indeterminate-bar"
              ></div>
            </div>
            <span
              class="font-mono text-xs uppercase tracking-widest text-slate-500"
              >Gerando arquivos...</span
            >
          </div>
        </transition>
      </div>
    </main>
  </div>
</template>

<style scoped>
@keyframes indeterminate-bar {
  0% {
    width: 0%;
    margin-left: 0;
  }
  50% {
    width: 50%;
    margin-left: 25%;
  }
  100% {
    width: 100%;
    margin-left: 100%;
  }
}
.animate-indeterminate-bar {
  animation: indeterminate-bar 1.5s infinite linear;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
