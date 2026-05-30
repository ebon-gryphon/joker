// 牌型识别与基础值
export const HAND_TYPES = {
  STRAIGHT_FLUSH:  { name: '同花顺', chips: 100, mult: 8 },
  FOUR_OF_A_KIND:  { name: '四条',   chips: 60,  mult: 7 },
  FULL_HOUSE:      { name: '葫芦',   chips: 40,  mult: 4 },
  FLUSH:           { name: '同花',   chips: 35,  mult: 4 },
  STRAIGHT:        { name: '顺子',   chips: 30,  mult: 4 },
  THREE_OF_A_KIND: { name: '三条',   chips: 30,  mult: 3 },
  TWO_PAIR:        { name: '两对',   chips: 20,  mult: 2 },
  PAIR:            { name: '对子',   chips: 10,  mult: 2 },
  HIGH_CARD:       { name: '高牌',   chips: 5,   mult: 1 },
}

// 点数值 A=11, J/Q/K=10
export function cardValue(rank) {
  if (rank === 'A') return 11
  if (['J', 'Q', 'K'].includes(rank)) return 10
  return parseInt(rank)
}

export function detectHand(cards) {
  if (!cards || cards.length === 0) return null
  const n = cards.length

  const rankCounts = {}
  const suitCounts = {}
  for (const c of cards) {
    rankCounts[c.rank] = (rankCounts[c.rank] || 0) + 1
    suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1
  }

  const counts = Object.values(rankCounts).sort((a, b) => b - a)
  const isFlush = n >= 5 && Object.keys(suitCounts).length === 1

  // 顺子检测（只在5张时）
  let isStraight = false
  if (n === 5) {
    const ORDER = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
    const indices = cards.map(c => ORDER.indexOf(c.rank)).sort((a,b) => a-b)
    // 普通顺子
    if (indices[4] - indices[0] === 4 && new Set(indices).size === 5) {
      isStraight = true
    }
    // A-2-3-4-5 低顺
    if (JSON.stringify(indices) === JSON.stringify([0,1,2,3,12])) {
      isStraight = true
    }
  }

  if (isFlush && isStraight) return HAND_TYPES.STRAIGHT_FLUSH
  if (counts[0] === 4)        return HAND_TYPES.FOUR_OF_A_KIND
  if (counts[0] === 3 && counts[1] === 2) return HAND_TYPES.FULL_HOUSE
  if (isFlush)                return HAND_TYPES.FLUSH
  if (isStraight)             return HAND_TYPES.STRAIGHT
  if (counts[0] === 3)        return HAND_TYPES.THREE_OF_A_KIND
  if (counts[0] === 2 && counts[1] === 2) return HAND_TYPES.TWO_PAIR
  if (counts[0] === 2)        return HAND_TYPES.PAIR
  return HAND_TYPES.HIGH_CARD
}

// 计算得分（含Joker效果）
export function calcScore(cards, jokers) {
  const hand = detectHand(cards)
  if (!hand) return { chips: 0, mult: 0, score: 0, hand: null }

  let chips = hand.chips + cards.reduce((s, c) => s + cardValue(c.rank), 0)
  let mult = hand.mult

  // 按顺序应用 Joker 效果
  for (const joker of (jokers || [])) {
    const effect = applyJoker(joker, cards, hand, chips, mult)
    chips = effect.chips
    mult = effect.mult
  }

  return { chips, mult, score: chips * mult, hand }
}

export function applyJoker(joker, cards, hand, chips, mult) {
  switch (joker.id) {
    case 'jester':
      // 每手 +4 倍率
      mult += 4
      break
    case 'scholar':
      // 每张A +4倍率
      for (const c of cards) {
        if (c.rank === 'A') mult += 4
      }
      break
    case 'heart_collector':
      // 含♥时 倍率×4
      if (cards.some(c => c.suit === '♥')) mult *= 4
      break
    case 'club_lover':
      // 含♣时 倍率×4
      if (cards.some(c => c.suit === '♣')) mult *= 4
      break
    case 'royal_face':
      // 含J/Q/K时 倍率×10
      if (cards.some(c => ['J','Q','K'].includes(c.rank))) mult *= 10
      break
    case 'straight_flush_master':
      // 打出同花顺时 +50倍率
      if (hand.name === '同花顺') mult += 50
      break
  }
  return { chips, mult }
}
