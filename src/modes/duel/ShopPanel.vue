<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import JokerArt from '../../components/JokerArt.vue'
import { jokerStatus } from '../../composables/jokerCatalog.js'
import { DUEL_RULES } from './config.js'

const props = defineProps({
  shop: { type: Object, required: true },
  you: { type: Object, required: true },
  bot: { type: Object, required: true },
  round: { type: Number, required: true },
  weights: { type: Object, default: () => ({}) },
  error: { type: String, default: '' },
  logs: { type: Array, default: () => [] },
})
const emit = defineEmits(['buy', 'replace', 'finish', 'next', 'sell', 'reorder'])
const rarityNames = { common: '普通', rare: '稀有', legendary: '传说' }
const sideName = side => side === 'you' ? '你' : '小丑'
const resaleValue = joker => Math.max(1, Math.floor(joker.price / 2))
const isYourTurn = computed(() => props.shop.turn === 'you' && !props.shop.complete && !props.shop.finished.you)
const firstSide = computed(() => props.shop.firstSide || (props.you.score === props.bot.score ? (props.round % 2 ? 'you' : 'bot') : props.you.score > props.bot.score ? 'you' : 'bot'))
const turnTitle = computed(() => props.shop.complete ? '双方已结束购物' : isYourTurn.value ? '轮到你购买一张' : '小丑正在挑选')
const productButtons = new Map()
const replacementPanel = ref(null)
const replacementId = ref(null)
const replacementSellId = ref(null)
const replacementItem = computed(() => props.shop.items.find(item => item.id === replacementId.value && !item.soldTo) || null)
const replacementChoices = computed(() => replacementItem.value ? props.you.jokers.map(joker => ({
  joker,
  resale: resaleValue(joker),
  cost: replacementItem.value.price - resaleValue(joker),
  cash: props.you.money + resaleValue(joker) - replacementItem.value.price,
})) : [])
const replacementChoice = computed(() => replacementChoices.value.find(choice => choice.joker.id === replacementSellId.value) || null)
const canConfirmReplacement = computed(() => isYourTurn.value && replacementItem.value && replacementChoice.value && replacementChoice.value.cash >= 0)
const yourBuildOpen = ref(true)
const botBuildOpen = ref(true)
let compactQuery

function updateBuildDisclosure() {
  yourBuildOpen.value = botBuildOpen.value = !compactQuery.matches
}
onMounted(() => {
  compactQuery = window.matchMedia('(max-width: 600px)')
  updateBuildDisclosure()
  compactQuery.addEventListener('change', updateBuildDisclosure)
})
onUnmounted(() => compactQuery?.removeEventListener('change', updateBuildDisclosure))

function cancelReplacement(restoreFocus = false) {
  const id = replacementId.value
  replacementId.value = null
  replacementSellId.value = null
  if (restoreFocus) nextTick(() => productButtons.get(id)?.focus())
}
watch([
  () => props.shop,
  isYourTurn,
  replacementItem,
  () => props.you.jokers.map(joker => joker.id).join(','),
], () => {
  if (!replacementId.value) return
  if (!isYourTurn.value || !replacementItem.value || props.you.jokers.length < DUEL_RULES.maxJokers) {
    cancelReplacement()
    return
  }
  if (!props.you.jokers.some(joker => joker.id === replacementSellId.value)) replacementSellId.value = null
})

function minimumShortfall(item) {
  const sale = props.you.jokers.length >= DUEL_RULES.maxJokers ? Math.max(0, ...props.you.jokers.map(resaleValue)) : 0
  return Math.max(0, item.price - props.you.money - sale)
}
function canBuy(item) {
  return isYourTurn.value && !item.soldTo && minimumShortfall(item) === 0
}
function buyLabel(item) {
  if (item.soldTo) return `${sideName(item.soldTo)}已购得`
  if (props.shop.complete) return '购物已结束'
  if (!isYourTurn.value) return '等待小丑'
  const shortfall = minimumShortfall(item)
  if (props.you.jokers.length >= DUEL_RULES.maxJokers) return shortfall ? `替换仍差 $${shortfall}` : '选择替换'
  return shortfall ? `还差 $${shortfall}` : `购买 · $${item.price}`
}
async function requestPurchase(item) {
  if (!canBuy(item)) return
  if (props.you.jokers.length >= DUEL_RULES.maxJokers) {
    replacementId.value = item.id
    replacementSellId.value = null
    await nextTick()
    replacementPanel.value?.focus({ preventScroll: true })
    replacementPanel.value?.scrollIntoView({ behavior: 'auto', block: 'start' })
    return
  }
  emit('buy', item.id)
}
function confirmReplacement() {
  if (!canConfirmReplacement.value) return
  emit('replace', { sellId: replacementSellId.value, buyId: replacementId.value })
}
function costLabel(cost) {
  return cost >= 0 ? `实付 $${cost}` : `净得 $${-cost}`
}
</script>

<template>
  <section tabindex="-1" class="shop-screen" aria-label="共享商店" :class="{'choosing-replacement': !!replacementItem}">
    <div class="shop-heading">
      <div><span class="eyebrow">INTERMISSION / 幕间交易</span><h2>好牌，只够一个人带走。</h2><p>第 {{round}} 轮结束 · {{round === DUEL_RULES.rounds - 1 ? "最后一次交易，下轮直接决胜" : `第 ${round} / ${DUEL_RULES.rounds - 1} 间商店`}} · 购买后本场独占</p></div>
      <div class="shop-round-result"><span>本轮比分</span><strong>{{you.score.toLocaleString()}} <small>:</small> {{bot.score.toLocaleString()}}</strong></div>
    </div>
    <div class="shop-turn-banner" :class="shop.complete ? 'shopping-done' : isYourTurn ? 'your-turn' : 'bot-turn'" role="status" aria-live="polite">
      <span class="shop-turn-icon">{{shop.complete ? '✓' : isYourTurn ? '♠' : '♦'}}</span>
      <div><strong>{{turnTitle}}</strong><small>{{shop.complete ? '阵容和金币会带入下一轮。' : shop.finished.you ? '你已结束购物，等待小丑完成。' : shop.finished.bot ? '小丑已结束购物，你可以继续购买。' : '买一张后换对方；也可以结束本轮购物，保留金币。'}}</small></div>
      <button v-if="!shop.complete && !shop.finished.you" class="shop-pass" :disabled="!isYourTurn" @click="emit('finish')">结束购物</button>
    </div>
    <div class="shop-steps"><span :class="{active: shop.turn === firstSide && !shop.complete}">先手 · {{sideName(firstSide)}}</span><span>→</span><span :class="{active: shop.turn !== firstSide && !shop.complete}">后手 · {{sideName(firstSide === 'you' ? 'bot' : 'you')}}</span><span>每次一张，轮流购买</span></div>
    <div class="shop-layout">
      <aside class="shop-player your-shop-seat" :class="{'active-player': isYourTurn}">
        <h2>♠ 你的阵容 <span class="shop-wallet">${{you.money}}</span></h2>
        <p class="shop-player-note">{{you.jokers.length}} / {{DUEL_RULES.maxJokers}} 个卡槽 · {{shop.finished.you ? '已结束购物' : isYourTurn ? '轮到你了' : '等待小丑选择'}}</p>
        <details class="shop-build-details" :open="yourBuildOpen" @toggle="yourBuildOpen = $event.target.open">
          <summary class="shop-build-summary">查看阵容与操作 <span class="compact-lineup"><span v-for="joker in you.jokers" :key="joker.id" :title="[joker.desc, jokerStatus(joker)].filter(Boolean).join(' · ')">{{joker.name}}</span></span></summary>
          <p class="joker-order-help">{{you.jokers.length ? '按阵容顺序结算，左右移动可调整顺序。' : '现在是空阵容，购买一张小丑牌开始构筑。'}}</p>
          <div class="shop-build">
            <div v-for="(joker, index) in you.jokers" :key="joker.id" class="shop-owned">
              <JokerArt :joker="joker"/>
              <div><strong>{{joker.name}}</strong><small>{{joker.desc}}</small><small v-if="jokerStatus(joker)" class="joker-growth">{{jokerStatus(joker)}}</small>
                <div class="joker-order-controls"><button class="order-button" :disabled="!isYourTurn || index === 0" :aria-label="`将${joker.name}向左移动`" @click="emit('reorder', {id: joker.id, direction: -1})">←</button><span>第 {{index + 1}} 位</span><button class="order-button" :disabled="!isYourTurn || index === you.jokers.length - 1" :aria-label="`将${joker.name}向右移动`" @click="emit('reorder', {id: joker.id, direction: 1})">→</button></div>
                <button class="sell-joker" :disabled="!isYourTurn" @click="emit('sell', joker.id)">出售 · ${{resaleValue(joker)}}</button>
              </div>
            </div>
          </div>
        </details>
      </aside>
      <div class="shop-shelf">
        <div class="shop-shelf-title"><h2>今夜的筹码</h2><small>共享货架 · 随机 3 张</small></div>
        <p class="shop-probabilities"><span>本轮基础概率</span><span v-for="(weight, rarity) in weights" :key="rarity">{{rarityNames[rarity]}} <b>{{weight}}%</b></span></p>
        <div class="shop-products">
          <article v-for="(item, itemIndex) in shop.items" :key="item.id" class="shop-product" :class="[item.rarity, {sold: item.soldTo, chosen: replacementId === item.id}]">
            <span class="product-lot">LOT {{String(itemIndex + 1).padStart(2, '0')}}</span>
            <div class="product-art"><JokerArt :joker="item"/><span v-if="item.soldTo" class="ownership">{{sideName(item.soldTo)}}已购得 · 本场独占</span></div>
            <div class="product-meta"><span class="rarity">{{rarityNames[item.rarity]}} · {{item.category}}</span><h3>{{item.name}}</h3><p>{{item.desc}}</p></div>
            <div class="product-price">${{item.price}}</div>
            <button :ref="el => { if (el) productButtons.set(item.id, el); else productButtons.delete(item.id) }" class="primary" :disabled="!canBuy(item)" @click="requestPurchase(item)">{{buyLabel(item)}}</button>
          </article>
        </div>
        <section v-if="replacementItem" ref="replacementPanel" tabindex="-1" class="replacement-picker" aria-labelledby="replacement-title">
          <div class="replacement-heading"><div><h3 id="replacement-title">换入{{replacementItem.name}}</h3><p>当前有 ${{you.money}}。选择要出售的一张牌，确认后一起完成替换。</p></div><button class="secondary compact" @click="cancelReplacement(true)">取消替换</button></div>
          <div class="replacement-options">
            <button v-for="choice in replacementChoices" :key="choice.joker.id" class="replacement-option" :class="{selected: replacementSellId === choice.joker.id, unaffordable: choice.cash < 0}" :disabled="!isYourTurn || choice.cash < 0" :aria-pressed="replacementSellId === choice.joker.id" @click="replacementSellId = choice.joker.id">
              <JokerArt :joker="choice.joker"/>
              <div class="replacement-option-copy"><strong>出售{{choice.joker.name}}</strong><small>{{choice.joker.desc}}</small><small v-if="jokerStatus(choice.joker)" class="joker-growth">{{jokerStatus(choice.joker)}}</small></div>
              <div class="replacement-option-price"><span>出售 +${{choice.resale}}</span><strong>{{costLabel(choice.cost)}}</strong><small>{{choice.cash >= 0 ? `购买后剩 $${choice.cash}` : `还差 $${-choice.cash}`}}</small></div>
            </button>
          </div>
          <p class="replacement-summary" aria-live="polite">{{replacementChoice ? `出售${replacementChoice.joker.name}得 $${replacementChoice.resale}，购入${replacementItem.name}需 $${replacementItem.price}，${costLabel(replacementChoice.cost)}，剩余 $${replacementChoice.cash}。` : '取消不会出售任何牌。请选择要替换的牌。'}}</p>
          <button class="replacement-confirm primary" :disabled="!canConfirmReplacement" @click="confirmReplacement">确认替换</button>
        </section>
        <p v-if="!shop.items.length" class="shop-feedback">牌池暂无可售商品，可以结束购物。</p>
        <p class="shop-feedback" :class="{'shop-error': error}" :role="error ? 'alert' : undefined">{{error || '双方的购买立即公开。已售出的牌不会再次上架给另一方。'}}</p>
      </div>
      <aside class="shop-player joker-shop-seat" :class="{'active-player': shop.turn === 'bot' && !shop.complete}">
        <h2>♦ 小丑的阵容 <span class="shop-wallet">${{bot.money}}</span></h2>
        <p class="shop-player-note">{{bot.jokers.length}} / {{DUEL_RULES.maxJokers}} 个卡槽 · {{shop.finished.bot ? '已结束购物' : shop.turn === 'bot' ? '正在选择' : '等待你选择'}}</p>
        <details class="shop-build-details" :open="botBuildOpen" @toggle="botBuildOpen = $event.target.open">
          <summary class="shop-build-summary">查看小丑阵容 <span class="compact-lineup"><span v-for="joker in bot.jokers" :key="joker.id" :title="[joker.desc, jokerStatus(joker)].filter(Boolean).join(' · ')">{{joker.name}}</span></span></summary>
          <div class="shop-build"><div v-for="joker in bot.jokers" :key="joker.id" class="shop-owned"><JokerArt :joker="joker"/><div><strong>{{joker.name}}</strong><small>{{joker.desc}}</small><small v-if="jokerStatus(joker)" class="joker-growth">{{jokerStatus(joker)}}</small></div></div></div>
        </details>
      </aside>
    </div>
    <div class="shop-controls"><span class="shop-compact-wallet">你的金币 <b>${{you.money}}</b> · {{you.jokers.length}} / {{DUEL_RULES.maxJokers}} 槽</span><span v-if="!shop.complete">{{shop.finished.you ? '你已结束本轮购物，剩余金币会保留。' : '不买也可以，把金币留给下一间商店。'}}</span><span v-else>双方准备完成，可以进入第 {{round + 1}} 轮。</span><button v-if="!shop.complete && !shop.finished.you" class="secondary" :disabled="!isYourTurn" @click="emit('finish')">结束购物 · 保留金币</button><button v-if="shop.complete" class="primary" @click="emit('next')">进入第 {{round + 1}} 轮 →</button></div>
    <div class="shop-activity" aria-live="polite"><p v-for="(entry, index) in logs.slice(0, 3)" :key="index">{{entry}}</p></div>
  </section>
</template>
