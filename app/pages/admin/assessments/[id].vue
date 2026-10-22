<script setup lang="ts">
import { formatDate, getApiError } from '../../../utils/format'

interface ReviewResponse {
  id: string; status: string; version: number; explanation: string; maturityLevelId: string | null
  maturityLevel: { level: number; criterion: string } | null
  indicator: { code: string; title: string; criterion: string; requiresEvidence: boolean; weight: number; domain: { id: string; name: string; weight: number; position: number }; maturityLevels: Array<{ id: string; level: number; criterion: string }> }
  evidence: Array<{ id: string; url: string; createdAt: string }>
  decisions: Array<{ id: string; outcome: string; comment: string; reviewedVersion: number; createdAt: string; reviewer: { displayName: string } }>
}
interface Detail { id: string; status: string; submittedAt: string | null; updatedAt: string; period: { name: string }; unit: { id: string; name: string; code: string }; createdBy: { displayName: string; email: string }; responses: ReviewResponse[]; statusEvents: Array<{ fromStatus: string | null; toStatus: string; reason: string | null; createdAt: string; actor: { displayName: string } | null }> }
const route = useRoute()
const id = String(route.params.id)
const { data, pending, error, refresh } = useFetch<{ assessment: Detail }>(`/api/admin/assessments/${id}`, { lazy: true })
const assessment = computed((): Detail | undefined => data.value?.assessment)
const starting = ref(false)
const busyResponse = ref('')
const pageError = ref('')
const success = ref('')
const outcomes = reactive<Record<string, 'APPROVE' | 'REQUEST_REVISION'>>({})
const comments = reactive<Record<string, string>>({})
const completeResponses = computed(() => assessment.value?.responses.filter((response: ReviewResponse) => response.maturityLevel && response.explanation.trim()).length || 0)

async function startReview() {
  starting.value = true; pageError.value = ''; success.value = ''
  try { await $fetch(`/api/admin/assessments/${id}/start-review`, { method: 'POST' }); success.value = 'Pemeriksaan dimulai.'; await refresh() }
  catch (requestError) { pageError.value = getApiError(requestError, 'Pemeriksaan belum dapat dimulai.') }
  finally { starting.value = false }
}
async function decide(response: ReviewResponse) {
  const outcome = outcomes[response.id] || 'APPROVE'
  busyResponse.value = response.id; pageError.value = ''; success.value = ''
  try {
    await $fetch(`/api/admin/responses/${response.id}/decision`, { method: 'POST', body: { outcome, comment: comments[response.id] || '', reviewedVersion: response.version } })
    success.value = outcome === 'APPROVE' ? 'Keputusan indikator disimpan.' : 'Permintaan revisi disimpan.'
    await refresh()
  } catch (requestError) { pageError.value = getApiError(requestError, 'Keputusan belum dapat disimpan. Muat ulang penilaian jika jawabannya berubah.') }
  finally { busyResponse.value = '' }
}
</script>

<template>
  <LoadingState v-if="pending" label="Memuat penilaian..." />
  <NoticeBanner v-else-if="error" tone="error" role="alert">{{ getApiError(error, 'Penilaian belum dapat dimuat.') }} <NuxtLink class="btn btn-secondary btn-small" to="/admin/queue">Kembali ke antrean</NuxtLink></NoticeBanner>
  <div v-else-if="assessment" class="section-stack">
    <PageHeading :title="assessment.period.name" :subtitle="`${assessment.unit.name} · ${assessment.unit.code} · Diisi oleh ${assessment.createdBy.displayName}`">
      <template #actions><StatusBadge :status="assessment.status" /></template>
    </PageHeading>
    <NoticeBanner v-if="pageError" tone="error" role="alert">{{ pageError }} <button class="btn btn-secondary btn-small" type="button" @click="refresh()">Muat ulang</button></NoticeBanner>
    <NoticeBanner v-else-if="success" tone="success" aria-live="polite">{{ success }}</NoticeBanner>
    <section class="panel assessment-summary"><div class="summary-progress"><div><strong>Jawaban lengkap</strong><span>{{ completeResponses }} dari {{ assessment.responses.length }} indikator</span></div><AssessmentProgress :complete="completeResponses" :total="assessment.responses.length" /></div><ScoreSummary :responses="assessment.responses" /><div class="summary-context"><span>Pengisi: {{ assessment.createdBy.email }}</span><span>Dikirim {{ formatDate(assessment.submittedAt) }}</span></div></section>
    <div v-if="['SUBMITTED', 'RESUBMITTED'].includes(assessment.status)" class="panel panel-body review-start"><div><h2 class="section-title">Mulai pemeriksaan</h2><p class="section-note">Setelah dimulai, berikan keputusan untuk tiap jawaban.</p></div><button class="btn btn-primary" type="button" :disabled="starting" @click="startReview">{{ starting ? 'Memulai...' : 'Mulai pemeriksaan' }}</button></div>
    <NoticeBanner v-else-if="assessment.status === 'IN_REVIEW'" tone="info">Tinjau tiap indikator. Permintaan revisi membutuhkan alasan agar User tahu apa yang perlu diperbaiki.</NoticeBanner>
    <section class="panel">
      <div class="panel-header"><div><h2>Jawaban indikator</h2><p>Periksa tingkat kematangan, penjelasan, dan tautan bukti.</p></div></div>
      <div class="review-responses">
        <article v-for="response in assessment.responses" :key="response.id" class="review-response">
          <div class="review-response-heading"><div><span class="indicator-number">{{ response.indicator.code }}</span><h3>{{ response.indicator.title }}</h3></div><StatusBadge :status="response.status" /></div>
          <p class="indicator-context">{{ response.indicator.domain.name }} (bobot {{ response.indicator.domain.weight }}%) / Bobot indikator {{ response.indicator.weight }}%</p>
          <div v-if="response.indicator.criterion" class="criteria-block"><h4>Kriteria indikator</h4><p>{{ response.indicator.criterion }}</p></div>
          <section class="review-answer"><h4>Tingkat kematangan yang dipilih</h4><p v-if="response.maturityLevel"><strong>Level {{ response.maturityLevel.level }} dari {{ response.indicator.maturityLevels.length }}</strong></p><p v-else class="field-hint">Belum memilih tingkat kematangan.</p><p v-if="response.maturityLevel">{{ response.maturityLevel.criterion }}</p><h4>Penjelasan</h4><p class="response-explanation">{{ response.explanation || 'Belum ada penjelasan.' }}</p></section>
          <section class="form-stack"><div><h4>Bukti dukung</h4><p v-if="response.indicator.requiresEvidence" class="field-hint">Indikator ini mewajibkan bukti.</p></div><ul v-if="response.evidence.length" class="review-evidence"><li v-for="link in response.evidence" :key="link.id"><a class="evidence-link" :href="link.url" target="_blank" rel="noopener noreferrer">{{ link.url }}</a><span>{{ formatDate(link.createdAt) }}</span></li></ul><p v-else class="field-hint">Tidak ada tautan bukti.</p></section>
          <section v-if="response.decisions.length" class="form-stack"><h4>Keputusan sebelumnya</h4><ul class="review-history"><li v-for="decision in response.decisions" :key="decision.id"><strong>{{ decision.outcome === 'APPROVE' ? 'Disetujui' : 'Diminta revisi' }} · {{ decision.reviewer.displayName }} · {{ formatDate(decision.createdAt) }}</strong><p v-if="decision.comment">{{ decision.comment }}</p></li></ul></section>
          <form v-if="assessment.status === 'IN_REVIEW' && response.status === 'PENDING'" class="inline-confirm review-decision" @submit.prevent="decide(response)">
            <div class="field"><label :for="`decision-${response.id}`">Keputusan</label><select :id="`decision-${response.id}`" v-model="outcomes[response.id]" class="control"><option value="APPROVE">Setujui jawaban</option><option value="REQUEST_REVISION">Minta revisi</option></select></div>
            <div class="field"><label :for="`comment-${response.id}`">Catatan untuk User</label><textarea :id="`comment-${response.id}`" v-model.trim="comments[response.id]" class="control" maxlength="4000" :required="outcomes[response.id] === 'REQUEST_REVISION'" :placeholder="outcomes[response.id] === 'REQUEST_REVISION' ? 'Jelaskan bagian yang perlu diperbaiki.' : 'Opsional.'" /></div>
            <div class="form-actions"><button class="btn btn-primary" type="submit" :disabled="busyResponse === response.id || (outcomes[response.id] === 'REQUEST_REVISION' && !comments[response.id]?.trim())">{{ busyResponse === response.id ? 'Menyimpan...' : 'Simpan keputusan' }}</button><span class="field-hint">Versi jawaban {{ response.version }}</span></div>
          </form>
        </article>
      </div>
    </section>
    <section class="panel panel-body"><h2 class="section-title">Riwayat status</h2><ol v-if="assessment.statusEvents.length" class="history-strip"><li v-for="entry in assessment.statusEvents" :key="`${entry.toStatus}-${entry.createdAt}`" class="history-entry"><strong>{{ entry.actor?.displayName || 'Sistem' }} · {{ formatDate(entry.createdAt) }}</strong><p>{{ entry.fromStatus || 'Penilaian dibuat' }} → {{ entry.toStatus }}<span v-if="entry.reason"> · {{ entry.reason }}</span></p></li></ol><EmptyState v-else title="Belum ada riwayat" message="Aktivitas status akan tercatat di sini." /></section>
  </div>
</template>
