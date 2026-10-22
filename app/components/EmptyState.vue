<script setup lang="ts">
withDefaults(defineProps<{ title: string; message: string; actionLabel?: string; actionTo?: string }>(), {
  actionLabel: undefined,
  actionTo: undefined,
})
</script>

<template>
  <div class="empty-state">
    <h2>{{ title }}</h2>
    <p>{{ message }}</p>
    <NuxtLink v-if="actionLabel && actionTo" class="btn btn-secondary" :to="actionTo">{{ actionLabel }}</NuxtLink>
    <slot />
  </div>
</template>
