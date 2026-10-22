<script setup lang="ts">
const { toasts, dismiss } = useToast()
const labels = { success: 'Berhasil', error: 'Gagal', info: 'Informasi' } as const
</script>

<template>
  <div class="toast-stack" aria-label="Notifikasi">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="toast"
      :class="`toast-${toast.tone}`"
      :role="toast.tone === 'error' ? 'alert' : 'status'"
      :aria-live="toast.tone === 'error' ? 'assertive' : 'polite'"
    >
      <div class="toast-body">
        <strong>{{ labels[toast.tone] }}</strong>
        <span>{{ toast.message }}</span>
      </div>
      <button class="toast-close" type="button" aria-label="Tutup notifikasi" @click="dismiss(toast.id)">×</button>
    </div>
  </div>
</template>
