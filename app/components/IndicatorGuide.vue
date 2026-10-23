<script setup lang="ts">
import { levelName } from '../utils/level'

interface GuideLevel {
  id: string
  level: number
  title: string
  criterion: string
  evidenceGuide: string
}

const props = defineProps<{
  code: string
  title: string
  definition: string
  levels: GuideLevel[]
}>()

const dialog = ref<HTMLDialogElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
// Level names and criteria already show in the picker, so the button only appears when there is more to read.
const hasGuide = computed(() => Boolean(props.definition.trim()) || props.levels.some((level) => level.evidenceGuide.trim()))

function open() {
  dialog.value?.showModal()
}

function close() {
  dialog.value?.close()
}

// A click that lands on the dialog element itself, not its content, is a click on the backdrop.
function onDialogClick(event: MouseEvent) {
  if (event.target === dialog.value) close()
}
</script>

<template>
  <template v-if="hasGuide">
    <button ref="trigger" class="guide-trigger" type="button" :aria-label="`Penjelasan indikator ${props.code}`" title="Penjelasan indikator" @click="open">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
        <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <dialog ref="dialog" class="guide-dialog" :aria-labelledby="`guide-title-${props.code}`" @click="onDialogClick" @close="trigger?.focus()">
      <div class="guide-dialog-body">
        <header class="guide-dialog-header">
          <div>
            <p class="guide-dialog-eyebrow">Penjelasan indikator {{ props.code }}</p>
            <h2 :id="`guide-title-${props.code}`">{{ props.title }}</h2>
          </div>
          <button class="btn btn-secondary btn-small" type="button" @click="close">Tutup</button>
        </header>
        <GuideText v-if="props.definition.trim()" :text="props.definition" />
        <section class="guide-levels" :aria-labelledby="`guide-levels-${props.code}`">
          <h3 :id="`guide-levels-${props.code}`">Tingkat kematangan dan bukti dukung</h3>
          <div v-for="level in props.levels" :key="level.id" class="guide-level">
            <strong>{{ levelName(level) }}</strong>
            <p>{{ level.criterion }}</p>
            <p v-if="level.evidenceGuide.trim()" class="guide-evidence"><span>Bukti dukung:</span> {{ level.evidenceGuide }}</p>
          </div>
        </section>
      </div>
    </dialog>
  </template>
</template>
