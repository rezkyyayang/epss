<script setup lang="ts">
import { formatScore, levelOf, scorePredicate, weightedScore } from '../utils/score'

type ScoredResponse = Parameters<typeof weightedScore>[0][number] & {
  indicator: { id: string; code: string; title: string }
}

const props = withDefaults(defineProps<{ responses: ScoredResponse[]; label?: string }>(), { label: 'Nilai tertimbang' })
const result = computed(() => weightedScore(props.responses))
const predicate = computed(() => scorePredicate(result.value.total, result.value.maxLevel))

// Each domain row opens to show its indicators, so the indicator levels sit under the domain they add up to.
const uid = useId()
const openDomains = ref<string[]>([])
function toggleDomain(domainId: string) {
  openDomains.value = openDomains.value.includes(domainId) ? openDomains.value.filter((id: string) => id !== domainId) : [...openDomains.value, domainId]
}
function indicatorsOf(domainId: string) {
  return props.responses.filter((response) => response.indicator.domain.id === domainId)
}
function levelText(response: ScoredResponse) {
  const level = levelOf(response)
  return level === null ? 'Belum diisi' : `Level ${level} dari ${response.indicator.maturityLevels.length}`
}
</script>

<template>
  <div class="score-summary">
    <div class="score-total">
      <strong>{{ props.label }}</strong>
      <template v-if="result.total !== null">
        <span class="score-value">{{ formatScore(result.total) }}</span>
        <span class="field-hint">dari {{ result.maxLevel }}</span>
        <span v-if="predicate" class="score-predicate">Predikat {{ predicate }}</span>
      </template>
      <span v-else class="field-hint">Muncul setelah semua indikator memiliki level tersimpan.</span>
    </div>
    <div class="data-table-wrap">
      <table class="data-table score-table">
        <caption class="sr-only">{{ props.label }} per domain dan indikator</caption>
        <thead>
          <tr>
            <th scope="col">Domain / indikator</th>
            <th scope="col" class="numeric">Bobot</th>
            <th scope="col" class="numeric">Nilai</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(domain, index) in result.domains" :key="domain.id">
            <tr class="domain-row" :class="{ 'is-open': openDomains.includes(domain.id) }">
              <td>
                <button class="domain-toggle" type="button" :aria-expanded="openDomains.includes(domain.id)" :aria-controls="indicatorsOf(domain.id).map((response) => `${uid}-${response.indicator.id}`).join(' ')" @click="toggleDomain(domain.id)">
                  <span class="domain-caret" aria-hidden="true">{{ openDomains.includes(domain.id) ? '▾' : '▸' }}</span>
                  <span>{{ index + 1 }}. {{ domain.name }}</span>
                </button>
              </td>
              <td class="numeric">{{ domain.weight }}%</td>
              <td class="numeric"><strong>{{ domain.score === null ? 'Belum lengkap' : formatScore(domain.score) }}</strong></td>
            </tr>
            <tr v-for="response in openDomains.includes(domain.id) ? indicatorsOf(domain.id) : []" :id="`${uid}-${response.indicator.id}`" :key="response.indicator.id" class="indicator-subrow">
              <td><span class="indicator-code">{{ response.indicator.code }}</span> {{ response.indicator.title }}</td>
              <td class="numeric">{{ response.indicator.weight }}%</td>
              <td class="numeric">{{ levelText(response) }}</td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
    <p class="field-hint">Klik nama domain untuk melihat level tiap indikatornya. Nilai dihitung dari jumlah bobot domain × jumlah (bobot indikator × level terpilih).</p>
  </div>
</template>
