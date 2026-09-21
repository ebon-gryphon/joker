import test from 'node:test'
import assert from 'node:assert/strict'

import { findBestPlay } from '../src/composables/useAI.js'
import { BLINDS, JOKER_POOL, SHOP_REROLL_COST, useGameState } from '../src/composables/useGameState.js'
import { calcScore } from '../src/composables/useHandDetector.js'

function cards(...entries) {
  return entries.map(([rank, suit], id) => ({ id, rank, suit }))
}

function joker(id) {
  return JOKER_POOL.find(item => item.id === id)
}

test('the extended run has four acts and steadily rising targets', () => {
  assert.equal(BLINDS.length, 12)
  assert.deepEqual(BLINDS.map(blind => blind.act), [1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4])
  assert.deepEqual(BLINDS.map(blind => blind.target), [250, 400, 650, 950, 1400, 2000, 2800, 3800, 5000, 6500, 8500, 11000])
  assert.ok(BLINDS.every((blind, index) => index === 0 || blind.target > BLINDS[index - 1].target))
})

test('the expanded shop has thirty-seven unique jokers and a reroll cost', () => {
  assert.equal(JOKER_POOL.length, 37)
  assert.equal(new Set(JOKER_POOL.map(item => item.id)).size, JOKER_POOL.length)
  assert.equal(SHOP_REROLL_COST, 2)
})

test('half joker rewards compact hands', () => {
  const result = calcScore(cards(['8', '♥'], ['8', '♣']), [joker('half_joker')])
  assert.equal(result.hand.name, '对子')
  assert.equal(result.mult, 7)
  assert.equal(result.score, 182)
})

test('rank jokers count only their matching cards', () => {
  const even = calcScore(cards(['2', '♥'], ['8', '♣']), [joker('even_steven')])
  const odd = calcScore(cards(['A', '♥'], ['7', '♣'], ['3', '♦']), [joker('odd_todd')])
  const faces = calcScore(cards(['J', '♥'], ['Q', '♣'], ['K', '♦']), [joker('smiley_face')])

  assert.equal(even.mult, 3)
  assert.equal(odd.mult, 4)
  assert.equal(faces.mult, 7)
})

test('hand specialists add chips to their supported hand families', () => {
  const pair = calcScore(cards(['8', '♥'], ['8', '♣']), [joker('pair_engine')])
  const flush = calcScore(
    cards(['2', '♥'], ['5', '♥'], ['7', '♥'], ['9', '♥'], ['K', '♥']),
    [joker('flush_flag')],
  )

  assert.equal(pair.chips, 56)
  assert.equal(flush.hand.name, '同花')
  assert.equal(flush.chips, 108)
})

test('AI still selects the strongest available play', () => {
  const hand = cards(['9', '♥'], ['9', '♣'])
  const best = findBestPlay(hand, [])

  assert.equal(best.length, 2)
  assert.deepEqual(new Set(best.map(card => card.rank)), new Set(['9']))
})

test('shop rerolls cost money and only work inside the shop', () => {
  const game = useGameState()

  assert.equal(game.rerollShop(), false)
  game.phase.value = 'shop'
  game.generateShop()
  assert.equal(game.rerollShop(), true)
  assert.equal(game.money.value, 5 - SHOP_REROLL_COST)
  assert.equal(game.shopItems.value.length, 3)

  game.money.value = SHOP_REROLL_COST - 1
  assert.equal(game.rerollShop(), false)
  assert.equal(game.money.value, SHOP_REROLL_COST - 1)
})

test('the last configured blind ends the run', () => {
  const game = useGameState()
  const finalIndex = BLINDS.length - 1

  game.roundIndex.value = finalIndex
  game.finishScoring(BLINDS[finalIndex].target)

  assert.equal(game.phase.value, 'won')
})
