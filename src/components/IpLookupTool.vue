<script setup lang="ts">
import { computed, ref } from 'vue'
import AppButton from './ui/AppButton.vue'
import AppIcon from './ui/AppIcon.vue'
import AppPanel from './ui/AppPanel.vue'
import EmptyState from './ui/EmptyState.vue'
import TextInput from './ui/TextInput.vue'

interface IpInfo {
  ip: string
  city?: string
  region?: string
  country_name?: string
  postal?: string
  latitude?: number
  longitude?: number
  timezone?: string
  org?: string
  asn?: string
  error?: boolean
  reason?: string
}

const query = ref('')
const loading = ref(false)
const error = ref('')
const result = ref<IpInfo | null>(null)

const fields: { key: keyof IpInfo; label: string }[] = [
  { key: 'city', label: 'City' },
  { key: 'region', label: 'Region' },
  { key: 'country_name', label: 'Country' },
  { key: 'postal', label: 'Postal' },
  { key: 'org', label: 'Org / ISP' },
  { key: 'asn', label: 'ASN' },
  { key: 'timezone', label: 'Timezone' },
]

/** Everything shown in the result grid: the API fields plus the coordinates. */
const tiles = computed(() => {
  const r = result.value
  if (!r) return []
  return [
    ...fields.map((f) => ({ label: f.label, value: r[f.key] ?? '—' })),
    {
      label: 'Coordinates',
      value: r.latitude != null && r.longitude != null ? `${r.latitude}, ${r.longitude}` : '—',
    },
  ]
})

const tileLabel = 'text-[10px] font-semibold tracking-wide text-[var(--muted)] uppercase'

async function lookup() {
  loading.value = true
  error.value = ''
  result.value = null
  try {
    const ip = query.value.trim()
    const url = ip ? `https://ipapi.co/${encodeURIComponent(ip)}/json/` : 'https://ipapi.co/json/'
    const res = await fetch(url)
    const data: IpInfo = await res.json()
    if (data.error) throw new Error(data.reason || 'Lookup failed')
    result.value = data
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AppPanel narrow label="NETWORK" title="IP Lookup">
    <div class="p-4">
      <div class="mb-4 flex flex-col gap-2 sm:flex-row">
        <TextInput
          v-model="query"
          mono
          class="flex-1"
          placeholder="Leave blank for your IP, or enter e.g. 8.8.8.8"
          @keyup.enter="lookup"
        />
        <AppButton variant="primary" size="md" :disabled="loading" @click="lookup">
          <AppIcon name="search" :size="14" :stroke-width="2.2" />
          {{ loading ? 'Looking up…' : 'Lookup' }}
        </AppButton>
      </div>

      <p
        v-if="error"
        class="rounded-lg border border-[var(--border)] bg-[var(--diff-bg)] px-3 py-2.5 font-[family-name:var(--mono)] text-[12.5px] text-[var(--red)]"
      >
        ⚠ {{ error }}
      </p>

      <div v-else-if="result" class="flex flex-col gap-3">
        <!-- IP highlight -->
        <div class="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--accent-soft)] px-4 py-3">
          <AppIcon name="globe" :size="20" class="text-[var(--accent)]" />
          <div>
            <div :class="tileLabel">IP Address</div>
            <div class="font-[family-name:var(--mono)] text-base font-semibold text-[var(--text)]">{{ result.ip }}</div>
          </div>
        </div>

        <!-- Field grid -->
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div
            v-for="t in tiles"
            :key="t.label"
            class="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-2"
          >
            <div :class="tileLabel">{{ t.label }}</div>
            <div class="mt-0.5 font-[family-name:var(--mono)] text-[12.5px] break-words text-[var(--text)]">{{ t.value }}</div>
          </div>
        </div>
      </div>

      <EmptyState v-else>
        Enter an IP and press <span class="font-semibold text-[var(--text)]">Lookup</span>, or leave blank for your own
      </EmptyState>

      <p class="mt-3 text-[11px] text-[var(--muted)]">
        Geolocation data from ipapi.co (free tier, rate-limited).
      </p>
    </div>
  </AppPanel>
</template>
