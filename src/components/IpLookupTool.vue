<script setup lang="ts">
import { computed, ref } from 'vue'

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

const coords = computed(() => {
  const r = result.value
  return r && r.latitude != null && r.longitude != null ? `${r.latitude}, ${r.longitude}` : '—'
})

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
  <section
    class="mx-auto flex max-w-[820px] flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]"
  >
    <header class="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
      <span class="text-[11px] font-semibold tracking-[0.12em] text-[var(--muted)]">NETWORK</span>
      <h2 class="text-sm font-semibold">IP Lookup</h2>
    </header>

    <div class="p-4">
      <div class="mb-4 flex flex-col gap-2 sm:flex-row">
        <input
          v-model="query"
          placeholder="Leave blank for your IP, or enter e.g. 8.8.8.8"
          class="flex-1 rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-2 font-[family-name:var(--mono)] text-[12.5px] text-[var(--text)] caret-[var(--accent)] outline-none transition-colors focus:border-[var(--accent)]"
          @keyup.enter="lookup"
        />
        <button
          class="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--tab-active-text)] transition-opacity hover:opacity-90 disabled:opacity-50"
          :disabled="loading"
          @click="lookup"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          {{ loading ? 'Looking up…' : 'Lookup' }}
        </button>
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
          <div>
            <div class="text-[10px] font-semibold tracking-wide text-[var(--muted)] uppercase">IP Address</div>
            <div class="font-[family-name:var(--mono)] text-base font-semibold text-[var(--text)]">{{ result.ip }}</div>
          </div>
        </div>

        <!-- Field grid -->
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <div
            v-for="f in fields"
            :key="f.key"
            class="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-2"
          >
            <div class="text-[10px] font-semibold tracking-wide text-[var(--muted)] uppercase">{{ f.label }}</div>
            <div class="mt-0.5 font-[family-name:var(--mono)] text-[12.5px] break-words text-[var(--text)]">{{ result[f.key] ?? '—' }}</div>
          </div>
          <div class="rounded-lg border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-2">
            <div class="text-[10px] font-semibold tracking-wide text-[var(--muted)] uppercase">Coordinates</div>
            <div class="mt-0.5 font-[family-name:var(--mono)] text-[12.5px] break-words text-[var(--text)]">{{ coords }}</div>
          </div>
        </div>
      </div>

      <div
        v-else
        class="rounded-lg border border-dashed border-[var(--border)] px-4 py-10 text-center text-[13px] text-[var(--muted)]"
      >
        Enter an IP and press <span class="font-semibold text-[var(--text)]">Lookup</span>, or leave blank for your own
      </div>

      <p class="mt-3 text-[11px] text-[var(--muted)]">
        Geolocation data from ipapi.co (free tier, rate-limited).
      </p>
    </div>
  </section>
</template>
