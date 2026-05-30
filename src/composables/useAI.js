import { calcScore } from './useHandDetector.js'

// 生成 C(n, k) 组合
function combinations(arr, k) {
  const result = []
  function combine(start, current) {
    if (current.length === k) {
      result.push([...current])
      return
    }
    for (let i = start; i < arr.length; i++) {
      current.push(arr[i])
      combine(i + 1, current)
      current.pop()
    }
  }
  combine(0, [])
  return result
}

// AI 枚举所有 C(8,1)~C(8,5) 共218种组合，选最高分
export function findBestPlay(hand, jokers) {
  let bestScore = -1
  let bestCombo = []

  for (let k = 1; k <= 5; k++) {
    const combos = combinations(hand, k)
    for (const combo of combos) {
      const { score } = calcScore(combo, jokers)
      if (score > bestScore) {
        bestScore = score
        bestCombo = combo
      }
    }
  }

  return bestCombo
}

// AI 商店建议：返回性价比最高的 Joker（简单启发：效果强度/价格）
export function getShopSuggestion(shopItems, money) {
  const affordable = shopItems.filter(item => money >= item.price)
  if (affordable.length === 0) return null

  // 稀有度评分
  const rarityScore = { common: 1, rare: 2, legendary: 3 }
  return affordable.reduce((best, item) => {
    const score = (rarityScore[item.rarity] || 1) / item.price
    const bestScore = (rarityScore[best.rarity] || 1) / best.price
    return score > bestScore ? item : best
  })
}
