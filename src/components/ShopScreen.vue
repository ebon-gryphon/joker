<template>
  <div class="shop-screen">
    <div class="shop-header">
      <h2 class="shop-title">🏪 商店</h2>
      <div class="shop-money">
        <span class="shop-money-icon">💰</span>
        <span class="shop-money-num">{{ money }}</span>
      </div>
    </div>

    <div class="shop-subtitle">{{ nextBlind.icon }} 下一关：{{ nextBlind.name }}（目标 {{ nextBlind.target }}）</div>

    <!-- AI 建议 -->
    <div v-if="aiSuggestion" class="shop-ai-hint">
      🤖 AI 建议购买：<strong>{{ aiSuggestion.name }}</strong>
    </div>

    <div class="shop-items">
      <div
        v-for="item in shopItems"
        :key="item.id"
        class="shop-item"
        :class="'rarity-' + item.rarity"
      >
        <div class="shop-item-art">{{ item.art }}</div>
        <div class="shop-item-name">{{ item.name }}</div>
        <div class="shop-item-desc">{{ item.desc }}</div>
        <div class="shop-item-rarity" :class="'badge-' + item.rarity">
          {{ rarityLabel(item.rarity) }}
        </div>

        <button
          class="px-btn shop-buy-btn"
          :class="getBtnClass(item)"
          :disabled="getBtnDisabled(item)"
          @click="onBuy(item)"
        >
          {{ getBtnText(item) }}
        </button>
      </div>
    </div>

    <!-- Joker 槽满提示 -->
    <div v-if="jokersFull" class="shop-jokers-full">
      ⚠️ Joker 槽已满（5/5），无法购买更多
    </div>

    <div class="shop-actions">
      <button class="px-btn btn-skip" @click="$emit('skip')">
        跳过 →
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { getShopSuggestion } from '../composables/useAI.js'

const props = defineProps({
  shopItems: { type: Array, required: true },
  soldItems: { type: Object, required: true }, // Set
  money: { type: Number, required: true },
  jokerCount: { type: Number, required: true },
  nextBlind: { type: Object, required: true },
})

const emit = defineEmits(['buy', 'skip'])

const jokersFull = computed(() => props.jokerCount >= 5)

const aiSuggestion = computed(() => {
  const available = props.shopItems.filter(item => !props.soldItems.has(item.id))
  return getShopSuggestion(available, props.money)
})

function rarityLabel(rarity) {
  const map = { common: '普通', rare: '稀有', legendary: '传说' }
  return map[rarity] || rarity
}

function isSold(item) {
  return props.soldItems.has(item.id)
}

function canAfford(item) {
  return props.money >= item.price
}

function getBtnText(item) {
  if (isSold(item)) return '已售出'
  if (jokersFull.value) return '槽满了'
  if (!canAfford(item)) return `钱不够 ($${item.price})`
  return `购买 $${item.price}`
}

function getBtnClass(item) {
  if (isSold(item)) return 'btn-sold'
  if (jokersFull.value || !canAfford(item)) return 'btn-disabled-buy'
  return 'btn-buy'
}

function getBtnDisabled(item) {
  return isSold(item) || jokersFull.value || !canAfford(item)
}

function onBuy(item) {
  if (!getBtnDisabled(item)) {
    emit('buy', item.id)
  }
}
</script>

<style scoped>
.shop-screen {
  position: fixed;
  inset: 0;
  background: linear-gradient(135deg, #0a1438 0%, #1a2858 50%, #0d1b40 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  z-index: 100;
  padding: 32px;
}

.shop-header {
  display: flex;
  align-items: center;
  gap: 32px;
}

.shop-title {
  font-family: 'Inter', 'PingFang SC', sans-serif;
  font-size: 32px;
  font-weight: 800;
  color: var(--gold);
  text-shadow: 0 0 20px rgba(255,200,87,0.5);
}

.shop-money {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,200,87,0.1);
  border: 2px solid rgba(255,200,87,0.3);
  padding: 8px 16px;
  border-radius: 10px;
}

.shop-money-icon {
  font-size: 20px;
}

.shop-money-num {
  font-family: 'VT323', monospace;
  font-size: 36px;
  color: var(--gold);
  line-height: 1;
}

.shop-subtitle {
  font-size: 14px;
  color: rgba(255,255,255,0.55);
  font-weight: 600;
}

.shop-ai-hint {
  background: rgba(192, 132, 252, 0.12);
  border: 1px solid rgba(192, 132, 252, 0.35);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  color: #c084fc;
}

/* 商店商品 */
.shop-items {
  display: flex;
  gap: 24px;
  justify-content: center;
}

.shop-item {
  width: 160px;
  background: linear-gradient(145deg, #1e2d60, #2a3d80);
  border-radius: 14px;
  padding: 16px 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  position: relative;
  transition: transform 0.2s ease;
}

.shop-item:hover {
  transform: translateY(-4px);
}

.rarity-common {
  border: 2px solid var(--rarity-common);
  box-shadow: 0 4px 16px rgba(108, 180, 211, 0.2);
}

.rarity-rare {
  border: 2px solid var(--rarity-rare);
  box-shadow: 0 4px 20px rgba(227, 75, 111, 0.3);
}

.rarity-legendary {
  border: 2px solid var(--rarity-legendary);
  box-shadow: 0 4px 24px rgba(181, 119, 255, 0.4);
  animation: shop-legendary 2s ease-in-out infinite;
}

@keyframes shop-legendary {
  0%, 100% { box-shadow: 0 4px 24px rgba(181, 119, 255, 0.4); }
  50% { box-shadow: 0 4px 36px rgba(181, 119, 255, 0.7), 0 0 20px rgba(181, 119, 255, 0.3); }
}

.shop-item-art {
  font-size: 48px;
  line-height: 1;
}

.shop-item-name {
  font-family: 'Inter', 'PingFang SC', sans-serif;
  font-size: 15px;
  font-weight: 800;
  color: #fff;
  text-align: center;
}

.shop-item-desc {
  font-size: 12px;
  color: rgba(255,255,255,0.6);
  text-align: center;
  line-height: 1.4;
  flex: 1;
}

.shop-item-rarity {
  font-size: 11px;
  font-weight: 800;
  padding: 2px 8px;
  border-radius: 4px;
}

.badge-common { background: rgba(108,180,211,0.2); color: var(--rarity-common); }
.badge-rare { background: rgba(227,75,111,0.2); color: var(--rarity-rare); }
.badge-legendary { background: rgba(181,119,255,0.2); color: var(--rarity-legendary); }

/* 购买按钮 */
.shop-buy-btn {
  width: 100%;
  min-height: 44px;
  padding: 10px;
  font-size: 13px;
  border-radius: 8px;
}

.btn-sold {
  background: rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.3);
  border-color: rgba(255,255,255,0.1);
  cursor: not-allowed;
}

.btn-disabled-buy {
  background: rgba(255,255,255,0.08);
  color: rgba(255,255,255,0.3);
  border-color: rgba(255,255,255,0.1);
}

/* 满槽提示 */
.shop-jokers-full {
  background: rgba(255, 85, 68, 0.12);
  border: 1px solid rgba(255, 85, 68, 0.3);
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  color: #ff5544;
}

/* 操作区 */
.shop-actions {
  margin-top: 8px;
}
</style>
