<template>
  <aside class="sidebar">
    <!-- Logo -->
    <div class="sb-logo">
      <div class="sb-logo-title">JOKER</div>
      <div class="sb-logo-sub">小丑牌</div>
    </div>

    <!-- 当前关卡 -->
    <div class="sb-panel sb-blind">
      <div class="sb-panel-label">当前盲注</div>
      <div class="sb-blind-name">
        {{ currentBlind.icon }} {{ currentBlind.name }}
      </div>
      <div class="sb-target">
        目标：<span class="sb-target-num">{{ currentBlind.target }}</span>
      </div>
    </div>

    <!-- 当前分数 -->
    <div class="sb-panel sb-score">
      <div class="sb-panel-label">当前得分</div>
      <div class="sb-score-num">{{ blindScore }}</div>
      <div class="sb-progress-bar">
        <div class="sb-progress-fill" :style="{ width: progress + '%', background: currentBlind.color }"></div>
      </div>
      <div class="sb-progress-text">{{ progress }}%</div>
    </div>

    <!-- 手数 + 弃牌 -->
    <div class="sb-panel sb-turns">
      <div class="sb-turns-row">
        <div class="sb-turns-item">
          <div class="sb-turns-label">手数</div>
          <div class="sb-turns-num" :class="{ danger: handsLeft <= 1 }">{{ handsLeft }}</div>
        </div>
        <div class="sb-turns-divider"></div>
        <div class="sb-turns-item">
          <div class="sb-turns-label">弃牌</div>
          <div class="sb-turns-num" :class="{ danger: discardsLeft === 0 }">{{ discardsLeft }}</div>
        </div>
      </div>
    </div>

    <!-- 金币 -->
    <div class="sb-panel sb-money">
      <div class="sb-panel-label">金币</div>
      <div class="sb-money-num">💰 {{ money }}</div>
    </div>

    <!-- 牌型预览 -->
    <div class="sb-panel sb-preview" v-if="previewScore">
      <div class="sb-panel-label">牌型预览</div>
      <div class="sb-hand-name">{{ previewScore.hand?.name }}</div>
      <div class="sb-preview-scores">
        <span class="sb-chips">chips {{ previewScore.chips }}</span>
        <span class="sb-x">×</span>
        <span class="sb-mult">mult {{ previewScore.mult }}</span>
      </div>
      <div class="sb-score-calc">= {{ previewScore.score }}</div>
    </div>
    <div class="sb-panel sb-preview" v-else>
      <div class="sb-panel-label">牌型预览</div>
      <div class="sb-preview-empty">选牌查看得分</div>
    </div>

    <!-- 关卡进度 -->
    <div class="sb-panel sb-rounds">
      <div class="sb-panel-label">关卡进度</div>
      <div class="sb-rounds-list">
        <div
          v-for="(blind, i) in BLINDS"
          :key="i"
          class="sb-round-item"
          :class="{
            'current': i === roundIndex,
            'done': i < roundIndex
          }"
        >
          <span class="sb-round-icon">{{ blind.icon }}</span>
          <span class="sb-round-name">{{ blind.name }}</span>
          <span class="sb-round-target">{{ blind.target }}</span>
        </div>
      </div>
    </div>

    <!-- 版本 -->
    <div class="sb-version">v0.1.0 · Joker Game</div>
  </aside>
</template>

<script setup>
import { BLINDS } from '../composables/useGameState.js'

defineProps({
  currentBlind: { type: Object, required: true },
  blindScore: { type: Number, required: true },
  progress: { type: Number, required: true },
  handsLeft: { type: Number, required: true },
  discardsLeft: { type: Number, required: true },
  money: { type: Number, required: true },
  previewScore: { type: Object, default: null },
  roundIndex: { type: Number, required: true },
})
</script>

<style scoped>
.sidebar {
  width: min(28vw, 480px);
  min-width: 280px;
  height: 100vh;
  background: linear-gradient(180deg, #0d1b40 0%, #121f4a 50%, #0a1438 100%);
  border-right: 1px solid rgba(74, 107, 255, 0.2);
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
  gap: 8px;
  overflow-y: auto;
  flex-shrink: 0;
}

/* Logo */
.sb-logo {
  text-align: center;
  padding: 8px 0 12px;
  border-bottom: 1px solid rgba(74, 107, 255, 0.3);
  margin-bottom: 4px;
}

.sb-logo-title {
  font-family: 'Press Start 2P', monospace;
  font-size: 22px;
  color: var(--gold);
  text-shadow: 0 0 20px rgba(255, 200, 87, 0.6);
  letter-spacing: 4px;
}

.sb-logo-sub {
  font-family: 'Inter', 'PingFang SC', sans-serif;
  font-size: 12px;
  color: rgba(255,255,255,0.5);
  margin-top: 4px;
}

/* 通用面板 */
.sb-panel {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(74, 107, 255, 0.2);
  border-radius: 10px;
  padding: 10px 12px;
}

.sb-panel-label {
  font-size: 12px;
  font-weight: 800;
  color: rgba(255,255,255,0.45);
  letter-spacing: 1px;
  text-transform: uppercase;
  margin-bottom: 6px;
}

/* 盲注 */
.sb-blind-name {
  font-size: 18px;
  font-weight: 800;
  color: #fff;
}

.sb-target {
  font-size: 13px;
  color: rgba(255,255,255,0.6);
  margin-top: 3px;
}

.sb-target-num {
  color: var(--gold);
  font-weight: 800;
  font-family: 'VT323', monospace;
  font-size: 18px;
}

/* 得分 */
.sb-score-num {
  font-family: 'VT323', monospace;
  font-size: 42px;
  color: #fff;
  line-height: 1;
  margin-bottom: 6px;
}

.sb-progress-bar {
  width: 100%;
  height: 8px;
  background: rgba(255,255,255,0.1);
  border-radius: 4px;
  overflow: hidden;
}

.sb-progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.sb-progress-text {
  font-size: 12px;
  color: rgba(255,255,255,0.5);
  text-align: right;
  margin-top: 3px;
}

/* 手数弃牌 */
.sb-turns-row {
  display: flex;
  align-items: center;
  justify-content: space-around;
}

.sb-turns-item {
  text-align: center;
}

.sb-turns-label {
  font-size: 12px;
  color: rgba(255,255,255,0.5);
  margin-bottom: 2px;
}

.sb-turns-num {
  font-family: 'VT323', monospace;
  font-size: 34px;
  color: #4dd6ff;
  line-height: 1;
}

.sb-turns-num.danger {
  color: #ff5544;
}

.sb-turns-divider {
  width: 1px;
  height: 40px;
  background: rgba(255,255,255,0.15);
}

/* 金币 */
.sb-money-num {
  font-family: 'VT323', monospace;
  font-size: 44px;
  color: var(--gold);
  line-height: 1;
}

/* 预览 */
.sb-hand-name {
  font-size: 15px;
  font-weight: 800;
  color: #fff;
  margin-bottom: 4px;
}

.sb-preview-scores {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.sb-chips {
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  color: var(--chips-from);
  background: rgba(77, 214, 255, 0.15);
  padding: 2px 6px;
  border-radius: 4px;
}

.sb-mult {
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  color: var(--mult-from);
  background: rgba(255, 136, 68, 0.15);
  padding: 2px 6px;
  border-radius: 4px;
}

.sb-x {
  font-family: 'Press Start 2P', monospace;
  font-size: 10px;
  color: rgba(255,255,255,0.6);
}

.sb-score-calc {
  font-family: 'VT323', monospace;
  font-size: 28px;
  color: var(--gold);
  line-height: 1;
}

.sb-preview-empty {
  font-size: 13px;
  color: rgba(255,255,255,0.3);
  font-style: italic;
}

/* 关卡进度 */
.sb-rounds-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sb-round-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  background: rgba(255,255,255,0.04);
  font-size: 13px;
  color: rgba(255,255,255,0.45);
  border: 1px solid transparent;
}

.sb-round-item.current {
  background: rgba(74, 107, 255, 0.15);
  border-color: rgba(74, 107, 255, 0.4);
  color: #fff;
}

.sb-round-item.done {
  color: rgba(255,255,255,0.3);
}

.sb-round-item.done .sb-round-icon::after {
  content: ' ✓';
  color: #62d18b;
}

.sb-round-icon {
  font-size: 16px;
}

.sb-round-name {
  flex: 1;
  font-weight: 700;
}

.sb-round-target {
  font-family: 'VT323', monospace;
  font-size: 18px;
  color: var(--gold);
}

/* 版本 */
.sb-version {
  margin-top: auto;
  text-align: center;
  font-size: 11px;
  color: rgba(255,255,255,0.2);
  padding-top: 8px;
}
</style>
