// Independent duel rules; the official twelve-round progression stays unchanged.
export const DUEL_RULES = Object.freeze({
  rounds: 7,
  hands: 4,
  discards: 3,
  handSize: 8,
  maxJokers: 5,
  startingMoney: 5,
  roundReward: 5,
})

export const DUEL_SHOP_WEIGHTS = Object.freeze([
  { common: 80, rare: 20, legendary: 0 },
  { common: 70, rare: 28, legendary: 2 },
  { common: 60, rare: 35, legendary: 5 },
  { common: 50, rare: 40, legendary: 10 },
  { common: 40, rare: 45, legendary: 15 },
  { common: 35, rare: 45, legendary: 20 },
].map(Object.freeze))

// clearedRoundIndex is zero based. The seventh round ends the match, with no shop.
// Sampling without replacement leaves pool and excludedIds unchanged. Depleted
// tiers redistribute weight among available unlocked tiers; zero stays locked.
export function selectDuelShopItems(pool, excludedIds, clearedRoundIndex, random = Math.random) {
  if (!Number.isInteger(clearedRoundIndex) || clearedRoundIndex < 0 || clearedRoundIndex >= DUEL_SHOP_WEIGHTS.length) {
    throw Error('该轮结束后没有商店')
  }
  const weights = DUEL_SHOP_WEIGHTS[clearedRoundIndex]
  const available = pool.filter(item => !excludedIds.has(item.id))
  const items = []
  while (items.length < 3) {
    const tiers = Object.entries(weights).filter(([rarity, weight]) =>
      weight > 0 && available.some(item => item.rarity === rarity),
    )
    if (!tiers.length) break
    let roll = random() * tiers.reduce((sum, [, weight]) => sum + weight, 0)
    let rarity = tiers.at(-1)[0]
    for (const [candidate, weight] of tiers) {
      roll -= weight
      if (roll < 0) {
        rarity = candidate
        break
      }
    }
    const candidates = available.filter(item => item.rarity === rarity)
    const chosen = candidates[Math.floor(random() * candidates.length)]
    items.push(chosen)
    available.splice(available.indexOf(chosen), 1)
  }
  return items
}
