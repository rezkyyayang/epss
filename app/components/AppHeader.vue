<script setup lang="ts">
const auth = useAuth()
const emit = defineEmits<{ toggleMenu: [] }>()
const signOut = ref(false)
const menuButton = ref<HTMLButtonElement | null>(null)
const props = defineProps<{ menuExpanded: boolean }>()

async function logout() {
  signOut.value = true
  await auth.logout()
  signOut.value = false
}

function focusMenuButton() { menuButton.value?.focus() }
defineExpose({ focusMenuButton })
</script>

<template>
  <header class="app-header">
    <div class="header-start">
      <button ref="menuButton" class="header-button menu-toggle" type="button" :aria-label="props.menuExpanded ? 'Tutup menu navigasi' : 'Buka menu navigasi'" aria-controls="sidebar-navigation" :aria-expanded="props.menuExpanded" @click="emit('toggleMenu')">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
          <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
      <NuxtLink class="brand-lockup" :to="auth.user.value?.role === 'ADMIN' ? '/admin/dashboard' : '/user/dashboard'">
        <img class="brand-logo" src="/lan-ri-logo.png" alt="LAN RI">
        <span>Monastik</span>
      </NuxtLink>
    </div>
    <div class="header-end">
      <div class="account-name" aria-live="polite">
        <strong>{{ auth.user.value?.displayName }}</strong>
        <span>{{ auth.user.value?.role === 'ADMIN' ? 'Admin' : 'User' }}</span>
      </div>
      <button class="header-button" type="button" :disabled="signOut" @click="logout">
        {{ signOut ? 'Keluar...' : 'Keluar' }}
      </button>
    </div>
  </header>
</template>
