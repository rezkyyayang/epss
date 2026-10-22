<script setup lang="ts">
import { getApiError, formatDate } from '../../utils/format'
import { formatScore, weightedScore, type DomainScore } from '../../utils/score'

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
  user: { memberships: Array<{ id: string; name: string; code: string }> }
  available: Array<{ period: { id: string; name: string; endsAt: string | null }; unit: { id: string; name: string; code: string } }>
  assessments: AssessmentRow[]
  focus: { assessmentId: string; responses: Parameters<typeof weightedScore>[0] } | null
}

const { data, pending, error, refresh } = useFetch<DashboardData>('/api/user/dashboard', { lazy: true })
const openError = ref('')
const opening = ref('')

const unitNames = computed(() => (data.value?.user.memberships || []).map(({ name }) => name).join(', '))

const activeRows = computed(() => {
  const existing = data.value?.assessments || []
  return (data.value?.available || []).map((entry) => ({
    ...entry,
    assessment: existing.find((item) => item.periodId === entry.period.id && item.unitId === entry.unit.id),
  }))
})

const focusAssessment = computed(() => data.value?.assessments.find(({ id }) => id === data.value?.focus?.assessmentId))
const focusScore = computed(() => data.value?.focus ? weightedScore(data.value.focus.responses) : null)
const hasIncompleteDomain = computed(() => Boolean(focusScore.value?.domains.some((domain: DomainScore) => domain.score === null)))
const progressPercent = computed(() => {
  const assessment = focusAssessment.value
  return assessment?.totalResponses ? Math.round(assessment.completedResponses / assessment.totalResponses * 100) : 0
})
const otherAssessments = computed(() => (data.value?.assessments || []).filter(({ id }) => id !== focusAssessment.value?.id))

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
  <PageHeading title="Penilaian mandiri" :subtitle="unitNames ? `Penilaian mandiri ${unitNames}` : 'Lanjutkan penilaian yang ditugaskan atau lihat status kiriman Anda.'" />
  <LoadingState v-if="pending" label="Memuat data penilaian..." />
  <NoticeBanner v-else-if="error" tone="error" role="alert">
    {{ getApiError(error, 'Data belum dapat dimuat.') }}
    <button class="btn btn-secondary btn-small" type="button" @click="refresh()">Coba lagi</button>
  </NoticeBanner>
  <div v-else class="section-stack">
    <NoticeBanner v-if="openError" tone="error" role="alert">{{ openError }}</NoticeBanner>

    <div class="dashboard-overview">
      <section class="panel" aria-labelledby="active-periods-heading">
        <div class="panel-header">
          <div>
            <h2 id="active-periods-heading">Periode yang ditugaskan</h2>
            <p>Buka periode untuk mengisi atau melanjutkan penilaian unit Anda.</p>
          </div>
        </div>
        <ol v-if="activeRows.length" class="assignment-list">
          <li v-for="(row, index) in activeRows" :key="`${row.period.id}:${row.unit.id}`" class="assignment-item">
            <div class="assignment-body">
              <span class="assignment-index">Penugasan {{ index + 1 }}</span>
              <strong>{{ row.period.name }}</strong>
              <span class="assignment-meta">{{ row.unit.name }} · {{ row.unit.code }} | Batas {{ formatDate(row.period.endsAt) }}</span>
            </div>
            <div class="assignment-action">
              <StatusBadge v-if="row.assessment" :status="row.assessment.status" />
              <span v-else class="record-meta">Belum dimulai</span>
              <button
                class="btn btn-small"
                :class="row.assessment ? 'btn-secondary' : 'btn-primary'"
                type="button"
                :disabled="opening === `${row.period.id}:${row.unit.id}`"
                @click="openAssessment(row.period.id, row.unit.id)"
              >
                {{ opening === `${row.period.id}:${row.unit.id}` ? 'Membuka...' : row.assessment ? 'Lanjutkan' : 'Mulai penilaian' }}
              </button>
            </div>
          </li>
        </ol>
        <EmptyState
          v-else
          title="Belum ada periode aktif"
          message="Admin belum menugaskan periode aktif ke unit Anda. Periode akan muncul di sini setelah penugasan tersedia."
        />
      </section>

      <section class="progress-card" :class="{ 'is-empty': !focusAssessment }" aria-labelledby="progress-heading">
        <h2 id="progress-heading">Progres penilaian</h2>
        <template v-if="focusAssessment">
          <p class="progress-figure">
            <span class="progress-number">{{ focusAssessment.completedResponses }}</span>
            <span>dari {{ focusAssessment.totalResponses }} indikator sudah diisi</span>
          </p>
          <div class="progress-card-track" role="progressbar" :aria-valuenow="focusAssessment.completedResponses" aria-valuemin="0" :aria-valuemax="focusAssessment.totalResponses" aria-label="Indikator sudah diisi">
            <div class="progress-card-fill" :style="{ transform: `scaleX(${progressPercent / 100})` }" />
          </div>
          <p class="progress-context">{{ focusAssessment.period.name }} · {{ focusAssessment.unit.code }}</p>
          <p v-if="focusAssessment.revisionCount" class="progress-context">{{ focusAssessment.revisionCount }} indikator perlu revisi</p>
        </template>
        <p v-else class="progress-context">Progres muncul setelah Anda memulai penilaian pada salah satu periode.</p>
      </section>
    </div>

    <section v-if="focusAssessment && focusScore" class="panel" aria-labelledby="score-heading">
      <div class="panel-header score-header">
        <div>
          <h2 id="score-heading">Nilai penilaian</h2>
          <p>{{ focusAssessment.period.name }} · {{ focusAssessment.unit.name }}</p>
        </div>
        <div class="score-actions">
          <StatusBadge :status="focusAssessment.status" />
          <NuxtLink class="btn btn-primary btn-small" :to="`/user/assessments/${focusAssessment.id}`">Lihat isian</NuxtLink>
        </div>
      </div>
      <div class="score-layout">
        <div class="score-table-block">
          <p class="score-total-chip" :class="{ 'is-pending': focusScore.total === null }">
            <template v-if="focusScore.total !== null">Nilai total {{ formatScore(focusScore.total) }} dari {{ focusScore.maxLevel }}</template>
            <template v-else>Nilai total muncul setelah semua indikator memiliki level</template>
          </p>
          <div class="data-table-wrap">
            <table class="data-table score-table">
              <thead><tr><th scope="col">Domain</th><th scope="col" class="numeric">Bobot</th><th scope="col" class="numeric">Nilai</th></tr></thead>
              <tbody>
                <tr v-for="(domain, index) in focusScore.domains" :key="domain.id">
                  <td>{{ index + 1 }}. {{ domain.name }}</td>
                  <td class="numeric">{{ domain.weight }}%</td>
                  <td class="numeric">{{ domain.score === null ? 'Belum lengkap' : formatScore(domain.score) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <figure class="score-chart">
          <RadarChart :domains="focusScore.domains" :max="focusScore.maxLevel" />
          <figcaption>
            Nilai tiap domain pada skala 0 sampai {{ focusScore.maxLevel }}.
            <template v-if="hasIncompleteDomain">Domain yang belum lengkap tampil di titik nol.</template>
          </figcaption>
        </figure>
      </div>
    </section>

    <section v-if="otherAssessments.length" class="panel" aria-labelledby="recent-assessments-heading">
      <div class="panel-header">
        <div>
          <h2 id="recent-assessments-heading">Penilaian lainnya</h2>
          <p>Progres menunjukkan jawaban dengan tingkat kematangan dan penjelasan yang tersimpan.</p>
        </div>
        <NuxtLink class="btn btn-secondary btn-small" to="/user/history">Lihat riwayat</NuxtLink>
      </div>
      <div class="record-list">
        <div v-for="assessment in otherAssessments.slice(0, 5)" :key="assessment.id" class="record-row">
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
