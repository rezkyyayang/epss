<script setup lang="ts">
const auth = useAuth()
const route = useRoute()
const props = defineProps<{ open: boolean; inert: boolean }>()
const emit = defineEmits<{ navigate: [] }>()

const userLinks = [
  { label: 'Dashboard', to: '/user/dashboard' },
  { label: 'Riwayat penilaian', to: '/user/history' },
]
const adminLinks = [
  { label: 'Dashboard', to: '/admin/dashboard' },
  { label: 'Antrean verifikasi', to: '/admin/queue' },
  { label: 'Periode', to: '/admin/periods' },
  { label: 'Indikator', to: '/admin/indicators' },
  { label: 'Pengguna dan unit', to: '/admin/users' },
]

const links = computed(() => auth.user.value?.role === 'ADMIN' ? adminLinks : userLinks)
const roleLabel = computed(() => auth.user.value?.role === 'ADMIN' ? 'Admin' : 'User')

function active(to: string) {
  return route.path === to || (to !== '/admin/dashboard' && to !== '/user/dashboard' && route.path.startsWith(`${to}/`))
}

function focusFirstLink() { document.querySelector<HTMLAnchorElement>('#sidebar-navigation .sidebar-link')?.focus() }
defineExpose({ focusFirstLink })
</script>

<template>
  <aside id="sidebar-navigation" class="app-sidebar" :class="{ 'is-open': props.open }" :aria-label="`Navigasi ${roleLabel}`" :inert="props.inert">
    <div>
      <p class="sidebar-label">Ruang kerja {{ roleLabel }}</p>
      <nav class="sidebar-nav">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          class="sidebar-link"
          :class="{ 'is-active': active(link.to) }"
          :to="link.to"
          :aria-current="active(link.to) ? 'page' : undefined"
          @click="emit('navigate')"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>
    </div>
    <div class="sidebar-footer">
      <NuxtLink to="/akun" :aria-current="route.path === '/akun' ? 'page' : undefined" @click="emit('navigate')">Akun dan kata sandi</NuxtLink>
      <NuxtLink to="/pusat-bantuan" @click="emit('navigate')">Pusat bantuan</NuxtLink>
      <span>Penilaian mandiri dan verifikasi</span>
    </div>
  </aside>
</template>
