<script setup lang="ts">
const props = defineProps<{ status: string }>()
const labels: Record<string, string> = {
  DRAFT: 'Draf',
  SUBMITTED: 'Dikirim',
  IN_REVIEW: 'Dalam pemeriksaan',
  REVISION_REQUIRED: 'Perlu revisi',
  RESUBMITTED: 'Dikirim ulang',
  APPROVED: 'Disetujui',
  PENDING: 'Menunggu pemeriksaan',
  NEEDS_REVISION: 'Perlu revisi',
  ACTIVE: 'Aktif',
  CLOSED: 'Ditutup',
}
const tones: Record<string, string> = {
  DRAFT: 'status-neutral',
  SUBMITTED: 'status-info',
  IN_REVIEW: 'status-warning',
  REVISION_REQUIRED: 'status-danger',
  RESUBMITTED: 'status-info',
  APPROVED: 'status-success',
  PENDING: 'status-neutral',
  NEEDS_REVISION: 'status-danger',
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
