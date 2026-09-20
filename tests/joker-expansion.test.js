import test from 'node:test'
import assert from 'node:assert/strict'
import { JOKER_POOL, advanceJokers } from '../src/composables/jokerCatalog.js'
import { calcScore } from '../src/composables/useHandDetector.js'
import { useGameState } from '../src/composables/useGameState.js'
import { findBestPlay } from '../src/composables/useAI.js'
const joker = id => ({ ...JOKER_POOL.find(j => j.id === id), progress: 0 })
const cards = (ranks, suits = []) => ranks.map((rank, id) => ({ id, rank, suit: suits[id] || '♥' }))
const high = cards(['4', '10', 'K'], ['♠', '♦', '♣'])
const straight = cards(['2','3','4','5','6'])
const examples = [
  ['blue_joker', high, {}, 30, 0],
  ['diamond_miner', high, {}, 12, 0],
  ['spade_guard', high, {}, 0, 3],
  ['jolly_joker', cards(['8','8']), {}, 0, 6],
  ['trio', cards(['8','8','8']), {}, 0, 3],
  ['double_act', cards(['2','2','3','3']), {}, 0, 8],
  ['straight_rail', straight, {}, 50, 0],
  ['crazy_joker', straight, {}, 0, 10],
  ['droll_joker', straight, {}, 0, 8],
  ['banner', high, { discardsLeft: 2 }, 24, 0],
  ['bull', high, { money: 100 }, 60, 0],
  ['empty_pockets', high, { discardsLeft: 0 }, 0, 1],
  ['last_hand', high, { handsLeft: 1 }, 0, 2],
  ['fibonacci', cards(['A','2','3','5','8']), {}, 0, 15],
  ['walkie_talkie', high, {}, 20, 4],
  ['runner', straight, {}, 15, 0],
  ['square_joker', cards(['2','3','4','5']), {}, 8, 0],
  ['green_joker', high, {}, 0, 1],
  ['golden_joker', high, {}, 0, 0],
  ['rebate', high, {}, 0, 0],
]
for (const [id, hand, context, chips, mult] of examples) {
  test(`${id}: correct scoring delta and trace`, () => {
    const base = calcScore(hand, [])
    const result = calcScore(hand, [joker(id)], context)
    assert.equal(result.chips - base.chips, chips)
    assert.equal(result.mult - base.mult, mult)
    assert.equal(result.steps[0].chips * result.steps[0].mult, result.score)
  })
}

test('conditional effects do not activate without their requirement', () => {
  for (const id of ['trio', 'jolly_joker', 'double_act', 'straight_rail', 'crazy_joker', 'droll_joker', 'empty_pockets', 'last_hand', 'runner', 'square_joker', 'heart_collector', 'club_lover', 'royal_face']) {
    assert.equal(calcScore(high, [joker(id)]).score, calcScore(high, []).score, id)
  }
})

test('rebalanced suit and face cards need three matches; ordering matters', () => {
  const hand = cards(['J','Q','K'])
  const base = calcScore(hand, [])
  assert.equal(calcScore(hand, [joker('royal_face')]).mult, base.mult * 2)
  assert.equal(calcScore(hand, [joker('heart_collector')]).mult, base.mult * 2)
  assert.equal(calcScore(hand, [joker('jester'), joker('royal_face')]).mult, 10)
  assert.equal(calcScore(hand, [joker('royal_face'), joker('jester')]).mult, 6)
})

test('previews and AI never mutate growth, actual play grows once, across rounds', () => {
  const game = useGameState()
  game.jokers.value = [joker('green_joker'), joker('square_joker')]
  game.hand.value = cards(['2','3','4','5'])
  game.selectedCards.value = [0,1,2,3]
  const preview = game.previewScore.value.score
  findBestPlay(game.hand.value, game.jokers.value, game.scoreContext.value)
  assert.deepEqual(game.jokers.value.map(j => j.progress), [0,0])
  const result = game.playHand()
  assert.equal(result.score, preview)
  assert.deepEqual(game.jokers.value.map(j => j.progress), [1,8])
  assert.equal(result.steps.at(-1).chips * result.steps.at(-1).mult, preview)
  assert.equal(game.playHand(), null)
  game.finishScoring(300)
  game.skipShop()
  assert.deepEqual(game.jokers.value.map(j => j.progress), [1,8])
  game.selectedCards.value = [game.hand.value[0].id]
  game.discardCards()
  assert.deepEqual(game.jokers.value.map(j => j.progress), [0,8])
  game.restart()
  assert.equal(game.jokers.value.length, 0)
  assert.ok(JOKER_POOL.every(j => j.progress === undefined))
})

test('runner adds on qualifying hands and keeps its bonus on later high cards', () => {
  const result = calcScore(straight, [])
  const grown = advanceJokers([joker('runner')], 'play', straight, result.hand)
  assert.equal(grown[0].progress, 15)
  assert.equal(calcScore(high, grown).chips - calcScore(high, []).chips, 15)
  assert.equal(calcScore(straight, grown).chips - result.chips, 30)
})

test('economy rewards require a valid discard or a cleared round', () => {
  const game = useGameState()
  game.jokers.value = [joker('rebate'), joker('golden_joker')]
  game.discardCards()
  assert.equal(game.money.value, 5)
  game.selectedCards.value = [game.hand.value[0].id]
  game.discardCards()
  assert.equal(game.money.value, 6)
  game.handsLeft.value = 2
  game.finishScoring(300)
  assert.equal(game.money.value, 16)
  assert.deepEqual(game.lastReward.value, { base: 7, bonus: 3, total: 10 })
})

test('shop prevents duplicate buys, supports selling and bounded reordering', () => {
  const game = useGameState()
  game.shopItems.value = [joker('runner')]
  assert.equal(game.buyJoker('runner'), false)
  game.phase.value = 'shop'
  game.money.value = 30
  assert.equal(game.buyJoker('runner'), true)
  assert.equal(game.buyJoker('runner'), false)
  game.jokers.value.push(joker('jester'))
  assert.equal(game.moveJoker(0, -1), false)
  assert.equal(game.moveJoker(0, 1), true)
  assert.equal(game.jokers.value[1].id, 'runner')
  game.isScoring.value = true
  assert.equal(game.moveJoker(0, 1), false)
  game.isScoring.value = false
  assert.equal(game.sellJoker('runner'), true)
  assert.equal(game.money.value, 28)
  assert.equal(game.sellJoker('runner'), false)
  assert.equal(game.buyJoker('runner'), false)
})

test('last-hand context agrees between preview, AI and actual score', () => {
  const game = useGameState()
  game.jokers.value = [joker('last_hand'), joker('banner'), joker('bull')]
  game.handsLeft.value = 1
  game.discardsLeft.value = 0
  game.money.value = 12
  game.hand.value = high
  const best = findBestPlay(high, game.jokers.value, game.scoreContext.value)
  game.selectedCards.value = best.map(c => c.id)
  const preview = game.previewScore.value.score
  assert.equal(game.playHand().score, preview)
  assert.equal(game.handsLeft.value, 0)
})
