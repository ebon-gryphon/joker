<template>
  <section class="hand-area" aria-label="手牌与操作">
    <div class="hand-preview" aria-live="polite">
      <template v-if="previewScore && !isScoring"><strong class="preview-name">{{ previewScore.hand?.name }}</strong><span>筹码 <b class="preview-chips">{{ previewScore.chips }}</b></span><span class="times">×</span><span>倍率 <b class="preview-mult">{{ previewScore.mult }}</b></span><span class="preview-total">预计 <b>{{ previewScore.score.toLocaleString() }}</b></span><span v-if="previewScore.score >= remainingScore" class="can-clear">可过关</span></template>
      <span v-else class="preview-idle">{{ isScoring ? '正在结算这一手…' : '选择 1—5 张手牌，查看牌型与预计得分' }}</span>
    </div>
    <ScoreBreakdown v-if="previewScore?.hand && !isScoring" :result="previewScore" :cards="hand.filter(card => selectedCards.includes(card.id))" title="查看预计得分明细" />
    <p v-if="orderImprovement > 0 && !isScoring" class="condition-hint order-optimization-hint" role="status">这手把加倍率牌移到乘倍率牌前，预计可多得 {{ orderImprovement.toLocaleString() }} 分；用小丑下方箭头调整。</p>
    <p v-if="lastHandHint && !isScoring" class="condition-hint last-hand-hint" role="status">{{ lastHandHint }}</p>
    <p v-if="conditionHint && !isScoring" class="condition-hint">{{ conditionHint }}</p>
    <div class="hand-cards" ref="handCardsRef">
      <CardView v-for="card in hand" :key="card.id" :card="card" :isSelected="selectedCards.includes(card.id)" selectable :disabled="isScoring || aiThinking" :ref="el => setCardRef(card.id, el)" @click="onCardClick(card)" />
    </div>
    <div class="hand-meta"><span>手牌 {{ hand.length }} / 8</span><span>已选 {{ selectedCount }} / 5</span></div>
    <div class="hand-actions">
      <div class="actions-sort"><span>排序</span><button class="px-btn btn-sort" :disabled="isScoring || aiThinking" @click="onSort('sortByRank')">点数</button><button class="px-btn btn-sort" :disabled="isScoring || aiThinking" @click="onSort('sortBySuit')">花色</button></div>
      <div class="actions-main"><button class="px-btn btn-play" :disabled="selectedCount === 0 || isScoring || aiThinking" @click="$emit('play')">出牌 <small v-if="selectedCount">{{ selectedCount }}</small></button><button class="px-btn btn-discard" :disabled="discardsLeft === 0 || selectedCount === 0 || isScoring || aiThinking" @click="$emit('discard')">弃牌</button></div>
      <button class="px-btn btn-ai" :disabled="aiThinking || isScoring" @click="$emit('aiPlay')">{{ aiThinking ? '计算中…' : '自动出牌' }}</button>
    </div>
  </section>
</template>
<script setup>
import { ref, computed } from 'vue'
import CardView from './CardView.vue'
import ScoreBreakdown from './ScoreBreakdown.vue'
import { playSfx } from '../composables/useAudio.js'
import { calcScore } from '../composables/useHandDetector.js'
import { computerJokerOrder } from '../strategy/jokerPlanning.js'
const props = defineProps({ hand: Array, selectedCards: Array, selectedCount: Number, discardsLeft: Number, isScoring: Boolean, aiThinking: Boolean, previewScore: Object, scoreContext: { type: Object, default: () => ({}) }, remainingScore: Number, jokers: { type: Array, default: () => [] }, handsLeft: Number })
const orderImprovement = computed(() => {
  if (!props.previewScore?.hand || props.selectedCards.length === 0) return 0
  const cards = props.hand.filter(card => props.selectedCards.includes(card.id))
  const orderedScore = calcScore(cards, computerJokerOrder(props.jokers), props.scoreContext).score
  return Math.max(0, orderedScore - props.previewScore.score)
})
const lastHandHint = computed(() => {
  if (props.handsLeft !== 1 || props.previewScore?.score >= props.remainingScore) return ''
  const needed = Math.max(0, props.remainingScore - (props.previewScore?.score || 0)).toLocaleString()
  const gap = props.previewScore ? `所选牌预计仍差 ${needed} 分` : `这一手需要 ${needed} 分`
  return `最后一手 · ${gap}。${props.discardsLeft > 0 ? `还可弃牌 ${props.discardsLeft} 次，补牌随机。` : '可重新搭配手牌，确认预计得分后再出牌。'}`
})
const conditionHint = computed(() => {
  const ids = new Set(props.jokers.map(j => j.id))
  if (ids.has('empty_pockets') && props.discardsLeft > 0) return `孤注一掷：弃牌次数归零后才有 ×2；目前还剩 ${props.discardsLeft} 次。换回的牌随机。`
  if (ids.has('phoenix') && (props.handsLeft !== 1 || props.discardsLeft > 0)) return '不死鸟：最后一手且弃牌次数归零才有 ×3，提前过关不会触发。'
  if (ids.has('green_joker')) return '绿色小丑：每次出牌成长，弃牌会降低已积累的倍率。'
  if (ids.has('banner')) return '节制旗帜：每剩一次弃牌加 8 筹码，弃牌前可以对比预计得分。'
  if (ids.has('rebate')) return '回收员：每次使用弃牌获得 $1，但换回的牌仍是随机的。'
  return ''
})
const emit = defineEmits(['selectCard', 'play', 'discard', 'sortByRank', 'sortBySuit', 'aiPlay'])
const handCardsRef = ref(null), cardRefMap = ref({})
function setCardRef(id, el) { if (el) cardRefMap.value[id] = el; else delete cardRefMap.value[id] }
function onCardClick(card) { if (props.isScoring || props.aiThinking) return; playSfx(props.selectedCards.includes(card.id) ? 'deselect' : 'select'); emit('selectCard', card.id) }
function onSort(event) { if (props.isScoring || props.aiThinking) return; playSfx('sort'); emit(event) }
function getCardEl(id) { return cardRefMap.value[id]?.$el || null }
defineExpose({ handCardsRef, getCardEl, cardRefMap })
</script>
<style scoped>
.condition-hint { color: #bfc4a7; font-size: 11px; line-height: 1.6; max-width: 920px; width: 100%; padding-top: 7px; }
.last-hand-hint { color: #e5c28c; }
.order-optimization-hint { color: #d9c28b; }
.hand-area > .score-breakdown { margin-top: 7px; }
.hand-area { padding: 0 clamp(18px,4vw,65px) 24px; display: flex; flex-direction: column; align-items: center; position: relative; z-index: 10; min-width: 0; }
.hand-preview { min-height: 50px; max-width: 100%; display: flex; align-items: center; justify-content: center; gap: 13px; padding: 9px 22px; color: #bdb69e; background: #0a1613bb; border: 1px solid #9b854c80; box-shadow: inset 0 0 0 4px #a58e4a08; font-size: 12px; border-radius: 2px; }
.preview-name { font: 20px var(--font-display); color: #e8d5a6; padding-right: 15px; border-right: 1px solid #ad97614a; } .hand-preview b { font: 26px Georgia,serif; margin-left: 5px; } .preview-chips { color: var(--chips-from); } .preview-mult { color: var(--mult-from); } .preview-total { padding-left: 14px; border-left: 1px solid #ad97614a; } .preview-total b { color: var(--gold); } .can-clear { font-size: 11px; color: #b8d8b2; padding: 4px 8px; border: 1px solid #5c8961; background: #34583c55; } .preview-idle { color: #b5ad94; letter-spacing: 2px; font-size: 12px; }
.hand-cards { display: flex; justify-content: center; width: 100%; max-width: 920px; padding-top: 30px; padding-bottom: 5px; }
.hand-cards :deep(.card-view) { width: clamp(66px,8.1vw,114px); height: auto; aspect-ratio: 2/3; }
.hand-cards :deep(.card-view + .card-view) { margin-left: -9px; }
.hand-meta { display: flex; justify-content: space-between; width: 100%; max-width: 860px; color: #9d9d82; font-size: 10px; margin: 8px 0 14px; letter-spacing: 1px; }
.hand-actions { display: flex; align-items: center; justify-content: space-between; width: 100%; max-width: 920px; gap: 15px; }
.actions-sort { display: flex; align-items: center; gap: 6px; } .actions-sort > span { font-size: 10px; color: #9e9a7e; margin-right: 4px; } .actions-sort button { padding: 9px 14px; min-height: 39px; font-size: 12px; }
.actions-main { display: flex; gap: 18px; } .actions-main button { min-width: 135px; } .actions-main small { margin-left: 7px; font-size: 12px; opacity: .7; }
.btn-ai { font-size: 12px; padding: 10px 18px; min-height: 39px; }
@media(max-height:750px) { .hand-area { padding-bottom: 17px; } .hand-cards :deep(.card-view) { width: clamp(62px,7.2vw,96px); } .hand-preview { min-height: 43px; padding: 6px 15px; } .hand-meta { margin: 5px 0 10px; } .hand-cards { padding-top: 25px; } }
@media(max-width:1000px) { .actions-sort > span { display: none; } .actions-main { gap: 10px; } .actions-main button { min-width: 95px; padding: 12px 15px; } .hand-actions { gap: 8px; } }
@media(max-width:700px) { .hand-preview { gap: 6px; padding: 8px; flex-wrap: wrap; } .hand-preview b { font-size: 19px; } .preview-name { font-size: 16px; padding-right: 8px; } .hand-actions { flex-wrap: wrap; justify-content: center; } .actions-main { order: -1; flex-basis: 100%; justify-content: center; } .hand-cards :deep(.card-view) { width: 62px; } .hand-cards :deep(.card-view + .card-view) { margin-left: -20px; } .preview-idle { font-size: 10px; letter-spacing: 0; } }
@media(max-width:600px) { .hand-cards :deep(.card-view) { width: clamp(42px,12vw,60px); } .hand-cards :deep(.card-view + .card-view) { margin-left: -10px; } .hand-area { padding-left: 12px; padding-right: 12px; } }
</style>
