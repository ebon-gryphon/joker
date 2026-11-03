<script setup>
import { computed } from 'vue'
import { cardValue } from '../composables/useHandDetector.js'
import { JOKER_POOL } from '../composables/jokerCatalog.js'

const props = defineProps({ result: { type: Object, required: true }, cards: { type: Array, required: true }, title: { type: String, default: '本手怎么算的' } })
const names = new Map(JOKER_POOL.map(j => [j.id, j.name]))
const baseChips = computed(() => props.result.hand.chips + props.cards.reduce((sum, card) => sum + cardValue(card.rank), 0))
</script>

<template>
  <details v-if="result.hand" class="score-breakdown">
    <summary>{{title}} · {{result.chips}} × {{result.mult}} = {{result.score}}</summary>
    <ol>
      <li>{{result.hand.name}}基础 {{result.hand.chips}} 筹码、{{result.hand.mult}} 倍率；打出的牌再加 {{baseChips - result.hand.chips}} 筹码。</li>
      <li v-for="step in result.steps" :key="step.id">{{names.get(step.id)}} · {{step.label || '本手无计分加成'}} → {{step.chips}} 筹码 × {{step.mult}} 倍率</li>
      <li>最终得分 {{result.chips}} × {{result.mult}} = {{result.score}}</li>
    </ol>
  </details>
</template>

<style scoped>
.score-breakdown { width: 100%; max-width: 920px; padding: 8px 12px; font-size: 11px; line-height: 1.7; color: #b9c7b8; background: #0a171480; border: 1px solid #8d784744; border-radius: 3px; }
summary { cursor: pointer; color: #dbc495; }
ol { margin: 8px 0 0; padding-left: 20px; }
li { margin: 4px 0; }
</style>
