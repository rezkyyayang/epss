<script setup lang="ts">
import { formatDate, getApiError } from '../../../utils/format'

interface PeriodData { id: string; name: string; status: 'DRAFT' | 'ACTIVE' | 'CLOSED'; startsAt: string | null; endsAt: string | null; _count: { assessments: number }; assignments: Array<{ unit: { id: string } }> }
interface UnitData { id: string; name: string; code: string; isActive: boolean }
const route = useRoute()
const periodId = String(route.params.id)
const [{ data: periodData, refresh: refreshPeriod, pending: periodPending, error: periodError }, { data: unitData, refresh: refreshUnits, pending: unitsPending, error: unitsError }] = [
  useFetch<{ periods: PeriodData[] }>('/api/admin/periods', { lazy: true }),
  useFetch<{ units: UnitData[] }>('/api/admin/units', { lazy: true }),
]
const loading = computed(() => periodPending.value || unitsPending.value)
const loadError = computed(() => periodError.value || unitsError.value)
const period = computed(() => periodData.value?.periods.find(({ id }) => id === periodId))
const name = ref('')
const startsAt = ref('')
const endsAt = ref('')
const status = ref<'DRAFT' | 'ACTIVE' | 'CLOSED'>('DRAFT')
const assignedIds = ref<string[]>([])
const saving = ref(false)
const message = toastRef('success')
const pageError = toastRef('error')
watch(period, (value: PeriodData | undefined) => {
  if (!value) return
  name.value = value.name
  startsAt.value = value.startsAt?.slice(0, 10) || ''
  endsAt.value = value.endsAt?.slice(0, 10) || ''
  status.value = value.status
  assignedIds.value = value.assignments.map((assignment: { unit: { id: string } }) => assignment.unit.id)
}, { immediate: true })
const locked = computed(() => Boolean(period.value?._count.assessments))
const activeUnits = computed(() => (unitData.value?.units || []).filter((unit: UnitData) => unit.isActive))
const allUnitsSelected = computed(() => activeUnits.value.length > 0 && activeUnits.value.every((unit: UnitData) => assignedIds.value.includes(unit.id)))
function toggleAllUnits() {
  assignedIds.value = allUnitsSelected.value ? [] : activeUnits.value.map((unit: UnitData) => unit.id)
}
function asDate(value: string) { return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : null }

async function refreshData() {
  await Promise.all([refreshPeriod(), refreshUnits()])
}

async function savePeriod() {
  saving.value = true; pageError.value = ''; message.value = ''
  try {
    await $fetch(`/api/admin/periods/${periodId}`, { method: 'PATCH', body: { name: name.value, startsAt: asDate(startsAt.value), endsAt: asDate(endsAt.value), status: status.value } })
    message.value = 'Pengaturan periode tersimpan.'; await refreshPeriod()
  } catch (error) { pageError.value = getApiError(error, 'Pengaturan periode belum dapat disimpan.') }
  finally { saving.value = false }
}
// Domain targets: a reference score per domain, shown beside unit results. Editable even after the catalog locks.
interface CatalogDomain { id: string; code: string; name: string; weight: number; target: number | null; indicators: Array<{ maturityLevels: Array<{ level: number }> }> }
const { data: catalogData, refresh: refreshCatalog } = useFetch<{ domains: CatalogDomain[] }>(`/api/admin/periods/${periodId}/catalog`, { lazy: true })
const catalogDomains = computed(() => catalogData.value?.domains || [])
const maxLevelOf = (domain: CatalogDomain) => Math.max(0, ...domain.indicators.flatMap(({ maturityLevels }) => maturityLevels.map(({ level }) => level)))
// Inputs hold text so a cleared field reads as "no target" rather than 0.
const targetInputs = ref<Record<string, string>>({})
watch(catalogDomains, (domains: CatalogDomain[]) => {
  targetInputs.value = Object.fromEntries(domains.map(({ id, target }) => [id, target === null ? '' : String(target)]))
}, { immediate: true })
const parsedTarget = (id: string) => {
  const text = (targetInputs.value[id] ?? '').trim().replace(',', '.')
  return text === '' ? null : Number(text)
}
const targetErrors = computed(() => Object.fromEntries(catalogDomains.value.map((domain: CatalogDomain) => {
  const value = parsedTarget(domain.id)
  const max = maxLevelOf(domain)
  return [domain.id, value !== null && (!Number.isFinite(value) || value < 0 || value > max) ? `Isi angka 0 sampai ${max}.` : '']
})))
const targetsChanged = computed(() => catalogDomains.value.some((domain: CatalogDomain) => parsedTarget(domain.id) !== domain.target))
const weightedTarget = computed(() => {
  const domains = catalogDomains.value
  if (!domains.length || domains.some((domain: CatalogDomain) => parsedTarget(domain.id) === null || targetErrors.value[domain.id])) return null
  return domains.reduce((sum: number, domain: CatalogDomain) => sum + domain.weight / 100 * (parsedTarget(domain.id) as number), 0)
})
async function saveTargets() {
  if (Object.values(targetErrors.value).some(Boolean)) return
  saving.value = true; pageError.value = ''; message.value = ''
  try {
    await $fetch(`/api/admin/periods/${periodId}/targets`, { method: 'PUT', body: { targets: catalogDomains.value.map((domain: CatalogDomain) => ({ domainId: domain.id, target: parsedTarget(domain.id) })) } })
    message.value = 'Nilai target tersimpan.'; await refreshCatalog()
  } catch (error) { pageError.value = getApiError(error, 'Nilai target belum dapat disimpan.') }
  finally { saving.value = false }
}

async function saveAssignments() {
  saving.value = true; pageError.value = ''; message.value = ''
  try {
    await $fetch(`/api/admin/periods/${periodId}/units`, { method: 'PUT', body: { unitIds: assignedIds.value } })
    message.value = 'Penugasan unit tersimpan.'; await refreshPeriod()
  } catch (error) { pageError.value = getApiError(error, 'Penugasan belum dapat disimpan.') }
  finally { saving.value = false }
}
</script>

<template>
  <NuxtPage v-if="route.path.endsWith('/catalog')" />
  <template v-else>
  <PageHeading :title="period?.name || 'Pengaturan periode'" subtitle="Atur jadwal dan unit yang dapat mengisi penilaian." />
  <LoadingState v-if="loading && !periodData" label="Memuat pengaturan periode..." />
  <NoticeBanner v-else-if="loadError" tone="error" role="alert">
    {{ getApiError(loadError, 'Pengaturan periode belum dapat dimuat.') }}
    <button class="btn btn-secondary btn-small" type="button" @click="refreshData">Coba lagi</button>
  </NoticeBanner>
  <EmptyState v-else-if="!period" title="Periode tidak ditemukan" message="Periode ini mungkin sudah dihapus atau tautannya sudah tidak berlaku." action-label="Kembali ke periode" action-to="/admin/periods" />
  <div v-else class="section-stack">
    <section class="panel">
      <div class="panel-header"><div><h2>Detail periode</h2><p>Status Aktif hanya tersedia setelah katalog indikator lengkap.</p></div><StatusBadge :status="period.status" /></div>
      <form class="panel-body form-stack" @submit.prevent="savePeriod">
        <div class="form-grid">
          <div class="field"><label for="edit-period-name">Nama</label><input id="edit-period-name" v-model.trim="name" class="control" required maxlength="160"></div>
          <div class="field"><label for="edit-period-status">Status</label><select id="edit-period-status" v-model="status" class="control"><option value="DRAFT">Draf</option><option value="ACTIVE">Aktif</option><option value="CLOSED">Ditutup</option></select></div>
          <div class="field"><label for="edit-period-start">Tanggal mulai</label><input id="edit-period-start" v-model="startsAt" class="control" type="date"></div>
          <div class="field"><label for="edit-period-end">Tanggal akhir</label><input id="edit-period-end" v-model="endsAt" class="control" type="date"></div>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit" :disabled="saving">Simpan perubahan</button><NuxtLink class="btn btn-secondary" :to="`/admin/periods/${periodId}/catalog`">Kelola katalog</NuxtLink></div>
      </form>
    </section>

    <section class="panel" aria-labelledby="targets-heading">
      <div class="panel-header"><div><h2 id="targets-heading">Nilai target per domain</h2><p>Acuan yang tampil di grafik unit. Tetap dapat diubah setelah penilaian berjalan.</p></div></div>
      <form v-if="catalogDomains.length" class="panel-body form-stack" novalidate @submit.prevent="saveTargets">
        <div class="target-grid">
          <div v-for="(domain, index) in catalogDomains" :key="domain.id" class="field">
            <label :for="`target-${domain.id}`">{{ index + 1 }}. {{ domain.name }} <span class="record-meta">· bobot {{ domain.weight }}%</span></label>
            <input
              :id="`target-${domain.id}`"
              v-model="targetInputs[domain.id]"
              class="control"
              type="text"
              inputmode="decimal"
              :placeholder="`0 sampai ${maxLevelOf(domain)}`"
              :aria-invalid="Boolean(targetErrors[domain.id])"
              :aria-describedby="`target-hint-${domain.id}`"
            >
            <p :id="`target-hint-${domain.id}`" class="field-hint" :class="{ 'is-error': targetErrors[domain.id] }">{{ targetErrors[domain.id] || 'Kosongkan bila belum ada target.' }}</p>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit" :disabled="saving || !targetsChanged || Object.values(targetErrors).some(Boolean)">Simpan target</button>
          <span class="field-hint">Target total tertimbang: <strong>{{ weightedTarget === null ? '-' : weightedTarget.toFixed(2).replace('.', ',') }}</strong></span>
        </div>
      </form>
      <p v-else class="panel-body field-hint">Susun katalog indikator terlebih dahulu, lalu tetapkan target per domain.</p>
    </section>

    <section class="panel">
      <div class="panel-header"><div><h2>Penugasan unit</h2><p>Pilih unit aktif yang dapat membuat penilaian pada periode ini.</p></div></div>
      <div class="panel-body form-stack">
        <NoticeBanner v-if="locked" tone="warning">Penugasan terkunci karena penilaian pertama sudah dibuat.</NoticeBanner>
        <div v-if="activeUnits.length" class="check-list-toolbar">
          <button class="btn btn-secondary btn-small" type="button" :disabled="locked" @click="toggleAllUnits">{{ allUnitsSelected ? 'Batalkan semua' : 'Pilih semua' }}</button>
          <span class="field-hint">{{ assignedIds.length }} dari {{ activeUnits.length }} unit dipilih</span>
        </div>
        <div class="check-list">
          <label v-for="unit in activeUnits" :key="unit.id" class="check-row"><input v-model="assignedIds" type="checkbox" :value="unit.id" :disabled="locked"><span>{{ unit.name }} · {{ unit.code }}</span></label>
          <p v-if="!(unitData?.units || []).some((item) => item.isActive)" class="field-hint">Tidak ada unit aktif. Tambahkan unit terlebih dahulu.</p>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="button" :disabled="saving || locked" @click="saveAssignments">Simpan penugasan</button><span v-if="locked" class="field-hint">{{ period._count.assessments }} penilaian telah dibuat.</span></div>
      </div>
    </section>
  </div>
  </template>
</template>
