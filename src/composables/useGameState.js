import { ref, computed } from 'vue'
import { calcScore } from './useHandDetector.js'
import { selectShopItems } from './shopSelection.js'
import { encodeClassicSnapshot, decodeClassicSnapshot } from './classicSnapshot.js'

// 52张牌堆
const SUITS = ['♠', '♥', '♦', '♣']
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']

function createDeck() {
  const deck = []
  let id = 0
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ id: id++, suit, rank })
    }
  }
  return deck
}

function shuffle(arr, random) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 关卡配置
export const BLINDS = [
  { act: 1, name: '小盲注', target: 250, icon: '🔵', color: '#4a6bff' },
  { act: 1, name: '中盲注', target: 400, icon: '🟡', color: '#4a6bff' },
  { act: 1, name: '大盲注', target: 650, icon: '🔴', color: '#4a6bff' },
  { act: 2, name: '暮色盲注', target: 950, icon: '🟣', color: '#a855f7' },
  { act: 2, name: '幻影盲注', target: 1400, icon: '🌙', color: '#a855f7' },
  { act: 2, name: '月蚀盲注', target: 2000, icon: '🌑', color: '#a855f7' },
  { act: 3, name: '星河盲注', target: 2800, icon: '🌌', color: '#38bdf8' },
  { act: 3, name: '风暴盲注', target: 3800, icon: '🌪️', color: '#38bdf8' },
  { act: 3, name: '深渊盲注', target: 5000, icon: '🕳️', color: '#38bdf8' },
  { act: 4, name: '王座盲注', target: 6000, icon: '🏰', color: '#f97316' },
  { act: 4, name: '命运盲注', target: 7500, icon: '🎭', color: '#f97316' },
  { act: 4, name: '终局盲注', target: 9000, icon: '👑', color: '#f97316' },
]

export { JOKER_POOL } from './jokerCatalog.js'
import { JOKER_POOL, advanceJokers } from './jokerCatalog.js'

export const SHOP_REROLL_COST = 2

export function useGameState({ random = Math.random } = {}) {
  if (typeof random !== 'function') throw new TypeError('random must be a function')
  let pendingScore = null
  // 游戏阶段: playing | shop | won | lost
  const phase = ref('playing')

  // 关卡
  const roundIndex = ref(0)

  // 分数
  const blindScore = ref(0)

  // 钱
  const money = ref(5)

  // 手数 / 弃牌数
  const handsLeft = ref(4)
  const discardsLeft = ref(3)

  // 牌堆
  const deck = ref([])
  const deckCount = ref(52)

  // 手牌
  const hand = ref([])

  // 选中的牌
  const selectedCards = ref([])

  // 出牌区（上次打出的牌）
  const playedCards = ref([])

  // 已拥有的 Joker
  const jokers = ref([])

  // 当前牌型
  const currentHandType = ref(null)

  // 计分动画状态
  const isScoring = ref(false)

  // 商店展示的3张 Joker
  const shopItems = ref([])

  // 已售出的商品
  const soldItems = ref(new Set())

  // 当前关卡信息
  const currentBlind = computed(() => BLINDS[roundIndex.value])

  // 进度百分比
  const progress = computed(() => {
    const target = currentBlind.value.target
    return Math.min(100, Math.round((blindScore.value / target) * 100))
  })

  // 选中牌数量
  const selectedCount = computed(() => selectedCards.value.length)

  const scoreContext = computed(() => ({ money: money.value, handsLeft: handsLeft.value, discardsLeft: discardsLeft.value }))
  const lastReward = ref(null)

  // 预览得分
  const previewScore = computed(() => {
    if (selectedCards.value.length === 0) return null
    const sel = selectedCards.value.map(id => hand.value.find(c => c.id === id)).filter(Boolean)
    return calcScore(sel, jokers.value, scoreContext.value)
  })

  function initRound() {
    const freshDeck = shuffle(createDeck(), random)
    deck.value = freshDeck
    deckCount.value = freshDeck.length
    hand.value = []
    selectedCards.value = []
    playedCards.value = []
    handsLeft.value = currentBlind.value.hands ?? 4
    discardsLeft.value = currentBlind.value.discards ?? 3
    blindScore.value = 0
    isScoring.value = false
    pendingScore = null
    currentHandType.value = null
    drawCards(8)
  }

  function drawCards(count) {
    const drawn = []
    for (let i = 0; i < count && deck.value.length > 0; i++) {
      drawn.push(deck.value.pop())
    }
    deckCount.value = deck.value.length
    hand.value = [...hand.value, ...drawn]
    return drawn
  }

  function toggleCard(cardId) {
    if (phase.value !== 'playing' || isScoring.value || !hand.value.some(card => card.id === cardId)) return
    const idx = selectedCards.value.indexOf(cardId)
    if (idx >= 0) {
      selectedCards.value = selectedCards.value.filter(id => id !== cardId)
    } else {
      if (selectedCards.value.length >= 5) return
      selectedCards.value = [...selectedCards.value, cardId]
    }
  }

  function sortByRank() {
    const ORDER = ['A','K','Q','J','10','9','8','7','6','5','4','3','2']
    hand.value = [...hand.value].sort((a, b) => ORDER.indexOf(a.rank) - ORDER.indexOf(b.rank))
  }

  function sortBySuit() {
    const SUIT_ORDER = ['♠','♥','♦','♣']
    const RANK_ORDER = ['A','K','Q','J','10','9','8','7','6','5','4','3','2']
    hand.value = [...hand.value].sort((a, b) => {
      const sd = SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit)
      if (sd !== 0) return sd
      return RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank)
    })
  }

  // 出牌（返回动画所需数据）
  function validSelection() {
    const ids = selectedCards.value
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 5 || new Set(ids).size !== ids.length) return null
    const cards = ids.map(id => hand.value.find(card => card.id === id))
    return cards.some(card => !card) ? null : cards
  }

  function playHand() {
    if (phase.value !== 'playing') return null
    if (isScoring.value) return null
    if (selectedCards.value.length === 0) return null
    if (handsLeft.value <= 0) return null

    const selCards = validSelection()
    if (!selCards) return null

    const result = calcScore(selCards, jokers.value, scoreContext.value)
    result.playedCards = selCards
    jokers.value = advanceJokers(jokers.value, 'play', selCards, result.hand)

    // 从手牌移除
    hand.value = hand.value.filter(c => !selectedCards.value.includes(c.id))
    playedCards.value = selCards
    selectedCards.value = []
    handsLeft.value--
    isScoring.value = true
    pendingScore = result.score
    currentHandType.value = result.hand

    return result
  }

  function finishScoring(scoreDelta) {
    if (phase.value !== 'playing' || !isScoring.value || pendingScore === null || scoreDelta !== pendingScore) return []
    pendingScore = null
    blindScore.value += scoreDelta
    isScoring.value = false

    // 补牌
    const needed = 8 - hand.value.length
    const drawn = drawCards(needed)

    // 检查胜利/失败/继续
    if (blindScore.value >= currentBlind.value.target) {
      const bonus = jokers.value.some(j => j.id === 'golden_joker') ? 2 : 0
      const reward = 5 + handsLeft.value
      lastReward.value = { base: reward, bonus, total: reward + bonus }
      money.value += reward + bonus
      // 胜利
      if (roundIndex.value === BLINDS.length - 1) {
        // 最终盲注通关 → won
        phase.value = 'won'
      } else {
        // 进商店
        generateShop()
        phase.value = 'shop'
      }
    } else if (handsLeft.value <= 0) {
      // 没手数了 → 失败
      phase.value = 'lost'
    }

    return drawn
  }

  function discardCards() {
    if (phase.value !== 'playing') return []
    if (isScoring.value) return []
    if (discardsLeft.value <= 0) return []
    if (selectedCards.value.length === 0) return []

    if (!validSelection()) return []

    const discarded = selectedCards.value
    hand.value = hand.value.filter(c => !discarded.includes(c.id))
    selectedCards.value = []
    discardsLeft.value--
    jokers.value = advanceJokers(jokers.value, 'discard')
    if (jokers.value.some(j => j.id === 'rebate')) money.value++

    // 补牌
    const drawn = drawCards(discarded.length)
    return drawn
  }

  function generateShop() {
    // 首次进店和刷新均使用刚通关关卡的稀有度权重。
    const ownedIds = new Set(jokers.value.map(j => j.id))
    shopItems.value = selectShopItems(JOKER_POOL, ownedIds, roundIndex.value, random)
    soldItems.value = new Set()
  }

  function buyJoker(jokerId) {
    if (phase.value !== 'shop' || soldItems.value.has(jokerId) || jokers.value.some(j => j.id === jokerId)) return false
    const item = shopItems.value.find(j => j.id === jokerId)
    if (!item) return false
    if (money.value < item.price) return false
    if (jokers.value.length >= 5) return false

    money.value -= item.price
    jokers.value = [...jokers.value, { ...item, progress: 0 }]
    soldItems.value = new Set([...soldItems.value, jokerId])
    return true
  }

  function moveJoker(index, direction) {
    if (isScoring.value || !['playing', 'shop'].includes(phase.value)) return false
    const target = index + direction
    if (![1, -1].includes(direction) || !jokers.value[index] || !jokers.value[target]) return false
    const next = [...jokers.value]
    ;[next[index], next[target]] = [next[target], next[index]]
    jokers.value = next
    return true
  }

  function replaceJoker(sellId, buyId) {
    if (phase.value !== 'shop' || soldItems.value.has(buyId) || jokers.value.some(joker => joker.id === buyId)) return false
    const sold = jokers.value.find(joker => joker.id === sellId)
    const bought = shopItems.value.find(joker => joker.id === buyId)
    if (!sold || !bought || jokers.value.length > 5) return false
    const resale = Math.max(1, Math.floor(sold.price / 2))
    if (money.value + resale < bought.price) return false
    money.value += resale - bought.price
    jokers.value = [...jokers.value.filter(joker => joker.id !== sellId), { ...bought, progress: 0 }]
    soldItems.value = new Set([...soldItems.value, buyId])
    return true
  }

  function sellJoker(id) {
    if (phase.value !== 'shop') return false
    const item = jokers.value.find(j => j.id === id)
    if (!item) return false
    money.value += Math.max(1, Math.floor(item.price / 2))
    jokers.value = jokers.value.filter(j => j.id !== id)
    return true
  }

  function rerollShop() {
    if (phase.value !== 'shop') return false
    if (money.value < SHOP_REROLL_COST) return false

    money.value -= SHOP_REROLL_COST
    generateShop()
    return true
  }

  function skipShop() {
    if (phase.value !== 'shop') return
    roundIndex.value++
    initRound()
    phase.value = 'playing'
  }

  function restart() {
    roundIndex.value = 0
    money.value = 5
    lastReward.value = null
    jokers.value = []
    soldItems.value = new Set()
    initRound()
    phase.value = 'playing'
  }

  function createSnapshot() {
    return encodeClassicSnapshot({
      phase: phase.value, roundIndex: roundIndex.value, blindScore: blindScore.value,
      money: money.value, handsLeft: handsLeft.value, discardsLeft: discardsLeft.value,
      deck: deck.value, hand: hand.value, jokers: jokers.value,
      shopItems: shopItems.value, soldItems: soldItems.value, lastReward: lastReward.value,
      isScoring: isScoring.value,
    }, BLINDS)
  }

  function restoreSnapshot(snapshot) {
    if (isScoring.value) return false
    const saved = decodeClassicSnapshot(snapshot, BLINDS)
    if (!saved) return false
    roundIndex.value = saved.roundIndex
    blindScore.value = saved.blindScore
    money.value = saved.money
    handsLeft.value = saved.handsLeft
    discardsLeft.value = saved.discardsLeft
    deck.value = saved.deck
    deckCount.value = saved.deck.length
    hand.value = saved.hand
    jokers.value = saved.jokers
    shopItems.value = saved.shopItems
    soldItems.value = saved.soldItems
    lastReward.value = saved.lastReward
    selectedCards.value = []
    playedCards.value = []
    currentHandType.value = null
    pendingScore = null
    phase.value = saved.phase
    return true
  }

  // 初始化
  initRound()

  return {
    scoreContext, lastReward, moveJoker, sellJoker, replaceJoker, createSnapshot, restoreSnapshot,
    phase,
    roundIndex,
    blindScore,
    money,
    handsLeft,
    discardsLeft,
    deck,
    deckCount,
    hand,
    selectedCards,
    playedCards,
    jokers,
    currentHandType,
    isScoring,
    shopItems,
    soldItems,
    currentBlind,
    progress,
    selectedCount,
    previewScore,
    toggleCard,
    sortByRank,
    sortBySuit,
    playHand,
    finishScoring,
    discardCards,
    generateShop,
    buyJoker,
    rerollShop,
    skipShop,
    restart,
    drawCards,
    initRound,
  }
}
