<script setup lang="ts">
import { getApiError } from '../../utils/format'
import { formatScore, scorePredicate, weightedScore, withFinalLevels, type DomainScore } from '../../utils/score'

interface UnitResponse {
  maturityLevelId: string | null
  explanation: string
  verification: { maturityLevelId: string } | null
  _count: { evidence: number }
  indicator: { id: string; code: string; title: string; weight: number; maturityLevels: Array<{ id: string; level: number }>; domain: { id: string; name: string; weight: number; position: number } }
}
interface UnitRow {
  unit: { id: string; name: string; code: string }
  verifier: { id: string; displayName: string } | null
  assessment: { id: string; status: string; activityName: string; activityYear: number | null; submittedAt: string | null; verifiedAt: string | null; responses: UnitResponse[] } | null
}
interface DashboardResult {
  periods: Array<{ id: string; name: string; status: string }>
  periodId: string | null
  rows: UnitRow[]
}
type Score = ReturnType<typeof weightedScore>
type ScoredRow = UnitRow & { verified: boolean; waiting: boolean; self: Score | null; final: Score | null }
// The chosen period lives in the URL, so a reload or a shared link opens the same period.
const route = useRoute()
const router = useRouter()
const selectedPeriodId = ref(typeof route.query.periode === 'string' ? route.query.periode : '')
watch(selectedPeriodId, (value: string) => {
  router.replace({ query: value ? { periode: value } : {} })
})

const { data, pending, error, refresh } = useFetch<DashboardResult>('/api/admin/dashboard', {
  lazy: true,
  query: computed(() => (selectedPeriodId.value ? { periodId: selectedPeriodId.value } : {})),
})
watch(() => data.value?.periodId, (value: string | null | undefined) => {
  if (value && !selectedPeriodId.value) selectedPeriodId.value = value
}, { immediate: true })
// After the first load, switching periods keeps the old rows on screen until the new ones arrive.
const refreshing = computed(() => pending.value && Boolean(data.value))
const periodName = computed(() => data.value?.periods.find(({ id }) => id === data.value?.periodId)?.name ?? '')
function periodOption(period: { name: string; status: string }) {
  if (period.status === 'CLOSED') return `${period.name} (ditutup)`
  if (period.status === 'DRAFT') return `${period.name} (draf)`
  return period.name
}

// Each unit is scored twice: the unit's own levels, and Pusdatin's final levels once verification is sent.
const scoredRows = computed((): ScoredRow[] => (data.value?.rows || []).map((row: UnitRow) => {
  const responses = row.assessment?.responses || []
  const status = row.assessment?.status
  const verified = status === 'VERIFIED'
  return {
    ...row,
    verified,
    waiting: status === 'SUBMITTED' || status === 'IN_REVIEW',
    self: responses.length ? weightedScore(responses) : null,
    final: verified ? weightedScore(withFinalLevels(responses)) : null,
  }
}))
const notSent = (row: ScoredRow) => !row.assessment || row.assessment.status === 'DRAFT'
const counts = computed(() => {
  const rows = scoredRows.value
  return {
    assigned: rows.length,
    notSubmitted: rows.filter(notSent).length,
    waiting: rows.filter((row: ScoredRow) => row.waiting).length,
    verified: rows.filter((row: ScoredRow) => row.verified).length,
  }
})

// Work order: waiting submissions first, oldest first, then units still filling in, then finished results.
function rank(row: ScoredRow) {
  if (row.waiting) return 0
  return row.verified ? 2 : 1
}
const time = (value: string | null | undefined) => (value ? new Date(value).getTime() : 0)
const sortedRows = computed(() => [...scoredRows.value].sort((a: ScoredRow, b: ScoredRow) => {
  const byRank = rank(a) - rank(b)
  if (byRank) return byRank
  if (a.waiting) return time(a.assessment?.submittedAt) - time(b.assessment?.submittedAt)
  if (a.verified) return time(b.assessment?.verifiedAt) - time(a.assessment?.verifiedAt)
  return a.unit.name.localeCompare(b.unit.name, 'id')
}))

// The mean final score of the period's verified units.
const verifiedAverage = computed(() => {
  const totals = scoredRows.value
    .filter((row: ScoredRow) => row.verified)
    .map((row: ScoredRow) => row.final?.total)
    .filter((value: number | null | undefined): value is number => typeof value === 'number')
  if (!totals.length) return null
  const maxLevel = scoredRows.value.find((row: ScoredRow) => row.final)!.final!.maxLevel
  const final = totals.reduce((sum: number, value: number) => sum + value, 0) / totals.length
  return { count: totals.length, final, maxLevel, predicate: scorePredicate(final, maxLevel) }
})

function scoreLabel(score: { total: number | null; maxLevel: number } | null) {
  if (score?.total === null || score?.total === undefined) return ''
  const predicate = scorePredicate(score.total, score.maxLevel)
  return predicate ? `${formatScore(score.total)} · ${predicate}` : formatScore(score.total)
}
function domainValue(score: { domains: DomainScore[] } | null, domainId: string) {
  const value = score?.domains.find(({ id }) => id === domainId)?.score
  return value === null || value === undefined ? '-' : formatScore(value)
}
const verifyPath = (row: ScoredRow) => `/admin/assessments/${row.assessment?.id}`
const verifiedCount = (row: ScoredRow) => (row.assessment?.responses || []).filter((response: UnitResponse) => response.verification).length

// Chart dialog. Previous and next follow the rows in the order shown on screen.
const selectedUnitId = ref('')
const selectedRow = computed((): ScoredRow | undefined => scoredRows.value.find((row: ScoredRow) => row.self && row.unit.id === selectedUnitId.value))
const selectedScore = computed(() => selectedRow.value?.final ?? selectedRow.value?.self ?? null)
const selectedHasGap = computed(() => Boolean(selectedScore.value?.domains.some((domain: DomainScore) => domain.score === null)))
const chartRows = computed(() => sortedRows.value.filter((row: ScoredRow) => row.self))
const chartIndex = computed(() => chartRows.value.findIndex((row: ScoredRow) => row.unit.id === selectedUnitId.value))
const previousChartRow = computed(() => (chartIndex.value > 0 ? chartRows.value[chartIndex.value - 1] : undefined))
const nextChartRow = computed(() => (chartIndex.value >= 0 ? chartRows.value[chartIndex.value + 1] : undefined))

const chartDialog = ref<HTMLDialogElement | null>(null)
// The content renders on the next tick; opening after it lets the browser autofocus the close button.
async function openChart(row: ScoredRow) {
  selectedUnitId.value = row.unit.id
  await nextTick()
  chartDialog.value?.showModal()
}
function showChart(row: ScoredRow | undefined) {
  if (row) selectedUnitId.value = row.unit.id
}
function closeChart() {
  chartDialog.value?.close()
}
// Escape, the close button, and a backdrop click all end here. Focus goes to the button of the unit
// last shown, which may differ from the one that opened the dialog.
function onChartClosed() {
  const id = selectedUnitId.value
  selectedUnitId.value = ''
  document.querySelector<HTMLElement>(`[data-chart-trigger="${id}"]`)?.focus()
}
// A click that lands on the dialog element itself, not its content, is a click on the backdrop.
function onChartDialogClick(event: MouseEvent) {
  if (event.target === chartDialog.value) closeChart()
}

// Reset and reopen are rare and weighty, so they sit behind each row's "more" button.
const menuUnitId = ref('')
const menuRow = computed(() => scoredRows.value.find((row: ScoredRow) => row.unit.id === menuUnitId.value))
const menuPosition = ref<Record<string, string>>({})
const rowMenu = ref<HTMLElement | null>(null)
let menuTrigger: HTMLElement | null = null
// The table scrolls sideways and would clip a menu placed in the cell, so the menu is fixed to the viewport.
async function toggleRowMenu(row: ScoredRow, event: MouseEvent) {
  if (menuUnitId.value === row.unit.id) return closeRowMenu(true)
  menuTrigger = event.currentTarget as HTMLElement
  const rect = menuTrigger.getBoundingClientRect()
  // clientWidth leaves out the scrollbar, which is what a fixed element's right edge is measured from.
  const right = `${Math.max(8, document.documentElement.clientWidth - rect.right)}px`
  menuPosition.value = window.innerHeight - rect.bottom > 72
    ? { top: `${rect.bottom + 6}px`, right }
    : { bottom: `${window.innerHeight - rect.top + 6}px`, right }
  menuUnitId.value = row.unit.id
  await nextTick()
  rowMenu.value?.querySelector('button')?.focus()
}
function closeRowMenu(returnFocus = false) {
  if (!menuUnitId.value) return
  menuUnitId.value = ''
  if (returnFocus) menuTrigger?.focus()
}
// Focus leaving the menu (Tab, or a click elsewhere) closes it. A click on its own trigger is left to toggleRowMenu.
function onRowMenuFocusOut(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  if (!rowMenu.value?.contains(next) && next !== menuTrigger) closeRowMenu()
}
const closeMenuOnMove = () => closeRowMenu()
onMounted(() => {
  window.addEventListener('scroll', closeMenuOnMove, true)
  window.addEventListener('resize', closeMenuOnMove)
})
onBeforeUnmount(() => {
  window.removeEventListener('scroll', closeMenuOnMove, true)
  window.removeEventListener('resize', closeMenuOnMove)
})

// Reset deletes a unit's unverified assessment; a sent verification is reopened instead, keeping every answer.
const actionDialog = ref<HTMLDialogElement | null>(null)
const queueHeading = ref<HTMLElement | null>(null)
const action = ref<{ mode: 'reset' | 'reopen'; row: ScoredRow } | null>(null)
const resetAcknowledged = ref(false)
const reopenReason = ref('')
const actionBusy = ref(false)
const actionError = ref('')
const pageError = toastRef('error')
const success = toastRef('success')
let actionTrigger: HTMLElement | null = null
const reasonMin = 10

const lossSummary = computed(() => {
  const responses = action.value?.row.assessment?.responses || []
  return {
    total: responses.length,
    levels: responses.filter((response: UnitResponse) => response.maturityLevelId).length,
    explanations: responses.filter((response: UnitResponse) => response.explanation.trim()).length,
    evidence: responses.reduce((sum: number, response: UnitResponse) => sum + response._count.evidence, 0),
    finals: responses.filter((response: UnitResponse) => response.verification).length,
  }
})

async function startAction(mode: 'reset' | 'reopen') {
  const row = menuRow.value
  const trigger = menuTrigger
  closeRowMenu()
  if (!row?.assessment) return
  actionTrigger = trigger
  action.value = { mode, row }
  resetAcknowledged.value = false
  reopenReason.value = ''
  actionError.value = ''
  await nextTick()
  actionDialog.value?.showModal()
}
function closeAction() {
  if (!actionBusy.value) actionDialog.value?.close()
}
// Escape is ignored while a request runs, so the dialog cannot vanish before the result is known.
function onActionCancel(event: Event) {
  if (actionBusy.value) event.preventDefault()
}
function onActionDialogClick(event: MouseEvent) {
  if (event.target === actionDialog.value) closeAction()
}
// After a reset the row's "more" button is gone, so focus lands on the list heading instead.
function onActionClosed() {
  action.value = null
  if (actionTrigger?.isConnected) actionTrigger.focus()
  else queueHeading.value?.focus()
  actionTrigger = null
}
async function confirmAction() {
  const current = action.value
  if (!current?.row.assessment || actionBusy.value) return
  if (current.mode === 'reset' && !resetAcknowledged.value) return
  if (current.mode === 'reopen' && reopenReason.value.trim().length < reasonMin) {
    actionError.value = `Tulis alasan minimal ${reasonMin} karakter.`
    return
  }
  actionBusy.value = true
  actionError.value = ''
  pageError.value = ''
  success.value = ''
  const { id } = current.row.assessment
  const name = current.row.unit.name
  try {
    if (current.mode === 'reset') {
      await $fetch(`/api/admin/assessments/${id}`, { method: 'DELETE' })
      success.value = `Penilaian ${name} sudah direset. Unit kerja dapat mulai mengisi lagi.`
    } else {
      await $fetch(`/api/admin/assessments/${id}/reopen`, { method: 'POST', body: { reason: reopenReason.value.trim() } })
      success.value = `Verifikasi ${name} dibuka ulang. Ubah level final di halaman Verifikasi, lalu kirim hasilnya lagi.`
    }
    actionBusy.value = false
    closeAction()
    await refresh()
  } catch (requestError) {
    actionError.value = getApiError(requestError, current.mode === 'reset' ? 'Penilaian belum dapat direset.' : 'Verifikasi belum dapat dibuka ulang.')
  } finally {
    actionBusy.value = false
  }
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
            <option v-for="period in data.periods" :key="period.id" :value="period.id">{{ periodOption(period) }}</option>
          </select>
        </div>
        <div v-if="data.periodId && scoredRows.length" class="export-action">
          <a class="btn btn-secondary" :href="`/api/admin/periods/${data.periodId}/export`" download>Unduh rekap Excel</a>
          <span class="field-hint">{{ counts.verified ? `${counts.verified} unit terverifikasi berisi nilai akhir.` : 'Nilai akhir terisi setelah verifikasi dikirim.' }}</span>
        </div>
      </div>

      <section class="stats-grid" aria-label="Ringkasan periode">
        <article class="panel stat-card stat-card--brand"><span>Unit ditugaskan</span><strong>{{ counts.assigned }}</strong><span>Pada periode ini</span></article>
        <article class="panel stat-card stat-card--neutral"><span>Belum dikirim</span><strong>{{ counts.notSubmitted }}</strong><span>Belum mulai atau masih draf</span></article>
        <article class="panel stat-card stat-card--warning"><span>Menunggu verifikasi</span><strong>{{ counts.waiting }}</strong><span>Sudah dikirim unit kerja</span></article>
        <article class="panel stat-card stat-card--success"><span>Terverifikasi</span><strong>{{ counts.verified }}</strong><span>Hasil final sudah dikirim</span></article>
        <article class="panel stat-card stat-card--data">
          <span>Rata-rata nilai final</span>
          <strong v-if="verifiedAverage">{{ formatScore(verifiedAverage.final) }}<small> dari {{ verifiedAverage.maxLevel }}</small></strong>
          <strong v-else class="is-empty">-</strong>
          <span v-if="verifiedAverage">
            <template v-if="verifiedAverage.predicate">{{ verifiedAverage.predicate }} · </template>dari {{ verifiedAverage.count }} unit terverifikasi
          </span>
          <span v-else>Muncul setelah verifikasi pertama dikirim</span>
        </article>
      </section>

      <section class="panel" aria-labelledby="unit-scores-heading" :aria-busy="refreshing">
        <div class="panel-header">
          <div><h2 id="unit-scores-heading" ref="queueHeading" tabindex="-1">Nilai per unit kerja</h2><p>Pilih Lihat grafik untuk membuka nilai per domain dan radar chart sebuah unit.</p></div>
          <NuxtLink class="btn btn-secondary btn-small" to="/admin/queue">Antrean verifikasi</NuxtLink>
        </div>
        <div v-if="scoredRows.length" class="data-table-wrap mobile-records" :class="{ 'is-refreshing': refreshing }">
          <table class="data-table unit-score-table">
            <thead><tr><th scope="col">Unit kerja</th><th scope="col">Kegiatan statistik</th><th scope="col">Status</th><th scope="col">Verifikator</th><th scope="col" class="numeric">Nilai mandiri</th><th scope="col" class="numeric">Nilai final</th><th scope="col">Aksi</th></tr></thead>
            <tbody>
              <tr v-for="row in sortedRows" :key="row.unit.id" :class="{ 'is-selected': selectedUnitId === row.unit.id || menuUnitId === row.unit.id }">
                <td data-label="Unit kerja"><div><strong>{{ row.unit.name }}</strong><br><span class="record-meta">{{ row.unit.code }}</span></div></td>
                <td data-label="Kegiatan"><div>{{ row.assessment?.activityName || '-' }}<span v-if="row.assessment?.activityYear" class="record-meta"> ({{ row.assessment.activityYear }})</span></div></td>
                <td data-label="Status"><StatusBadge v-if="row.assessment" :status="row.assessment.status" /><span v-else class="record-meta">Belum mulai</span></td>
                <td data-label="Verifikator">
                  <div class="verifier-cell">
                    <span v-if="row.verifier">{{ row.verifier.displayName }}</span>
                    <span v-else class="record-meta">Belum ditugaskan</span>
                    <span v-if="row.waiting" class="record-meta" :title="`${verifiedCount(row)} dari ${row.assessment!.responses.length} indikator sudah diberi level final`">{{ verifiedCount(row) }}/{{ row.assessment!.responses.length }} indikator</span>
                  </div>
                </td>
                <td data-label="Nilai mandiri" class="numeric">
                  <template v-if="scoreLabel(row.self)">{{ scoreLabel(row.self) }}</template>
                  <template v-else><span aria-hidden="true">-</span><span class="sr-only">Belum ada nilai</span></template>
                </td>
                <td data-label="Nilai final" class="numeric">
                  <strong v-if="scoreLabel(row.final)">{{ scoreLabel(row.final) }}</strong>
                  <template v-else><span aria-hidden="true">-</span><span class="sr-only">Belum ada nilai</span></template>
                </td>
                <td data-label="Aksi" class="row-actions-cell">
                  <div v-if="row.assessment" class="row-actions">
                    <NuxtLink v-if="row.waiting" class="btn btn-primary btn-small row-action-main" :to="verifyPath(row)">Verifikasi</NuxtLink>
                    <NuxtLink v-else-if="row.verified" class="btn btn-secondary btn-small row-action-main" :to="verifyPath(row)">Hasil</NuxtLink>
                    <button
                      v-if="row.self"
                      class="btn btn-secondary btn-small row-action-chart"
                      type="button"
                      aria-haspopup="dialog"
                      :aria-label="`Lihat grafik ${row.unit.name}`"
                      :data-chart-trigger="row.unit.id"
                      @click="openChart(row)"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M5 20V11M12 20V5M19 20v-6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" /></svg>
                      Lihat grafik
                    </button>
                    <button
                      class="btn btn-secondary btn-small row-action-more"
                      type="button"
                      aria-controls="row-menu"
                      :aria-expanded="menuUnitId === row.unit.id"
                      :aria-label="`Aksi lain untuk ${row.unit.name}`"
                      title="Aksi lain"
                      @click="toggleRowMenu(row, $event)"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><circle cx="5" cy="12" r="1.8" fill="currentColor" /><circle cx="12" cy="12" r="1.8" fill="currentColor" /><circle cx="19" cy="12" r="1.8" fill="currentColor" /></svg>
                    </button>
                  </div>
                  <template v-else><span aria-hidden="true">-</span><span class="sr-only">Belum ada aksi, unit belum mulai mengisi</span></template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <EmptyState v-else title="Belum ada unit ditugaskan" message="Tugaskan unit kerja ke periode ini dari halaman pengaturan periode." action-label="Kelola periode" action-to="/admin/periods" />
        <div
          v-if="menuRow"
          id="row-menu"
          ref="rowMenu"
          class="row-menu"
          :style="menuPosition"
          @keydown.esc.prevent="closeRowMenu(true)"
          @focusout="onRowMenuFocusOut"
        >
          <button v-if="menuRow.verified" class="row-menu-item" type="button" @click="startAction('reopen')">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M7 11V8a5 5 0 0 1 9.6-2M5 11h14v9H5z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
            Buka ulang verifikasi
          </button>
          <button v-else class="row-menu-item is-danger" type="button" @click="startAction('reset')">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
            Reset penilaian
          </button>
        </div>
      </section>

      <dialog ref="chartDialog" class="score-dialog" aria-labelledby="unit-detail-heading" @click="onChartDialogClick" @close="onChartClosed">
        <template v-if="selectedRow && selectedScore">
          <div class="panel-header score-header score-dialog-header">
            <div>
              <h2 id="unit-detail-heading">{{ selectedRow.unit.name }}</h2>
              <p>{{ selectedRow.verified ? 'Nilai final hasil verifikasi Pusdatin.' : 'Nilai mandiri dari unit kerja. Nilai final muncul setelah verifikasi dikirim.' }}</p>
            </div>
            <div class="score-actions">
              <StatusBadge v-if="selectedRow.assessment" :status="selectedRow.assessment.status" />
              <button class="dialog-close" type="button" aria-label="Tutup grafik" title="Tutup" autofocus @click="closeChart">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                  <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                </svg>
              </button>
            </div>
          </div>
          <div class="score-layout">
            <div class="score-table-block">
              <p class="score-reading" :class="{ 'is-pending': selectedScore.total === null }">
                <template v-if="selectedScore.total !== null">
                  <span class="score-reading-label">{{ selectedRow.verified ? 'Nilai final' : 'Nilai mandiri' }}</span>
                  <strong class="score-reading-value">{{ formatScore(selectedScore.total) }}</strong>
                  <span class="score-reading-meta">dari {{ selectedScore.maxLevel }}<template v-if="scorePredicate(selectedScore.total, selectedScore.maxLevel)"> · {{ scorePredicate(selectedScore.total, selectedScore.maxLevel) }}</template></span>
                </template>
                <template v-else>Nilai total muncul setelah semua indikator memiliki level.</template>
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
                <template v-if="selectedHasGap">Domain yang belum lengkap ditandai "belum diisi" dan berada di titik nol.</template>
              </figcaption>
            </figure>
          </div>
          <div class="score-dialog-footer">
            <div class="score-dialog-nav">
              <button
                class="btn btn-secondary btn-small"
                type="button"
                :disabled="!previousChartRow"
                :aria-label="previousChartRow ? `Unit sebelumnya, ${previousChartRow.unit.name}` : 'Unit sebelumnya'"
                @click="showChart(previousChartRow)"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
                Sebelumnya
              </button>
              <span class="score-dialog-position" aria-live="polite">{{ chartIndex + 1 }} dari {{ chartRows.length }}</span>
              <button
                class="btn btn-secondary btn-small"
                type="button"
                :disabled="!nextChartRow"
                :aria-label="nextChartRow ? `Unit berikutnya, ${nextChartRow.unit.name}` : 'Unit berikutnya'"
                @click="showChart(nextChartRow)"
              >
                Berikutnya
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
              </button>
            </div>
            <NuxtLink v-if="selectedRow.waiting" class="btn btn-primary btn-small" :to="verifyPath(selectedRow)">Verifikasi unit ini</NuxtLink>
            <NuxtLink v-else-if="selectedRow.verified" class="btn btn-secondary btn-small" :to="verifyPath(selectedRow)">Lihat hasil</NuxtLink>
          </div>
        </template>
      </dialog>

      <dialog
        ref="actionDialog"
        class="action-dialog"
        aria-labelledby="action-title"
        aria-describedby="action-description"
        @click="onActionDialogClick"
        @cancel="onActionCancel"
        @close="onActionClosed"
      >
        <form v-if="action" class="action-dialog-body" @submit.prevent="confirmAction">
          <div class="action-dialog-header">
            <h2 id="action-title">{{ action.mode === 'reset' ? `Reset penilaian ${action.row.unit.name}?` : `Buka ulang verifikasi ${action.row.unit.name}?` }}</h2>
            <button class="dialog-close" type="button" aria-label="Batal" title="Batal" :disabled="actionBusy" @click="closeAction">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
            </button>
          </div>
          <dl class="action-facts">
            <div><dt>Periode</dt><dd>{{ periodName }}</dd></div>
            <div><dt>Kegiatan</dt><dd>{{ action.row.assessment?.activityName || '-' }}</dd></div>
            <div><dt>Status</dt><dd><StatusBadge :status="action.row.assessment?.status ?? 'NOT_STARTED'" /></dd></div>
          </dl>
          <template v-if="action.mode === 'reset'">
            <div id="action-description" class="action-loss">
              <p><strong>Yang akan dihapus permanen:</strong></p>
              <ul>
                <li>{{ lossSummary.levels }} dari {{ lossSummary.total }} level yang dipilih unit</li>
                <li>{{ lossSummary.explanations }} penjelasan</li>
                <li>{{ lossSummary.evidence }} tautan bukti</li>
                <li v-if="lossSummary.finals">{{ lossSummary.finals }} level final dan komentar Pusdatin</li>
              </ul>
              <p>Unit kerja harus mengisi ulang dari awal. Tindakan ini tidak dapat dibatalkan.</p>
            </div>
            <label class="check-row"><input v-model="resetAcknowledged" type="checkbox"><span>Saya mengerti isian ini akan dihapus permanen.</span></label>
          </template>
          <template v-else>
            <p id="action-description" class="action-note">
              Status kembali menjadi <strong>Dalam verifikasi</strong>. Isian unit dan level final Anda tetap tersimpan, tetapi unit tidak melihat nilai final sampai Anda mengirim hasil verifikasi lagi.
            </p>
            <div class="field">
              <label for="reopen-reason">Alasan membuka ulang</label>
              <textarea id="reopen-reason" v-model="reopenReason" class="control action-reason" maxlength="1000" required aria-describedby="reopen-reason-hint" />
              <p id="reopen-reason-hint" class="field-hint">Dicatat di riwayat status penilaian. Minimal {{ reasonMin }} karakter.</p>
            </div>
          </template>
          <p v-if="actionError" class="action-error" role="alert">{{ actionError }}</p>
          <div class="action-dialog-actions">
            <button class="btn btn-secondary" type="button" autofocus :disabled="actionBusy" @click="closeAction">Batal</button>
            <button v-if="action.mode === 'reset'" class="btn btn-danger-solid" type="submit" :disabled="!resetAcknowledged || actionBusy">
              {{ actionBusy ? 'Mereset...' : 'Reset penilaian' }}
            </button>
            <button v-else class="btn btn-primary" type="submit" :disabled="reopenReason.trim().length < reasonMin || actionBusy">
              {{ actionBusy ? 'Membuka ulang...' : 'Buka ulang verifikasi' }}
            </button>
          </div>
        </form>
      </dialog>

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
