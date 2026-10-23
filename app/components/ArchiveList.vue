<script setup lang="ts">
import { groupArchive, linkSource, type ArchiveDocument } from '../utils/archive'

const props = defineProps<{ documents: ArchiveDocument[] }>()
const groups = computed(() => groupArchive([...props.documents]))
</script>

<template>
  <div class="archive-groups">
    <section v-for="(group, groupIndex) in groups" :key="group.type" class="panel" :aria-labelledby="`archive-group-${groupIndex}`">
      <div class="panel-header">
        <div>
          <h2 :id="`archive-group-${groupIndex}`">{{ group.type }}</h2>
          <p>{{ group.documents.length }} dokumen</p>
        </div>
      </div>
      <ul class="archive-list">
        <li v-for="item in group.documents" :key="item.id" class="archive-row">
          <span class="archive-year">{{ item.year }}</span>
          <div class="archive-main">
            <a class="archive-title" :href="item.url" target="_blank" rel="noopener noreferrer">{{ item.title }}<span class="sr-only"> (membuka tab baru)</span></a>
            <span class="archive-source">{{ linkSource(item.url) }}</span>
          </div>
          <div v-if="$slots.actions" class="archive-actions">
            <slot name="actions" :document="item" />
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
