<script setup lang="ts">
import { ref } from 'vue'
import { useClipboard } from '../composables/useClipboard'
import AppButton from './ui/AppButton.vue'
import AppIcon from './ui/AppIcon.vue'
import AppPanel from './ui/AppPanel.vue'
import CopyButton from './ui/CopyButton.vue'
import EmptyState from './ui/EmptyState.vue'

const count = ref(1)
const uuids = ref<string[]>([])

/** `copied` holds the index of the row that was just copied. */
const { copied, copy } = useClipboard()

function generate() {
  const n = Math.min(50, Math.max(1, count.value || 1))
  uuids.value = Array.from({ length: n }, () => crypto.randomUUID())
}
</script>

<template>
  <AppPanel narrow label="UUID" title="v4 Generator">
    <template v-if="uuids.length" #actions>
      <CopyButton :text="uuids.join('\n')" variant="label" label="Copy all" copied-label="Copied all" />
    </template>

    <div class="p-4">
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <AppButton variant="primary" size="md" @click="generate">
          <AppIcon name="refresh" :size="14" :stroke-width="2.2" />
          Generate
        </AppButton>
        <div class="flex items-center gap-2 text-xs text-[var(--muted)]">
          <span>Count</span>
          <input
            v-model.number="count"
            type="number"
            min="1"
            max="50"
            class="w-[72px] rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-2.5 py-1.5 font-[family-name:var(--mono)] text-[var(--text)] caret-[var(--accent)] outline-none transition-colors focus:border-[var(--accent)]"
          />
          <span class="text-[var(--gutter-text)]">max 50</span>
        </div>
      </div>

      <div v-if="uuids.length" class="overflow-hidden rounded-lg border border-[var(--border)]">
        <button
          v-for="(id, i) in uuids"
          :key="i"
          class="group flex w-full items-center gap-3 border-b border-[var(--border)] px-3 py-2 text-left transition-colors last:border-b-0 odd:bg-[var(--panel-soft)] hover:bg-[var(--accent-soft)]"
          @click="copy(id, i)"
        >
          <span class="w-6 shrink-0 text-right font-[family-name:var(--mono)] text-[11px] text-[var(--gutter-text)]">{{ i + 1 }}</span>
          <span class="flex-1 font-[family-name:var(--mono)] text-[12.5px] break-all text-[var(--text)]">{{ id }}</span>
          <span
            class="shrink-0 transition-opacity group-hover:opacity-100"
            :class="copied === i ? 'text-[var(--green)] opacity-100' : 'text-[var(--muted)] opacity-0'"
          >
            <AppIcon v-if="copied === i" name="check" :size="14" :stroke-width="2.5" />
            <AppIcon v-else name="copy" :size="14" />
          </span>
        </button>
      </div>

      <EmptyState v-else>
        Click <span class="font-semibold text-[var(--text)]">Generate</span> to create UUIDs · click any row to copy
      </EmptyState>
    </div>
  </AppPanel>
</template>
