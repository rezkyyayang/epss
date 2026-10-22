<script setup lang="ts">
import { formatScore, weightedScore } from '../utils/score'

const props = withDefaults(defineProps<{ responses: Parameters<typeof weightedScore>[0]; label?: string }>(), { label: 'Nilai tertimbang' })
const result = computed(() => weightedScore(props.responses))
</script>

<template>
  <div class="score-summary">
    <div class="score-total">
      <strong>{{ props.label }}</strong>
      <template v-if="result.total !== null">
        <span class="score-value">{{ formatScore(result.total) }}</span>
        <span class="field-hint">dari {{ result.maxLevel }}</span>
      </template>
      <span v-else class="field-hint">Muncul setelah semua indikator memiliki level tersimpan.</span>
    </div>
    <ul class="score-domains" aria-label="Nilai per domain">
      <li v-for="domain in result.domains" :key="domain.id">
        {{ domain.name }} ({{ domain.weight }}%): {{ domain.score === null ? 'belum lengkap' : formatScore(domain.score) }}
      </li>
    </ul>
    <p class="field-hint">Dihitung dari jumlah bobot domain × jumlah (bobot indikator × level terpilih).</p>
  </div>
</template>
