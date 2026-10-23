<script setup lang="ts">
import type { ArchiveDocument } from '../../utils/archive'
import { getApiError } from '../../utils/format'

const { data, pending, error, refresh } = useFetch<{ documents: ArchiveDocument[] }>('/api/archive', { lazy: true })
</script>

<template>
  <PageHeading title="Dokumen arsip" subtitle="Hasil penilaian dan laporan terdahulu yang dibagikan Pusdatin, dikelompokkan per jenis." />
  <LoadingState v-if="pending && !data" label="Memuat dokumen arsip..." />
  <NoticeBanner v-else-if="error" tone="error" role="alert">
    {{ getApiError(error, 'Dokumen arsip belum dapat dimuat.') }}
    <button class="btn btn-secondary btn-small" type="button" @click="refresh()">Coba lagi</button>
  </NoticeBanner>
  <ArchiveList v-else-if="data?.documents.length" :documents="data.documents" />
  <section v-else class="panel">
    <EmptyState title="Belum ada dokumen arsip" message="Dokumen yang dibagikan Pusdatin akan tampil di sini." />
  </section>
</template>
