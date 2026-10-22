<script setup lang="ts">
const auth = useAuth()
const sidebarOpen = useState('sidebar:open', () => false)
const mobile = ref(false)
const header = ref<{ focusMenuButton: () => void } | null>(null)
const sidebar = ref<{ focusFirstLink: () => void } | null>(null)
function updateViewport() { mobile.value = window.matchMedia('(max-width: 780px)').matches }
async function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
  if (sidebarOpen.value) {
    await nextTick()
    sidebar.value?.focusFirstLink()
  } else {
    await nextTick()
    header.value?.focusMenuButton()
  }
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && sidebarOpen.value) {
    sidebarOpen.value = false
    nextTick(() => header.value?.focusMenuButton())
  }
}
onMounted(() => {
  updateViewport()
  window.addEventListener('resize', updateViewport)
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', updateViewport)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="app-frame">
    <a v-if="auth.user.value" class="skip-link" href="#main-content">Lewati ke konten</a>
    <AppHeader v-if="auth.user.value" ref="header" :menu-expanded="sidebarOpen" @toggle-menu="toggleSidebar" />
    <div v-if="auth.user.value" class="workspace">
      <button
        class="drawer-scrim"
        :class="{ 'is-open': sidebarOpen }"
        aria-label="Tutup menu"
        :aria-hidden="!sidebarOpen"
        tabindex="-1"
        @click="sidebarOpen = false"
      />
      <AppSidebar ref="sidebar" :open="sidebarOpen" :inert="mobile && !sidebarOpen" @navigate="sidebarOpen = false" />
      <main id="main-content" class="main-content" tabindex="-1">
        <div class="content-width">
          <BreadcrumbTrail />
          <slot />
        </div>
      </main>
    </div>
    <main v-else id="main-content">
      <slot />
    </main>
  </div>
</template>
