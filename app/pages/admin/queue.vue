<script setup lang="ts">
import { formatDate, getApiError } from '../../utils/format'

interface QueueItem {
  id: string
  status: string
  activityName: string
  activityYear: number | null
  submittedAt: string | null
  period: { id: string; name: string }
  unit: { id: string; name: string; code: string }
  createdBy: { displayName: string }
  totalResponses: number
  completedResponses: number
  verifiedResponses: number
}
const { data, pending, error, refresh } = useFetch<{ assessments: QueueItem[]; units: Array<{ id: string; name: string; code: string }>; periods: Array<{ id: string; name: string }> }>('/api/admin/queue', { lazy: true })
const status = ref('')
const unitId = ref('')
const periodId = ref('')
const visibleRows = computed(() => (data.value?.assessments || []).filter((row) => (!status.value || row.status === status.value) && (!unitId.value || row.unit.id === unitId.value) && (!periodId.value || row.period.id === periodId.value)))
</script>

<template>
  <PageHeading title="Antrean verifikasi" subtitle="Penilaian yang sudah dikirim unit kerja. Buka satu untuk menetapkan level final tiap indikator." />
  <LoadingState v-if="pending" label="Memuat antrean..." />
  <NoticeBanner v-else-if="error" tone="error" role="alert">
    {{ getApiError(error, 'Antrean belum dapat dimuat.') }}
    <button class="btn btn-secondary btn-small" type="button" @click="refresh()">Coba lagi</button>
  </NoticeBanner>
  <section v-else class="panel">
    <div class="filters-row">
      <div class="field"><label for="filter-status">Status</label><select id="filter-status" v-model="status" class="control"><option value="">Semua status</option><option value="SUBMITTED">Menunggu verifikasi</option><option value="IN_REVIEW">Dalam verifikasi</option><option value="VERIFIED">Terverifikasi</option></select></div>
      <div class="field"><label for="filter-unit">Unit</label><select id="filter-unit" v-model="unitId" class="control"><option value="">Semua unit</option><option v-for="unit in data?.units" :key="unit.id" :value="unit.id">{{ unit.name }} · {{ unit.code }}</option></select></div>
      <div class="field"><label for="filter-period">Periode</label><select id="filter-period" v-model="periodId" class="control"><option value="">Semua periode</option><option v-for="period in data?.periods" :key="period.id" :value="period.id">{{ period.name }}</option></select></div>
    </div>
    <div v-if="visibleRows.length" class="data-table-wrap mobile-records">
      <table class="data-table">
        <thead><tr><th>Unit / Kegiatan</th><th>Status</th><th>Verifikasi</th><th>Pengisi</th><th>Dikirim</th><th>Aksi</th></tr></thead>
        <tbody><tr v-for="row in visibleRows" :key="row.id">
          <td data-label="Unit / Kegiatan"><div><strong>{{ row.unit.name }} · {{ row.unit.code }}</strong><br>{{ row.activityName || 'Kegiatan belum diisi' }}<span v-if="row.activityYear"> ({{ row.activityYear }})</span><br><span class="record-meta">{{ row.period.name }}</span></div></td>
          <td data-label="Status"><StatusBadge :status="row.status" /></td>
          <td data-label="Verifikasi">{{ row.verifiedResponses }} dari {{ row.totalResponses }} indikator</td>
          <td data-label="Pengisi">{{ row.createdBy.displayName }}</td>
          <td data-label="Dikirim">{{ formatDate(row.submittedAt) }}</td>
          <td data-label="Aksi"><NuxtLink class="btn btn-secondary btn-small" :to="`/admin/assessments/${row.id}`">{{ row.status === 'VERIFIED' ? 'Lihat hasil' : 'Verifikasi' }}</NuxtLink></td>
        </tr></tbody>
      </table>
    </div>
    <EmptyState v-else title="Tidak ada penilaian pada filter ini" message="Ubah filter untuk melihat status lain atau periksa kembali setelah penilaian dikirim." />
  </section>
</template>
