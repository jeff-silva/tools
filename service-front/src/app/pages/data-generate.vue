<script setup>
definePageMeta({
  title: "Data Generator",
  description: "Gerador de dados de arquivos",
  icon: "ph:database-duotone",
  menu: true,
  tags: ["data", "generate", "json", "csv", "xml", "excel"],
  badge: "NOVO",
  color: "bg-emerald-500",
});

useHead({
  title: "Data Generator - Dashboard",
  link: [
    {
      rel: "stylesheet",
      href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap",
    },
  ],
});

import { faker } from '@faker-js/faker';
import ExcelJS from 'exceljs';

// State
const state = reactive({
  step: 0,
  steps: ["Definir Colunas", "Configurar Dados"],
  columns: [
    { id: faker.helpers.fake('{{string.uuid}}'), name: "nome", type: "person.firstName" },
    { id: faker.helpers.fake('{{string.uuid}}'), name: "email", type: "internet.email" },

  ],
  newColumnName: "",
  
  // Step 2 Settings
  generateRows: 10,
  outputFormat: "json", // json, csv, xml, xlsx
  outputFilename: "download_" + Math.floor(Math.random() * 100000),
  isGenerating: false,
  
  // Methods
  columnAdd() {
    if (!this.newColumnName.trim()) return;
    
    this.columns.push({
      id: faker.helpers.fake('{{string.uuid}}'),
      name: this.newColumnName.trim(),
      type: "person.firstName"
    });
    this.newColumnName = "";
  },
  
  columnRemove(id) {
    this.columns = this.columns.filter(c => c.id !== id);
  },
  
  nextStep() {
    if (this.step === 0 && this.columns.length === 0) {
      return;
    }
    if (this.step === 1) {
       if (this.generateRows < 1 || this.generateRows > 100000) {
         alert("Número de linhas deve ser entre 1 e 100.000");
         return;
       }
    }
    if (this.step < this.steps.length - 1) {
      this.step++;
    }
  },
  
  prevStep() {
    if (this.step > 0) {
      this.step--;
    }
  },
  
  async generateData() {
    if (this.isGenerating) return;
    this.isGenerating = true;

    try {
      // 1. Array de objetos com os dados fake gerados
      const data = [];
      for (let i = 0; i < this.generateRows; i++) {
        const row = {};
        for (const col of this.columns) {
          const typeDef = fakerState.types.find(t => t.id === col.type);
          if (typeDef && typeDef.template) {
             row[col.name] = faker.helpers.fake(typeDef.template);
          } else {
             row[col.name] = "";
          }
        }
        data.push(row);
      }

      let baseName = faker.helpers.fake(this.outputFilename.trim()).replace(/[^a-z0-9_-]/gi, '_');
      if (!baseName) baseName = `faker_data_${new Date().getTime()}`;
      
      const filename = `${baseName}.${this.outputFormat}`;
      let blob = null;

      // 2. Formatadores e Builders
      if (this.outputFormat === 'json') {
        blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      } 
      else if (this.outputFormat === 'csv') {
        const headerRow = keys.join(",") + "\n";
        const bodyRows = data.map(r => keys.map(k => `"${String(r[k]).replace(/"/g, '""')}"`).join(",")).join("\n");
        blob = new Blob([headerRow + bodyRows], { type: "text/csv;charset=utf-8;" });
      }
      else if (this.outputFormat === 'xml') {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<dataset>\n';
        data.forEach((row) => {
          xml += "  <row>\n";
          for (const key of keys) {
            xml += `    <${key}>${String(row[key] || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</${key}>\n`;
          }
          xml += "  </row>\n";
        });
        xml += "</dataset>";
        blob = new Blob([xml], { type: "application/xml" });
      }
      else if (this.outputFormat === 'xlsx') {
        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Mock Data");
        
        // Colunas e Heades
        ws.columns = keys.map(k => ({ header: k, key: k, width: Math.max(k.length + 5, 15) }));
        
        // Adicionando as rows
        ws.addRows(data);
        
        // Setar linha de título em negrito
        ws.getRow(1).font = { bold: true };

        const buffer = await wb.xlsx.writeBuffer();
        blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      }

      // 3. Forçar Download
      if (blob) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      
    } catch(err) {
      console.error(err);
      alert("Falha ao gerar o arquivo de dados: " + err.message);
    } finally {
      this.isGenerating = false;
    }
  }
});

const fakerState = reactive({
  types: [
    // Pessoal
    { id: 'person.firstName', name: 'Primeiro Nome', template: '{{person.firstName}}' },
    { id: 'person.lastName', name: 'Último Nome', template: '{{person.lastName}}' },
    { id: 'person.fullName', name: 'Nome Completo', template: '{{person.fullName}}' },
    { id: 'person.jobTitle', name: 'Profissão', template: '{{person.jobTitle}}' },
    
    // Contato & Internet
    { id: 'internet.email', name: 'Email', template: '{{internet.email}}' },
    { id: 'phone.number', name: 'Telefone', template: '{{phone.number}}' },
    { id: 'internet.userName', name: 'Username', template: '{{internet.userName}}' },
    { id: 'internet.password', name: 'Senha', template: '{{internet.password}}' },
    { id: 'internet.url', name: 'URL (Website)', template: '{{internet.url}}' },
    { id: 'internet.ipv4', name: 'Endereço IPv4', template: '{{internet.ipv4}}' },

    // Localização (Endereço)
    { id: 'location.streetAddress', name: 'Endereço (Rua/Num)', template: '{{location.streetAddress}}' },
    { id: 'location.city', name: 'Cidade', template: '{{location.city}}' },
    { id: 'location.state', name: 'Estado', template: '{{location.state}}' },
    { id: 'location.zipCode', name: 'CEP', template: '{{location.zipCode}}' },
    { id: 'location.country', name: 'País', template: '{{location.country}}' },

    // Financeiro / Comercial
    { id: 'finance.accountNumber', name: 'Número de Conta', template: '{{finance.accountNumber}}' },
    { id: 'finance.amount', name: 'Valor Financeiro', template: '{{finance.amount}}' },
    { id: 'finance.currencyName', name: 'Moeda', template: '{{finance.currencyName}}' },
    { id: 'company.name', name: 'Nome de Empresa', template: '{{company.name}}' },
    { id: 'commerce.productName', name: 'Nome de Produto', template: '{{commerce.productName}}' },
    { id: 'commerce.price', name: 'Preço', template: '{{commerce.price}}' },

    // Datas e Tempo
    { id: 'date.past', name: 'Data no Passado', template: '{{date.past}}' },
    { id: 'date.future', name: 'Data no Futuro', template: '{{date.future}}' },
    { id: 'date.recent', name: 'Data Recente', template: '{{date.recent}}' },
    { id: 'date.birthdate', name: 'Data de Nascimento', template: '{{date.birthdate}}' },

    // Outros / Genéricos
    { id: 'string.uuid', name: 'UUID v4', template: '{{string.uuid}}' },
    { id: 'lorem.sentence', name: 'Frase Curta', template: '{{lorem.sentence}}' },
    { id: 'lorem.paragraph', name: 'Parágrafo', template: '{{lorem.paragraph}}' },
    { id: 'color.human', name: 'Cor', template: '{{color.human}}' },
  ],
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
          class="w-8 h-8 flex items-center justify-center mr-3 rounded-sm bg-emerald-500 text-white"
        >
          <icon
            name="ph:database-bold"
            class="w-5 h-5"
          />
        </div>
        <div>
          <h1 class="font-bold text-lg tracking-wide uppercase">Data</h1>
          <p
            class="text-[10px] text-slate-400 font-mono tracking-widest uppercase"
          >
            Generator
          </p>
        </div>
      </div>
      <nav class="flex-1 py-8 px-4 space-y-1 overflow-y-auto">
        <div
          v-for="(stepName, index) in state.steps"
          :key="index"
          class="relative group"
        >
          <div
            v-if="index < state.steps.length - 1"
            class="absolute left-3.5 top-8 bottom-[-8px] w-px bg-white/10 group-hover:bg-white/20 transition-colors"
          ></div>
          <div
            class="flex items-center gap-4 p-3 rounded-sm transition-all duration-300"
            :class="
              state.step === index
                ? 'bg-white/10 border-l-2 border-emerald-500'
                : state.step > index
                ? 'text-emerald-400'
                : 'text-slate-500'
            "
          >
            <div
              class="w-7 h-7 flex items-center justify-center text-xs font-bold border rounded-sm transition-all z-10 bg-slate-900"
              :class="
                state.step === index
                  ? 'border-emerald-500 text-white'
                  : state.step > index
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-slate-700 text-slate-600'
              "
            >
              <span v-if="state.step > index">✓</span>
              <span v-else>{{ index + 1 }}</span>
            </div>
            <span class="text-xs font-bold uppercase tracking-widest"
              >{{ stepName }}</span
            >
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
          class="w-8 h-8 flex items-center justify-center font-bold text-sm rounded-sm bg-emerald-500 text-white"
        >
          D
        </div>
        <span class="font-bold uppercase tracking-wider text-sm"
          >Data Generator</span
        >
      </div>
    </header>

    <!-- CONTENT -->
    <main
      class="flex-1 relative flex flex-col h-full overflow-hidden bg-white dark:bg-slate-950 w-full"
    >
      <!-- TOP BAR -->
      <div
        class="h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 sm:px-10 bg-white dark:bg-slate-950 flex-shrink-0 z-10"
      >
        <h2
          class="text-lg font-bold text-slate-800 dark:text-white uppercase tracking-tight hidden sm:block"
        >
          {{ state.steps[state.step] }}
        </h2>
        
        <div class="flex items-center gap-3 ml-auto">
          <button
            v-if="state.step > 0"
            @click="state.prevStep()"
            class="px-5 py-2 border border-slate-300 dark:border-slate-700 hover:border-slate-500 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors"
          >
            Voltar
          </button>
          
          <button
            v-if="state.step === 0"
            @click="state.nextStep()"
            class="px-6 py-2 bg-emerald-600 text-white text-xs font-bold uppercase tracking-widest hover:bg-emerald-700 transition-all rounded-sm flex items-center gap-2 disabled:opacity-50"
            :disabled="state.columns.length === 0"
          >
            Continuar
            <icon name="ph:arrow-right-bold" class="w-4 h-4 ml-1" />
          </button>
          
          <button
            v-if="state.step === 1"
            @click="state.generateData()"
            :disabled="state.isGenerating"
            class="px-6 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all rounded-sm gap-2 flex items-center disabled:opacity-50"
          >
            <icon v-if="state.isGenerating" name="ph:spinner-gap-bold" class="w-4 h-4 mr-1 animate-spin" />
            <icon v-else name="ph:magic-wand-duotone" class="w-4 h-4 mr-1" />
            {{ state.isGenerating ? "Gerando..." : "Gerar Dados" }}
          </button>
        </div>
      </div>

      <!-- MAIN AREA -->
      <div
        class="flex-1 overflow-auto p-6 sm:p-10 relative scroll-smooth flex flex-col"
      >
        <!-- STEP 0: DEFINIR COLUNAS -->
        <div
          v-if="state.step === 0"
          class="max-w-4xl mx-auto w-full flex flex-col gap-8"
        >
          <!-- HEADER DESC -->
          <div>
             <h1 class="text-3xl font-bold text-slate-900 dark:text-white mb-2 uppercase tracking-tight">
               Estrutura de Dados
             </h1>
             <p class="text-slate-500">
               Defina as colunas que seu arquivo final terá. Em seguida, você configurará que tipo de dado cada uma vai gerar.
             </p>
          </div>

          <!-- ADDITION FORM -->
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-6 shadow-sm flex flex-col sm:flex-row gap-4 items-end">
            <div class="flex-1 w-full">
              <label class="block text-xs uppercase font-bold text-slate-500 mb-2 tracking-widest">
                Nome da nova Coluna
              </label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                  <icon name="ph:columns-duotone" class="w-5 h-5" />
                </div>
                <input
                  v-model="state.newColumnName"
                  @keyup.enter="state.columnAdd()"
                  type="text"
                  placeholder="Ex: email_do_cliente"
                  class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm rounded-sm focus:ring-emerald-500 focus:border-emerald-500 block pl-10 p-3 transition-colors placeholder:text-slate-400"
                />
              </div>
            </div>
            <button
              @click="state.columnAdd()"
              class="w-full h-[46px] sm:w-auto px-6 bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-700 transition-all rounded-sm flex items-center justify-center gap-2"
            >
              <icon name="ph:plus-bold" class="w-4 h-4" />
              Adicionar
            </button>
          </div>

          <!-- LIST OF COLUMNS -->
          <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm shadow-sm overflow-hidden flex flex-col">
            <div class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex justify-between items-center">
              <span class="text-xs font-bold uppercase tracking-widest text-slate-500">
                Colunas ({{ state.columns.length }})
              </span>
            </div>
            
            <div v-if="state.columns.length === 0" class="p-12 text-center flex flex-col items-center justify-center text-slate-400">
               <icon name="ph:empty-duotone" class="w-16 h-16 mb-4 opacity-50" />
               <p class="text-sm font-medium">Nenhuma coluna definida ainda.</p>
               <p class="text-xs mt-1">Adicione a primeira coluna usando o formulário acima.</p>
            </div>

            <div v-else class="max-h-[50vh] overflow-y-auto custom-scrollbar">
              <table class="w-full text-left border-collapse">
                <thead>
                  <tr class="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800">
                    <th class="w-12"></th>
                    <th class="py-3 px-4 text-xs font-bold uppercase tracking-widest text-slate-500">Nome da Coluna</th>
                    <th class="py-3 px-4 text-xs font-bold uppercase tracking-widest text-slate-500">Tipo</th>
                    <th class="w-16"></th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100 dark:divide-slate-800/60">
                  <tr
                    v-for="(col, i) in state.columns"
                    :key="col.id"
                    class="group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <!-- Order/Drag handle placeholder -->
                    <td class="px-4 py-3 text-center align-middle">
                      <div class="inline-flex items-center justify-center w-8 h-8 text-slate-300 dark:text-slate-700 cursor-move">
                        <icon name="ph:dots-six-vertical-bold" class="w-5 h-5" />
                      </div>
                    </td>
                    
                    <!-- COLUMN NAME -->
                    <td class="px-4 py-3">
                      <input
                        v-model="col.name"
                        type="text"
                        class="w-full bg-transparent border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:bg-white dark:focus:bg-slate-950 focus:border-emerald-500 rounded-sm px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-200 transition-colors outline-none"
                        placeholder="Nome da coluna"
                      />
                    </td>

                    <!-- TYPE SELECTOR -->
                    <td class="px-4 py-3">
                      <select
                        v-model="col.type"
                        class="w-full bg-slate-50 dark:bg-slate-950 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 focus:border-emerald-500 rounded-sm px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors outline-none cursor-pointer"
                      >
                        <option 
                          v-for="typeDef in fakerState.types" 
                          :key="typeDef.id" 
                          :value="typeDef.id"
                        >
                          {{ typeDef.name }}
                        </option>
                      </select>
                    </td>

                    <!-- ACTIONS -->
                    <td class="px-4 py-3 text-right">
                      <button
                        @click="state.columnRemove(col.id)"
                        class="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-sm transition-colors opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                        title="Remover coluna"
                      >
                        <icon name="ph:trash-duotone" class="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- STEP 1: CONFIGURAR DADOS -->
        <div
          v-if="state.step === 1"
          class="max-w-4xl mx-auto w-full flex flex-col gap-8"
        >
          <!-- HEADER DESC -->
          <div>
             <h1 class="text-3xl font-bold text-slate-900 dark:text-white mb-2 uppercase tracking-tight">
               Configurações da Geração
             </h1>
             <p class="text-slate-500">
               Neste passo você define a formatação final do arquivo e o volume de informações aleatórias que o Faker precisará criar.
             </p>
          </div>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="flex flex-col gap-6">
              <!-- FILE NAME -->
              <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-6 shadow-sm flex flex-col">
                <div class="mb-4 inline-flex p-3 border border-slate-200 dark:border-slate-700 bg-emerald-50 dark:bg-slate-950 text-emerald-500 rounded-sm shadow-sm w-fit">
                   <icon name="ph:text-t-bold" class="w-6 h-6" />
                </div>
                <label class="block text-xs uppercase font-bold text-slate-500 mb-2 tracking-widest">
                  Nome do Arquivo
                </label>
                <div class="flex items-center mt-1">
                  <input
                    v-model="state.outputFilename"
                    type="text"
                    :placeholder="`ex: mock_users_{{string.uuid}}`"
                    class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm font-bold rounded-sm focus:ring-emerald-500 focus:border-emerald-500 block p-3 transition-colors placeholder:font-normal placeholder:text-slate-400"
                  />
                </div>
                <span class="text-[10px] text-slate-400 mt-2">Você pode usar templates do Faker (ex: <span v-pre>{{string.uuid}}</span>). A extensão é automática.</span>
              </div>
              
              <!-- ROWS / QUANTITY -->
              <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-6 shadow-sm flex flex-col">
                <div class="mb-4 inline-flex p-3 border border-slate-200 dark:border-slate-700 bg-emerald-50 dark:bg-slate-950 text-emerald-500 rounded-sm shadow-sm w-fit">
                   <icon name="ph:rows-duotone" class="w-6 h-6" />
                </div>
                <label class="block text-xs uppercase font-bold text-slate-500 mb-2 tracking-widest">
                  Quantidade de Registros
                </label>
                <div class="flex items-center mt-1">
                  <input
                    v-model.number="state.generateRows"
                    type="number"
                    min="1"
                    max="100000"
                    class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-lg font-mono rounded-sm focus:ring-emerald-500 focus:border-emerald-500 block p-3 transition-colors"
                  />
                </div>
                <span class="text-[10px] text-slate-400 mt-2">Valores permitidos: 1 a 100.000 linhas</span>
              </div>
            </div>

            <!-- FORMAT -->
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-6 shadow-sm flex flex-col">
              <div class="mb-4 inline-flex p-3 border border-slate-200 dark:border-slate-700 bg-emerald-50 dark:bg-slate-950 text-emerald-500 rounded-sm shadow-sm w-fit">
                 <icon name="ph:file-code-duotone" class="w-6 h-6" />
              </div>
              <label class="block text-xs uppercase font-bold text-slate-500 mb-2 tracking-widest">
                Formato de Saída
              </label>
              <div class="space-y-2 mt-1">
                 <label class="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" :class="{'ring-2 ring-emerald-500 border-transparent': state.outputFormat === 'json'}">
                   <input type="radio" v-model="state.outputFormat" value="json" class="text-emerald-500 focus:ring-emerald-500" />
                   <div class="font-bold text-sm uppercase">JSON Format (.json)</div>
                 </label>
                 
                 <label class="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" :class="{'ring-2 ring-emerald-500 border-transparent': state.outputFormat === 'csv'}">
                   <input type="radio" v-model="state.outputFormat" value="csv" class="text-emerald-500 focus:ring-emerald-500" />
                   <div class="font-bold text-sm uppercase">CSV Padrão (.csv)</div>
                 </label>
                 
                 <label class="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" :class="{'ring-2 ring-emerald-500 border-transparent': state.outputFormat === 'xml'}">
                   <input type="radio" v-model="state.outputFormat" value="xml" class="text-emerald-500 focus:ring-emerald-500" />
                   <div class="font-bold text-sm uppercase">XML Schema (.xml)</div>
                 </label>

                 <label class="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors" :class="{'ring-2 ring-emerald-500 border-transparent': state.outputFormat === 'xlsx'}">
                   <input type="radio" v-model="state.outputFormat" value="xlsx" class="text-emerald-500 focus:ring-emerald-500" />
                   <div class="font-bold text-sm uppercase">Microsoft Excel (.xlsx)</div>
                 </label>
              </div>
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
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
  background: #334155;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #475569;
}
</style>
