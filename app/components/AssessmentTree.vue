<script setup lang="ts">
interface TreeResponse {
  id: string
  maturityLevelId: string | null
  explanation: string
  indicator: {
    code: string
    title: string
    weight: number
    position: number
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

function completeness(response: TreeResponse) {
  return response.maturityLevelId && response.explanation.trim() ? 'Lengkap' : 'Belum lengkap'
}
</script>

<template>
  <nav id="indicator-tree" class="panel tree-panel" :class="{ 'is-open': props.open }" :inert="props.inert" aria-label="Navigasi indikator">
    <div class="panel-header">
      <div>
        <h2>Indikator</h2>
        <p>Pilih satu untuk melihat isian.</p>
      </div>
      <button class="btn btn-quiet btn-small mobile-only" type="button" @click="emit('close')">Tutup</button>
    </div>
    <div class="panel-body">
      <div v-for="domain in groups" :key="domain.id" class="tree-group">
        <h3 class="tree-domain">{{ domain.name }} · bobot {{ domain.weight }}%</h3>
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
  </nav>
</template>
