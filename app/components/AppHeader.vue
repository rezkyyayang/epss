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
      <button ref="menuButton" class="header-button mobile-only" type="button" aria-label="Menu utama" aria-controls="sidebar-navigation" :aria-expanded="props.menuExpanded" @click="emit('toggleMenu')">
        Menu
      </button>
      <NuxtLink class="brand-lockup" :to="auth.user.value?.role === 'ADMIN' ? '/admin/dashboard' : '/user/dashboard'">
        <span class="brand-mark" aria-hidden="true">S</span>
        <span>SectOra</span>
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
