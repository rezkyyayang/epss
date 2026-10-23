<script setup lang="ts">
import { getApiError } from '../../utils/format'
import { formatScore, scorePredicate, weightedScore, withFinalLevels, type DomainScore } from '../../utils/score'

interface UnitResponse {
  maturityLevelId: string | null
  explanation: string
  verification: { maturityLevelId: string } | null
  indicator: { id: string; code: string; title: string; weight: number; maturityLevels: Array<{ id: string; level: number }>; domain: { id: string; name: string; weight: number; position: number } }
}
interface UnitRow {
  unit: { id: string; name: string; code: string }
  assessment: { id: string; status: string; activityName: string; activityYear: number | null; submittedAt: string | null; verifiedAt: string | null; responses: UnitResponse[] } | null
}
interface DashboardResult {
  periods: Array<{ id: string; name: string; status: string }>
  periodId: string | null
  rows: UnitRow[]
}
type Score = ReturnType<typeof weightedScore>
type ScoredRow = UnitRow & { verified: boolean; self: Score | null; final: Score | null }

const selectedPeriodId = ref('')
const { data, pending, error, refresh } = useFetch<DashboardResult>('/api/admin/dashboard', {
  lazy: true,
  query: computed(() => (selectedPeriodId.value ? { periodId: selectedPeriodId.value } : {})),
})
watch(() => data.value?.periodId, (value: string | null | undefined) => {
  if (value && !selectedPeriodId.value) selectedPeriodId.value = value
}, { immediate: true })

// Each unit is scored twice: the unit's own levels, and Pusdatin's final levels once verification is sent.
const scoredRows = computed((): ScoredRow[] => (data.value?.rows || []).map((row: UnitRow) => {
  const responses = row.assessment?.responses || []
  const verified = row.assessment?.status === 'VERIFIED'
  return {
    ...row,
    verified,
    self: responses.length ? weightedScore(responses) : null,
    final: verified ? weightedScore(withFinalLevels(responses)) : null,
  }
}))
const counts = computed(() => {
  const rows = scoredRows.value
  return {
    assigned: rows.length,
    notSubmitted: rows.filter((row: ScoredRow) => !row.assessment || row.assessment.status === 'DRAFT').length,
    waiting: rows.filter((row: ScoredRow) => row.assessment?.status === 'SUBMITTED' || row.assessment?.status === 'IN_REVIEW').length,
    verified: rows.filter((row: ScoredRow) => row.verified).length,
  }
})

const selectedUnitId = ref('')
const selectedRow = computed((): ScoredRow | undefined => {
  const rows = scoredRows.value.filter((row: ScoredRow) => row.self)
  return rows.find((row: ScoredRow) => row.unit.id === selectedUnitId.value) ?? rows.find((row: ScoredRow) => row.verified) ?? rows[0]
})
const selectedScore = computed(() => selectedRow.value?.final ?? selectedRow.value?.self ?? null)
const selectedHasGap = computed(() => Boolean(selectedScore.value?.domains.some((domain: DomainScore) => domain.score === null)))

// Reset removes the unit's assessment entirely, so the unit fills the period again from the start.
const resettingId = ref('')
const pageError = toastRef('error')
const success = toastRef('success')
async function resetAssessment(row: ScoredRow) {
  if (!row.assessment) return
  if (!window.confirm(`Reset penilaian ${row.unit.name}? Semua level, penjelasan, tautan bukti, dan hasil verifikasi untuk "${row.assessment.activityName}" akan dihapus. Unit kerja harus mengisi ulang dari awal.`)) return
  resettingId.value = row.assessment.id; pageError.value = ''; success.value = ''
  try {
    await $fetch(`/api/admin/assessments/${row.assessment.id}`, { method: 'DELETE' })
    success.value = `Penilaian ${row.unit.name} sudah direset.`
    if (selectedUnitId.value === row.unit.id) selectedUnitId.value = ''
    await refresh()
  } catch (requestError) { pageError.value = getApiError(requestError, 'Penilaian belum dapat direset.') }
  finally { resettingId.value = '' }
}

function total(score:{ total: number | null; maxLevel: number } | null) {
  if (score?.total === null || score?.total === undefined) return '-'
  const predicate = scorePredicate(score.total, score.maxLevel)
  return predicate ? `${formatScore(score.total)} · ${predicate}` : formatScore(score.total)
}
function domainValue(score: { domains: DomainScore[] } | null, domainId: string) {
  const value = score?.domains.find(({ id }) => id === domainId)?.score
  return value === null || value === undefined ? '-' : formatScore(value)
}
</script>

<template>
  <PageHeading title="Dashboard Admin" subtitle="Hasil penilaian mandiri dan verifikasi Pusdatin untuk setiap unit kerja." />
  <LoadingState v-if="pending && !data" label="Memuat ringkasan..." />
  <NoticeBanner v-else-if="error" tone="error" role="alert">
    {{ getApiError(error, 'Ringkasan belum dapat dimuat.') }}
    <button class="btn btn-secondary btn-small" type="button" @click="refresh()">Coba lagi</button>
  </NoticeBanner>
  <div v-else class="section-stack">
    <EmptyState
      v-if="!data?.periods.length"
      title="Belum ada periode"
      message="Buat periode, susun katalognya, lalu tugaskan unit kerja agar hasil penilaian muncul di sini."
      action-label="Kelola periode"
      action-to="/admin/periods"
    />
    <template v-else>
      <div class="filters-row dashboard-filters">
        <div class="field">
          <label for="dashboard-period">Periode</label>
          <select id="dashboard-period" v-model="selectedPeriodId" class="control">
            <option v-for="period in data.periods" :key="period.id" :value="period.id">{{ period.name }}</option>
          </select>
        </div>
        <div v-if="data.periodId && scoredRows.length" class="export-action">
          <a class="btn btn-secondary" :href="`/api/admin/periods/${data.periodId}/export`" download>Unduh rekap Excel</a>
          <span class="field-hint">{{ counts.verified ? `${counts.verified} unit terverifikasi berisi nilai akhir.` : 'Nilai akhir terisi setelah verifikasi dikirim.' }}</span>
        </div>
      </div>

      <section class="stats-grid" aria-label="Ringkasan periode">
        <article class="panel stat-card"><span>Unit ditugaskan</span><strong>{{ counts.assigned }}</strong><span>Pada periode ini</span></article>
        <article class="panel stat-card"><span>Belum dikirim</span><strong>{{ counts.notSubmitted }}</strong><span>Belum mulai atau masih draf</span></article>
        <article class="panel stat-card"><span>Menunggu verifikasi</span><strong>{{ counts.waiting }}</strong><span>Sudah dikirim unit kerja</span></article>
        <article class="panel stat-card"><span>Terverifikasi</span><strong>{{ counts.verified }}</strong><span>Hasil final sudah dikirim</span></article>
      </section>

      <section class="panel" aria-labelledby="unit-scores-heading">
        <div class="panel-header">
          <div><h2 id="unit-scores-heading">Nilai per unit kerja</h2><p>Pilih unit untuk melihat nilai per domain dan radar chart-nya.</p></div>
          <NuxtLink class="btn btn-secondary btn-small" to="/admin/queue">Antrean verifikasi</NuxtLink>
        </div>
        <div v-if="scoredRows.length" class="data-table-wrap mobile-records">
          <table class="data-table unit-score-table">
            <thead><tr><th scope="col">Unit kerja</th><th scope="col">Kegiatan statistik</th><th scope="col">Status</th><th scope="col" class="numeric">Nilai mandiri</th><th scope="col" class="numeric">Nilai final</th><th scope="col">Aksi</th></tr></thead>
            <tbody>
              <tr v-for="row in scoredRows" :key="row.unit.id" :class="{ 'is-selected': selectedRow?.unit.id === row.unit.id }">
                <td data-label="Unit kerja"><div><strong>{{ row.unit.name }}</strong><br><span class="record-meta">{{ row.unit.code }}</span></div></td>
                <td data-label="Kegiatan"><div>{{ row.assessment?.activityName || '-' }}<span v-if="row.assessment?.activityYear" class="record-meta"> ({{ row.assessment.activityYear }})</span></div></td>
                <td data-label="Status"><StatusBadge v-if="row.assessment" :status="row.assessment.status" /><span v-else class="record-meta">Belum mulai</span></td>
                <td data-label="Nilai mandiri" class="numeric">{{ total(row.self) }}</td>
                <td data-label="Nilai final" class="numeric"><strong>{{ total(row.final) }}</strong></td>
                <td data-label="Aksi">
                  <div class="table-actions">
                    <button v-if="row.self" class="btn btn-quiet btn-small" type="button" :aria-pressed="selectedRow?.unit.id === row.unit.id" @click="selectedUnitId = row.unit.id">Lihat grafik</button>
                    <NuxtLink v-if="row.assessment && row.assessment.status !== 'DRAFT'" class="btn btn-secondary btn-small" :to="`/admin/assessments/${row.assessment.id}`">{{ row.verified ? 'Hasil' : 'Verifikasi' }}</NuxtLink>
                    <button v-if="row.assessment" class="btn btn-danger btn-small" type="button" :disabled="resettingId === row.assessment.id" @click="resetAssessment(row)">{{ resettingId === row.assessment.id ? 'Mereset...' : 'Reset' }}</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <EmptyState v-else title="Belum ada unit ditugaskan" message="Tugaskan unit kerja ke periode ini dari halaman pengaturan periode." action-label="Kelola periode" action-to="/admin/periods" />
      </section>

      <section v-if="selectedRow && selectedScore" class="panel" aria-labelledby="unit-detail-heading">
        <div class="panel-header score-header">
          <div>
            <h2 id="unit-detail-heading">{{ selectedRow.unit.name }}</h2>
            <p>{{ selectedRow.verified ? 'Nilai final hasil verifikasi Pusdatin.' : 'Nilai mandiri dari unit kerja. Nilai final muncul setelah verifikasi dikirim.' }}</p>
          </div>
          <div class="score-actions">
            <StatusBadge v-if="selectedRow.assessment" :status="selectedRow.assessment.status" />
          </div>
        </div>
        <div class="score-layout">
          <div class="score-table-block">
            <p class="score-total-chip" :class="{ 'is-pending': selectedScore.total === null }">
              <template v-if="selectedScore.total !== null">{{ selectedRow.verified ? 'Nilai final' : 'Nilai mandiri' }} {{ formatScore(selectedScore.total) }} dari {{ selectedScore.maxLevel }}<template v-if="scorePredicate(selectedScore.total, selectedScore.maxLevel)"> · Predikat {{ scorePredicate(selectedScore.total, selectedScore.maxLevel) }}</template></template>
              <template v-else>Nilai total muncul setelah semua indikator memiliki level</template>
            </p>
            <div class="data-table-wrap">
              <table class="data-table score-table">
                <thead><tr><th scope="col">Domain</th><th scope="col" class="numeric">Bobot</th><th scope="col" class="numeric">Mandiri</th><th v-if="selectedRow.verified" scope="col" class="numeric">Final</th></tr></thead>
                <tbody>
                  <tr v-for="(domain, index) in selectedScore.domains" :key="domain.id">
                    <td>{{ index + 1 }}. {{ domain.name }}</td>
                    <td class="numeric">{{ domain.weight }}%</td>
                    <td class="numeric">{{ domainValue(selectedRow.self, domain.id) }}</td>
                    <td v-if="selectedRow.verified" class="numeric"><strong>{{ domainValue(selectedRow.final, domain.id) }}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <figure class="score-chart">
            <RadarChart :domains="selectedScore.domains" :max="selectedScore.maxLevel" />
            <figcaption>
              {{ selectedRow.verified ? 'Nilai final' : 'Nilai mandiri' }} {{ selectedRow.unit.code }} pada skala 0 sampai {{ selectedScore.maxLevel }}.
              <template v-if="selectedHasGap">Domain yang belum lengkap tampil di titik nol.</template>
            </figcaption>
          </figure>
        </div>
      </section>

      <section class="panel panel-body admin-shortcuts">
        <div><h2 class="section-title">Pengaturan</h2><p class="section-note">Siapkan periode, katalog indikator berbobot, akun, dan unit.</p></div>
        <nav aria-label="Pengaturan Admin">
          <NuxtLink class="btn btn-secondary" to="/admin/periods">Kelola periode</NuxtLink>
          <NuxtLink class="btn btn-secondary" to="/admin/indicators">Kelola katalog</NuxtLink>
          <NuxtLink class="btn btn-secondary" to="/admin/users">Pengguna dan unit</NuxtLink>
        </nav>
      </section>
    </template>
  </div>
</template>
