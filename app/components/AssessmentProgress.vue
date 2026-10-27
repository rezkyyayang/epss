<script setup lang="ts">
// `unit` names what is counted; most callers count indicators, the verifier summary counts units.
const props = withDefaults(defineProps<{ complete: number; total: number; label?: string; unit?: string }>(), { unit: 'indikator' })
const percent = computed(() => props.total ? Math.min(100, Math.round(props.complete / props.total * 100)) : 0)
</script>

<template>
  <div class="progress-row" role="group" :aria-label="label || 'Progres penilaian'">
    <div class="progress-track" role="progressbar" :aria-valuenow="complete" :aria-valuemin="0" :aria-valuemax="total" :aria-label="label || 'Indikator lengkap'">
      <div class="progress-fill" :style="{ transform: `scaleX(${percent / 100})` }" />
    </div>
    <span class="progress-caption">{{ complete }} dari {{ total }} {{ unit }}</span>
  </div>
</template>
