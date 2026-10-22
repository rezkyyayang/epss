<script setup lang="ts">
const props = defineProps<{ status: string }>()
const labels: Record<string, string> = {
  DRAFT: 'Draf',
  SUBMITTED: 'Menunggu verifikasi',
  IN_REVIEW: 'Dalam verifikasi',
  VERIFIED: 'Terverifikasi',
  ACTIVE: 'Aktif',
  CLOSED: 'Ditutup',
}
const tones: Record<string, string> = {
  DRAFT: 'status-neutral',
  SUBMITTED: 'status-info',
  IN_REVIEW: 'status-warning',
  VERIFIED: 'status-success',
  ACTIVE: 'status-success',
  CLOSED: 'status-neutral',
}
</script>

<template>
  <span class="status-badge" :class="tones[props.status] || 'status-neutral'">
    <span class="status-mark" aria-hidden="true" />
    {{ labels[props.status] || props.status }}
  </span>
</template>
