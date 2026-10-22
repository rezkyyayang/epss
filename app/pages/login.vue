<script setup lang="ts">
import { getApiError } from '../utils/format'

definePageMeta({ layout: false })
const auth = useAuth()
const route = useRoute()
const email = ref('')
const password = ref('')
const errorMessage = ref('')
const pending = ref(false)

async function signIn() {
  errorMessage.value = ''
  pending.value = true
  try {
    const user = await auth.login(email.value, password.value)
    const requested = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    const permittedPrefix = user.role === 'ADMIN' ? '/admin' : '/user'
    const target = requested.startsWith(`${permittedPrefix}/`) ? requested : `${permittedPrefix}/dashboard`
    await navigateTo(target)
  } catch (error) {
    errorMessage.value = getApiError(error, 'Sistem belum dapat memproses permintaan. Coba lagi.')
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <aside class="auth-aside">
      <NuxtLink class="brand-lockup" to="/home">
        <span class="brand-mark" aria-hidden="true">S</span>
        <span>SectOra</span>
      </NuxtLink>
      <div>
        <h1>Jawaban dan bukti, dalam satu alur.</h1>
        <p>Isi indikator yang ditugaskan. Tinjau catatan Admin pada jawaban yang perlu diperbaiki.</p>
      </div>
      <footer>Penilaian internal</footer>
    </aside>
    <main class="auth-main">
      <form class="auth-form" @submit.prevent="signIn">
        <div>
          <h2>Masuk ke SectOra</h2>
          <p>Gunakan akun yang dibuat oleh Admin organisasi Anda.</p>
        </div>
        <NoticeBanner v-if="errorMessage" tone="error" role="alert">{{ errorMessage }}</NoticeBanner>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" v-model="email" class="control" type="email" autocomplete="username" required maxlength="254">
        </div>
        <div class="field">
          <label for="password">Kata sandi</label>
          <input id="password" v-model="password" class="control" type="password" autocomplete="current-password" required maxlength="200">
        </div>
        <button class="btn btn-primary" type="submit" :disabled="pending">
          {{ pending ? 'Memeriksa akun...' : 'Masuk' }}
        </button>
        <div class="auth-links">
          <NuxtLink to="/pusat-bantuan">Butuh bantuan?</NuxtLink>
          <NuxtLink to="/home">Tentang SectOra</NuxtLink>
        </div>
      </form>
    </main>
  </div>
</template>
