<script setup lang="ts">
import { formatDate, getApiError } from '../../utils/format'

interface DashboardResult {
  queue: Array<{ id: string; status: string; updatedAt: string; submittedAt: string | null; period: { name: string }; unit: { name: string } }>
  counts: Record<string, number>
  hasUnitAccess: boolean
}

const { data, pending, error, refresh } = useFetch<DashboardResult>('/api/admin/dashboard', { lazy: true })
const total = computed(() => Object.values(data.value?.counts || {}).reduce((sum, value) => sum + value, 0))
const waiting = computed(() => (data.value?.counts.SUBMITTED || 0) + (data.value?.counts.RESUBMITTED || 0) + (data.value?.counts.IN_REVIEW || 0))
</script>

<template>
  <PageHeading title="Dashboard Admin" subtitle="Pantau pemeriksaan, periode, dan penilaian yang dikelola di SectOra." />
  <LoadingState v-if="pending" label="Memuat ringkasan..." />
  <NoticeBanner v-else-if="error" tone="error" role="alert">
    {{ getApiError(error, 'Ringkasan belum dapat dimuat.') }}
    <button class="btn btn-secondary btn-small" type="button" @click="refresh()">Coba lagi</button>
  </NoticeBanner>
  <div v-else class="section-stack">
    <NoticeBanner v-if="!data?.hasUnitAccess" tone="info">Akun ini belum ditugaskan ke unit. Buka Pengguna dan unit untuk menetapkan cakupan pemeriksaan.</NoticeBanner>
    <section class="stats-grid" aria-label="Ringkasan penilaian">
      <article class="panel stat-card"><span>Total penilaian</span><strong>{{ total }}</strong><span>Seluruh status</span></article>
      <article class="panel stat-card"><span>Dalam pemeriksaan</span><strong>{{ waiting }}</strong><span>Menunggu atau sedang diperiksa</span></article>
      <article class="panel stat-card"><span>Perlu revisi</span><strong>{{ data?.counts.REVISION_REQUIRED || 0 }}</strong><span>Menunggu perbaikan dari User</span></article>
      <article class="panel stat-card"><span>Disetujui</span><strong>{{ data?.counts.APPROVED || 0 }}</strong><span>Pemeriksaan selesai</span></article>
    </section>

    <section class="panel" aria-labelledby="recent-queue-heading">
      <div class="panel-header">
        <div><h2 id="recent-queue-heading">Pemeriksaan terbaru</h2><p>Daftar ini menampilkan penilaian yang dikirim atau sedang diperiksa.</p></div>
        <NuxtLink class="btn btn-secondary btn-small" to="/admin/queue">Buka antrean</NuxtLink>
      </div>
      <div v-if="data?.queue.length" class="record-list">
        <div v-for="item in data.queue" :key="item.id" class="record-row">
          <div class="record-primary"><strong>{{ item.period.name }}</strong><span>{{ item.unit.name }}</span></div>
          <span class="record-meta">Dikirim {{ formatDate(item.submittedAt) }}</span>
          <StatusBadge :status="item.status" />
          <div class="record-action"><NuxtLink class="btn btn-secondary btn-small" :to="`/admin/assessments/${item.id}`">Periksa</NuxtLink></div>
        </div>
      </div>
      <EmptyState v-else-if="data?.hasUnitAccess" title="Antrean masih kosong" message="Penilaian yang dikirim akan muncul di sini untuk diperiksa." />
    </section>

    <section class="panel panel-body admin-shortcuts">
      <div><h2 class="section-title">Pengaturan</h2><p class="section-note">Siapkan periode, katalog indikator berbobot, akun, dan unit.</p></div>
      <nav aria-label="Pengaturan Admin">
        <NuxtLink class="btn btn-secondary" to="/admin/periods">Kelola periode</NuxtLink>
        <NuxtLink class="btn btn-secondary" to="/admin/indicators">Kelola katalog</NuxtLink>
        <NuxtLink class="btn btn-secondary" to="/admin/users">Pengguna dan unit</NuxtLink>      </nav>
    </section>
  </div>
</template>
