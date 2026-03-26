<script setup>
import * as phonelib from 'libphonenumber-js';

import { useClipboard } from '@vueuse/core';
const clip = useClipboard();

definePageMeta({
  title: 'Google Dorks',
  description: 'Gerador de buscas avançadas para Google (OSINT)',
  icon: 'ph:detective-duotone',
  menu: true,
  tags: ['osint', 'google', 'dorks', 'busca', 'search'],
  badge: 'Novo',
  color: 'bg-red-500',
});

useHead({
  title: 'Dorks - Gerador de Buscas Avançadas',
  link: [
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    },
  ],
});

class Dork {
  type = '';
  icon = '';
  name = '';
  text = '';

  constructor() {
    this.init();
  }

  async init() {
    //
  }

  async run() {
    //
  }
}

class GeneralDork extends Dork {
  type = 'general';
  icon = 'ph:identification-card-duotone';
  name = 'Geral';
  text = 'Encontrar resultados de forma geral';

  searchName = '';
  searchEmail = '';
  searchPhone = '';
  searchPlace = '';

  searchUrl = '';

  async init() {
    await this.run();
  }

  async run() {
    try {
      let terms = [];

      // 1. E-MAIL (Alta Fidelidade)
      if (this.searchEmail) {
        const lines = this.searchEmail.split(/\r?\n/);
        for (let line of lines) {
          const email = line.trim();
          if (email) {
            terms.push(`"${email}"`);
            if (email.includes('@')) {
              const username = email.split('@')[0];
              if (username) terms.push(`"${username}"`);
            }
          }
        }
      }

      // 2. TELEFONE (Alta Fidelidade)
      if (this.searchPhone) {
        const lines = this.searchPhone.split(/\r?\n/);
        for (let line of lines) {
          const rawPhone = line.replace(/[^0-9]/g, '');
          if (rawPhone) {
            try {
              const parsed = new phonelib.PhoneNumber('+' + rawPhone);
              terms.push(`"${rawPhone}"`);
              terms.push(`"${parsed.number}"`);
              terms.push(`"${parsed.format('NATIONAL')}"`);
              terms.push(`"${parsed.format('INTERNATIONAL')}"`);
            } catch (e) {
              terms.push(`"${rawPhone}"`);
            }
          }
        }
      }

      // 3. NOME (Fidelidade Média)
      if (this.searchName) {
        const lines = this.searchName.split(/\r?\n/);
        for (let line of lines) {
          const nameClean = line.trim();
          if (nameClean) {
            terms.push(`"${nameClean}"`); // Nome Exato

            const parts = nameClean.split(/\s+/).filter((p) => p.length > 2);
            if (parts.length >= 2) {
              const first = parts[0];
              const last = parts[parts.length - 1];

              if (parts.length >= 3) {
                terms.push(`"${first} * ${last}"`);
              }
            }
          }
        }
      }

      // 4. LOCAL / CIDADE (Modificador de Contexto Exato)
      let placeTerms = [];
      if (this.searchPlace) {
        const lines = this.searchPlace.split(/\r?\n/);
        for (let line of lines) {
          const placeClean = line.trim();
          if (placeClean) {
            placeTerms.push(`"${placeClean}"`);
          }
        }
      }

      terms = [...new Set(terms)];
      placeTerms = [...new Set(placeTerms)];

      let searchStr = '';
      if (terms.length > 0 && placeTerms.length > 0) {
        searchStr = `(${terms.join(' OR ')}) AND (${placeTerms.join(' OR ')})`;
      } else if (terms.length > 0) {
        searchStr = terms.join(' OR ');
      } else if (placeTerms.length > 0) {
        searchStr = placeTerms.join(' OR ');
      }

      if (searchStr) {
        this.searchUrl = `https://www.google.com/search?q=${encodeURIComponent(
          searchStr
        )}`;
      } else {
        this.searchUrl = '';
      }
    } catch (_) {}
  }
}

class PhoneDork extends Dork {
  type = 'phone';
  icon = 'ph:phone-duotone';
  name = 'Phone';
  text = 'Encontrar números de telefone';

  phone = '';
  searchUrl = '';

  async run() {
    try {
      const phoneNumber = '+' + this.phone.replace(/[^0-9]/g, '');

      const parsed = new phonelib.PhoneNumber(phoneNumber);
      parsed.formats = [
        phoneNumber.replace(/[^0-9]/g, ''),
        parsed.number,
        parsed.format('NATIONAL'),
        parsed.format('INTERNATIONAL'),
        parsed.format('RFC3966'),
      ];

      const searchUrl = '"' + parsed.formats.join('" OR "') + '"';
      this.searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchUrl)}`;
    } catch (_) {}
  }
}

const dork = reactive({
  current: null,
  types: [new GeneralDork(), new PhoneDork()],
  select(type) {
    dork.current = type;
    dork.current.run();
  },
});

dork.select(dork.types[0]);
</script>

<template>
  <div
    class="flex flex-col md:flex-row h-screen w-full bg-gray-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 overflow-hidden font-sans"
  >
    <!-- SIDEBAR (Desktop) -->
    <aside
      class="hidden md:flex w-72 flex-col bg-slate-900 text-white flex-shrink-0 border-r border-slate-800 z-20"
    >
      <div class="h-16 flex items-center px-8 border-b border-white/10">
        <div
          class="w-8 h-8 bg-black border border-slate-700 text-slate-200 flex items-center justify-center font-bold text-lg mr-3 rounded-sm shadow-sm group hover:border-slate-500 transition-colors"
        >
          <Icon name="ph:detective-duotone" class="w-5 h-5" />
        </div>
        <div>
          <h1 class="font-bold text-lg tracking-wide uppercase">Dorks</h1>
          <p
            class="text-[10px] text-slate-400 font-mono tracking-widest uppercase"
          >
            OSINT Tool
          </p>
        </div>
      </div>
      <nav class="flex-1 py-8 px-4 space-y-1 overflow-y-auto">
        <div
          class="pt-2 pb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500"
        >
          Tipos de Buscas
        </div>

        <template v-for="t in dork.types">
          <button
            @click="dork.select(t)"
            class="w-full flex items-center gap-4 p-3 rounded-sm transition-all duration-300 group"
            :class="
              dork.current == t
                ? 'bg-white/10 border-l-2 border-white text-white'
                : 'text-slate-500 hover:bg-slate-800 hover:text-white'
            "
          >
            <div
              class="w-7 h-7 flex items-center justify-center text-xs font-bold border rounded-sm transition-all z-10 bg-slate-900"
              :class="
                dork.current == t
                  ? 'border-white text-white'
                  : 'border-slate-700 text-slate-600 group-hover:border-slate-500 group-hover:text-slate-400'
              "
            >
              <Icon :name="t.icon" class="w-4 h-4" />
            </div>
            <span class="text-xs font-bold uppercase tracking-widest">{{
              t.name
            }}</span>
          </button>
        </template>
      </nav>
      <div
        class="p-6 border-t border-white/10 text-xs text-slate-500 text-center"
      >
        &copy; 2026 Dorks OSINT
      </div>
    </aside>

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
          Pesquisa por {{ dork.current?.name || 'Dork' }}
        </h2>
      </div>

      <!-- MAIN AREA -->
      <div
        class="flex-1 overflow-auto p-6 sm:p-10 relative scroll-smooth flex flex-col items-center"
      >
        <div class="w-full max-w-2xl flex flex-col gap-6 mt-4 sm:mt-8">
          <div
            class="text-center mb-4 flex flex-col items-center animate-fade-in-down"
          >
            <div
              class="w-16 h-16 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full flex items-center justify-center mb-4 shadow-sm"
            >
              <Icon
                :name="dork.current?.icon || 'ph:detective-duotone'"
                class="w-8 h-8 text-slate-700 dark:text-slate-300"
              />
            </div>
            <h1
              class="text-3xl font-bold text-slate-900 dark:text-white mb-2 uppercase tracking-tight"
            >
              {{ dork.current?.name || 'Ferramenta' }}
            </h1>
            <p class="text-slate-500 text-sm">
              {{
                dork.current?.text || 'Selecione uma ferramenta p/ continuar.'
              }}
            </p>
          </div>

          <template v-if="dork.current?.type === 'general'">
            <div
              class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-6 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-700 relative overflow-hidden"
            >
              <div
                class="absolute top-0 left-0 w-1 h-full bg-blue-400 dark:bg-blue-600"
              ></div>

              <div class="space-y-4">
                <div>
                  <label
                    class="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 pl-2"
                  >
                    Nome Completo (Um por linha)
                  </label>
                  <textarea
                    v-model="dork.current.searchName"
                    @input="dork.current.run()"
                    rows="2"
                    placeholder="Antônio Augusto Moraes Liberato&#10;Gugu Liberato"
                    class="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-base rounded-sm focus:ring-2 focus:ring-slate-800 dark:focus:ring-slate-500 focus:border-transparent block p-3 transition-all placeholder:text-slate-400 font-mono shadow-inner outline-none resize-y min-h-[60px]"
                  ></textarea>
                </div>
                <div>
                  <label
                    class="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 pl-2"
                  >
                    E-mail (Um por linha)
                  </label>
                  <textarea
                    v-model="dork.current.searchEmail"
                    @input="dork.current.run()"
                    rows="2"
                    placeholder="pessoal@mail.com&#10;empresarial@mail.com"
                    class="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-base rounded-sm focus:ring-2 focus:ring-slate-800 dark:focus:ring-slate-500 focus:border-transparent block p-3 transition-all placeholder:text-slate-400 font-mono shadow-inner outline-none resize-y min-h-[60px]"
                  ></textarea>
                </div>
                <div>
                  <label
                    class="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 pl-2"
                  >
                    Telefone (Um por linha)
                  </label>
                  <textarea
                    v-model="dork.current.searchPhone"
                    @input="dork.current.run()"
                    rows="2"
                    placeholder="(11) 98765-4321&#10;+55 31 9999-9999"
                    class="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-base rounded-sm focus:ring-2 focus:ring-slate-800 dark:focus:ring-slate-500 focus:border-transparent block p-3 transition-all placeholder:text-slate-400 font-mono shadow-inner outline-none resize-y min-h-[60px]"
                  ></textarea>
                </div>
                <div>
                  <label
                    class="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 pl-2"
                  >
                    Localização (Um por linha)
                  </label>
                  <textarea
                    v-model="dork.current.searchPlace"
                    @input="dork.current.run()"
                    rows="2"
                    placeholder="Belo Horizonte&#10;Rio de Janeiro"
                    class="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-base rounded-sm focus:ring-2 focus:ring-slate-800 dark:focus:ring-slate-500 focus:border-transparent block p-3 transition-all placeholder:text-slate-400 font-mono shadow-inner outline-none resize-y min-h-[60px]"
                  ></textarea>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="dork.current?.type === 'phone'">
            <!-- Entrada de Dados -->
            <div
              class="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm p-6 shadow-sm transition-all hover:border-slate-300 dark:hover:border-slate-700 relative overflow-hidden"
            >
              <div
                class="absolute top-0 left-0 w-1 h-full bg-red-400 dark:bg-red-600"
              ></div>

              <label
                class="block text-xs font-bold uppercase tracking-widest text-slate-500 mb-3 pl-2"
              >
                Número Alvo (com informativos)
              </label>
              <div class="flex gap-3 flex-col sm:flex-row">
                <input
                  v-model="dork.current.phone"
                  @input="dork.current.run()"
                  @keyup.enter="dork.current.run()"
                  type="text"
                  placeholder="Ex: (11) 98765-4321"
                  class="flex-1 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-lg rounded-sm focus:ring-2 focus:ring-slate-800 dark:focus:ring-slate-500 focus:border-transparent block p-4 transition-all placeholder:text-slate-400 font-mono shadow-inner outline-none"
                />
              </div>
            </div>
          </template>

          <!-- RESULTADOS -->
          <div
            v-if="dork.current?.searchUrl"
            class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-sm flex flex-col shadow-lg overflow-hidden animate-fade-in"
          >
            <div
              class="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex justify-between items-center"
            >
              <span
                class="text-xs font-bold uppercase tracking-widest text-slate-500"
                >Query / Filtros Fixados</span
              >
            </div>
            <div class="p-6">
              <div
                class="w-full bg-slate-100 dark:bg-black/40 border border-slate-200 dark:border-slate-800 p-5 rounded-sm font-mono text-sm text-slate-800 dark:text-slate-300 break-words mb-6 select-all shadow-inner leading-relaxed"
              >
                {{
                  decodeURIComponent(
                    dork.current.searchUrl.split('q=')[1] || ''
                  )
                }}
              </div>

              <div class="flex gap-4 flex-col sm:flex-row">
                <button
                  @click="
                    clip.copy(
                      decodeURIComponent(
                        dork.current.searchUrl.split('q=')[1] || ''
                      )
                    )
                  "
                  class="flex-1 py-3 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all rounded-sm flex items-center justify-center gap-2 group"
                >
                  <Icon
                    :name="
                      clip.copied.value ? 'ph:check-bold' : 'ph:copy-duotone'
                    "
                    class="w-4 h-4 group-hover:scale-110 transition-transform"
                  />
                  {{ clip.copied.value ? 'Copiado!' : 'Copiar Dork' }}
                </button>

                <a
                  :href="dork.current.searchUrl"
                  target="_blank"
                  class="flex-1 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all rounded-sm flex items-center justify-center gap-2 group shadow-md"
                >
                  Buscar no Google
                  <Icon
                    name="ph:google-logo-bold"
                    class="w-4 h-4 group-hover:translate-x-1 transition-transform"
                  />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.animate-fade-in-down {
  animation: fadeInDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(15px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-15px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
