<script setup lang="ts">
// Catalog guides are plain text typed by Admins. Lines starting with "- " become bullets and "1. " a numbered
// list; a blank line starts a new paragraph, and any other line break is a wrap carried over from the source
// document, so it joins the line before. Rendered as text nodes, never as HTML.
type Block = { kind: 'p'; text: string } | { kind: 'ul'; items: string[] } | { kind: 'ol'; start: number; items: string[] }

const props = defineProps<{ text: string }>()

const blocks = computed(() => {
  const result: Block[] = []
  let current: Block | null = null
  for (const raw of props.text.split('\n')) {
    const line = raw.trim()
    if (!line) {
      current = null
      continue
    }
    const bullet = line.match(/^[-•*]\s+(.+)$/)
    const numbered = line.match(/^(\d{1,2})[.)]\s*(.+)$/)
    if (bullet) {
      if (current?.kind !== 'ul') result.push(current = { kind: 'ul', items: [] })
      current.items.push(bullet[1])
    } else if (numbered) {
      if (current?.kind !== 'ol') result.push(current = { kind: 'ol', start: Number(numbered[1]), items: [] })
      current.items.push(numbered[2])
    } else if (current?.kind === 'p') {
      current.text += ` ${line}`
    } else if (current) {
      current.items[current.items.length - 1] += ` ${line}`
    } else {
      result.push(current = { kind: 'p', text: line })
    }
  }
  return result
})
</script>

<template>
  <div class="guide-text">
    <template v-for="(block, index) in blocks" :key="index">
      <p v-if="block.kind === 'p'">{{ block.text }}</p>
      <ul v-else-if="block.kind === 'ul'"><li v-for="(item, itemIndex) in block.items" :key="itemIndex">{{ item }}</li></ul>
      <ol v-else :start="block.start"><li v-for="(item, itemIndex) in block.items" :key="itemIndex">{{ item }}</li></ol>
    </template>
  </div>
</template>
