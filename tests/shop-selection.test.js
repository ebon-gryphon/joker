import test from 'node:test'
import assert from 'node:assert/strict'
import { JOKER_POOL, useGameState } from '../src/composables/useGameState.js'
import { SHOP_RARITY_WEIGHTS, selectShopItems } from '../src/composables/shopSelection.js'

function seededRandom(seed = 12345) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 4294967296
  }
}

test('first-card rarity distribution follows each stage rather than pool size', () => {
  for (const [stage, weights] of SHOP_RARITY_WEIGHTS.entries()) {
    const counts = { common: 0, rare: 0, legendary: 0 }
    const random = seededRandom()
    for (let i = 0; i < 20000; i++) {
      const items = selectShopItems(JOKER_POOL, new Set(), stage, random)
      counts[items[0].rarity]++
      assert.equal(items.length, 3)
      assert.equal(new Set(items.map(item => item.id)).size, 3)
      if (stage < 2) assert.ok(items.every(item => item.rarity !== 'legendary'))
    }
    for (const rarity of Object.keys(counts)) {
      assert.ok(Math.abs(counts[rarity] / 20000 - weights[rarity] / 100) < 0.01,
        `stage ${stage}, ${rarity}: ${counts[rarity] / 20000}`)
    }
  }
})

test('owned cards are excluded and exhausted categories redistribute without unlocking legends', () => {
  const owned = new Set(JOKER_POOL.filter(item => item.rarity === 'common').map(item => item.id))
  const items = selectShopItems(JOKER_POOL, owned, 0, seededRandom())
  assert.equal(items.length, 3)
  assert.ok(items.every(item => item.rarity === 'rare' && !owned.has(item.id)))

  const allNonLegendary = new Set(JOKER_POOL.filter(item => item.rarity !== 'legendary').map(item => item.id))
  assert.deepEqual(selectShopItems(JOKER_POOL, allNonLegendary, 0), [])
  assert.equal(selectShopItems(JOKER_POOL, allNonLegendary, 4).length, 3)
  assert.deepEqual(selectShopItems(JOKER_POOL, new Set(JOKER_POOL.map(item => item.id)), 4), [])
})

test('opening and rerolling a shop both use the cleared round, without advancing it', t => {
  const game = useGameState()
  t.mock.method(Math, 'random', () => 0.99)
  game.finishScoring(300)
  assert.equal(game.phase.value, 'shop')
  assert.ok(game.shopItems.value.every(item => item.rarity === 'rare'))
  assert.equal(game.rerollShop(), true)
  assert.equal(game.roundIndex.value, 0)
  assert.ok(game.shopItems.value.every(item => item.rarity === 'rare'))

  game.roundIndex.value = 2
  game.generateShop()
  assert.equal(game.shopItems.value[0].rarity, 'legendary')
  assert.equal(game.rerollShop(), true)
  assert.equal(game.shopItems.value[0].rarity, 'legendary')
  assert.equal(game.roundIndex.value, 2)
})
