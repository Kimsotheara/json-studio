<script setup lang="ts">
import { ref } from 'vue'

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
  { key: 'ip', label: 'IP Address' },
  { key: 'city', label: 'City' },
  { key: 'region', label: 'Region' },
  { key: 'country_name', label: 'Country' },
  { key: 'postal', label: 'Postal' },
  { key: 'org', label: 'Org / ISP' },
  { key: 'asn', label: 'ASN' },
  { key: 'timezone', label: 'Timezone' },
]

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

function coords(r: IpInfo): string {
  return r.latitude != null && r.longitude != null ? `${r.latitude}, ${r.longitude}` : '—'
}
</script>

<template>
  <div class="max-w-[760px] rounded-xl border border-[var(--border)] bg-white p-[18px]">
    <h2 class="mb-3 text-[15px] font-semibold">IP Lookup</h2>

    <div class="mb-3 flex gap-2">
      <input
        v-model="query"
        placeholder="Leave blank for your IP, or enter e.g. 8.8.8.8"
        class="flex-1 rounded-lg border border-[var(--border)] px-2.5 py-2 font-[var(--mono)] text-[12.5px] outline-none focus:border-[var(--accent)]"
        @keyup.enter="lookup"
      />
      <button
        class="rounded-lg border border-[var(--border)] bg-white px-3.5 py-2 text-xs font-medium hover:bg-[var(--bg)] disabled:opacity-50"
        :disabled="loading"
        @click="lookup"
      >
        {{ loading ? 'Looking up…' : 'Lookup' }}
      </button>
    </div>

    <p
      v-if="error"
      class="rounded-lg bg-[var(--hl-del,#fdecef)] px-3 py-2 font-[var(--mono)] text-[12.5px] text-[var(--red)]"
    >
      ⚠ {{ error }}
    </p>

    <div v-else-if="result" class="overflow-hidden rounded-lg border border-[var(--border)]">
      <div
        v-for="f in fields"
        :key="f.key"
        class="flex border-b border-[var(--border)] last:border-b-0 odd:bg-[#fafbfc]"
      >
        <div class="w-36 shrink-0 px-3 py-2 text-[12px] text-[var(--muted)]">{{ f.label }}</div>
        <div class="px-3 py-2 font-[var(--mono)] text-[12.5px]">{{ result[f.key] ?? '—' }}</div>
      </div>
      <div class="flex odd:bg-[#fafbfc]">
        <div class="w-36 shrink-0 px-3 py-2 text-[12px] text-[var(--muted)]">Coordinates</div>
        <div class="px-3 py-2 font-[var(--mono)] text-[12.5px]">{{ coords(result) }}</div>
      </div>
    </div>

    <p v-else class="text-[13px] text-[var(--muted)]">Enter an IP and click Lookup…</p>

    <p class="mt-3 text-[11px] text-[var(--muted)]">
      Geolocation data from ipapi.co (free tier, rate-limited).
    </p>
  </div>
</template>
