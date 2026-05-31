<template>
  <div class="joker-area">
    <div class="joker-area-header">
      <span class="joker-title">JOKERS · {{ jokers.length }}/5</span>
    </div>
    <div class="joker-slots">
      <div
        v-for="i in 5"
        :key="i"
        class="joker-slot"
        :class="{ filled: jokers[i - 1] }"
      >
        <template v-if="jokers[i - 1]">
          <div
            class="joker-card"
            :class="'rarity-' + jokers[i - 1].rarity"
            :data-joker-index="i - 1"
          >
            <div class="joker-art">
              <div class="joker-card-back">
                <img src="/card-back.png" class="joker-back-img" alt="card back" />
                <span class="joker-card-emoji">{{ jokers[i - 1].art }}</span>
              </div>
            </div>
            <div class="joker-name">{{ jokers[i - 1].name }}</div>
            <div class="joker-desc">{{ jokers[i - 1].desc }}</div>
            <div class="joker-rarity-badge" :class="'badge-' + jokers[i - 1].rarity">
              {{ rarityLabel(jokers[i - 1].rarity) }}
            </div>
          </div>
        </template>
        <template v-else>
          <div class="joker-empty">
            <div class="joker-empty-plus">+</div>
            <div class="joker-empty-label">空槽</div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  jokers: { type: Array, required: true },
})

function rarityLabel(rarity) {
  const map = { common: '普通', rare: '稀有', legendary: '传说' }
  return map[rarity] || rarity
}
</script>

<style scoped>
.joker-area {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 12px 16px;
  background: rgba(0,0,0,0.15);
  border-bottom: 1px solid rgba(74, 107, 255, 0.15);
}

.joker-area-header {
  margin-bottom: 10px;
}

.joker-title {
  font-family: 'Press Start 2P', monospace;
  font-size: 12px;
  color: var(--gold);
  letter-spacing: 2px;
}

.joker-slots {
  display: flex;
  gap: 12px;
  align-items: center;
  flex: 1;
}

/* Joker 卡片 */
.joker-card {
  width: 140px;
  height: 200px;
  border-radius: 12px;
  background: linear-gradient(145deg, #1e2d60, #2a3d80);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px 8px;
  cursor: default;
  position: relative;
  transition: transform 0.2s ease;
}

.joker-card:hover {
  transform: translateY(-4px);
}

/* 稀有度描边 */
.rarity-common {
  box-shadow: 0 0 0 2px var(--rarity-common) inset, 0 4px 12px rgba(0,0,0,0.4);
  border: 2px solid var(--rarity-common);
}

.rarity-rare {
  box-shadow: 0 0 0 2px var(--rarity-rare) inset, 0 4px 16px rgba(227,75,111,0.3);
  border: 2px solid var(--rarity-rare);
}

.rarity-legendary {
  box-shadow: 0 0 0 2px var(--rarity-legendary) inset, 0 4px 20px rgba(181,119,255,0.4);
  border: 2px solid var(--rarity-legendary);
  animation: legendary-glow 2s ease-in-out infinite;
}

@keyframes legendary-glow {
  0%, 100% { box-shadow: 0 0 0 2px var(--rarity-legendary) inset, 0 4px 20px rgba(181,119,255,0.4); }
  50% { box-shadow: 0 0 0 2px var(--rarity-legendary) inset, 0 4px 30px rgba(181,119,255,0.7), 0 0 20px rgba(181,119,255,0.3); }
}

.joker-art {
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.joker-card-back {
  width: 72px;
  height: 100px;
  border-radius: 8px;
  position: relative;
  overflow: hidden;
}

.joker-back-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 8px;
}

.joker-card-emoji {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  z-index: 1;
}

.joker-name {
  font-family: 'Inter', 'PingFang SC', sans-serif;
  font-size: 13px;
  font-weight: 800;
  color: #fff;
  text-align: center;
  margin-bottom: 6px;
}

.joker-desc {
  font-family: 'Inter', 'PingFang SC', sans-serif;
  font-size: 11px;
  color: rgba(255,255,255,0.65);
  text-align: center;
  line-height: 1.4;
}

.joker-rarity-badge {
  position: absolute;
  top: 6px;
  right: 6px;
  font-size: 10px;
  font-weight: 800;
  padding: 2px 5px;
  border-radius: 4px;
}

.badge-common {
  background: rgba(108, 180, 211, 0.25);
  color: var(--rarity-common);
}

.badge-rare {
  background: rgba(227, 75, 111, 0.2);
  color: var(--rarity-rare);
}

.badge-legendary {
  background: rgba(181, 119, 255, 0.2);
  color: var(--rarity-legendary);
}

/* 空槽 */
.joker-slot {
  width: 140px;
  height: 200px;
  border-radius: 12px;
  flex-shrink: 0;
}

.joker-slot.filled {
  background: transparent;
}

.joker-empty {
  width: 100%;
  height: 100%;
  border: 2px dashed rgba(255,255,255,0.15);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.joker-empty-plus {
  font-size: 24px;
  color: rgba(255,255,255,0.2);
  line-height: 1;
}

.joker-empty-label {
  font-size: 12px;
  color: rgba(255,255,255,0.2);
}
</style>
