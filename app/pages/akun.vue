<script setup lang="ts">
import { getApiError } from '../utils/format'
import { maxPasswordLength, passwordRules } from '../utils/passwordPolicy'

const auth = useAuth()
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const showPasswords = ref(false)
const saving = ref(false)
const success = toastRef('success')
const failure = toastRef('error')

interface RuleState { id: string; label: string; met: boolean }
const ruleStates = computed((): RuleState[] => passwordRules.map((rule) => ({ id: rule.id, label: rule.label, met: rule.test(newPassword.value) })))
const rulesMet = computed(() => ruleStates.value.every((rule: RuleState) => rule.met))
const confirmMatches = computed(() => confirmPassword.value.length > 0 && confirmPassword.value === newPassword.value)
const canSubmit = computed(() => Boolean(currentPassword.value) && rulesMet.value && confirmMatches.value && !saving.value)
const inputType = computed(() => showPasswords.value ? 'text' : 'password')

async function changePassword() {
  if (!canSubmit.value) return
  saving.value = true
  failure.value = ''
  success.value = ''
  try {
    await $fetch('/api/auth/password', { method: 'POST', body: { currentPassword: currentPassword.value, newPassword: newPassword.value } })
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
    showPasswords.value = false
    success.value = 'Kata sandi diganti. Sesi di perangkat lain sudah dikeluarkan; gunakan kata sandi baru saat masuk berikutnya.'
  } catch (error) {
    failure.value = getApiError(error, 'Kata sandi belum dapat diganti. Coba lagi.')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <PageHeading title="Akun saya" :subtitle="`${auth.user.value?.displayName ?? ''} · ${auth.user.value?.email ?? ''}`" />
  <section class="panel account-panel" aria-labelledby="password-heading">
    <div class="panel-header">
      <div>
        <h2 id="password-heading">Ganti kata sandi</h2>
        <p>Setelah diganti, akun ini otomatis keluar dari perangkat lain.</p>
      </div>
    </div>
    <form class="panel-body form-stack" @submit.prevent="changePassword">
      <input class="sr-only" type="email" autocomplete="username" :value="auth.user.value?.email" tabindex="-1" aria-hidden="true" readonly>
      <div class="field">
        <label for="current-password">Kata sandi saat ini</label>
        <input id="current-password" v-model="currentPassword" class="control" :type="inputType" autocomplete="current-password" required :maxlength="maxPasswordLength">
      </div>
      <div class="field">
        <label for="new-password">Kata sandi baru</label>
        <input id="new-password" v-model="newPassword" class="control" :type="inputType" autocomplete="new-password" required :maxlength="maxPasswordLength" aria-describedby="password-rules">
        <ul id="password-rules" class="rule-list" aria-label="Syarat kata sandi baru">
          <li v-for="rule in ruleStates" :key="rule.id" :class="{ 'is-met': rule.met }">
            <span class="rule-mark" aria-hidden="true">{{ rule.met ? '✓' : '•' }}</span>
            {{ rule.label }}<span class="sr-only">{{ rule.met ? ', terpenuhi' : ', belum terpenuhi' }}</span>
          </li>
        </ul>
      </div>
      <div class="field">
        <label for="confirm-password">Ulangi kata sandi baru</label>
        <input id="confirm-password" v-model="confirmPassword" class="control" :type="inputType" autocomplete="new-password" required :maxlength="maxPasswordLength" aria-describedby="confirm-hint">
        <p id="confirm-hint" class="field-hint" :class="{ 'is-error': confirmPassword && !confirmMatches }" aria-live="polite">
          <template v-if="!confirmPassword">Ketik ulang kata sandi baru.</template>
          <template v-else-if="confirmMatches">Kata sandi sama.</template>
          <template v-else>Belum sama dengan kata sandi baru.</template>
        </p>
      </div>
      <label class="check-row"><input v-model="showPasswords" type="checkbox"><span>Tampilkan kata sandi</span></label>
      <div class="form-actions">
        <button class="btn btn-primary" type="submit" :disabled="!canSubmit">{{ saving ? 'Menyimpan...' : 'Ganti kata sandi' }}</button>
      </div>
    </form>
  </section>
</template>
