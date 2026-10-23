<script setup lang="ts">
import type { ArchiveDocument } from '../../utils/archive'
import { getApiError } from '../../utils/format'

const { data, pending, error, refresh } = useFetch<{ documents: ArchiveDocument[] }>('/api/archive', { lazy: true })
const documents = computed((): ArchiveDocument[] => data.value?.documents ?? [])
const knownTypes = computed(() => [...new Set<string>(documents.value.map((item: ArchiveDocument) => item.type))].sort((a, b) => a.localeCompare(b, 'id')))

const editingId = ref('')
const type = ref('')
const title = ref('')
const year = ref<number | null>(new Date().getFullYear())
const url = ref('')
const saving = ref(false)
const deletingId = ref('')
const message = toastRef('success')
const pageError = toastRef('error')
const typeInput = ref<HTMLInputElement | null>(null)

function resetForm() {
  editingId.value = ''
  type.value = ''
  title.value = ''
  year.value = new Date().getFullYear()
  url.value = ''
}

// Editing reuses the form at the top, so focus moves there and the page scrolls to it.
function startEdit(item: ArchiveDocument) {
  editingId.value = item.id
  type.value = item.type
  title.value = item.title
  year.value = item.year
  url.value = item.url
  nextTick(() => {
    typeInput.value?.scrollIntoView({ block: 'center' })
    typeInput.value?.focus()
  })
}

async function save() {
  if (!type.value.trim() || !title.value.trim() || !year.value || !url.value.trim()) return
  saving.value = true
  message.value = ''
  pageError.value = ''
  const body = { type: type.value.trim(), title: title.value.trim(), year: Number(year.value), url: url.value.trim() }
  try {
    if (editingId.value) await $fetch(`/api/admin/archive/${editingId.value}`, { method: 'PUT', body })
    else await $fetch('/api/admin/archive', { method: 'POST', body })
    message.value = editingId.value ? 'Perubahan dokumen tersimpan.' : 'Dokumen ditambahkan dan langsung tampil bagi semua User.'
    resetForm()
    await refresh()
  } catch (requestError) {
    pageError.value = getApiError(requestError, 'Dokumen belum dapat disimpan.')
  } finally {
    saving.value = false
  }
}

async function remove(item: ArchiveDocument) {
  if (!window.confirm(`Hapus "${item.title}" dari arsip? User tidak akan melihatnya lagi.`)) return
  deletingId.value = item.id
  message.value = ''
  pageError.value = ''
  try {
    await $fetch(`/api/admin/archive/${item.id}`, { method: 'DELETE' })
    if (editingId.value === item.id) resetForm()
    message.value = 'Dokumen dihapus dari arsip.'
    await refresh()
  } catch (requestError) {
    pageError.value = getApiError(requestError, 'Dokumen belum dapat dihapus.')
  } finally {
    deletingId.value = ''
  }
}
</script>

<template>
  <PageHeading title="Dokumen arsip" subtitle="Bagikan tautan hasil penilaian dan laporan ke semua User. Dokumen dikelompokkan per jenis." />
  <div class="management-grid">
    <section class="panel" aria-labelledby="archive-form-heading">
      <div class="panel-header">
        <div>
          <h2 id="archive-form-heading">{{ editingId ? 'Ubah dokumen' : 'Tambah dokumen' }}</h2>
          <p>Pastikan tautan dapat dibuka oleh unit kerja.</p>
        </div>
      </div>
      <form class="panel-body form-stack" @submit.prevent="save">
        <div class="field">
          <label for="archive-type">Jenis dokumen</label>
          <input id="archive-type" ref="typeInput" v-model="type" class="control" list="archive-types" required minlength="2" maxlength="120" placeholder="Contoh: Hasil EPSS LAN" autocomplete="off" aria-describedby="archive-type-hint">
          <datalist id="archive-types"><option v-for="known in knownTypes" :key="known" :value="known" /></datalist>
          <p id="archive-type-hint" class="field-hint">Pilih jenis yang sudah ada agar dokumen masuk ke kelompok yang sama, atau ketik jenis baru.</p>
        </div>
        <div class="field">
          <label for="archive-title">Judul dokumen</label>
          <input id="archive-title" v-model="title" class="control" required minlength="3" maxlength="240" placeholder="Contoh: Hasil EPSS LAN 2024">
        </div>
        <div class="field archive-year-field">
          <label for="archive-year">Tahun</label>
          <input id="archive-year" v-model.number="year" class="control" type="number" required min="1990" max="2100" inputmode="numeric">
        </div>
        <div class="field">
          <label for="archive-url">Tautan dokumen</label>
          <input id="archive-url" v-model="url" class="control" type="url" required maxlength="2000" inputmode="url" placeholder="https://drive.google.com/...">
        </div>
        <div class="form-actions">
          <button class="btn btn-primary" type="submit" :disabled="saving">{{ saving ? 'Menyimpan...' : editingId ? 'Simpan perubahan' : 'Tambah dokumen' }}</button>
          <button v-if="editingId" class="btn btn-secondary" type="button" :disabled="saving" @click="resetForm">Batal ubah</button>
        </div>
      </form>
    </section>

    <div>
      <LoadingState v-if="pending && !data" label="Memuat dokumen arsip..." />
      <NoticeBanner v-else-if="error" tone="error" role="alert">
        {{ getApiError(error, 'Dokumen arsip belum dapat dimuat.') }}
        <button class="btn btn-secondary btn-small" type="button" @click="refresh()">Coba lagi</button>
      </NoticeBanner>
      <ArchiveList v-else-if="documents.length" :documents="documents">
        <template #actions="{ document: item }">
          <button class="btn btn-secondary btn-small" type="button" :aria-label="`Ubah ${item.title}`" @click="startEdit(item)">Ubah</button>
          <button class="btn btn-danger btn-small" type="button" :aria-label="`Hapus ${item.title}`" :disabled="deletingId === item.id" @click="remove(item)">Hapus</button>
        </template>
      </ArchiveList>
      <section v-else class="panel">
        <EmptyState title="Arsip masih kosong" message="Dokumen yang Anda tambahkan akan tampil di sini dan di menu Dokumen arsip milik User." />
      </section>
    </div>
  </div>
</template>
