<script setup lang="ts">
import { formatScore } from '../utils/score'

// One series of domain scores on a 0..max scale. The score table beside it is the exact view,
// so the chart carries shape only: no legend (single series) and values on hover.
const props = defineProps<{ domains: Array<{ id: string; name: string; score: number | null }>; max: number }>()

const size = 320
const center = size / 2
const radius = 96
const labelGap = 22

function point(index: number, value: number) {
  const angle = -Math.PI / 2 + (index / props.domains.length) * Math.PI * 2
  const distance = props.max ? (value / props.max) * radius : 0
  return { x: center + Math.cos(angle) * distance, y: center + Math.sin(angle) * distance, angle }
}

function toPoints(values: number[]) {
  return values.map((value, index) => point(index, value)).map((vertex: { x: number; y: number }) => `${vertex.x},${vertex.y}`).join(' ')
}

const rings = computed(() => Array.from({ length: props.max }, (_, step) => ({
  level: step + 1,
  points: toPoints(props.domains.map(() => step + 1)),
})))

const spokes = computed(() => props.domains.map((_, index) => point(index, props.max)))

// Ring numbers sit halfway between the first two spokes so they never sit under a data marker.
const ticks = computed(() => {
  const angle = -Math.PI / 2 + Math.PI / Math.max(props.domains.length, 1)
  return rings.value.map(({ level }: { level: number }) => {
    const distance = props.max ? (level / props.max) * radius : 0
    return { level, x: center + Math.cos(angle) * distance, y: center + Math.sin(angle) * distance }
  })
})

const vertices = computed(() => props.domains.map((domain, index) => ({ ...domain, ...point(index, domain.score ?? 0) })))
const hasScore = computed(() => props.domains.some(({ score }) => score !== null))
const shape = computed(() => toPoints(props.domains.map(({ score }) => score ?? 0)))

// Long domain names break into lines of about 14 characters so they stay inside the frame.
function wrap(name: string) {
  const lines: string[] = []
  for (const word of name.split(/\s+/)) {
    const last = lines[lines.length - 1]
    if (last && `${last} ${word}`.length <= 14) lines[lines.length - 1] = `${last} ${word}`
    else lines.push(word)
  }
  return lines
}

const labels = computed(() => props.domains.map((domain, index) => {
  const { angle } = point(index, props.max)
  const x = center + Math.cos(angle) * (radius + labelGap)
  const y = center + Math.sin(angle) * (radius + labelGap)
  const cos = Math.cos(angle)
  const anchor = Math.abs(cos) < 0.2 ? 'middle' : cos > 0 ? 'start' : 'end'
  const lines = wrap(domain.name)
  // Labels above the chart grow upward, labels below grow downward.
  const firstLineY = Math.sin(angle) < -0.2 ? y - (lines.length - 1) * 13 : Math.abs(Math.sin(angle)) <= 0.2 ? y - ((lines.length - 1) * 13) / 2 : y + 4
  return { id: domain.id, x, firstLineY, anchor, lines }
}))

const summary = computed(() => props.domains
  .map(({ name, score }) => `${name} ${score === null ? 'belum lengkap' : formatScore(score)}`)
  .join(', '))
</script>

<template>
  <svg class="radar-chart" :viewBox="`-40 -10 ${size + 80} ${size + 20}`" role="img" :aria-label="`Nilai per domain dari skala ${max}: ${summary}`">
    <g class="radar-grid" aria-hidden="true">
      <polygon v-for="ring in rings" :key="ring.level" :points="ring.points" />
      <line v-for="(spoke, index) in spokes" :key="index" :x1="center" :y1="center" :x2="spoke.x" :y2="spoke.y" />
      <text v-for="tick in ticks" :key="`tick-${tick.level}`" class="radar-tick" :x="tick.x + 3" :y="tick.y - 3">{{ tick.level }}</text>
    </g>
    <polygon v-if="hasScore" class="radar-shape" :points="shape" />
    <g v-for="vertex in vertices" :key="vertex.id" class="radar-vertex">
      <circle class="radar-hit" :cx="vertex.x" :cy="vertex.y" r="14">
        <title>{{ vertex.name }}: {{ vertex.score === null ? 'belum lengkap' : formatScore(vertex.score) }}</title>
      </circle>
      <circle class="radar-marker" :class="{ 'is-empty': vertex.score === null }" :cx="vertex.x" :cy="vertex.y" r="4" />
    </g>
    <text v-for="label in labels" :key="`label-${label.id}`" class="radar-label" :text-anchor="label.anchor" aria-hidden="true">
      <tspan v-for="(line, index) in label.lines" :key="index" :x="label.x" :y="label.firstLineY + index * 13">{{ line }}</tspan>
    </text>
  </svg>
</template>
