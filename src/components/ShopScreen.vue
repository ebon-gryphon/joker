<template>
  <div class="shop-screen">
    <div class="shop-header">
      <h2 class="shop-title">小丑商店</h2>
      <div class="shop-money">
        <span class="shop-money-icon">＄</span>
        <span class="shop-money-num">{{ money }}</span>
      </div>
    </div>

    <div class="shop-subtitle">
      第 {{ nextBlind.act }} 幕 · {{ nextBlind.icon }} 下一关 {{ nextBlind.name }}（目标 {{ nextBlind.target }}）
    </div>

    <div v-if="lastReward" class="shop-subtitle">过关收入 ${{ lastReward.base }} + 小丑奖励 ${{ lastReward.bonus }} = ${{ lastReward.total }}</div>
    <button class="px-btn catalog-button" @click="$emit('catalog')">浏览 {{ JOKER_POOL.length }} 张小丑牌图鉴 ↗</button>
    <!-- AI 建议 -->
    <div v-if="aiSuggestion" class="shop-ai-hint">
      推荐组合：<strong>{{ aiSuggestion.name }}</strong>
    </div>

    <div class="shop-items">
      <div
        v-for="item in shopItems"
        :key="item.id"
        class="shop-item"
        :class="'rarity-' + item.rarity"
      >
        <JokerArt class="shop-item-art" :joker="item" />
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
      Joker 槽已满（5/5），可出售下方已拥有的牌来腾出位置
    </div>

    <section v-if="jokers.length" class="owned-section">
      <p>我的组合 · 从左到右结算 · 出售返还半价（向下取整）</p>
      <div class="owned-items">
        <article v-for="(joker, index) in jokers" :key="joker.id" :title="joker.desc">
          <JokerArt class="owned-art" :joker="joker" /><strong>{{ joker.name }}</strong><small>{{ jokerStatus(joker) || joker.desc }}</small>
          <div><button :disabled="index === 0" :aria-label="`左移${joker.name}`" @click="$emit('move', index, -1)">←</button><button :disabled="index === jokers.length - 1" :aria-label="`右移${joker.name}`" @click="$emit('move', index, 1)">→</button><button @click="$emit('sell', joker.id)">出售 ${{ Math.max(1, Math.floor(joker.price / 2)) }}</button></div>
        </article>
      </div>
    </section>
    <div class="shop-actions">
      <button
        class="px-btn btn-reroll"
        :disabled="!canReroll"
        @click="onReroll"
      >
        重新进货 ${{ rerollCost }}
      </button>
      <button class="px-btn btn-skip" @click="onSkip">
        下一关 →
      </button>
    </div>
  </div>
</template>

<script setup>
import JokerArt from './JokerArt.vue'
import { computed } from 'vue'
import { JOKER_POOL, jokerStatus } from '../composables/jokerCatalog.js'
import { getShopSuggestion } from '../composables/useAI.js'
import { playSfx } from '../composables/useAudio.js'

const props = defineProps({
  jokers: { type: Array, default: () => [] },
  lastReward: { type: Object, default: null },
  shopItems: { type: Array, required: true },
  soldItems: { type: Object, required: true }, // Set
  money: { type: Number, required: true },
  jokerCount: { type: Number, required: true },
  nextBlind: { type: Object, required: true },
  rerollCost: { type: Number, required: true },
})

const emit = defineEmits(['buy', 'reroll', 'skip', 'sell', 'move', 'catalog'])

const jokersFull = computed(() => props.jokerCount >= 5)
const canReroll = computed(() => props.money >= props.rerollCost)

const aiSuggestion = computed(() => {
  if (jokersFull.value) return null
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
    playSfx('buy')
    emit('buy', item.id)
  }
}

function onSkip() {
  playSfx('skip')
  emit('skip')
}

function onReroll() {
  if (canReroll.value) emit('reroll')
}
</script>

<style scoped>
.owned-section { width: min(850px, 100%); }
.owned-section p { color: #b9ad90; font-size: 12px; margin: 0 0 10px; }
.owned-items { display: flex; flex-wrap: wrap; gap: 10px; }
.owned-items article { flex: 1; min-width: 140px; padding: 10px; background: #ffffff09; border: 1px solid #ffffff22; border-radius: 3px; }
.owned-items strong { font-size: 12px; color: white; }
.owned-items small { display: block; font-size: 10px; color: #c0b799; min-height: 30px; margin: 8px 0; }
.owned-items button { color: #ffd17b; background: transparent; border: 1px solid #ffffff33; border-radius: 4px; margin-right: 4px; padding: 4px; cursor: pointer; }
.owned-items button:disabled { opacity: .25; }
.catalog-button { font-size: 12px; min-height: 32px; padding: 8px 16px; }

.shop-screen {
  position: fixed;
  inset: 0;
  background: radial-gradient(ellipse at 50% 20%,#173c2710,#04180bc9),url('/felt.svg');
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  overflow-y: auto;
  gap: 16px;
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
  font-family: var(--font-display);
  font-weight: 600;
  color: var(--gold);
  letter-spacing: 5px;
}

.shop-money {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,200,87,0.1);
  border: 2px solid rgba(255,200,87,0.3);
  padding: 8px 16px;
  border-radius: 4px;
}

.shop-money-icon {
  font-size: 20px;
}

.shop-money-num {
  font-family: Georgia, serif;
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
  background: rgba(189, 165, 97, 0.08);
  border: 1px solid rgba(189, 165, 97, 0.3);
  padding: 8px 16px;
  border-radius: 3px;
  font-size: 14px;
  color: #c3b27e;
}

/* 商店商品 */
.shop-items {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  justify-content: center;
}

.shop-item {
  width: 215px;
  background: linear-gradient(145deg, #24382b, #1a2a20);
  border-radius: 4px;
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

.shop-item-art { width: 120px; box-shadow: 2px 4px 12px #0006; }
.owned-art { width: 64px; margin: 0 auto 10px; }

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
  border-radius: 3px;
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
  border-radius: 3px;
  font-size: 13px;
  color: #ff5544;
}

/* 操作区 */
.shop-actions {
  margin-top: 8px;
  display: flex;
  gap: 12px;
}

.btn-reroll {
  background: transparent;
  color: #c3b27e;
  border-color: rgba(189, 165, 97, 0.5);
}
@media(max-width:600px) { .shop-screen { padding: 22px 15px; }.shop-header { gap: 18px; }.shop-title { font-size: 26px; }.shop-items { gap: 12px; }.shop-item { width: min(215px,100%); }.shop-subtitle { text-align: center; font-size: 12px; } .shop-actions .px-btn { padding: 12px 16px; font-size: 14px; } }
</style>
