<script setup lang="ts">
import { levelName } from '../utils/level'

interface MaturityLevel {
  id: string
  level: number
  title: string
  criterion: string
}

const props = defineProps<{
  modelValue: string | null
  levels: MaturityLevel[]
  disabled?: boolean
  name: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <fieldset class="maturity-list" :disabled="props.disabled">
    <legend>Tingkat kematangan</legend>
    <label v-for="level in props.levels" :key="level.id" class="maturity-option">
      <input
        type="radio"
        :name="props.name"
        :value="level.id"
        :checked="props.modelValue === level.id"
        @change="emit('update:modelValue', level.id)"
      >
      <span class="maturity-copy">
        <strong>{{ levelName(level) }}</strong>
        <span>{{ level.criterion }}</span>
      </span>
    </label>
  </fieldset>
</template>
