<template>
  <div class="play-area" ref="playAreaRef">
    <!-- 出牌区域 -->
    <div class="played-zone" ref="playedZoneRef">
      <!-- 空态提示 -->
      <div v-if="!playedCards.length && !isScoring" class="played-empty">
        选择手牌组成牌型（1-5 张）
      </div>

      <!-- 已打出的牌 -->
      <div v-if="playedCards.length" class="played-cards">
        <CardView
          v-for="(card, idx) in playedCards"
          :key="card.id"
          :card="card"
          :ref="el => { if (el) cardRefs.value[idx] = el }"
        />
      </div>

      <!-- 牌型 + chips/mult 显示 -->
      <div v-if="scoringState.handType" class="scoring-display">
        <div class="scoring-hand-name">{{ scoringState.handType.name }}</div>
        <div class="scoring-chips-mult">
          <div class="scoring-chips-block" ref="chipsBlockRef">
            <div class="scoring-label">chips</div>
            <div class="scoring-value chips-value">{{ scoringState.chips }}</div>
          </div>
          <div class="scoring-x">×</div>
          <div class="scoring-mult-block" ref="multBlockRef">
            <div class="scoring-label">mult</div>
            <div class="scoring-value mult-value">{{ scoringState.mult }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 牌堆（绝对定位，右下角） -->
    <div class="deck-pile" ref="deckRef">
      <div class="deck-card deck-card-1"></div>
      <div class="deck-card deck-card-2"></div>
      <div class="deck-card deck-card-3"></div>
      <div class="deck-count">
        <span class="deck-num">{{ deckCount }}</span>
        <span class="deck-slash">/52</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import CardView from './CardView.vue'

const props = defineProps({
  playedCards: { type: Array, default: () => [] },
  deckCount: { type: Number, required: true },
  isScoring: { type: Boolean, default: false },
  scoringState: { type: Object, default: () => ({ handType: null, chips: 0, mult: 0 }) },
})

const playAreaRef = ref(null)
const playedZoneRef = ref(null)
const deckRef = ref(null)
const chipsBlockRef = ref(null)
const multBlockRef = ref(null)
const cardRefs = ref([])

defineExpose({ playAreaRef, playedZoneRef, deckRef, chipsBlockRef, multBlockRef, cardRefs })
</script>

<style scoped>
.play-area {
  position: relative;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.1);
  border-bottom: 1px solid rgba(74, 107, 255, 0.15);
  padding: 16px;
  overflow: hidden;
}

/* 出牌区 */
.played-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  width: 100%;
  max-width: 700px;
}

.played-empty {
  font-family: 'Inter', 'PingFang SC', sans-serif;
  font-size: 14px;
  color: rgba(255,255,255,0.55);
  opacity: 0.55;
  text-align: center;
}

.played-cards {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: center;
  flex-wrap: nowrap;
}

/* 计分显示 */
.scoring-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.scoring-hand-name {
  font-family: 'Inter', 'PingFang SC', sans-serif;
  font-size: 20px;
  font-weight: 800;
  color: var(--gold);
  letter-spacing: 2px;
  text-shadow: 0 0 16px rgba(255,200,87,0.6);
}

.scoring-chips-mult {
  display: flex;
  align-items: center;
  gap: 16px;
}

.scoring-chips-block,
.scoring-mult-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 16px;
  border-radius: 10px;
  min-width: 120px;
}

.scoring-chips-block {
  background: linear-gradient(135deg, rgba(77, 214, 255, 0.2), rgba(33, 150, 243, 0.2));
  border: 2px solid rgba(77, 214, 255, 0.4);
}

.scoring-mult-block {
  background: linear-gradient(135deg, rgba(255, 136, 68, 0.2), rgba(255, 51, 68, 0.2));
  border: 2px solid rgba(255, 136, 68, 0.4);
}

.scoring-label {
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  color: rgba(255,255,255,0.6);
  margin-bottom: 4px;
}

.scoring-value {
  font-family: 'Press Start 2P', monospace;
  font-size: 28px;
  line-height: 1;
}

.chips-value {
  color: var(--chips-from);
  text-shadow: 0 0 10px var(--chips-from);
}

.mult-value {
  color: var(--mult-from);
  text-shadow: 0 0 10px var(--mult-from);
}

.scoring-x {
  font-family: 'Press Start 2P', monospace;
  font-size: 24px;
  color: rgba(255,255,255,0.7);
}

/* 牌堆 */
.deck-pile {
  position: absolute;
  bottom: 16px;
  right: 16px;
  width: 90px;
  height: 130px;
  cursor: default;
}

.deck-card {
  position: absolute;
  width: 80px;
  height: 115px;
  border-radius: 8px;
  background: linear-gradient(135deg, #2a1a6e, #3d2490);
  border: 2px solid rgba(120, 80, 200, 0.6);
}

/* 紫色花纹装饰 */
.deck-card::after {
  content: '';
  position: absolute;
  inset: 4px;
  border: 1px dashed rgba(150, 100, 220, 0.4);
  border-radius: 4px;
}

.deck-card-1 {
  bottom: 0;
  right: 0;
  transform: rotate(-3deg);
  z-index: 1;
}

.deck-card-2 {
  bottom: 3px;
  right: 3px;
  transform: rotate(0deg);
  z-index: 2;
}

.deck-card-3 {
  bottom: 6px;
  right: 6px;
  transform: rotate(3deg);
  z-index: 3;
  background: linear-gradient(135deg, #3d2490, #4a2fa0);
}

.deck-count {
  position: absolute;
  bottom: -4px;
  left: 0;
  right: 0;
  text-align: center;
  z-index: 4;
}

.deck-num {
  font-family: 'VT323', monospace;
  font-size: 14px;
  color: var(--gold);
}

.deck-slash {
  font-family: 'VT323', monospace;
  font-size: 12px;
  color: rgba(255, 200, 87, 0.6);
}
</style>
