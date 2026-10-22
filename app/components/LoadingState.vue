<script setup lang="ts">
// The placeholder rows stand in for the list or table that replaces them, so the page keeps its
// shape while data loads. `inset` drops the panel frame when the state sits inside an existing panel.
withDefaults(defineProps<{ label: string; rows?: number; inset?: boolean }>(), {
  rows: 3,
  inset: false,
})
</script>

<template>
  <div class="loading-state" :class="{ panel: !inset }" role="status" aria-live="polite">
    <p class="loading-label">{{ label }}</p>
    <div class="loading-rows" aria-hidden="true">
      <div v-for="row in rows" :key="row" class="loading-row">
        <span class="loading-bar loading-bar-main" />
        <span class="loading-bar loading-bar-side" />
      </div>
    </div>
  </div>
</template>
