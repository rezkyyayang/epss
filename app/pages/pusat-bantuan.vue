<script setup lang="ts">
definePageMeta({ layout: false })

const search = ref('')
const questions = [
  {
    category: 'Akun',
    question: 'Siapa yang dapat menggunakan Monastik?',
    answer: 'Monastik memiliki dua peran. User mengisi penilaian pada unit dan periode yang ditugaskan. Admin mengelola periode, katalog, pengguna, dan memeriksa jawaban pada unit dalam cakupan aksesnya.',
  },
  {
    category: 'Penilaian',
    question: 'Bagaimana memulai penilaian?',
    answer: 'Masuk sebagai User, pilih periode aktif yang ditugaskan, lalu buka penilaian. Setiap indikator memuat tingkat kematangan, kriteria, penjelasan, dan bukti jika diwajibkan oleh katalog.',
  },
  {
    category: 'Penilaian',
    question: 'Apakah jawaban bisa diubah setelah dikirim?',
    answer: 'Tidak. Selama status masih Draf, level, penjelasan, dan tautan bukti dapat diubah. Setelah penilaian dikirim, semuanya terkunci dan tidak dikembalikan ke unit. Periksa setiap indikator sebelum menekan Kirim penilaian.',
  },
  {
    category: 'Verifikasi',
    question: 'Bagaimana Pusdatin memverifikasi penilaian?',
    answer: 'Admin Pusdatin memeriksa jawaban dan bukti per indikator, lalu menetapkan level final dan dapat menulis komentar. Level final dan komentar baru terlihat oleh unit setelah Pusdatin mengirim hasil verifikasi.',
  },
  {
    category: 'Bukti dukung',
    question: 'Bagaimana cara melampirkan bukti?',
    answer: 'Bukti dilampirkan sebagai tautan, misalnya ke Google Drive atau OneDrive, bukan unggahan berkas. Satu indikator dapat memuat hingga 10 tautan. Pastikan Admin pemeriksa punya izin untuk membuka tautan tersebut.',
  },
  {
    category: 'Hasil',
    question: 'Bagaimana nilai tertimbang dihitung?',
    answer: 'Setiap indikator dikalikan bobotnya dengan level yang dipilih, lalu dijumlahkan per domain. Nilai domain dikalikan bobot domain dan dijumlahkan menjadi nilai akhir. Nilai baru muncul setelah semua indikator memiliki level. Pada katalog dengan tiga level, nilai indeks diberi predikat: 2,34 sampai 3,00 Memuaskan, 1,67 sampai di bawah 2,34 Cukup, dan 1,00 sampai di bawah 1,67 Kurang.',
  },
]
const filteredQuestions = computed(() => {
  const term = search.value.trim().toLocaleLowerCase('id')
  if (!term) return questions
  return questions.filter((item) => `${item.category} ${item.question} ${item.answer}`.toLocaleLowerCase('id').includes(term))
})
</script>

<template>
  <div class="help-page">
    <header class="public-header">
      <NuxtLink class="brand-lockup" to="/home">
        <img class="brand-logo" src="/lan-ri-logo.png" alt="LAN RI">
        <span>Monastik</span>
      </NuxtLink>
      <nav aria-label="Navigasi utama">
        <NuxtLink to="/home">Beranda</NuxtLink>
        <NuxtLink class="btn btn-secondary btn-small" to="/login">Masuk</NuxtLink>
      </nav>
    </header>
    <main class="help-content">
      <PageHeading title="Pusat bantuan" subtitle="Jawaban singkat tentang akun, penilaian, pemeriksaan, dan bukti dukung." />
      <div class="help-search field">
        <label for="help-search">Cari panduan</label>
        <input id="help-search" v-model="search" class="control" type="search" placeholder="Contoh: bukti dukung">
      </div>
      <div v-if="filteredQuestions.length" class="faq-list">
        <details v-for="item in filteredQuestions" :key="item.question" class="faq-item">
          <summary>
            <span class="faq-category">{{ item.category }}</span>
            <strong>{{ item.question }}</strong>
          </summary>
          <p>{{ item.answer }}</p>
        </details>
      </div>
      <EmptyState v-else title="Panduan tidak ditemukan" message="Coba kata kunci lain atau hapus pencarian." >
        <button class="btn btn-secondary" type="button" @click="search = ''">Hapus pencarian</button>
      </EmptyState>
    </main>
    <footer class="public-footer">
      <span>Monastik</span>
      <NuxtLink to="/login">Masuk</NuxtLink>
    </footer>
  </div>
</template>
