<script setup lang="ts">
import { getApiError } from '../../utils/format'

interface Verifier { id: string; displayName: string; email: string }
interface AssignmentRow {
  unit: { id: string; name: string; code: string }
  verifier: { id: string; displayName: string; isActive: boolean } | null
  assessment: { id: string; status: string; totalResponses: number; verifiedResponses: number } | null
}
interface AssignmentResult {
  period: { id: string; name: string; status: string }
  verifiers: Verifier[]
  rows: AssignmentRow[]
}

const route = useRoute()
const router = useRouter()
const { data: periodData } = useFetch<{ periods: Array<{ id: string; name: string; status: string }> }>('/api/admin/periods', { lazy: true })
const periods = computed(() => periodData.value?.periods || [])
const selectedPeriodId = ref(typeof route.query.periode === 'string' ? route.query.periode : '')
// Without a period in the URL, start on the first active one.
watch(periods, (list: Array<{ id: string; status: string }>) => {
  if (!selectedPeriodId.value && list.length) selectedPeriodId.value = (list.find(({ status }) => status === 'ACTIVE') ?? list[0]).id
}, { immediate: true })

const { data, pending, error, refresh } = useFetch<AssignmentResult>(() => `/api/admin/periods/${selectedPeriodId.value}/verifiers`, {
  lazy: true,
  immediate: false,
  watch: false,
})

// Choices on screen, keyed by unit id. '' means no verifier. Only rows that differ from the saved value are sent.
const choices = ref<Record<string, string>>({})
function resetChoices() {
  choices.value = Object.fromEntries((data.value?.rows || []).map((row) => [row.unit.id, row.verifier?.id ?? '']))
}
// Immediate: returning to the page reuses cached data, which would otherwise leave every choice blank and unsaved.
watch(data, resetChoices, { immediate: true })
const changes = computed(() => (data.value?.rows || [])
  .filter((row) => (choices.value[row.unit.id] ?? '') !== (row.verifier?.id ?? ''))
  .map((row) => ({ unitId: row.unit.id, verifierId: choices.value[row.unit.id] || null })))

// Switching periods with unsaved choices asks first; putting the old value back must not ask again.
let reverting = false
watch(selectedPeriodId, async (value: string, old: string | undefined) => {
  if (!value || reverting) {
    reverting = false
    return
  }
  if (old && changes.value.length && !window.confirm('Ada penugasan yang belum disimpan. Pindah periode dan buang perubahan tersebut?')) {
    reverting = true
    selectedPeriodId.value = old
    return
  }
  router.replace({ query: { periode: value } })
  await refresh()
}, { immediate: true })

// Inactive Admins can stay assigned from before; they remain listed for that row so the saved value is visible.
function optionsFor(row: AssignmentRow) {
  const list = (data.value?.verifiers || []).map(({ id, displayName }) => ({ id, label: displayName }))
  if (row.verifier && !row.verifier.isActive && !list.some(({ id }) => id === row.verifier!.id)) {
    list.push({ id: row.verifier.id, label: `${row.verifier.displayName} (nonaktif)` })
  }
  return list
}

const sent = (row: AssignmentRow) => Boolean(row.assessment && row.assessment.status !== 'DRAFT')
// Per verifier: units assigned, units the unit has sent, units verified. Progress is over sent units, the ones a verifier can act on.
const summary = computed(() => {
  const rows = data.value?.rows || []
  const people = (data.value?.verifiers || []).map(({ id, displayName }) => ({ id, name: displayName }))
  for (const row of rows) {
    if (row.verifier && !people.some(({ id }) => id === row.verifier!.id)) people.push({ id: row.verifier.id, name: `${row.verifier.displayName} (nonaktif)` })
  }
  const tally = (list: AssignmentRow[]) => ({
    assigned: list.length,
    sent: list.filter(sent).length,
    verified: list.filter((row) => row.assessment?.status === 'VERIFIED').length,
  })
  return {
    people: people
      .map((person) => ({ ...person, ...tally(rows.filter((row) => row.verifier?.id === person.id)) }))
      .filter(({ assigned }) => assigned > 0),
    unassigned: rows.filter((row) => !row.verifier).length,
    idle: people.filter((person) => !rows.some((row) => row.verifier?.id === person.id)).map(({ name }) => name),
  }
})

const saving = ref(false)
const pageError = toastRef('error')
const success = toastRef('success')
async function save() {
  if (!changes.value.length || !selectedPeriodId.value) return
  saving.value = true
  pageError.value = ''
  try {
    const count = changes.value.length
    await $fetch(`/api/admin/periods/${selectedPeriodId.value}/verifiers`, { method: 'PUT', body: { assignments: changes.value } })
    success.value = `Penugasan ${count} unit tersimpan.`
    await refresh()
  } catch (requestError) {
    pageError.value = getApiError(requestError, 'Penugasan belum tersimpan. Pilihan Anda tetap di halaman ini.')
  } finally {
    saving.value = false
  }
}

onBeforeRouteLeave(() => (changes.value.length ? window.confirm('Ada penugasan yang belum disimpan. Tinggalkan halaman ini?') : true))
</script>

<template>
  <PageHeading title="Penugasan verifikator" subtitle="Tentukan Admin yang memverifikasi tiap unit kerja pada satu periode, lalu pantau progres verifikasinya." />
  <div class="section-stack">
    <div class="filters-row dashboard-filters">
      <div class="field">
        <label for="assignment-period">Periode</label>
        <select id="assignment-period" v-model="selectedPeriodId" class="control" :disabled="!periods.length">
          <option v-for="period in periods" :key="period.id" :value="period.id">{{ period.name }}{{ period.status === 'CLOSED' ? ' (ditutup)' : '' }}</option>
        </select>
      </div>
      <p class="field-hint">Semua Admin tetap dapat memverifikasi unit mana pun. Penugasan menunjukkan siapa yang bertanggung jawab.</p>
    </div>

    <EmptyState v-if="periodData && !periods.length" title="Belum ada periode" message="Buat periode dan tugaskan unit kerja terlebih dahulu." action-label="Kelola periode" action-to="/admin/periods" />
    <LoadingState v-else-if="pending && !data" label="Memuat penugasan..." />
    <NoticeBanner v-else-if="error" tone="error" role="alert">
      {{ getApiError(error, 'Penugasan belum dapat dimuat.') }}
      <button class="btn btn-secondary btn-small" type="button" @click="refresh()">Coba lagi</button>
    </NoticeBanner>
    <template v-else-if="data">
      <section class="panel" aria-labelledby="verifier-progress-heading">
        <div class="panel-header">
          <div><h2 id="verifier-progress-heading">Progres per verifikator</h2><p>Progres dihitung dari unit yang sudah mengirim penilaian.</p></div>
        </div>
        <div v-if="summary.people.length" class="data-table-wrap mobile-records">
          <table class="data-table">
            <thead><tr><th scope="col">Verifikator</th><th scope="col" class="numeric">Unit ditugaskan</th><th scope="col" class="numeric">Sudah dikirim unit</th><th scope="col">Terverifikasi</th></tr></thead>
            <tbody>
              <tr v-for="person in summary.people" :key="person.id">
                <td data-label="Verifikator"><strong>{{ person.name }}</strong></td>
                <td data-label="Unit ditugaskan" class="numeric">{{ person.assigned }}</td>
                <td data-label="Sudah dikirim unit" class="numeric">{{ person.sent }}</td>
                <td data-label="Terverifikasi">
                  <AssessmentProgress v-if="person.sent" :complete="person.verified" :total="person.sent" unit="unit" label="Unit terverifikasi" />
                  <span v-else class="record-meta">Belum ada kiriman</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="panel-body record-meta">Belum ada unit yang ditugaskan ke verifikator pada periode ini.</p>
        <p v-if="summary.unassigned || summary.idle.length" class="panel-body verifier-summary-note">
          <template v-if="summary.unassigned"><strong>{{ summary.unassigned }} unit</strong> belum punya verifikator.</template>
          <template v-if="summary.idle.length"> Belum mendapat tugas: {{ summary.idle.join(', ') }}.</template>
        </p>
      </section>

      <section class="panel" aria-labelledby="unit-assignment-heading">
        <div class="panel-header">
          <div><h2 id="unit-assignment-heading">Unit kerja pada {{ data.period.name }}</h2><p>Pilih verifikator untuk tiap unit, lalu simpan.</p></div>
        </div>
        <div v-if="data.rows.length" class="data-table-wrap mobile-records">
          <table class="data-table assignment-table">
            <thead><tr><th scope="col">Unit kerja</th><th scope="col">Status</th><th scope="col">Progres verifikasi</th><th scope="col">Verifikator</th></tr></thead>
            <tbody>
              <tr v-for="row in data.rows" :key="row.unit.id" :class="{ 'is-changed': (choices[row.unit.id] ?? '') !== (row.verifier?.id ?? '') }">
                <td data-label="Unit kerja"><div><strong>{{ row.unit.name }}</strong><br><span class="record-meta">{{ row.unit.code }}</span></div></td>
                <td data-label="Status"><StatusBadge v-if="row.assessment" :status="row.assessment.status" /><span v-else class="record-meta">Belum mulai</span></td>
                <td data-label="Progres verifikasi">
                  <AssessmentProgress v-if="sent(row)" :complete="row.assessment!.verifiedResponses" :total="row.assessment!.totalResponses" />
                  <span v-else class="record-meta">{{ row.assessment ? 'Unit belum mengirim' : 'Belum ada penilaian' }}</span>
                </td>
                <td data-label="Verifikator">
                  <label class="sr-only" :for="`verifier-${row.unit.id}`">Verifikator untuk {{ row.unit.name }}</label>
                  <select :id="`verifier-${row.unit.id}`" v-model="choices[row.unit.id]" class="control verifier-select">
                    <option value="">Belum ditugaskan</option>
                    <option v-for="option in optionsFor(row)" :key="option.id" :value="option.id">{{ option.label }}</option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <EmptyState v-else title="Belum ada unit pada periode ini" message="Tugaskan unit kerja ke periode ini dari halaman pengaturan periode." action-label="Kelola periode" action-to="/admin/periods" />
        <div v-if="data.rows.length" class="assignment-save-bar">
          <span class="field-hint" aria-live="polite">{{ changes.length ? `${changes.length} perubahan belum disimpan.` : 'Semua penugasan sudah tersimpan.' }}</span>
          <div class="table-actions">
            <button class="btn btn-secondary" type="button" :disabled="!changes.length || saving" @click="resetChoices">Batalkan</button>
            <button class="btn btn-primary" type="button" :disabled="!changes.length || saving" @click="save">{{ saving ? 'Menyimpan...' : 'Simpan penugasan' }}</button>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
