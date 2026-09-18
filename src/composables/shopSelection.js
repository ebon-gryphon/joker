// 按刚通关的关卡索引配置；第六关通关后直接结算，没有商店。
export const SHOP_RARITY_WEIGHTS = [
  { common: 90, rare: 10, legendary: 0 },
  { common: 85, rare: 15, legendary: 0 },
  { common: 75, rare: 23, legendary: 2 },
  { common: 65, rare: 30, legendary: 5 },
  { common: 55, rare: 37, legendary: 8 },
]

export function selectShopItems(pool, ownedIds, clearedRoundIndex, random = Math.random) {
  const index = Math.max(0, Math.min(clearedRoundIndex, SHOP_RARITY_WEIGHTS.length - 1))
  const weights = SHOP_RARITY_WEIGHTS[index]
  const available = pool.filter(item => !ownedIds.has(item.id))
  const result = []

  while (result.length < 3) {
    // 排除已经抽空的类别，剩余类别按相对权重重新分配；零权重不会解锁。
    const categories = Object.entries(weights).filter(([rarity, weight]) =>
      weight > 0 && available.some(item => item.rarity === rarity),
    )
    if (categories.length === 0) break

    let roll = random() * categories.reduce((sum, [, weight]) => sum + weight, 0)
    let rarity = categories[categories.length - 1][0]
    for (const [candidate, weight] of categories) {
      roll -= weight
      if (roll < 0) {
        rarity = candidate
        break
      }
    }

    const candidates = available.filter(item => item.rarity === rarity)
    const item = candidates[Math.floor(random() * candidates.length)]
    result.push(item)
    available.splice(available.indexOf(item), 1)
  }

  return result
}
