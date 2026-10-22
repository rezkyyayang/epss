<script setup lang="ts">
import { formatDate, getApiError } from '../../utils/format'

interface PeriodRow {
  id: string; name: string; status: string; startsAt: string | null; endsAt: string | null
  _count: { domains: number; assessments: number }; indicatorCount: number; catalogReady: boolean
  assignments: Array<{ unit: { id: string; name: string; code: string } }>
}
const { data, pending, error, refresh } = useFetch<{ periods: PeriodRow[] }>('/api/admin/periods', { lazy: true })
const route = useRoute()
const name = ref('')
const startsAt = ref('')
const endsAt = ref('')
const creating = ref(false)
const pageError = toastRef('error')
const success = toastRef('success')

function asDate(value: string) { return value ? new Date(`${value}T00:00:00.000Z`).toISOString() : null }
async function createPeriod() {
  creating.value = true; pageError.value = ''; success.value = ''
  try {
    await $fetch('/api/admin/periods', { method: 'POST', body: { name: name.value, startsAt: asDate(startsAt.value), endsAt: asDate(endsAt.value), status: 'DRAFT' } })
    name.value = ''; startsAt.value = ''; endsAt.value = ''; success.value = 'Periode dibuat sebagai draf.'
    await refresh()
  } catch (error) { pageError.value = getApiError(error, 'Periode belum dapat dibuat.') }
  finally { creating.value = false }
}
</script>

<template>
  <NuxtPage v-if="route.params.id" />
  <template v-else>
  <PageHeading title="Periode penilaian" subtitle="Atur rentang waktu, katalog indikator, dan penugasan unit untuk setiap periode." />
  <div class="section-stack">
    <section class="panel" aria-labelledby="new-period-heading">
      <div class="panel-header"><div><h2 id="new-period-heading">Buat periode</h2><p>Periode baru dimulai dalam status draf.</p></div></div>
      <form class="panel-body form-stack" @submit.prevent="createPeriod">
        <div class="form-grid">
          <div class="field"><label for="period-name">Nama periode</label><input id="period-name" v-model.trim="name" class="control" required maxlength="160"></div>
          <div class="field"><label for="period-start">Tanggal mulai</label><input id="period-start" v-model="startsAt" class="control" type="date"></div>
          <div class="field"><label for="period-end">Tanggal akhir</label><input id="period-end" v-model="endsAt" class="control" type="date"></div>
        </div>
        <div class="form-actions"><button class="btn btn-primary" type="submit" :disabled="creating">{{ creating ? 'Menyimpan...' : 'Buat draf periode' }}</button></div>
      </form>
    </section>

    <section class="panel" aria-labelledby="period-list-heading">
      <div class="panel-header"><div><h2 id="period-list-heading">Periode terdaftar</h2><p>Penugasan dan katalog terkunci saat penilaian pertama dibuat.</p></div></div>
      <LoadingState v-if="pending && !data" label="Memuat periode..." inset />
      <NoticeBanner v-else-if="error" class="panel-body" tone="error" role="alert">{{ getApiError(error, 'Daftar periode belum dapat dimuat.') }} <button class="btn btn-secondary btn-small" type="button" @click="refresh()">Coba lagi</button></NoticeBanner>
      <div v-else-if="data?.periods.length" class="record-list">
        <article v-for="period in data.periods" :key="period.id" class="period-row">
          <div class="record-primary"><strong>{{ period.name }}</strong><span>{{ formatDate(period.startsAt) }} – {{ formatDate(period.endsAt) }}</span><span>{{ period.assignments.length }} unit ditugaskan · {{ period.indicatorCount }} indikator</span></div>
          <StatusBadge :status="period.status" />
          <span class="record-meta">{{ period.catalogReady ? 'Katalog siap' : 'Katalog belum lengkap' }}</span>
          <div class="record-action period-actions"><NuxtLink class="btn btn-secondary btn-small" :to="`/admin/periods/${period.id}`">Pengaturan</NuxtLink><NuxtLink class="btn btn-secondary btn-small" :to="`/admin/periods/${period.id}/catalog`">Katalog</NuxtLink></div>
        </article>
      </div>
      <EmptyState v-else title="Belum ada periode" message="Buat periode untuk mulai menyiapkan katalog dan penugasan." />
    </section>
  </div>
  </template>
</template>
