<script setup>
import CardView from './DuelCard.vue'
import ScoreBreakdown from './ScoreBreakdown.vue'
defineProps({ result: { type: Object, default: null }, label: { type: String, required: true } })
</script>

<template>
  <div class="clash-hand">
    <span class="clash-label">{{label}}</span>
    <template v-if="result">
      <div class="clash-play">
        <div class="played-cards"><CardView v-for="c in result.cards" :key="c.id" :card="c" /></div>
        <div class="calculation"><strong>{{result.hand.name}}</strong><em>+{{result.score.toLocaleString()}}</em></div>
      </div>
      <ScoreBreakdown :result="result" :cards="result.cards" />
    </template>
    <div v-else class="empty-play"><span aria-hidden="true">♠</span><small>等待亮牌</small></div>
  </div>
</template>
