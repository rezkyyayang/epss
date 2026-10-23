<script setup lang="ts">
import { formatDate, getApiError } from '../../../utils/format'
import { levelName } from '../../../utils/level'
import { withFinalLevels } from '../../../utils/score'

interface ReviewResponse {
  id: string; explanation: string; maturityLevelId: string | null
  maturityLevel: { level: number; title: string; criterion: string } | null
  indicator: { code: string; title: string; criterion: string; requiresEvidence: boolean; weight: number; position: number; domain: { id: string; name: string; weight: number; position: number }; maturityLevels: Array<{ id: string; level: number; title: string; criterion: string; evidenceGuide: string }> }
  evidence: Array<{ id: string; url: string; createdAt: string }>
  verification: { maturityLevelId: string; comment: string; updatedAt: string; verifier: { displayName: string } } | null
}
interface Detail {
  id: string; status: string; activityName: string; activityYear: number | null; submittedAt: string | null; verifiedAt: string | null; updatedAt: string
  period: { name: string }; unit: { id: string; name: string; code: string }; createdBy: { displayName: string; email: string }
  responses: ReviewResponse[]
  statusEvents: Array<{ fromStatus: string | null; toStatus: string; reason: string | null; createdAt: string; actor: { displayName: string } | null }>
}
const statusLabels: Record<string, string> = { DRAFT: 'Draf', SUBMITTED: 'Menunggu verifikasi', IN_REVIEW: 'Dalam verifikasi', VERIFIED: 'Terverifikasi' }

const route = useRoute()
const id = String(route.params.id)
const { data, pending, error, refresh } = useFetch<{ assessment: Detail }>(`/api/admin/assessments/${id}`, { lazy: true })
const assessment = computed((): Detail | undefined => data.value?.assessment)
const busyResponse = ref('')
const sending = ref(false)
const pageError = toastRef('error')
const success = toastRef('success')
// Form state per indicator, prefilled from a saved verification or else the unit's own level.
const levels = reactive<Record<string, string>>({})
const comments = reactive<Record<string, string>>({})

const canVerify = computed(() => assessment.value?.status === 'SUBMITTED' || assessment.value?.status === 'IN_REVIEW')
const verifiedCount = computed(() => assessment.value?.responses.filter((response: ReviewResponse) => response.verification).length || 0)
const totalCount = computed(() => assessment.value?.responses.length || 0)
const finalResponses = computed(() => withFinalLevels(assessment.value?.responses || []))

watch(assessment, (value: Detail | undefined) => {
  for (const response of value?.responses || []) {
    levels[response.id] = response.verification?.maturityLevelId || levels[response.id] || response.maturityLevelId || ''
    if (comments[response.id] === undefined || response.verification) comments[response.id] = response.verification?.comment || comments[response.id] || ''
  }
}, { immediate: true })

function finalLevel(response: ReviewResponse) {
  return response.indicator.maturityLevels.find((level: { id: string; level: number }) => level.id === response.verification?.maturityLevelId)?.level ?? '-'
}

function isChanged(response: ReviewResponse) {
  if (!response.verification) return true
  return levels[response.id] !== response.verification.maturityLevelId || (comments[response.id] || '').trim() !== response.verification.comment
}

// The saved result is written into the page instead of reloading it, so the reviewer keeps their place;
// the toast confirms it wherever they are scrolled.
const auth = useAuth()
async function saveVerification(response: ReviewResponse) {
  busyResponse.value = response.id; pageError.value = ''; success.value = ''
  try {
    const result = await $fetch<{ verification: { maturityLevelId: string; comment: string; updatedAt: string }; assessmentStatus: string }>(`/api/admin/responses/${response.id}/verification`, { method: 'PUT', body: { maturityLevelId: levels[response.id], comment: comments[response.id] || '' } })
    response.verification = { ...result.verification, verifier: { displayName: auth.user.value?.displayName || 'Admin' } }
    comments[response.id] = result.verification.comment
    if (assessment.value) assessment.value.status = result.assessmentStatus
    success.value = `Verifikasi ${response.indicator.code} tersimpan.`
  } catch (requestError) { pageError.value = getApiError(requestError, 'Verifikasi belum dapat disimpan.') }
  finally { busyResponse.value = '' }
}

async function sendVerification() {
  if (!window.confirm('Kirim hasil verifikasi ke unit kerja? Setelah dikirim, level final dan komentar tidak dapat diubah.')) return
  sending.value = true; pageError.value = ''; success.value = ''
  try {
    await $fetch(`/api/admin/assessments/${id}/verify`, { method: 'POST' })
    success.value = 'Hasil verifikasi terkirim. Unit kerja sekarang melihat nilai final.'
    await refresh()
  } catch (requestError) { pageError.value = getApiError(requestError, 'Hasil verifikasi belum dapat dikirim.') }
  finally { sending.value = false }
}
</script>

<template>
  <LoadingState v-if="pending && !data" label="Memuat penilaian..." />
  <NoticeBanner v-else-if="error" tone="error" role="alert">{{ getApiError(error, 'Penilaian belum dapat dimuat.') }} <NuxtLink class="btn btn-secondary btn-small" to="/admin/queue">Kembali ke antrean</NuxtLink></NoticeBanner>
  <div v-else-if="assessment" class="section-stack">
    <PageHeading :title="assessment.activityName || assessment.period.name" :subtitle="`${assessment.unit.name} · ${assessment.unit.code}${assessment.activityYear ? ` · ${assessment.activityYear}` : ''} · ${assessment.period.name}`">
      <template #actions><StatusBadge :status="assessment.status" /></template>
    </PageHeading>
    <NoticeBanner v-if="assessment.status === 'DRAFT'" tone="info">Unit kerja belum mengirim penilaian ini. Verifikasi dapat dimulai setelah dikirim.</NoticeBanner>
    <NoticeBanner v-else-if="canVerify" tone="info">Tetapkan level final dan komentar untuk tiap indikator, lalu kirim hasil verifikasi di bagian bawah halaman.</NoticeBanner>
    <NoticeBanner v-else-if="assessment.status === 'VERIFIED'" tone="success">Hasil verifikasi sudah dikirim {{ formatDate(assessment.verifiedAt) }}. Level final terkunci.</NoticeBanner>

    <section class="panel assessment-summary">
      <div class="summary-progress"><div><strong>Indikator terverifikasi</strong><span>{{ verifiedCount }} dari {{ totalCount }} indikator</span></div><AssessmentProgress :complete="verifiedCount" :total="totalCount" label="Indikator terverifikasi" /></div>
      <ScoreSummary :responses="assessment.responses" label="Nilai mandiri (unit kerja)" />
      <ScoreSummary :responses="finalResponses" :label="assessment.status === 'VERIFIED' ? 'Nilai final' : 'Nilai final (sementara)'" />
      <div class="summary-context"><span>Pengisi: {{ assessment.createdBy.displayName }} ({{ assessment.createdBy.email }})</span><span>Dikirim {{ formatDate(assessment.submittedAt) }}</span></div>
    </section>

    <section class="panel">
      <div class="panel-header"><div><h2>Verifikasi per indikator</h2><p>Bandingkan isian unit kerja dengan bukti dukung, lalu tetapkan level final.</p></div></div>
      <div class="review-responses">
        <article v-for="response in assessment.responses" :key="response.id" class="review-response">
          <div class="review-response-heading">
            <div><span class="indicator-number">{{ response.indicator.code }}</span><h3>{{ response.indicator.title }}</h3><IndicatorGuide :code="response.indicator.code" :title="response.indicator.title" :definition="response.indicator.criterion" :levels="response.indicator.maturityLevels" /></div>
            <span class="record-meta">{{ response.verification ? 'Terverifikasi' : 'Belum diverifikasi' }}</span>
          </div>
          <p class="indicator-context">{{ response.indicator.domain.name }} (bobot {{ response.indicator.domain.weight }}%) / Bobot indikator {{ response.indicator.weight }}%</p>
          <section class="review-answer">
            <h4>Level pilihan unit kerja</h4>
            <p v-if="response.maturityLevel"><strong>{{ levelName(response.maturityLevel) }} (dari {{ response.indicator.maturityLevels.length }} level)</strong>. {{ response.maturityLevel.criterion }}</p>
            <p v-else class="field-hint">Belum memilih tingkat kematangan.</p>
            <h4>Penjelasan</h4>
            <p class="response-explanation">{{ response.explanation || 'Belum ada penjelasan.' }}</p>
          </section>
          <section class="form-stack">
            <div><h4>Bukti dukung</h4><p v-if="response.indicator.requiresEvidence" class="field-hint">Indikator ini mewajibkan bukti.</p></div>
            <ul v-if="response.evidence.length" class="review-evidence"><li v-for="link in response.evidence" :key="link.id"><a class="evidence-link" :href="link.url" target="_blank" rel="noopener noreferrer">{{ link.url }}</a><span>{{ formatDate(link.createdAt) }}</span></li></ul>
            <p v-else class="field-hint">Tidak ada tautan bukti.</p>
          </section>

          <form v-if="canVerify" class="inline-confirm review-decision" @submit.prevent="saveVerification(response)">
            <div class="field">
              <label :for="`final-level-${response.id}`">Level final</label>
              <select :id="`final-level-${response.id}`" v-model="levels[response.id]" class="control" required>
                <option value="" disabled>Pilih level final</option>
                <option v-for="level in response.indicator.maturityLevels" :key="level.id" :value="level.id">{{ level.title ? levelName(level) : `Level ${level.level}: ${level.criterion}` }}</option>
              </select>
            </div>
            <div class="field">
              <label :for="`comment-${response.id}`">Komentar verifikasi</label>
              <textarea :id="`comment-${response.id}`" v-model="comments[response.id]" class="control" maxlength="4000" placeholder="Opsional. Jelaskan alasan jika level final berbeda dari pilihan unit." />
            </div>
            <div class="form-actions">
              <button class="btn btn-primary" type="submit" :disabled="busyResponse === response.id || !levels[response.id] || !isChanged(response)">{{ busyResponse === response.id ? 'Menyimpan...' : response.verification ? 'Perbarui verifikasi' : 'Simpan verifikasi' }}</button>
              <span v-if="response.verification" class="field-hint">Disimpan {{ response.verification.verifier.displayName }}, {{ formatDate(response.verification.updatedAt) }}</span>
            </div>
          </form>
          <section v-else-if="response.verification" class="review-answer">
            <h4>Hasil verifikasi</h4>
            <p><strong>Level final {{ finalLevel(response) }} dari {{ response.indicator.maturityLevels.length }}</strong></p>
            <p v-if="response.verification.comment">{{ response.verification.comment }}</p>
          </section>
        </article>
      </div>
    </section>

    <section v-if="canVerify" class="panel panel-body review-start">
      <div>
        <h2 class="section-title">Kirim hasil verifikasi</h2>
        <p class="section-note">{{ verifiedCount < totalCount ? `${totalCount - verifiedCount} indikator belum diberi level final.` : 'Semua indikator sudah diverifikasi. Setelah dikirim, unit kerja melihat nilai final dan hasilnya terkunci.' }}</p>
      </div>
      <button class="btn btn-primary" type="button" :disabled="sending || verifiedCount < totalCount" @click="sendVerification">{{ sending ? 'Mengirim...' : 'Kirim hasil verifikasi' }}</button>
    </section>

    <section class="panel panel-body"><h2 class="section-title">Riwayat status</h2><ol v-if="assessment.statusEvents.length" class="history-strip"><li v-for="entry in assessment.statusEvents" :key="`${entry.toStatus}-${entry.createdAt}`" class="history-entry"><strong>{{ entry.actor?.displayName || 'Sistem' }} · {{ formatDate(entry.createdAt) }}</strong><p>{{ entry.fromStatus ? statusLabels[entry.fromStatus] || entry.fromStatus : 'Penilaian dibuat' }} → {{ statusLabels[entry.toStatus] || entry.toStatus }}<span v-if="entry.reason"> · {{ entry.reason }}</span></p></li></ol><EmptyState v-else title="Belum ada riwayat" message="Aktivitas status akan tercatat di sini." /></section>
  </div>
</template>
