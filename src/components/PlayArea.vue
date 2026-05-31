<template>
  <div class="play-area">
    <!-- 出牌区域 -->
    <div class="played-zone">
      <!-- 空态提示 -->
      <div v-if="!playedCards.length && !isScoring" class="played-empty">
        选择手牌组成牌型（1-5 张）
      </div>

      <!-- 已打出的牌 -->
      <div v-if="playedCards.length" class="played-cards">
        <CardView
          v-for="card in playedCards"
          :key="card.id"
          :card="card"
        />
      </div>

      <!-- 牌型 + chips/mult 显示 -->
      <div v-if="scoringState.handType" class="scoring-display">
        <div class="scoring-hand-name">{{ scoringState.handType.name }}</div>
        <div class="scoring-chips-mult">
          <div class="scoring-chips-block">
            <div class="scoring-label">chips</div>
            <div class="scoring-value chips-value">{{ scoringState.chips }}</div>
          </div>
          <div class="scoring-x">×</div>
          <div class="scoring-mult-block">
            <div class="scoring-label">mult</div>
            <div class="scoring-value mult-value">{{ scoringState.mult }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 牌堆（绝对定位，右下角） -->
    <div class="deck-pile">
      <div class="deck-card-back">
        <img src="/card-back.png" class="deck-back-img" alt="card back" />
      </div>
      <div class="deck-count">
        <span class="deck-num">{{ deckCount }}</span>
        <span class="deck-slash">/52</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import CardView from './CardView.vue'

defineProps({
  playedCards: { type: Array, default: () => [] },
  deckCount: { type: Number, required: true },
  isScoring: { type: Boolean, default: false },
  scoringState: { type: Object, default: () => ({ handType: null, chips: 0, mult: 0 }) },
})
</script>

<style scoped>
.play-area {
  position: relative;
  height: 100%;
  /* 锁住栅格轨道，避免计分内容把 1fr 撑高导致底部按钮被裁切 */
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.1);
  border-bottom: 1px solid rgba(74, 107, 255, 0.15);
  padding: 10px 16px;
  /* 计分动画（高亮上抬、Joker 放大）允许溢出，避免被裁切；并提高层级画在最上层 */
  overflow: visible;
  z-index: 50;
}

/* 出牌区 */
.played-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  width: 100%;
  max-width: 720px;
  /* 计分内容整体提高优先级，确保完整展示在最上层 */
  position: relative;
  z-index: 60;
}

/* 出牌区里展示的牌尺寸 */
.played-cards :deep(.card-view) {
  width: 90px;
  height: 130px;
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
  gap: 12px;
  padding: 14px 28px;
  border-radius: 16px;
  background: rgba(10, 20, 56, 0.55);
  border: 2px solid rgba(255, 200, 87, 0.25);
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
}

.scoring-hand-name {
  font-family: 'Inter', 'PingFang SC', sans-serif;
  font-size: 24px;
  font-weight: 800;
  color: var(--gold);
  letter-spacing: 2px;
  text-shadow: 0 0 16px rgba(255,200,87,0.6);
}

.scoring-chips-mult {
  display: flex;
  align-items: center;
  gap: 20px;
}

.scoring-chips-block,
.scoring-mult-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 24px;
  border-radius: 12px;
  min-width: 150px;
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
  font-size: 34px;
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: default;
}

.deck-card-back {
  width: 80px;
  height: 115px;
  border-radius: 8px;
  position: relative;
  overflow: hidden;
  box-shadow: 3px 3px 0 rgba(0,0,0,0.4), 6px 6px 0 rgba(0,0,0,0.25);
}

.deck-back-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
  display: block;
}

.deck-count {
  text-align: center;
}

.deck-num {
  font-family: 'VT323', monospace;
  font-size: 16px;
  color: var(--gold);
}

.deck-slash {
  font-family: 'VT323', monospace;
  font-size: 14px;
  color: rgba(255, 200, 87, 0.6);
}
</style>
