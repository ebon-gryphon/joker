import { ref, computed } from 'vue'
import { detectHand, calcScore } from './useHandDetector.js'

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

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// 关卡配置
export const BLINDS = [
  { name: '小盲注', target: 300, icon: '🔵', color: '#4a6bff' },
  { name: '中盲注', target: 500, icon: '🟡', color: '#ffc857' },
  { name: '大盲注', target: 800, icon: '🔴', color: '#ff3344' },
]

// 全部 Joker 候选库
export const JOKER_POOL = [
  { id: 'jester',               name: '小丑',       rarity: 'common',    price: 3, art: '🃏', desc: '每手 +4 倍率' },
  { id: 'scholar',              name: '学者',       rarity: 'common',    price: 3, art: '📖', desc: '打出的牌每张 A：+4 倍率' },
  { id: 'heart_collector',      name: '红心收藏家', rarity: 'rare',      price: 5, art: '❤️', desc: '含 ♥ 时，倍率 ×4' },
  { id: 'club_lover',           name: '梅花爱好者', rarity: 'rare',      price: 5, art: '♣',  desc: '含 ♣ 时，倍率 ×4' },
  { id: 'royal_face',           name: '皇家头牌',   rarity: 'rare',      price: 5, art: '👑', desc: '含 J/Q/K 时，倍率 ×10' },
  { id: 'straight_flush_master',name: '同花顺大师', rarity: 'legendary', price: 8, art: '🔥', desc: '打出同花顺时 +50 倍率' },
]

export function useGameState() {
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

  // 预览得分
  const previewScore = computed(() => {
    if (selectedCards.value.length === 0) return null
    const sel = selectedCards.value.map(id => hand.value.find(c => c.id === id)).filter(Boolean)
    return calcScore(sel, jokers.value)
  })

  function initRound() {
    const freshDeck = shuffle(createDeck())
    deck.value = freshDeck
    deckCount.value = freshDeck.length
    hand.value = []
    selectedCards.value = []
    playedCards.value = []
    handsLeft.value = 4
    discardsLeft.value = 3
    blindScore.value = 0
    isScoring.value = false
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
    if (isScoring.value) return
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
  function playHand() {
    if (isScoring.value) return null
    if (selectedCards.value.length === 0) return null
    if (handsLeft.value <= 0) return null

    const selCards = selectedCards.value
      .map(id => hand.value.find(c => c.id === id))
      .filter(Boolean)

    const result = calcScore(selCards, jokers.value)
    result.playedCards = selCards

    // 从手牌移除
    hand.value = hand.value.filter(c => !selectedCards.value.includes(c.id))
    playedCards.value = selCards
    selectedCards.value = []
    handsLeft.value--
    isScoring.value = true
    currentHandType.value = result.hand

    return result
  }

  function finishScoring(scoreDelta) {
    blindScore.value += scoreDelta
    isScoring.value = false

    // 补牌
    const needed = 8 - hand.value.length
    const drawn = drawCards(needed)

    // 检查胜利/失败/继续
    if (blindScore.value >= currentBlind.value.target) {
      // 胜利
      if (roundIndex.value === 2) {
        // 大盲注通关 → won
        phase.value = 'won'
      } else {
        // 进商店
        const reward = 5 + handsLeft.value * 1
        money.value += reward
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
    if (isScoring.value) return []
    if (discardsLeft.value <= 0) return []
    if (selectedCards.value.length === 0) return []

    const discarded = selectedCards.value
    hand.value = hand.value.filter(c => !discarded.includes(c.id))
    selectedCards.value = []
    discardsLeft.value--

    // 补牌
    const drawn = drawCards(discarded.length)
    return drawn
  }

  function generateShop() {
    // 从候选库中随机抽3张不重复
    const ownedIds = new Set(jokers.value.map(j => j.id))
    const available = JOKER_POOL.filter(j => !ownedIds.has(j.id))
    const shuffled = shuffle(available)
    shopItems.value = shuffled.slice(0, 3)
    soldItems.value = new Set()
  }

  function buyJoker(jokerId) {
    const item = shopItems.value.find(j => j.id === jokerId)
    if (!item) return false
    if (money.value < item.price) return false
    if (jokers.value.length >= 5) return false

    money.value -= item.price
    jokers.value = [...jokers.value, item]
    soldItems.value = new Set([...soldItems.value, jokerId])
    return true
  }

  function skipShop() {
    roundIndex.value++
    initRound()
    phase.value = 'playing'
  }

  function restart() {
    roundIndex.value = 0
    money.value = 5
    jokers.value = []
    soldItems.value = new Set()
    initRound()
    phase.value = 'playing'
  }

  // 初始化
  initRound()

  return {
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
    skipShop,
    restart,
    drawCards,
    initRound,
  }
}
