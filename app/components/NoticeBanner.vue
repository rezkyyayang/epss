<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'info' | 'success' | 'warning' | 'error' }>(), { tone: 'info' })
</script>

<template>
  <div class="notice" :class="`notice-${tone}`" role="status">
    <slot />
  </div>
</template>
