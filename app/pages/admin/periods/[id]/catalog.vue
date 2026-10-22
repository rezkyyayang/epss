<script setup lang="ts">
import { getApiError } from '../../../../utils/format'
import { buildStandardCatalog } from '../../../../utils/standardCatalog'

interface Level { level: number; criterion: string }
interface Indicator { code: string; title: string; criterion: string; weight: number; requiresEvidence: boolean; maturityLevels: Level[] }
interface Domain { code: string; name: string; weight: number; indicators: Indicator[] }
const minLevels = 2
const maxLevels = 5
const route = useRoute()
const periodId = String(route.params.id)
const { data, pending, error, refresh } = await useFetch<{ period: { id: string; name: string; status: string }; domains: Domain[]; locked: boolean }>(`/api/admin/periods/${periodId}/catalog`)
const domains = ref<Domain[]>([])
const saving = ref(false)
const pageError = ref('')
const message = ref('')
watch(() => data.value?.domains, (value: Domain[] | undefined) => {
  if (!value) return
  domains.value = value.map(({ code, name, weight, indicators }) => ({
    code, name, weight,
    indicators: indicators.map(({ code: indicatorCode, title, criterion, weight: indicatorWeight, requiresEvidence, maturityLevels }) => ({
      code: indicatorCode, title, criterion, weight: indicatorWeight, requiresEvidence,
      maturityLevels: maturityLevels.map(({ level, criterion: levelCriterion }) => ({ level, criterion: levelCriterion })),
    })),
  }))
}, { immediate: true })
const locked = computed(() => Boolean(data.value?.locked))
const sum = (items: Array<{ weight: number }>) => items.reduce((total, { weight }) => total + (Number(weight) || 0), 0)
const domainTotal = computed(() => sum(domains.value))
const validWeight = (value: number) => Number.isInteger(value) && value >= 1 && value <= 100
const valid = computed(() => domains.value.length > 0 && domainTotal.value === 100 && domains.value.every((domain: Domain) => domain.code.trim() && domain.name.trim() && validWeight(domain.weight) && domain.indicators.length > 0 && sum(domain.indicators) === 100 && domain.indicators.every((indicator: Indicator) => indicator.code.trim() && indicator.title.trim() && validWeight(indicator.weight) && indicator.maturityLevels.length >= minLevels && indicator.maturityLevels.every((level: Level) => level.criterion.trim()))))

function newIndicator(): Indicator {
  return { code: '', title: '', criterion: '', weight: 0, requiresEvidence: false, maturityLevels: Array.from({ length: 3 }, (_, index) => ({ level: index + 1, criterion: '' })) }
}
function addDomain() { domains.value.push({ code: '', name: '', weight: 0, indicators: [] }) }
function addIndicator(domainIndex: number) { domains.value[domainIndex].indicators.push(newIndicator()) }
function removeDomain(index: number) { domains.value.splice(index, 1) }
function removeIndicator(domainIndex: number, indicatorIndex: number) { domains.value[domainIndex].indicators.splice(indicatorIndex, 1) }
function addLevel(indicator: Indicator) { indicator.maturityLevels.push({ level: indicator.maturityLevels.length + 1, criterion: '' }) }
function removeLastLevel(indicator: Indicator) { indicator.maturityLevels.pop() }
function loadStandardCatalog() {
  if (domains.value.length && !window.confirm('Ganti isi formulir dengan katalog standar? Perubahan yang belum disimpan akan hilang.')) return
  domains.value = buildStandardCatalog()
  pageError.value = ''
  message.value = 'Katalog standar dimuat ke formulir. Periksa isinya, lalu simpan katalog.'
}
async function saveCatalog() {
  if (!valid.value) return
  saving.value = true; pageError.value = ''; message.value = ''
  try {
    await $fetch(`/api/admin/periods/${periodId}/catalog`, { method: 'PUT', body: { domains: domains.value } })
    message.value = 'Katalog tersimpan.'; await refresh()
  } catch (requestError) { pageError.value = getApiError(requestError, 'Katalog belum dapat disimpan.') }
  finally { saving.value = false }
}
</script>

<template>
  <PageHeading :title="data?.period.name || 'Katalog indikator'" subtitle="Susun domain, indikator, bobot, dan kriteria tiap tingkat kematangan untuk periode ini.">
    <template #actions><NuxtLink class="btn btn-secondary btn-small" :to="`/admin/periods/${periodId}`">Pengaturan periode</NuxtLink></template>
  </PageHeading>
  <div v-if="pending" class="panel loading-state" role="status">Memuat katalog...</div>
  <NoticeBanner v-else-if="error" tone="error" role="alert">{{ getApiError(error, 'Katalog belum dapat dimuat.') }} <button class="btn btn-secondary btn-small" type="button" @click="refresh()">Coba lagi</button></NoticeBanner>
  <div v-else class="section-stack">
    <NoticeBanner v-if="locked" tone="warning">Katalog terkunci setelah penilaian pertama dibuat. Struktur, bobot, dan kriteria tidak dapat diubah.</NoticeBanner>
    <NoticeBanner v-if="pageError" tone="error" role="alert">{{ pageError }}</NoticeBanner>
    <NoticeBanner v-else-if="message" tone="success" aria-live="polite">{{ message }}</NoticeBanner>
    <NoticeBanner v-if="data?.period.status === 'ACTIVE'" tone="info">Periode aktif. User dapat memulai penilaian pada unit yang ditugaskan.</NoticeBanner>
    <section class="panel panel-body form-stack">
      <div class="nested-toolbar">
        <div>
          <h2 class="section-title">Struktur katalog</h2>
          <p class="section-note">Bobot ditulis dalam persen. Total bobot domain harus 100%, begitu juga total bobot indikator di setiap domain.</p>
        </div>
        <div class="toolbar-actions">
          <button class="btn btn-secondary btn-small" type="button" :disabled="locked" @click="loadStandardCatalog">Isi katalog standar (5 domain)</button>
          <button class="btn btn-secondary btn-small" type="button" :disabled="locked" @click="addDomain">Tambah domain</button>
        </div>
      </div>
      <p v-if="domains.length" class="weight-total" :class="{ 'is-off': domainTotal !== 100 }" aria-live="polite">Total bobot domain: {{ domainTotal }}%{{ domainTotal === 100 ? '' : ' (harus 100%)' }}</p>
      <EmptyState v-if="!domains.length" title="Katalog belum memiliki domain" message="Isi katalog standar atau tambahkan domain sendiri, lalu susun indikatornya." />
      <div v-for="(domain, domainIndex) in domains" :key="domainIndex" class="nested-block">
        <div class="nested-toolbar"><h3>Domain {{ domainIndex + 1 }}</h3><button class="btn btn-danger btn-small" type="button" :disabled="locked" @click="removeDomain(domainIndex)">Hapus domain</button></div>
        <div class="form-grid form-grid-weighted">
          <div class="field"><label :for="`domain-code-${domainIndex}`">Kode domain</label><input :id="`domain-code-${domainIndex}`" v-model.trim="domain.code" class="control" :disabled="locked" maxlength="32"></div>
          <div class="field"><label :for="`domain-name-${domainIndex}`">Nama domain</label><input :id="`domain-name-${domainIndex}`" v-model.trim="domain.name" class="control" :disabled="locked" maxlength="160"></div>
          <div class="field"><label :for="`domain-weight-${domainIndex}`">Bobot domain (%)</label><input :id="`domain-weight-${domainIndex}`" v-model.number="domain.weight" class="control" type="number" min="1" max="100" step="1" inputmode="numeric" :disabled="locked"></div>
        </div>
        <div class="nested-toolbar">
          <div><h4>Indikator</h4><p class="weight-total" :class="{ 'is-off': sum(domain.indicators) !== 100 }">Total bobot indikator: {{ sum(domain.indicators) }}%{{ sum(domain.indicators) === 100 ? '' : ' (harus 100%)' }}</p></div>
          <button class="btn btn-secondary btn-small" type="button" :disabled="locked" @click="addIndicator(domainIndex)">Tambah indikator</button>
        </div>
        <article v-for="(indicator, indicatorIndex) in domain.indicators" :key="indicatorIndex" class="indicator-editor">
          <div class="nested-toolbar"><h4>Indikator {{ domainIndex + 1 }}.{{ indicatorIndex + 1 }}</h4><button class="btn btn-danger btn-small" type="button" :disabled="locked" @click="removeIndicator(domainIndex, indicatorIndex)">Hapus indikator</button></div>
          <div class="form-grid form-grid-weighted">
            <div class="field"><label :for="`indicator-code-${domainIndex}-${indicatorIndex}`">Kode indikator</label><input :id="`indicator-code-${domainIndex}-${indicatorIndex}`" v-model.trim="indicator.code" class="control" :disabled="locked" maxlength="32"></div>
            <div class="field"><label :for="`indicator-title-${domainIndex}-${indicatorIndex}`">Nama indikator</label><input :id="`indicator-title-${domainIndex}-${indicatorIndex}`" v-model.trim="indicator.title" class="control" :disabled="locked" maxlength="240"></div>
            <div class="field"><label :for="`indicator-weight-${domainIndex}-${indicatorIndex}`">Bobot indikator (%)</label><input :id="`indicator-weight-${domainIndex}-${indicatorIndex}`" v-model.number="indicator.weight" class="control" type="number" min="1" max="100" step="1" inputmode="numeric" :disabled="locked"></div>
          </div>
          <div class="field"><label :for="`indicator-criterion-${domainIndex}-${indicatorIndex}`">Keterangan indikator (opsional)</label><textarea :id="`indicator-criterion-${domainIndex}-${indicatorIndex}`" v-model.trim="indicator.criterion" class="control" :disabled="locked" maxlength="3000" /></div>
          <label class="check-row"><input v-model="indicator.requiresEvidence" type="checkbox" :disabled="locked"><span>Tautan bukti dukung wajib</span></label>
          <div class="level-editor">
            <h4>Tingkat kematangan</h4>
            <div v-for="level in indicator.maturityLevels" :key="level.level" class="level-row">
              <strong>Level {{ level.level }}</strong>
              <div class="field level-criterion"><label :for="`level-criterion-${domainIndex}-${indicatorIndex}-${level.level}`">Kriteria Level {{ level.level }}</label><textarea :id="`level-criterion-${domainIndex}-${indicatorIndex}-${level.level}`" v-model.trim="level.criterion" class="control" :disabled="locked" maxlength="3000" /></div>
            </div>
            <div class="toolbar-actions">
              <button class="btn btn-secondary btn-small" type="button" :disabled="locked || indicator.maturityLevels.length >= maxLevels" @click="addLevel(indicator)">Tambah level</button>
              <button class="btn btn-secondary btn-small" type="button" :disabled="locked || indicator.maturityLevels.length <= minLevels" @click="removeLastLevel(indicator)">Hapus Level {{ indicator.maturityLevels.length }}</button>
            </div>
          </div>
        </article>
      </div>
      <div class="form-actions"><button class="btn btn-primary" type="button" :disabled="saving || locked || !valid" @click="saveCatalog">{{ saving ? 'Menyimpan...' : 'Simpan katalog' }}</button><span v-if="!valid && !locked" class="field-hint">Lengkapi kode, nama, bobot (total 100%), dan kriteria setiap level sebelum menyimpan.</span></div>
    </section>
  </div>
</template>
