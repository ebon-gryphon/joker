<template>
  <div class="end-screen">
    <div class="end-content" :class="isWon ? 'end-won' : 'end-lost'">
      <!-- 图标 -->
      <div class="end-icon">{{ isWon ? '♛' : '♠' }}</div>

      <!-- 标题 -->
      <div class="end-title">{{ isWon ? 'YOU WIN!' : 'GAME OVER' }}</div>

      <!-- 中文描述 -->
      <div class="end-subtitle">
        {{ isWon ? '恭喜通关！你征服了所有盲注！' : '手数耗尽，遗憾败北...' }}
      </div>

      <!-- 统计 -->
      <p class="end-subtitle">到达第 {{ roundNumber }} / {{ totalRounds }} 关 · {{ currentBlind.name }}</p>
      <p v-if="!isWon" class="end-deficit">离目标还差 {{ Math.max(0, currentBlind.target - blindScore).toLocaleString() }} 分<span v-if="discardsLeft > 0"> · 剩余 {{ discardsLeft }} 次弃牌</span></p>
      <div class="end-stats">
        <div class="end-stat">
          <div class="end-stat-label">本关得分</div>
          <div class="end-stat-value">{{ blindScore }}</div>
        </div>
        <div class="end-stat">
          <div class="end-stat-label">目标</div>
          <div class="end-stat-value">{{ currentBlind.target }}</div>
        </div>
        <div class="end-stat">
          <div class="end-stat-label">金币</div>
          <div class="end-stat-value">＄ {{ money }}</div>
        </div>
        <div class="end-stat">
          <div class="end-stat-label">Joker 数</div>
          <div class="end-stat-value">{{ jokerCount }}</div>
        </div>
      </div>

      <ScoreBreakdown v-if="lastHand" :result="lastHand.result" :cards="lastHand.cards" title="复盘最后一手" />

      <!-- 重新开始 -->
      <button class="px-btn btn-restart" @click="$emit('restart')">
        再来一局
      </button>
    </div>
  </div>
</template>

<script setup>
import ScoreBreakdown from './ScoreBreakdown.vue'
defineProps({
  isWon: { type: Boolean, required: true },
  blindScore: { type: Number, required: true },
  currentBlind: { type: Object, required: true },
  money: { type: Number, required: true },
  jokerCount: { type: Number, required: true },
  roundNumber: { type: Number, required: true },
  totalRounds: { type: Number, required: true },
  discardsLeft: { type: Number, default: 0 },
  lastHand: { type: Object, default: null },
})

defineEmits(['restart'])
</script>

<style scoped>
.end-screen {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.end-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 48px;
  border-radius: 4px;
  max-width: 480px;
  width: 90%;
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  animation: end-appear 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

@keyframes end-appear {
  from { opacity: 0; transform: scale(0.8) translateY(20px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

.end-won {
  background: linear-gradient(145deg, #243d29, #102116);
  border: 1px solid #b59b59;
  box-shadow: 0 0 60px rgba(98, 209, 139, 0.3), 0 20px 60px rgba(0,0,0,0.5);
}

.end-lost {
  background: linear-gradient(145deg, #342422, #201715);
  border: 1px solid #926456;
  box-shadow: 0 0 60px rgba(255, 85, 68, 0.3), 0 20px 60px rgba(0,0,0,0.5);
}

.end-icon {
  font-size: 72px;
  line-height: 1;
}

.end-title {
  font-family: Georgia, serif;
  font-size: 32px;
  color: #fff;
  text-shadow: 0 0 20px currentColor;
  letter-spacing: 4px;
}

.end-won .end-title {
  color: #62d18b;
  text-shadow: 0 0 20px rgba(98, 209, 139, 0.6);
}

.end-lost .end-title {
  color: #ff5544;
  text-shadow: 0 0 20px rgba(255, 85, 68, 0.6);
}

.end-subtitle {
  font-family: 'Inter', 'PingFang SC', sans-serif;
  font-size: 16px;
  font-weight: 600;
  color: rgba(255,255,255,0.7);
  text-align: center;
}
.end-deficit { color: #e6bc92; font-size: 13px; text-align: center; line-height: 1.6; }

/* 统计 */
.end-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  width: 100%;
}

.end-stat {
  background: rgba(255,255,255,0.06);
  border-radius: 4px;
  padding: 14px;
  text-align: center;
}

.end-stat-label {
  font-size: 12px;
  color: rgba(255,255,255,0.5);
  margin-bottom: 6px;
  font-weight: 600;
}

.end-stat-value {
  font-family: Georgia, serif;
  font-size: 32px;
  color: var(--gold);
  line-height: 1;
}

/* 重开按钮 */
.btn-restart {
  background: linear-gradient(135deg, #dfc68e, #b9995d);
  color: #1a1a1a;
  font-size: 18px;
  padding: 16px 40px;
  margin-top: 8px;
}
@media (max-height: 750px), (max-width: 600px) {
  .end-content { padding: 24px; gap: 14px; }
  .end-icon { font-size: 48px; }
  .end-subtitle { font-size: 14px; }
  .end-stat { padding: 10px; }
}
</style>
