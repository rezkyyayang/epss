<script setup lang="ts">
import { getApiError } from '../../utils/format'
const { data, pending, error, refresh } = useFetch<{ periods: Array<{ id: string; name: string; status: string; indicatorCount: number; catalogReady: boolean; _count: { assessments: number } }> }>('/api/admin/periods', { lazy: true })
</script>

<template>
  <PageHeading title="Katalog indikator" subtitle="Susun domain, indikator, bobot, tingkat kematangan, dan kewajiban bukti per periode." />
  <LoadingState v-if="pending" label="Memuat katalog..." />
  <NoticeBanner v-else-if="error" tone="error" role="alert">{{ getApiError(error, 'Daftar katalog belum dapat dimuat.') }} <button class="btn btn-secondary btn-small" type="button" @click="refresh()">Coba lagi</button></NoticeBanner>
  <section v-else-if="data?.periods.length" class="panel">
    <div class="panel-header"><div><h2>Pilih periode</h2><p>Katalog terkunci setelah penilaian pertama dibuat.</p></div></div>
    <div class="record-list">
      <div v-for="period in data.periods" :key="period.id" class="record-row">
        <div class="record-primary"><strong>{{ period.name }}</strong><span>{{ period.indicatorCount }} indikator · {{ period.catalogReady ? 'bobot dan level lengkap' : 'belum lengkap' }}</span></div>
        <StatusBadge :status="period.status" />
        <span class="record-meta">{{ period._count.assessments ? 'Terkunci' : 'Dapat disunting' }}</span>
        <div class="record-action"><NuxtLink class="btn btn-secondary btn-small" :to="`/admin/periods/${period.id}/catalog`">Buka katalog</NuxtLink></div>
      </div>
    </div>
  </section>
  <EmptyState v-else title="Buat periode terlebih dahulu" message="Katalog indikator disimpan dan dikelola pada satu periode penilaian." />
</template>
