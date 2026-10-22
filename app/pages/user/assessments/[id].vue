<script setup lang="ts">
import { getApiError, formatDate } from '../../../utils/format'
import { withFinalLevels } from '../../../utils/score'

interface EvidenceItem {
  id: string
  url: string
  createdAt: string
}
interface AssessmentResponse {
  id: string
  version: number
  maturityLevelId: string | null
  explanation: string
  indicator: {
    id: string
    code: string
    title: string
    criterion: string
    requiresEvidence: boolean
    weight: number
    position: number
    domain: { id: string; name: string; weight: number; position: number }
    maturityLevels: Array<{ id: string; level: number; criterion: string }>
  }
  evidence: EvidenceItem[]
  // Present only after Pusdatin sends the verification result.
  verification: { maturityLevelId: string; comment: string; updatedAt: string } | null
}
interface AssessmentDetail {
  id: string
  status: string
  activityName: string
  activityYear: number | null
  submittedAt: string | null
  verifiedAt: string | null
  updatedAt: string
  period: { name: string; startsAt: string | null; endsAt: string | null }
  unit: { name: string; code: string }
  responses: AssessmentResponse[]
}

const route = useRoute()
const assessmentId = String(route.params.id)
const { data, pending, error, refresh } = useFetch<{ assessment: AssessmentDetail; maxEvidenceLinks: number }>(`/api/user/assessments/${assessmentId}`, { lazy: true })
const selectedId = ref('')
const selectedLevel = ref<string | null>(null)
const explanation = ref('')
const evidenceUrl = ref('')
const saving = ref(false)
const addingLink = ref(false)
const submitting = ref(false)
const dirty = ref(false)
const initializing = ref(false)
const treeOpen = ref(false)
const mobile = ref(false)
const saveMessage = ref('')
const pageError = ref('')
const treeTrigger = ref<HTMLButtonElement | null>(null)

const assessment = computed((): AssessmentDetail | undefined => data.value?.assessment)
const responses = computed((): AssessmentResponse[] => assessment.value?.responses || [])
const current = computed((): AssessmentResponse | undefined => responses.value.find((item: AssessmentResponse) => item.id === selectedId.value))
const maxEvidenceLinks = computed(() => data.value?.maxEvidenceLinks || 0)
const editable = computed(() => assessment.value?.status === 'DRAFT')
const verified = computed(() => assessment.value?.status === 'VERIFIED')
const isComplete = (response: AssessmentResponse) => Boolean(response.maturityLevelId && response.explanation.trim()) && (!response.indicator.requiresEvidence || response.evidence.length > 0)
const completeCount = computed(() => responses.value.filter((response: AssessmentResponse) => isComplete(response)).length)
const incompleteCount = computed(() => responses.value.filter((response: AssessmentResponse) => !isComplete(response)).length)
const finalResponses = computed(() => withFinalLevels(responses.value))
const currentFinalLevel = computed(() => current.value?.indicator.maturityLevels.find((level: { id: string }) => level.id === current.value?.verification?.maturityLevelId))

const activityName = ref('')
const activityYear = ref<number | null>(null)
const savingActivity = ref(false)
const activitySaved = computed(() => Boolean(assessment.value?.activityName.trim() && assessment.value?.activityYear))
const activityDirty = computed(() => Boolean(assessment.value) && (activityName.value.trim() !== assessment.value?.activityName || activityYear.value !== assessment.value?.activityYear))

watch(assessment, (value: AssessmentDetail | undefined) => {
  if (!value) return
  if (!activityDirty.value || !activityName.value) {
    activityName.value = value.activityName
    activityYear.value = value.activityYear
  }
  if (selectedId.value) return
  const firstActionable = value.responses.find((response: AssessmentResponse) => !isComplete(response)) || value.responses[0]
  if (firstActionable) selectedId.value = firstActionable.id
}, { immediate: true })

async function saveActivity() {
  if (!activityName.value.trim() || !activityYear.value) return
  savingActivity.value = true
  pageError.value = ''
  try {
    await $fetch(`/api/user/assessments/${assessmentId}/activity`, {
      method: 'PUT',
      body: { activityName: activityName.value.trim(), activityYear: Number(activityYear.value) },
    })
    await refresh()
    saveMessage.value = 'Data kegiatan statistik tersimpan.'
  } catch (requestError) {
    pageError.value = getApiError(requestError, 'Data kegiatan belum tersimpan.')
  } finally {
    savingActivity.value = false
  }
}

watch([selectedLevel, explanation], () => {
  if (!initializing.value && current.value) {
    dirty.value = true
    saveMessage.value = ''
  }
})

watch(selectedId, async (id: string) => {
  const response = responses.value.find((item: AssessmentResponse) => item.id === id)
  if (!response) return
  initializing.value = true
  selectedLevel.value = response.maturityLevelId
  explanation.value = response.explanation
  evidenceUrl.value = ''
  dirty.value = false
  saveMessage.value = ''
  await nextTick()
  initializing.value = false
}, { immediate: true })

function updateResponse(updated: Partial<AssessmentResponse> & { id: string }) {
  const target = responses.value.find((item: AssessmentResponse) => item.id === updated.id)
  if (target) Object.assign(target, updated)
}

async function saveCurrent() {
  if (!current.value || !editable.value || !dirty.value) return true
  saving.value = true
  pageError.value = ''
  try {
    const result = await $fetch<{ response: { version: number; updatedAt: string } }>(`/api/user/responses/${current.value.id}`, {
      method: 'PUT',
      body: {
        maturityLevelId: selectedLevel.value,
        explanation: explanation.value,
        expectedVersion: current.value.version,
      },
    })
    updateResponse({ id: current.value.id, version: result.response.version })
    dirty.value = false
    saveMessage.value = 'Draf tersimpan.'
    await refresh()
    return true
  } catch (requestError) {
    pageError.value = getApiError(requestError, 'Jawaban belum tersimpan. Isian Anda tetap tersedia di halaman ini.')
    return false
  } finally {
    saving.value = false
  }
}

async function selectResponse(id: string) {
  if (id === selectedId.value) {
    treeOpen.value = false
    return
  }
  if (!(await saveCurrent())) return
  selectedId.value = id
  treeOpen.value = false
}

async function addEvidenceLink() {
  if (!current.value || !evidenceUrl.value.trim()) return
  // Adding a link bumps the response version, so unsaved answer edits go first.
  if (!(await saveCurrent())) return
  pageError.value = ''
  addingLink.value = true
  try {
    await $fetch(`/api/user/responses/${current.value.id}/evidence`, { method: 'POST', body: { url: evidenceUrl.value.trim() } })
    evidenceUrl.value = ''
    await refresh()
    saveMessage.value = 'Tautan bukti tersimpan.'
  } catch (requestError) {
    pageError.value = getApiError(requestError, 'Tautan bukti belum dapat disimpan. Coba lagi.')
  } finally {
    addingLink.value = false
  }
}

async function removeEvidence(evidence: EvidenceItem) {
  if (!current.value || !window.confirm(`Hapus tautan ${evidence.url}?`)) return
  if (!(await saveCurrent())) return
  pageError.value = ''
  try {
    await $fetch(`/api/user/evidence/${evidence.id}`, { method: 'DELETE' })
    await refresh()
    saveMessage.value = 'Bukti dihapus.'
  } catch (requestError) {
    pageError.value = getApiError(requestError, 'Bukti belum dapat dihapus.')
  }
}

async function submitAssessment() {
  if (!(await saveCurrent())) return
  if (!window.confirm('Kirim penilaian ke Pusdatin? Setelah dikirim, isian dan bukti tidak dapat diubah lagi.')) return
  pageError.value = ''
  submitting.value = true
  try {
    await $fetch(`/api/user/assessments/${assessmentId}/submit`, { method: 'POST' })
    await navigateTo('/user/dashboard')
  } catch (requestError) {
    pageError.value = getApiError(requestError, 'Penilaian belum dapat dikirim.')
    await refresh()
  } finally {
    submitting.value = false
  }
}

function updateViewport() {
  mobile.value = window.matchMedia('(max-width: 780px)').matches
}

function closeTree() {
  treeOpen.value = false
  nextTick(() => treeTrigger.value?.focus())
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && treeOpen.value) closeTree()
}

onMounted(() => {
  updateViewport()
  window.addEventListener('resize', updateViewport)
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewport)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <LoadingState v-if="pending" label="Memuat penilaian..." />
  <NoticeBanner v-else-if="error" tone="error" role="alert">
    {{ getApiError(error, 'Penilaian belum dapat dimuat.') }}
    <NuxtLink class="btn btn-secondary btn-small" to="/user/dashboard">Kembali ke dashboard</NuxtLink>
  </NoticeBanner>
  <template v-else-if="assessment">
    <PageHeading :title="assessment.period.name" :subtitle="`${assessment.unit.name} · ${assessment.unit.code}`">
      <template #actions>
        <StatusBadge :status="assessment.status" />
      </template>
    </PageHeading>

    <section class="panel assessment-summary">
      <div class="summary-progress">
        <div>
          <strong>Progres isian</strong>
          <span>{{ completeCount }} dari {{ responses.length }} indikator lengkap</span>
        </div>
        <AssessmentProgress :complete="completeCount" :total="responses.length" />
      </div>
      <ScoreSummary :responses="responses" label="Nilai mandiri" />
      <ScoreSummary v-if="verified" :responses="finalResponses" label="Nilai final (verifikasi Pusdatin)" />
      <div class="summary-context">
        <span>Terakhir diubah {{ formatDate(assessment.updatedAt) }}</span>
        <span v-if="assessment.submittedAt">Dikirim {{ formatDate(assessment.submittedAt) }}</span>
        <span v-if="assessment.verifiedAt">Diverifikasi {{ formatDate(assessment.verifiedAt) }}</span>
      </div>
    </section>

    <NoticeBanner v-if="pageError" tone="error" role="alert">{{ pageError }}</NoticeBanner>
    <NoticeBanner v-else-if="saveMessage" tone="success" aria-live="polite">{{ saveMessage }}</NoticeBanner>
    <NoticeBanner v-if="assessment.status === 'SUBMITTED' || assessment.status === 'IN_REVIEW'" tone="info">
      Penilaian sudah dikirim dan sedang menunggu verifikasi Pusdatin. Isian tidak dapat diubah lagi.
    </NoticeBanner>
    <NoticeBanner v-else-if="verified" tone="success">
      Verifikasi Pusdatin selesai. Level final dan komentar tampil pada tiap indikator.
    </NoticeBanner>

    <section class="panel" aria-labelledby="activity-heading">
      <div class="panel-header">
        <div>
          <h2 id="activity-heading">Kegiatan statistik</h2>
          <p>Satu kegiatan statistik yang dinilai unit Anda pada periode ini.</p>
        </div>
      </div>
      <form v-if="editable" class="panel-body activity-form" @submit.prevent="saveActivity">
        <div class="field activity-name">
          <label for="activity-name">Nama kegiatan</label>
          <input id="activity-name" v-model="activityName" class="control" required minlength="3" maxlength="240" placeholder="Contoh: Kompilasi Data Indeks Kualitas Kebijakan Nasional">
        </div>
        <div class="field activity-year">
          <label for="activity-year">Tahun</label>
          <input id="activity-year" v-model.number="activityYear" class="control" type="number" required min="2000" max="2100" inputmode="numeric">
        </div>
        <button class="btn btn-secondary" type="submit" :disabled="savingActivity || !activityDirty || !activityName.trim() || !activityYear">
          {{ savingActivity ? 'Menyimpan...' : 'Simpan kegiatan' }}
        </button>
      </form>
      <div v-else class="panel-body">
        <p class="activity-summary"><strong>{{ assessment.activityName || 'Belum diisi' }}</strong><span v-if="assessment.activityYear"> · {{ assessment.activityYear }}</span></p>
      </div>
    </section>

    <div class="assessment-layout">
      <button class="drawer-scrim" :class="{ 'is-open': treeOpen }" aria-label="Tutup daftar indikator" :aria-hidden="!treeOpen" tabindex="-1" @click="closeTree" />
      <AssessmentTree
        :responses="responses"
        :selected-id="selectedId"
        :open="treeOpen"
        :inert="mobile && !treeOpen"
        @select="selectResponse"
        @close="closeTree"
      />

      <section v-if="current" class="panel indicator-panel" aria-labelledby="indicator-heading">
        <div class="panel-body form-stack">
          <button ref="treeTrigger" class="btn btn-secondary btn-small review-tree-button" type="button" :aria-expanded="treeOpen" aria-controls="indicator-tree" @click="treeOpen = true">
            Daftar indikator
          </button>
          <div class="indicator-context">
            <span>{{ current.indicator.domain.name }} (bobot {{ current.indicator.domain.weight }}%)</span>
            <span aria-hidden="true">/</span>
            <span>Bobot indikator {{ current.indicator.weight }}%</span>
            <span aria-hidden="true">/</span>
            <span>{{ assessment.period.name }}</span>
          </div>
          <div class="indicator-path">
            <span class="indicator-number">{{ current.indicator.code }}</span>
            <h2 id="indicator-heading" class="indicator-title">{{ current.indicator.title }}</h2>
          </div>
          <div v-if="current.indicator.criterion" class="criteria-block">
            <h3>Kriteria indikator</h3>
            <p>{{ current.indicator.criterion }}</p>
          </div>

          <div v-if="current.verification" class="review-feedback">
            <h3>Hasil verifikasi Pusdatin</h3>
            <p><strong>Level final {{ currentFinalLevel?.level ?? '-' }} dari {{ current.indicator.maturityLevels.length }}</strong><span v-if="currentFinalLevel">: {{ currentFinalLevel.criterion }}</span></p>
            <p v-if="current.verification.comment">{{ current.verification.comment }}</p>
          </div>

          <MaturityPicker
            v-model="selectedLevel"
            :name="`level-${current.id}`"
            :levels="current.indicator.maturityLevels"
            :disabled="!editable"
          />

          <div class="field">
            <label :for="`explanation-${current.id}`">Penjelasan</label>
            <textarea
              :id="`explanation-${current.id}`"
              v-model="explanation"
              class="control"
              maxlength="12000"
              :disabled="!editable"
              placeholder="Jelaskan kondisi yang mendukung tingkat kematangan yang dipilih."
            />
            <p class="field-hint">{{ explanation.length }} dari 12.000 karakter</p>
          </div>

          <section class="form-stack" aria-labelledby="evidence-heading">
            <div>
              <h3 id="evidence-heading" class="section-title">Bukti dukung</h3>
              <p class="section-note">
                {{ current.indicator.requiresEvidence ? 'Bukti wajib untuk indikator ini.' : 'Bukti bersifat opsional untuk indikator ini.' }}
              </p>
            </div>
            <div v-if="current.evidence.length" class="evidence-list">
              <div v-for="link in current.evidence" :key="link.id" class="evidence-row">
                <a class="evidence-name evidence-link" :href="link.url" target="_blank" rel="noopener noreferrer">{{ link.url }}</a>
                <span class="evidence-meta">{{ formatDate(link.createdAt) }}</span>
                <button v-if="editable" class="btn btn-danger btn-small" type="button" @click="removeEvidence(link)">Hapus</button>
              </div>
            </div>
            <p v-else class="field-hint">Belum ada tautan bukti.</p>
            <form v-if="editable" class="evidence-form" @submit.prevent="addEvidenceLink">
              <div class="field">
                <label :for="`evidence-${current.id}`">Tambah tautan bukti</label>
                <input
                  :id="`evidence-${current.id}`"
                  v-model="evidenceUrl"
                  class="control"
                  type="url"
                  inputmode="url"
                  maxlength="2000"
                  placeholder="https://drive.google.com/..."
                  :disabled="addingLink || current.evidence.length >= maxEvidenceLinks"
                  :aria-describedby="`evidence-hint-${current.id}`"
                >
              </div>
              <button class="btn btn-secondary" type="submit" :disabled="addingLink || !evidenceUrl.trim() || current.evidence.length >= maxEvidenceLinks">
                {{ addingLink ? 'Menyimpan...' : 'Tambah tautan' }}
              </button>
              <p :id="`evidence-hint-${current.id}`" class="field-hint">
                Tempel tautan dokumen, misalnya Google Drive atau OneDrive. Pastikan Admin pemeriksa punya akses untuk membukanya. Maksimum {{ maxEvidenceLinks }} tautan per indikator.
              </p>
            </form>
            <p v-else class="field-hint">Bukti hanya dapat diubah selama penilaian masih draf.</p>
          </section>

          <div class="indicator-actions">
            <button class="btn btn-secondary" type="button" :disabled="saving || !editable || !dirty" @click="saveCurrent">
              {{ saving ? 'Menyimpan...' : 'Simpan draf' }}
            </button>
            <button
              v-if="editable"
              class="btn btn-primary"
              type="button"
              :disabled="submitting || saving || addingLink || incompleteCount > 0 || !activitySaved"
              @click="submitAssessment"
            >
              {{ submitting ? 'Mengirim...' : 'Kirim penilaian' }}
            </button>
            <span v-if="editable && incompleteCount" class="field-hint">{{ incompleteCount }} indikator belum lengkap.</span>
            <span v-else-if="editable && !activitySaved" class="field-hint">Simpan nama dan tahun kegiatan statistik sebelum mengirim.</span>
          </div>
        </div>
      </section>
    </div>
  </template>
</template>
