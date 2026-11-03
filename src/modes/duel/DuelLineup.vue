<script setup>
import JokerArt from '../../components/JokerArt.vue'
import { jokerStatus } from '../../composables/jokerCatalog.js'
import { DUEL_RULES } from './config.js'
defineProps({ jokers: { type: Array, required: true }, label: { type: String, required: true } })
</script>

<template>
  <details class="arena-lineup">
    <summary>
      <span class="lineup-label">{{label}} <b>{{jokers.length}} / {{DUEL_RULES.maxJokers}}</b></span>
      <span class="lineup-thumbnails"><JokerArt v-for="j in jokers" :key="j.id" :joker="j" /></span>
      <span v-if="!jokers.length" class="lineup-empty">空阵容 · 商店购买</span>
      <span class="lineup-expand" aria-hidden="true">⌄</span>
    </summary>
    <div class="lineup-details">
      <p v-if="!jokers.length" class="lineup-empty-detail">本轮结束后，在共享商店购买小丑牌，逐步组建阵容。</p>
      <div v-for="j in jokers" :key="j.id" class="lineup-detail">
        <JokerArt :joker="j" />
        <div><strong>{{j.name}}</strong><p>{{j.desc}}</p><small v-if="jokerStatus(j)">{{jokerStatus(j)}}</small></div>
      </div>
    </div>
  </details>
</template>
