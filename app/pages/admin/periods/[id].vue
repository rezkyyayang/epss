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
const message = ref('')
const pageError = ref('')
watch(period, (value: PeriodData | undefined) => {
  if (!value) return
  name.value = value.name
  startsAt.value = value.startsAt?.slice(0, 10) || ''
  endsAt.value = value.endsAt?.slice(0, 10) || ''
  status.value = value.status
  assignedIds.value = value.assignments.map((assignment: { unit: { id: string } }) => assignment.unit.id)
}, { immediate: true })
const locked = computed(() => Boolean(period.value?._count.assessments))
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
  <NoticeBanner v-if="pageError" tone="error" role="alert">{{ pageError }}</NoticeBanner>
  <NoticeBanner v-else-if="message" tone="success" aria-live="polite">{{ message }}</NoticeBanner>
  <div v-if="loading" class="panel loading-state" role="status">Memuat pengaturan periode...</div>
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

    <section class="panel">
      <div class="panel-header"><div><h2>Penugasan unit</h2><p>Pilih unit aktif yang dapat membuat penilaian pada periode ini.</p></div></div>
      <div class="panel-body form-stack">
        <NoticeBanner v-if="locked" tone="warning">Penugasan terkunci karena penilaian pertama sudah dibuat.</NoticeBanner>
        <div class="check-list">
          <label v-for="unit in (unitData?.units || []).filter((item) => item.isActive)" :key="unit.id" class="check-row"><input v-model="assignedIds" type="checkbox" :value="unit.id" :disabled="locked"><span>{{ unit.name }} · {{ unit.code }}</span></label>
          <p v-if="!(unitData?.units || []).some((item) => item.isActive)" class="field-hint">Tidak ada unit aktif. Tambahkan unit terlebih dahulu.</p>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="button" :disabled="saving || locked" @click="saveAssignments">Simpan penugasan</button><span v-if="locked" class="field-hint">{{ period._count.assessments }} penilaian telah dibuat.</span></div>
      </div>
    </section>
  </div>
  </template>
</template>
