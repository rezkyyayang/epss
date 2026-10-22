<script setup lang="ts">
import { getApiError, formatDate } from '../../utils/format'

interface AssessmentRow {
  id: string
  periodId: string
  unitId: string
  status: string
  updatedAt: string
  period: { id: string; name: string; endsAt: string | null }
  unit: { id: string; name: string; code: string }
  totalResponses: number
  completedResponses: number
  revisionCount: number
}

interface DashboardData {
  available: Array<{ period: { id: string; name: string; endsAt: string | null }; unit: { id: string; name: string; code: string } }>
  assessments: AssessmentRow[]
}

const { data, pending, error, refresh } = useFetch<DashboardData>('/api/user/dashboard', { lazy: true })
const openError = ref('')
const opening = ref('')

const activeRows = computed(() => {
  const existing = data.value?.assessments || []
  return (data.value?.available || []).map((entry) => ({
    ...entry,
    assessment: existing.find((item) => item.periodId === entry.period.id && item.unitId === entry.unit.id),
  }))
})

const latestAssessments = computed(() => data.value?.assessments || [])

async function openAssessment(periodId: string, unitId: string) {
  const key = `${periodId}:${unitId}`
  opening.value = key
  openError.value = ''
  try {
    const result = await $fetch<{ assessment: { id: string } }>('/api/user/assessments', {
      method: 'POST',
      body: { periodId, unitId },
    })
    await navigateTo(`/user/assessments/${result.assessment.id}`)
  } catch (requestError) {
    openError.value = getApiError(requestError, 'Penilaian belum dapat dibuka. Coba lagi.')
    await refresh()
  } finally {
    opening.value = ''
  }
}
</script>

<template>
  <PageHeading title="Dashboard" subtitle="Lanjutkan penilaian yang ditugaskan atau lihat status kiriman Anda." />
  <div v-if="pending" class="panel loading-state" role="status">Memuat data penilaian...</div>
  <NoticeBanner v-else-if="error" tone="error" role="alert">
    {{ getApiError(error, 'Data belum dapat dimuat.') }}
    <button class="btn btn-secondary btn-small" type="button" @click="refresh()">Coba lagi</button>
  </NoticeBanner>
  <div v-else class="section-stack">
    <NoticeBanner v-if="openError" tone="error" role="alert">{{ openError }}</NoticeBanner>

    <section class="panel" aria-labelledby="active-periods-heading">
      <div class="panel-header">
        <div>
          <h2 id="active-periods-heading">Periode yang ditugaskan</h2>
          <p>Pilih periode dan unit untuk membuka atau melanjutkan isian.</p>
        </div>
      </div>
      <div v-if="activeRows.length" class="record-list">
        <div v-for="row in activeRows" :key="`${row.period.id}:${row.unit.id}`" class="record-row">
          <div class="record-primary">
            <strong>{{ row.period.name }}</strong>
            <span>{{ row.unit.name }} · {{ row.unit.code }}</span>
          </div>
          <span class="record-meta">Batas periode: {{ formatDate(row.period.endsAt) }}</span>
          <StatusBadge v-if="row.assessment" :status="row.assessment.status" />
          <span v-else class="record-meta">Belum dimulai</span>
          <div class="record-action">
            <button
              class="btn btn-primary btn-small"
              type="button"
              :disabled="opening === `${row.period.id}:${row.unit.id}`"
              @click="openAssessment(row.period.id, row.unit.id)"
            >
              {{ opening === `${row.period.id}:${row.unit.id}` ? 'Membuka...' : row.assessment ? 'Lanjutkan' : 'Mulai penilaian' }}
            </button>
          </div>
        </div>
      </div>
      <EmptyState
        v-else
        title="Belum ada periode aktif"
        message="Admin belum menugaskan periode aktif ke unit Anda. Periode akan muncul di sini setelah penugasan tersedia."
      />
    </section>

    <section v-if="latestAssessments.length" class="panel" aria-labelledby="recent-assessments-heading">
      <div class="panel-header">
        <div>
          <h2 id="recent-assessments-heading">Penilaian Anda</h2>
          <p>Progres menunjukkan jawaban dengan tingkat kematangan dan penjelasan yang tersimpan.</p>
        </div>
        <NuxtLink class="btn btn-secondary btn-small" to="/user/history">Lihat riwayat</NuxtLink>
      </div>
      <div class="record-list">
        <div v-for="assessment in latestAssessments.slice(0, 5)" :key="assessment.id" class="record-row">
          <div class="record-primary">
            <strong>{{ assessment.period.name }}</strong>
            <span>{{ assessment.unit.name }} · {{ assessment.unit.code }}</span>
          </div>
          <AssessmentProgress :complete="assessment.completedResponses" :total="assessment.totalResponses" />
          <StatusBadge :status="assessment.status" />
          <div class="record-action">
            <NuxtLink class="btn btn-secondary btn-small" :to="`/user/assessments/${assessment.id}`">Buka</NuxtLink>
          </div>
          <span class="record-meta">Diperbarui {{ formatDate(assessment.updatedAt) }}</span>
          <span v-if="assessment.revisionCount" class="record-meta">{{ assessment.revisionCount }} indikator perlu revisi</span>
        </div>
      </div>
    </section>
  </div>
</template>
