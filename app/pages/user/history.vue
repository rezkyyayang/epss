<script setup lang="ts">
import { getApiError, formatDate } from '../../utils/format'

interface HistoryData {
  assessments: Array<{
    id: string
    status: string
    updatedAt: string
    period: { name: string }
    unit: { name: string; code: string }
    totalResponses: number
    completedResponses: number
    revisionCount: number
  }>
}

const { data, pending, error, refresh } = useFetch<HistoryData>('/api/user/dashboard', { lazy: true })
</script>

<template>
  <PageHeading title="Riwayat penilaian" subtitle="Lihat progres dan keputusan pada periode yang pernah Anda buka." />
  <div v-if="pending" class="panel loading-state" role="status">Memuat riwayat...</div>
  <NoticeBanner v-else-if="error" tone="error" role="alert">
    {{ getApiError(error, 'Riwayat belum dapat dimuat.') }}
    <button class="btn btn-secondary btn-small" type="button" @click="refresh()">Coba lagi</button>
  </NoticeBanner>
  <section v-else class="panel">
    <div v-if="data?.assessments.length" class="record-list">
      <div v-for="assessment in data.assessments" :key="assessment.id" class="record-row">
        <div class="record-primary">
          <strong>{{ assessment.period.name }}</strong>
          <span>{{ assessment.unit.name }} · {{ assessment.unit.code }}</span>
        </div>
        <AssessmentProgress :complete="assessment.completedResponses" :total="assessment.totalResponses" />
        <StatusBadge :status="assessment.status" />
        <div class="record-action">
          <NuxtLink class="btn btn-secondary btn-small" :to="`/user/assessments/${assessment.id}`">Lihat</NuxtLink>
        </div>
        <span class="record-meta">Diperbarui {{ formatDate(assessment.updatedAt) }}</span>
        <span v-if="assessment.revisionCount" class="record-meta">{{ assessment.revisionCount }} indikator perlu revisi</span>
      </div>
    </div>
    <EmptyState v-else title="Riwayat masih kosong" message="Penilaian yang Anda buka akan tampil di sini." />
  </section>
</template>
