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
    <div class="shop-ai-hint" role="status">
      <span>本店参考 · </span><strong>{{ suggestionText }}</strong>
      <small>{{ suggestionCondition || '根据当前组合与剩余关卡估算，选牌仍由你决定。' }}</small>
    </div>

    <div class="shop-items">
      <div
        v-for="item in shopItems"
        :key="item.id"
        class="shop-item"
        :class="['rarity-' + item.rarity, { 'replacement-chosen': replacementId === item.id }]"
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
      Joker 槽已满（5/5），点击商品可选择旧牌替换，确认后才会出售
    </div>

    <section v-if="replacementItem" ref="replacementPanel" class="classic-replacement" aria-labelledby="classic-replacement-title">
      <div class="classic-replacement-heading"><div><h3 id="classic-replacement-title">换入{{ replacementItem.name }} · ${{ replacementItem.price }}</h3><p>{{ replacementItem.desc }}</p></div><button class="px-btn btn-sort" @click="cancelReplacement">取消替换</button></div>
      <p class="classic-replacement-note">选择要出售的一张牌。确认前，你的金币和阵容都不会改变。</p>
      <div class="classic-replacement-options">
        <button v-for="choice in replacementChoices" :key="choice.joker.id" class="classic-replacement-option" :class="{ selected: replacementSellId === choice.joker.id }" :disabled="choice.cash < 0" :aria-pressed="replacementSellId === choice.joker.id" @click="replacementSellId = choice.joker.id">
          <JokerArt class="classic-replacement-art" :joker="choice.joker"/>
          <span class="classic-replacement-copy"><strong>出售{{ choice.joker.name }}</strong><small>{{ choice.joker.desc }}</small><small v-if="jokerStatus(choice.joker)" class="classic-growth">{{ jokerStatus(choice.joker) }}</small></span>
          <span class="classic-replacement-price"><span>卖价 +${{ choice.resale }}</span><strong>{{ costLabel(choice.cost) }}</strong><small>{{ choice.cash >= 0 ? `替换后剩 $${choice.cash}` : `还差 $${-choice.cash}` }}</small></span>
        </button>
      </div>
      <p class="classic-replacement-summary" aria-live="polite">{{ replacementChoice ? `卖出${replacementChoice.joker.name}得 $${replacementChoice.resale}，买入${replacementItem.name}需 $${replacementItem.price}，${costLabel(replacementChoice.cost)}，剩余 $${replacementChoice.cash}。` : '请选择一张旧牌；取消不会出售任何牌。' }}</p>
      <button class="px-btn btn-buy classic-replacement-confirm" :disabled="!canReplace" @click="confirmReplacement">确认替换</button>
    </section>

    <section v-if="jokers.length" class="owned-section">
      <p>我的组合 · 从左到右结算 · 出售返还半价（向下取整）</p>
      <div class="owned-items">
        <article v-for="(joker, index) in jokers" :key="joker.id" :title="joker.desc">
          <JokerArt class="owned-art" :joker="joker" /><strong>{{ joker.name }}</strong><small>{{ joker.desc }}</small><small v-if="jokerStatus(joker)" class="classic-growth">{{ jokerStatus(joker) }}</small>
          <div><button :disabled="index === 0" :aria-label="`左移${joker.name}`" @click="$emit('move', index, -1)">←</button><button :disabled="index === jokers.length - 1" :aria-label="`右移${joker.name}`" @click="$emit('move', index, 1)">→</button><button @click="$emit('sell', joker.id)">出售 ${{ Math.max(1, Math.floor(joker.price / 2)) }}</button></div>
        </article>
      </div>
    </section>
    <div class="shop-actions">
      <span class="shop-action-wallet">金币 <strong>${{ money }}</strong> · {{ jokerCount }}/5 槽</span>
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
import { computed, nextTick, ref, watch } from 'vue'
import { JOKER_POOL, jokerStatus } from '../composables/jokerCatalog.js'
import { chooseShopMove } from '../strategy/jokerPlanning.js'
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
  remainingRounds: { type: Number, default: 11 },
})

const emit = defineEmits(['buy', 'replace', 'reroll', 'skip', 'sell', 'move', 'catalog'])

const jokersFull = computed(() => props.jokerCount >= 5)
const canReroll = computed(() => props.money >= props.rerollCost)

const available = computed(() => props.shopItems.filter(item => !isSold(item) && !isOwned(item)))
const suggestion = computed(() => chooseShopMove({ jokers: props.jokers, money: props.money }, available.value, {
  remainingRounds: props.remainingRounds, maxRemainingRounds: 12, maxJokers: 5, handsPerRound: 4, discardsPerRound: 3,
}))
const suggestionItem = computed(() => available.value.find(item => item.id === suggestion.value.id))
const suggestionText = computed(() => {
  if (!suggestionItem.value) return '本店可以先攒钱'
  if (suggestion.value.type === 'replace') {
    const sold = props.jokers.find(joker => joker.id === suggestion.value.sellId)
    return sold ? `用${sold.name}换入${suggestionItem.value.name}` : `考虑${suggestionItem.value.name}`
  }
  return `考虑购入${suggestionItem.value.name}`
})
const suggestionCondition = computed(() => {
  const item = suggestionItem.value
  if (!item) return '目前没有明显合适的可购买选择，可以留钱，或自行决定是否重新进货。'
  const trigger = item.id === 'phoenix' ? '需要主动规划到最后一手，并用完弃牌机会。' : item.id === 'empty_pockets' ? '需要主动用完弃牌机会才能触发。' : item.id === 'last_hand' ? '只在本关最后一次出牌时触发，提前过关可能用不到。' : ''
  return `${item.desc}${trigger ? ` · ${trigger}` : ''} · 这是构筑参考，不保证过关。`
})
const replacementId = ref(null), replacementSellId = ref(null), replacementPanel = ref(null)
const resaleValue = joker => Math.max(1, Math.floor(joker.price / 2))
const replacementItem = computed(() => available.value.find(item => item.id === replacementId.value) || null)
const replacementChoices = computed(() => replacementItem.value ? props.jokers.map(joker => ({ joker, resale: resaleValue(joker), cost: replacementItem.value.price - resaleValue(joker), cash: props.money + resaleValue(joker) - replacementItem.value.price })) : [])
const replacementChoice = computed(() => replacementChoices.value.find(choice => choice.joker.id === replacementSellId.value) || null)
const canReplace = computed(() => replacementItem.value && replacementChoice.value && replacementChoice.value.cash >= 0)

function cancelReplacement() { replacementId.value = null; replacementSellId.value = null }
watch(() => props.shopItems, cancelReplacement)
watch([replacementItem, () => props.jokers.map(joker => joker.id).join(',')], () => {
  if (!replacementId.value) return
  if (!replacementItem.value || !jokersFull.value) { cancelReplacement(); return }
  if (!props.jokers.some(joker => joker.id === replacementSellId.value)) replacementSellId.value = null
})

function rarityLabel(rarity) {
  const map = { common: '普通', rare: '稀有', legendary: '传说' }
  return map[rarity] || rarity
}

function isSold(item) {
  return props.soldItems.has(item.id)
}

function isOwned(item) { return props.jokers.some(joker => joker.id === item.id) }
function shortfall(item) {
  const resale = jokersFull.value ? Math.max(0, ...props.jokers.map(resaleValue)) : 0
  return Math.max(0, item.price - props.money - resale)
}
function costLabel(cost) { return cost >= 0 ? `补差 $${cost}` : `净得 $${-cost}` }

function canAfford(item) {
  return props.money >= item.price
}

function getBtnText(item) {
  if (isSold(item)) return '已售出'
  if (isOwned(item)) return '已拥有'
  if (jokersFull.value) return shortfall(item) ? `替换仍差 $${shortfall(item)}` : '选择替换'
  if (!canAfford(item)) return `还差 $${shortfall(item)}`
  return `购买 $${item.price}`
}

function getBtnClass(item) {
  if (isSold(item)) return 'btn-sold'
  if (getBtnDisabled(item)) return 'btn-disabled-buy'
  return 'btn-buy'
}

function getBtnDisabled(item) {
  return isSold(item) || isOwned(item) || shortfall(item) > 0
}

async function onBuy(item) {
  if (!getBtnDisabled(item)) {
    if (jokersFull.value) {
      replacementId.value = item.id
      replacementSellId.value = null
      await nextTick()
      replacementPanel.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      replacementPanel.value?.querySelector('.classic-replacement-option:not(:disabled)')?.focus({ preventScroll: true })
      return
    }
    emit('buy', item.id)
  }
}

function confirmReplacement() {
  if (!canReplace.value) return
  emit('replace', { sellId: replacementSellId.value, buyId: replacementId.value })
}

function onSkip() {
  cancelReplacement()
  playSfx('skip')
  emit('skip')
}

function onReroll() {
  if (canReroll.value) { cancelReplacement(); emit('reroll') }
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
  scroll-padding: 20px 0 150px;
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
  max-width: min(850px, 100%);
  line-height: 1.7;
}
.shop-ai-hint small { display: block; margin-top: 4px; color: #b8b39f; font-size: 11px; }

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
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  position: sticky;
  bottom: 8px;
  z-index: 2;
  padding: 12px;
  border: 1px solid #b39a5b70;
  border-radius: 5px;
  background: #11251bf5;
}
.shop-action-wallet { color: #bdbea4; font-size: 12px; white-space: nowrap; }
.shop-action-wallet strong { color: var(--gold); font: 20px Georgia, serif; margin-left: 4px; }
.owned-items .classic-growth { min-height: 0; margin-top: -2px; color: #e3c481; }
.owned-items button { min-height: 40px; min-width: 40px; }
.shop-item.replacement-chosen { box-shadow: 0 0 0 2px var(--gold), 0 8px 24px #0006; }
.classic-replacement { width: min(850px, 100%); padding: 20px; border: 1px solid #c6a65e; border-radius: 6px; background: #1e3426; }
.classic-replacement-heading { display: flex; justify-content: space-between; align-items: flex-start; gap: 15px; }
.classic-replacement-heading h3 { color: var(--gold); font: 600 20px var(--font-display); margin: 0 0 6px; }
.classic-replacement-heading p,.classic-replacement-note,.classic-replacement-summary { color: #c5c7af; font-size: 12px; line-height: 1.7; }
.classic-replacement-heading p { margin: 0; }
.classic-replacement-heading button { min-height: 40px; white-space: nowrap; padding: 8px 12px; font-size: 12px; }
.classic-replacement-note { margin: 13px 0; }
.classic-replacement-options { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
.classic-replacement-option { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 12px; border: 1px solid #9fa37b70; border-radius: 5px; background: #11281c; color: #c9cbb8; text-align: left; cursor: pointer; }
.classic-replacement-option.selected { border-color: #efd28a; background: #3c5031; box-shadow: inset 0 0 0 1px #efd28a70; }
.classic-replacement-option:disabled { opacity: .45; cursor: not-allowed; }
.classic-replacement-art { width: 40px; flex: 0 0 40px; }
.classic-replacement-copy { min-width: 0; flex: 1; }
.classic-replacement-copy strong,.classic-replacement-copy small,.classic-replacement-price span,.classic-replacement-price strong,.classic-replacement-price small { display: block; }
.classic-replacement-copy strong { color: #e4d3a0; font-size: 12px; line-height: 1.6; }
.classic-replacement-copy small { font-size: 10px; margin-top: 4px; line-height: 1.6; overflow-wrap: anywhere; }
.classic-replacement-copy .classic-growth { color: #e3c481; }
.classic-replacement-price { color: #e1c689; font-size: 11px; line-height: 1.7; text-align: right; white-space: nowrap; }
.classic-replacement-price strong { font-size: 12px; }
.classic-replacement-price small { color: #b9c1a9; font-size: 10px; }
.classic-replacement-summary { margin: 14px 0 10px; }
.classic-replacement-confirm { width: 100%; min-height: 44px; }

.btn-reroll {
  background: transparent;
  color: #c3b27e;
  border-color: rgba(189, 165, 97, 0.5);
}
@media(max-width:600px) { .shop-screen { padding: 22px 15px; }.shop-header { gap: 18px; }.shop-title { font-size: 26px; }.shop-items { gap: 12px; }.shop-item { width: min(215px,100%); }.shop-subtitle { text-align: center; font-size: 12px; } .shop-actions .px-btn { padding: 12px 16px; font-size: 14px; } }
@media(max-width:600px) { .classic-replacement { padding: 14px; }.classic-replacement-options { grid-template-columns: 1fr; }.classic-replacement-heading h3 { font-size: 17px; }.classic-replacement-heading { gap: 8px; }.classic-replacement-heading button { font-size: 11px; padding: 8px; }.shop-action-wallet { flex-basis: 100%; text-align: center; }.shop-actions { width: 100%; bottom: max(8px,env(safe-area-inset-bottom)); gap: 8px; }.shop-actions .px-btn { flex: 1; min-width: 0; font-size: 13px; padding: 10px; } }
</style>
