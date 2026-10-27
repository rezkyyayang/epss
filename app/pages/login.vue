<script setup lang="ts">
import { getApiError } from '../utils/format'

definePageMeta({ layout: false })
const auth = useAuth()
const route = useRoute()
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const errorMessage = toastRef('error')
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
    <header class="auth-topbar">
      <NuxtLink class="auth-topbar-brand" to="/home">
        <img src="/lan-ri-logo.png" alt="LAN RI">
      </NuxtLink>
      <NuxtLink class="auth-back-link" to="/home">Kembali ke Beranda</NuxtLink>
    </header>
    <main class="auth-main">
      <section class="auth-intro">
        <div>
          <p class="auth-product-name">Monastik</p>
          <p class="auth-kicker">Penilaian internal</p>
          <h1>Jawaban dan bukti, dalam satu alur.</h1>
          <p>Isi indikator yang ditugaskan, lalu lihat level final dari Pusdatin setelah verifikasi selesai.</p>
        </div>
      </section>
      <form class="auth-form" @submit.prevent="signIn">
        <div class="auth-form-heading">
          <img class="auth-card-logo" src="/lan-ri-logo.png" alt="LAN RI">
          <h2>Masuk ke Monastik</h2>
          <p>Gunakan akun yang dibuat oleh Admin organisasi Anda.</p>
        </div>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" v-model="email" class="control" type="email" autocomplete="username" required maxlength="254">
        </div>
        <div class="field">
          <label for="password">Kata sandi</label>
          <div class="password-field">
            <input id="password" v-model="password" class="control" :type="showPassword ? 'text' : 'password'" autocomplete="current-password" required maxlength="200">
            <button class="password-toggle" type="button" :aria-label="showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'" :aria-pressed="showPassword" aria-controls="password" :title="showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'" @click="showPassword = !showPassword">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
                <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.8" />
                <path v-if="showPassword" d="M4 4l16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
              </svg>
            </button>
          </div>
        </div>
        <button class="btn btn-primary" type="submit" :disabled="pending">
          {{ pending ? 'Memeriksa akun...' : 'Masuk' }}
        </button>
        <div class="auth-links">
          <NuxtLink to="/pusat-bantuan">Butuh bantuan?</NuxtLink>
          <NuxtLink to="/home">Tentang Monastik</NuxtLink>
        </div>
      </form>
    </main>
  </div>
</template>
