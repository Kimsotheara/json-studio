<script setup lang="ts">
import { computed, defineAsyncComponent, ref, type Component } from 'vue'
import type { TabKey } from './types'
import { dark } from './composables/theme'
import AppIcon from './components/ui/AppIcon.vue'
import JsonTool from './components/JsonTool.vue'
import XmlTool from './components/XmlTool.vue'
import D2Tool from './components/D2Tool.vue'
import ErdTool from './components/ErdTool.vue'
import Base64Tool from './components/Base64Tool.vue'
import UuidTool from './components/UuidTool.vue'
import IpLookupTool from './components/IpLookupTool.vue'
import ApiDocsTool from './components/ApiDocsTool.vue'

// sql-formatter ships every dialect (~300 kB), so load it only when the tab opens.
const SqlTool = defineAsyncComponent(() => import('./components/SqlTool.vue'))

/** To add a tool: create its component, add the key to TabKey, and list it here. */
const tabs: { key: TabKey; label: string; component: Component }[] = [
  { key: 'editor', label: 'Editor', component: JsonTool },
  { key: 'xml', label: 'XML', component: XmlTool },
  { key: 'd2', label: 'D2', component: D2Tool },
  { key: 'sql', label: 'SQL', component: SqlTool },
  { key: 'erd', label: 'ERD', component: ErdTool },
  { key: 'base64', label: 'Base64', component: Base64Tool },
  { key: 'uuid', label: 'UUID', component: UuidTool },
  { key: 'iplookup', label: 'IP Lookup', component: IpLookupTool },
  { key: 'apidocs', label: 'API Docs', component: ApiDocsTool },
]
const activeTab = ref<TabKey>('editor')
const activeTool = computed(() => tabs.find((t) => t.key === activeTab.value)!.component)
</script>

<template>
  <header
    class="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--border)] bg-[var(--panel)] px-3 py-2.5 sm:px-5"
  >
    <div class="flex shrink-0 items-center gap-2">
      <span
        class="grid h-7 w-7 place-items-center rounded-lg bg-[var(--accent)] text-[13px] font-bold text-white"
      >
        { }
      </span>
      <span class="text-[15px] font-bold tracking-tight">JSON <span class="font-normal text-[var(--muted)]">Studio</span></span>
    </div>

    <nav class="order-last -mx-1 flex w-full gap-0.5 overflow-x-auto px-1 sm:order-none sm:w-auto">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors"
        :class="
          activeTab === t.key
            ? 'bg-[var(--tab-active-bg)] text-[var(--tab-active-text)]'
            : 'text-[var(--muted)] hover:bg-[var(--ctrl-bg)] hover:text-[var(--text)]'
        "
        @click="activeTab = t.key"
      >
        {{ t.label }}
      </button>
    </nav>

    <button
      class="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--ctrl-bg)] hover:text-[var(--text)]"
      :title="dark ? 'Switch to light mode' : 'Switch to dark mode'"
      @click="dark = !dark"
    >
      <AppIcon :name="dark ? 'sun' : 'moon'" :size="17" />
    </button>
  </header>

  <main class="p-3 sm:p-4">
    <!-- KeepAlive: each tool keeps its text and settings while you visit other tabs. -->
    <KeepAlive>
      <component :is="activeTool" />
    </KeepAlive>
  </main>
</template>
