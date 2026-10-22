<script setup lang="ts">
definePageMeta({ layout: false })
</script>

<template>
  <main class="public-page">
    <header class="public-header">
      <NuxtLink class="brand-lockup" to="/home">
        <span class="brand-mark" aria-hidden="true">S</span>
        <span>Sectoral</span>
      </NuxtLink>
      <nav aria-label="Navigasi utama">
        <NuxtLink to="/pusat-bantuan">Pusat bantuan</NuxtLink>
        <NuxtLink class="btn btn-secondary btn-small" to="/login">Masuk</NuxtLink>
      </nav>
    </header>
    <section class="public-intro">
      <div>
        <p class="public-kicker">Penilaian internal</p>
        <h1>Catat jawaban, bukti, dan tindak lanjut dalam satu alur.</h1>
        <p class="public-lead">Sectoral membantu staf mengisi indikator penilaian dan memberi Admin konteks yang sama saat memeriksa setiap jawaban.</p>
        <div class="heading-actions">
          <NuxtLink class="btn btn-primary" to="/login">Masuk ke Sectoral</NuxtLink>
          <NuxtLink class="btn btn-secondary" to="/pusat-bantuan">Baca panduan</NuxtLink>
        </div>
      </div>
      <section class="public-workflow" aria-label="Ringkasan alur penilaian Sectoral">
        <div class="workflow-line">
          <span class="workflow-number">01</span>
          <div><strong>User mengisi indikator</strong><span>Pilih tingkat kematangan dan tulis penjelasan.</span></div>
        </div>
        <div class="workflow-line">
          <span class="workflow-number">02</span>
          <div><strong>Bukti mengikuti jawaban</strong><span>Berkas ditautkan ke indikator yang dinilai.</span></div>
        </div>
        <div class="workflow-line">
          <span class="workflow-number">03</span>
          <div><strong>Pusdatin memverifikasi per indikator</strong><span>Level final dan komentar tampil setelah hasil verifikasi dikirim.</span></div>
        </div>
      </section>
    </section>
    <section class="public-lower">
      <div>
        <h2>Ruang kerja yang jelas</h2>
        <p>Progres berasal dari isian yang tersimpan. Admin melihat antrean sesuai unit yang menjadi cakupan akunnya.</p>
      </div>
      <div>
        <h2>Hasil mengikuti aturan internal</h2>
        <p>Sectoral tidak menetapkan rumus skor atau batas bukti. Admin mengatur katalog dan kebijakan sesuai kebutuhan organisasi.</p>
      </div>
    </section>
    <footer class="public-footer">
      <span>Sectoral</span>
      <NuxtLink to="/pusat-bantuan">Pusat bantuan</NuxtLink>
    </footer>
  </main>
</template>
