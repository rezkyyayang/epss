<script setup lang="ts">
interface TreeResponse {
  id: string
  maturityLevelId: string | null
  explanation: string
  evidence: unknown[]
  indicator: {
    code: string
    title: string
    weight: number
    position: number
    requiresEvidence: boolean
    domain: { id: string; name: string; weight: number; position: number }
  }
}

const props = defineProps<{
  responses: TreeResponse[]
  selectedId: string
  open: boolean
  inert?: boolean
}>()
const emit = defineEmits<{ select: [id: string]; close: [] }>()

const groups = computed(() => {
  const domains = new Map<string, { id: string; name: string; weight: number; position: number; responses: TreeResponse[] }>()
  for (const response of props.responses) {
    const { domain } = response.indicator
    if (!domains.has(domain.id)) domains.set(domain.id, { ...domain, responses: [] })
    domains.get(domain.id)!.responses.push(response)
  }
  return [...domains.values()]
    .sort((a, b) => a.position - b.position)
    .map((domain) => ({ ...domain, responses: domain.responses.sort((a, b) => a.indicator.position - b.indicator.position) }))
})

// Lengkap matches what submitting requires; an indicator with only part of that is Kurang lengkap.
type Completeness = 'Lengkap' | 'Kurang lengkap' | 'Tidak lengkap'
function completeness(response: TreeResponse): Completeness {
  const hasLevel = Boolean(response.maturityLevelId)
  const hasExplanation = Boolean(response.explanation.trim())
  const evidenceDone = !response.indicator.requiresEvidence || response.evidence.length > 0
  if (hasLevel && hasExplanation && evidenceDone) return 'Lengkap'
  return hasLevel || hasExplanation || response.evidence.length ? 'Kurang lengkap' : 'Tidak lengkap'
}
const totals = computed(() => {
  const counts: Record<Completeness, number> = { 'Lengkap': 0, 'Kurang lengkap': 0, 'Tidak lengkap': 0 }
  for (const response of props.responses) counts[completeness(response)] += 1
  return counts
})
</script>

<template>
  <nav id="indicator-tree" class="panel tree-panel" :class="{ 'is-open': props.open }" :inert="props.inert" aria-label="Ringkasan indikator">
    <div class="panel-header">
      <div>
        <h2>Ringkasan</h2>
        <p>Pilih indikator untuk membuka isiannya.</p>
      </div>
      <button class="btn btn-quiet btn-step tree-close" type="button" aria-label="Tutup ringkasan" @click="emit('close')"><span aria-hidden="true">×</span></button>
    </div>
    <div class="panel-body">
      <div v-for="domain in groups" :key="domain.id" class="tree-group">
        <h3 class="tree-domain">
          <span>{{ domain.name }} · bobot {{ domain.weight }}%</span>
          <span class="tree-count" :aria-label="`${domain.responses.length} indikator`">{{ domain.responses.length }}</span>
        </h3>
        <button
          v-for="response in domain.responses"
          :key="response.id"
          class="tree-item"
          :class="{ 'is-current': response.id === props.selectedId }"
          type="button"
          :aria-current="response.id === props.selectedId ? 'step' : undefined"
          @click="emit('select', response.id)"
        >
          <span class="tree-code">{{ response.indicator.code }}</span>
          <span class="tree-title">{{ response.indicator.title }}</span>
          <span class="tree-status">{{ completeness(response) }} · bobot {{ response.indicator.weight }}%</span>
        </button>
      </div>
    </div>
    <dl class="tree-stats">
      <div><dt>Lengkap</dt><dd>{{ totals['Lengkap'] }}</dd></div>
      <div><dt>Kurang lengkap</dt><dd>{{ totals['Kurang lengkap'] }}</dd></div>
      <div><dt>Tidak lengkap</dt><dd>{{ totals['Tidak lengkap'] }}</dd></div>
    </dl>
  </nav>
</template>
