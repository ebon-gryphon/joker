<template>
  <div class="hand-area">
    <!-- 手牌区域 -->
    <div class="hand-header">
      <span class="hand-label">手牌</span>
      <span class="hand-selected">已选 {{ selectedCount }} / 5 张</span>
    </div>

    <div class="hand-cards" ref="handCardsRef">
      <CardView
        v-for="card in hand"
        :key="card.id"
        :card="card"
        :isSelected="selectedCards.includes(card.id)"
        :ref="el => setCardRef(card.id, el)"
        @click="onCardClick(card)"
      />
    </div>

    <!-- 操作按钮区 -->
    <div class="hand-actions">
      <!-- 左侧：排序 -->
      <div class="actions-sort">
        <button class="px-btn btn-sort" @click="onSort('sortByRank')">
          按点排序
        </button>
        <button class="px-btn btn-sort" @click="onSort('sortBySuit')">
          按花排序
        </button>
      </div>

      <!-- 中间：出牌 + 弃牌 -->
      <div class="actions-main">
        <button
          class="px-btn btn-play"
          :disabled="selectedCount === 0 || isScoring"
          @click="$emit('play')"
        >
          出牌 ({{ selectedCount }})
        </button>
        <button
          class="px-btn btn-discard"
          :disabled="discardsLeft === 0 || selectedCount === 0 || isScoring"
          @click="$emit('discard')"
        >
          弃牌 ({{ discardsLeft }})
        </button>
      </div>

      <!-- 右侧：AI -->
      <div class="actions-ai">
        <button
          class="px-btn btn-ai"
          :class="{ 'ai-thinking': aiThinking }"
          :disabled="aiThinking || isScoring"
          @click="$emit('aiPlay')"
        >
          <span v-if="aiThinking">🤔 AI 思考中…</span>
          <span v-else>🤖 AI 出牌</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import CardView from './CardView.vue'
import { playSfx } from '../composables/useAudio.js'

const props = defineProps({
  hand: { type: Array, required: true },
  selectedCards: { type: Array, required: true },
  selectedCount: { type: Number, required: true },
  discardsLeft: { type: Number, required: true },
  isScoring: { type: Boolean, default: false },
  aiThinking: { type: Boolean, default: false },
})

const emit = defineEmits(['selectCard', 'play', 'discard', 'sortByRank', 'sortBySuit', 'aiPlay'])

const handCardsRef = ref(null)
const cardRefMap = ref({})

function setCardRef(cardId, el) {
  if (el) cardRefMap.value[cardId] = el
  else delete cardRefMap.value[cardId]
}

function onCardClick(card) {
  playSfx(props.selectedCards.includes(card.id) ? 'deselect' : 'select')
  emit('selectCard', card.id)
}

function onSort(event) {
  playSfx('sort')
  emit(event)
}

function getCardEl(cardId) {
  const ref = cardRefMap.value[cardId]
  return ref?.$el || null
}

defineExpose({ handCardsRef, getCardEl, cardRefMap })
</script>

<style scoped>
.hand-area {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px 16px 16px;
  gap: 10px;
  background: rgba(0,0,0,0.08);
}

/* 手牌标题行 */
.hand-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.hand-label {
  font-size: 14px;
  font-weight: 800;
  color: rgba(255,255,255,0.7);
  letter-spacing: 1px;
}

.hand-selected {
  font-size: 13px;
  color: var(--chips-from);
  font-weight: 600;
}

/* 手牌列表 */
.hand-cards {
  display: flex;
  gap: 8px;
  align-items: flex-end;
  flex-wrap: nowrap;
  padding-top: 28px;
  padding-bottom: 12px;
  overflow-x: auto;
  overflow-y: visible;
  min-height: 180px;
}

/* 操作按钮区 */
.hand-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

.actions-sort {
  display: flex;
  gap: 8px;
}

.actions-main {
  display: flex;
  gap: 10px;
  flex: 1;
  justify-content: center;
}

.actions-ai {
  display: flex;
}

/* AI 思考脉冲动画 */
.ai-thinking {
  animation: ai-pulse 1s ease-in-out infinite;
}

@keyframes ai-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>
