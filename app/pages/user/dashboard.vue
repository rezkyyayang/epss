<script setup lang="ts">
import { getApiError, formatDate } from '../../utils/format'
import { formatScore, levelOf, scorePredicate, weightedScore, withFinalLevels, type DomainScore } from '../../utils/score'

interface AssessmentRow {
  id: string
  periodId: string
  unitId: string
  status: string
  activityName: string
  activityYear: number | null
  updatedAt: string
  period: { id: string; name: string; endsAt: string | null }
  unit: { id: string; name: string; code: string }
  totalResponses: number
  completedResponses: number
}

interface FocusResponse {
  maturityLevelId: string | null
  verification: { maturityLevelId: string; comment: string } | null
  indicator: {
    id: string
    code: string
    title: string
    weight: number
    maturityLevels: Array<{ id: string; level: number }>
    domain: { id: string; name: string; weight: number; position: number }
  }
}

interface DashboardData {
  user: { memberships: Array<{ id: string; name: string; code: string }> }
  available: Array<{ period: { id: string; name: string; endsAt: string | null }; unit: { id: string; name: string; code: string } }>
  assessments: AssessmentRow[]
  focus: { assessmentId: string; verified: boolean; responses: FocusResponse[] } | null
}

const { data, pending, error, refresh } = useFetch<DashboardData>('/api/user/dashboard', { lazy: true })
const openError = toastRef('error')
const opening = ref('')
// The row whose "start" form is open, keyed by period and unit.
const startingKey = ref('')
const newActivityName = ref('')
const newActivityYear = ref<number | null>(new Date().getFullYear())

const unitNames = computed(() => (data.value?.user.memberships || []).map(({ name }) => name).join(', '))

const activeRows = computed(() => {
  const existing = data.value?.assessments || []
  return (data.value?.available || []).map((entry) => ({
    ...entry,
    key: `${entry.period.id}:${entry.unit.id}`,
    assessment: existing.find((item) => item.periodId === entry.period.id && item.unitId === entry.unit.id),
    // One activity per period: once any unit's assessment exists in this period, the others cannot start.
    periodTaken: existing.some((item) => item.periodId === entry.period.id),
  }))
})

const focusAssessment = computed(() => data.value?.assessments.find(({ id }) => id === data.value?.focus?.assessmentId))
const verified = computed(() => Boolean(data.value?.focus?.verified))
const selfScore = computed(() => data.value?.focus ? weightedScore(data.value.focus.responses) : null)
const finalScore = computed(() => data.value?.focus && verified.value ? weightedScore(withFinalLevels(data.value.focus.responses)) : null)
// The headline score is Pusdatin's once verified, the unit's own before that.
const shownScore = computed(() => finalScore.value ?? selfScore.value)
const hasIncompleteDomain = computed(() => Boolean(shownScore.value?.domains.some((domain: DomainScore) => domain.score === null)))
const progressPercent = computed(() => {
  const assessment = focusAssessment.value
  return assessment?.totalResponses ? Math.round(assessment.completedResponses / assessment.totalResponses * 100) : 0
})
const indicatorRows = computed(() => (data.value?.focus?.responses || []).map((response: FocusResponse) => ({
  id: response.indicator.id,
  code: response.indicator.code,
  title: response.indicator.title,
  domainId: response.indicator.domain.id,
  weight: response.indicator.weight,
  maxLevel: response.indicator.maturityLevels.length,
  selfLevel: levelOf(response),
  finalLevel: response.verification ? levelOf({ maturityLevelId: response.verification.maturityLevelId, indicator: response.indicator }) : null,
  comment: response.verification?.comment || '',
})))
const otherAssessments = computed(() => (data.value?.assessments || []).filter(({ id }) => id !== focusAssessment.value?.id))

// Each domain row opens to show its indicators, so per-indicator levels live in the same table as the domain scores.
const openDomains = ref<string[]>([])
function toggleDomain(domainId: string) {
  openDomains.value = openDomains.value.includes(domainId) ? openDomains.value.filter((id: string) => id !== domainId) : [...openDomains.value, domainId]
}
function indicatorsOf(domainId: string) {
  return indicatorRows.value.filter((row: { domainId: string }) => row.domainId === domainId)
}
function levelText(level: number | null, max: number) {
  return level === null ? 'Belum diisi' : `Level ${level} dari ${max}`
}

function domainScore(score: { domains: DomainScore[] } | null, domainId: string) {
  const value = score?.domains.find(({ id }) => id === domainId)?.score
  return value === null || value === undefined ? 'Belum lengkap' : formatScore(value)
}

function showStartForm(key: string) {
  startingKey.value = key
  newActivityName.value = ''
  newActivityYear.value = new Date().getFullYear()
  openError.value = ''
}

async function openAssessment(periodId: string, unitId: string, withActivity = false) {
  const key = `${periodId}:${unitId}`
  opening.value = key
  openError.value = ''
  try {
    const result = await $fetch<{ assessment: { id: string } }>('/api/user/assessments', {
      method: 'POST',
      body: withActivity
        ? { periodId, unitId, activityName: newActivityName.value.trim(), activityYear: Number(newActivityYear.value) }
        : { periodId, unitId },
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
  <PageHeading title="Penilaian mandiri" :subtitle="unitNames ? `Penilaian mandiri ${unitNames}` : 'Lanjutkan penilaian yang ditugaskan atau lihat hasil verifikasi.'" />
  <LoadingState v-if="pending && !data" label="Memuat data penilaian..." />
  <NoticeBanner v-else-if="error" tone="error" role="alert">
    {{ getApiError(error, 'Data belum dapat dimuat.') }}
    <button class="btn btn-secondary btn-small" type="button" @click="refresh()">Coba lagi</button>
  </NoticeBanner>
  <div v-else class="section-stack">

    <div class="dashboard-overview">
      <section class="panel" aria-labelledby="active-periods-heading">
        <div class="panel-header">
          <div>
            <h2 id="active-periods-heading">Kegiatan statistik</h2>
            <p>Setiap unit menilai satu kegiatan statistik per periode.</p>
          </div>
        </div>
        <ol v-if="activeRows.length" class="assignment-list">
          <li v-for="(row, index) in activeRows" :key="row.key" class="assignment-item" :class="{ 'is-starting': startingKey === row.key }">
            <div class="assignment-body">
              <span class="assignment-index">{{ row.period.name }}</span>
              <strong>{{ row.assessment?.activityName || 'Kegiatan belum diisi' }}</strong>
              <span class="assignment-meta">
                <template v-if="row.assessment?.activityYear">{{ row.assessment.activityYear }} | </template>{{ row.unit.name }} · {{ row.unit.code }} | Batas {{ formatDate(row.period.endsAt) }}
              </span>
            </div>
            <div v-if="startingKey !== row.key" class="assignment-action">
              <StatusBadge v-if="row.assessment" :status="row.assessment.status" />
              <span v-else-if="!row.periodTaken" class="record-meta">Belum dimulai</span>
              <button
                v-if="row.assessment"
                class="btn btn-secondary btn-small"
                type="button"
                :disabled="opening === row.key"
                @click="openAssessment(row.period.id, row.unit.id)"
              >
                {{ opening === row.key ? 'Membuka...' : row.assessment.status === 'DRAFT' ? 'Lanjutkan' : 'Lihat isian' }}
              </button>
              <span v-else-if="row.periodTaken" class="record-meta">Kegiatan periode ini sudah diisi</span>
              <button v-else class="btn btn-primary btn-small" type="button" @click="showStartForm(row.key)">Mulai penilaian</button>
            </div>
            <form v-else class="start-form" :aria-label="`Mulai penilaian ${row.period.name}`" @submit.prevent="openAssessment(row.period.id, row.unit.id, true)">
              <div class="field">
                <label :for="`activity-name-${index}`">Nama kegiatan statistik</label>
                <input :id="`activity-name-${index}`" v-model="newActivityName" class="control" required minlength="3" maxlength="240" placeholder="Contoh: Kompilasi Data Indeks Kualitas Kebijakan Nasional">
              </div>
              <div class="field">
                <label :for="`activity-year-${index}`">Tahun</label>
                <input :id="`activity-year-${index}`" v-model.number="newActivityYear" class="control" type="number" required min="2000" max="2100" inputmode="numeric">
              </div>
              <div class="start-form-actions">
                <button class="btn btn-quiet btn-small" type="button" @click="startingKey = ''">Batal</button>
                <button class="btn btn-primary btn-small" type="submit" :disabled="opening === row.key || newActivityName.trim().length < 3 || !newActivityYear">
                  {{ opening === row.key ? 'Membuka...' : 'Mulai' }}
                </button>
              </div>
            </form>
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
        </template>
        <p v-else class="progress-context">Progres muncul setelah Anda memulai penilaian pada salah satu periode.</p>
      </section>
    </div>

    <section v-if="focusAssessment && shownScore" class="panel" aria-labelledby="score-heading">
      <div class="panel-header score-header">
        <div>
          <h2 id="score-heading">{{ verified ? 'Hasil akhir penilaian' : 'Nilai penilaian mandiri' }}</h2>
          <p>{{ focusAssessment.activityName || focusAssessment.period.name }} · {{ focusAssessment.unit.name }}</p>
        </div>
        <div class="score-actions">
          <StatusBadge :status="focusAssessment.status" />
          <NuxtLink class="btn btn-primary btn-small" :to="`/user/assessments/${focusAssessment.id}`">Lihat isian</NuxtLink>
        </div>
      </div>
      <div class="score-layout">
        <div class="score-table-block">
          <p class="score-reading" :class="{ 'is-pending': shownScore.total === null }">
            <template v-if="shownScore.total !== null">
              <span class="score-reading-label">{{ verified ? 'Nilai final' : 'Nilai mandiri' }}</span>
              <strong class="score-reading-value">{{ formatScore(shownScore.total) }}</strong>
              <span class="score-reading-meta">dari {{ shownScore.maxLevel }}<template v-if="scorePredicate(shownScore.total, shownScore.maxLevel)"> · {{ scorePredicate(shownScore.total, shownScore.maxLevel) }}</template></span>
            </template>
            <template v-else>Nilai total muncul setelah semua indikator memiliki level.</template>
          </p>
          <p v-if="verified && selfScore?.total !== null && selfScore?.total !== undefined" class="score-compare">Nilai mandiri sebelum verifikasi: {{ formatScore(selfScore.total) }}<template v-if="scorePredicate(selfScore.total, selfScore.maxLevel)"> (predikat {{ scorePredicate(selfScore.total, selfScore.maxLevel) }})</template></p>
          <div class="data-table-wrap">
            <table class="data-table score-table">
              <thead>
                <tr>
                  <th scope="col">Domain / indikator</th>
                  <th scope="col" class="numeric">Bobot</th>
                  <th scope="col" class="numeric">Mandiri</th>
                  <th v-if="verified" scope="col" class="numeric">Final</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="(domain, index) in shownScore.domains" :key="domain.id">
                  <tr class="domain-row" :class="{ 'is-open': openDomains.includes(domain.id) }">
                    <td>
                      <button class="domain-toggle" type="button" :aria-expanded="openDomains.includes(domain.id)" :aria-controls="`domain-indicators-${domain.id}`" @click="toggleDomain(domain.id)">
                        <span class="domain-caret" aria-hidden="true">{{ openDomains.includes(domain.id) ? '▾' : '▸' }}</span>
                        <span>{{ index + 1 }}. {{ domain.name }}</span>
                      </button>
                    </td>
                    <td class="numeric">{{ domain.weight }}%</td>
                    <td class="numeric">{{ domainScore(selfScore, domain.id) }}</td>
                    <td v-if="verified" class="numeric"><strong>{{ domainScore(finalScore, domain.id) }}</strong></td>
                  </tr>
                  <template v-if="openDomains.includes(domain.id)">
                    <tr v-for="row in indicatorsOf(domain.id)" :id="`domain-indicators-${domain.id}`" :key="row.id" class="indicator-subrow">
                      <td>
                        <span class="indicator-code">{{ row.code }}</span> {{ row.title }}
                        <span v-if="verified && row.comment" class="subrow-comment">Komentar verifikasi: {{ row.comment }}</span>
                      </td>
                      <td class="numeric">{{ row.weight }}%</td>
                      <td class="numeric">{{ levelText(row.selfLevel, row.maxLevel) }}</td>
                      <td v-if="verified" class="numeric"><strong>{{ levelText(row.finalLevel, row.maxLevel) }}</strong></td>
                    </tr>
                  </template>
                </template>
              </tbody>
            </table>
          </div>
          <p class="score-table-hint">Klik nama domain untuk melihat level tiap indikatornya.</p>
        </div>
        <figure class="score-chart">
          <RadarChart :domains="shownScore.domains" :max="shownScore.maxLevel" />
          <figcaption>
            {{ verified ? 'Nilai final' : 'Nilai mandiri' }} tiap domain pada skala 0 sampai {{ shownScore.maxLevel }}.
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
            <strong>{{ assessment.activityName || assessment.period.name }}</strong>
            <span>{{ assessment.period.name }} · {{ assessment.unit.code }}</span>
          </div>
          <AssessmentProgress :complete="assessment.completedResponses" :total="assessment.totalResponses" />
          <StatusBadge :status="assessment.status" />
          <div class="record-action">
            <NuxtLink class="btn btn-secondary btn-small" :to="`/user/assessments/${assessment.id}`">Buka</NuxtLink>
          </div>
          <span class="record-meta">Diperbarui {{ formatDate(assessment.updatedAt) }}</span>
        </div>
      </div>
    </section>
  </div>
</template>
