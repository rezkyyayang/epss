<script setup lang="ts">
const route = useRoute()
const auth = useAuth()
const names: Record<string, string> = {
  admin: 'Admin',
  user: 'User',
  dashboard: 'Dashboard',
  history: 'Riwayat penilaian',
  queue: 'Antrean verifikasi',
  periods: 'Periode',
  indicators: 'Indikator',
  users: 'Pengguna dan unit',
  catalog: 'Katalog',
  assessments: 'Penilaian',
  archive: 'Dokumen arsip',
  akun: 'Akun saya',
}

// Assessment detail pages have no list page at their parent path, so the crumb opens the matching list.
const listPages: Record<string, string> = {
  '/user/assessments': '/user/history',
  '/admin/assessments': '/admin/queue',
}

const crumbs = computed(() => {
  const parts = route.path.split('/').filter(Boolean)
  if (parts.length <= 1) return []
  return parts.map((part, index) => {
    const path = `/${parts.slice(0, index + 1).join('/')}`
    return { label: names[part] || (part.length > 16 ? 'Rincian' : part), path: listPages[path] || path, current: index === parts.length - 1 }
  }).filter((crumb, index) => index > 0 || crumb.label !== (auth.user.value?.role === 'ADMIN' ? 'Admin' : 'User'))
})
</script>

<template>
  <nav v-if="crumbs.length" class="breadcrumb" aria-label="Breadcrumb">
    <template v-for="(crumb, index) in crumbs" :key="crumb.path">
      <span v-if="index" class="breadcrumb-separator" aria-hidden="true">/</span>
      <span v-if="crumb.current" aria-current="page">{{ crumb.label }}</span>
      <NuxtLink v-else :to="crumb.path">{{ crumb.label }}</NuxtLink>
    </template>
  </nav>
</template>
