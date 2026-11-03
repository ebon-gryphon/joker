import test from 'node:test'
import assert from 'node:assert/strict'
import { useGameState, JOKER_POOL } from '../src/composables/useGameState.js'
import { calcScore } from '../src/composables/useHandDetector.js'
import { findBestPlay } from '../src/composables/useAI.js'

const joker = id => ({ ...JOKER_POOL.find(item => item.id === id), progress: 0 })
const seeded = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32)
const clone = value => JSON.parse(JSON.stringify(value))
const state = game => JSON.stringify({ phase: game.phase.value, hand: game.hand.value, deck: game.deck.value, selected: game.selectedCards.value, hands: game.handsLeft.value, discards: game.discardsLeft.value, score: game.blindScore.value, money: game.money.value, jokers: game.jokers.value, stock: game.shopItems.value, sold: [...game.soldItems.value] })
function onePlay(game) {
  game.toggleCard(game.hand.value[0].id)
  const result = game.playHand()
  game.finishScoring(result.score)
  return result
}

test('completion accepts only the pending actual score once and restart cancels it', () => {
  const game = useGameState({ random: seeded(12) })
  const initial = state(game)
  assert.deepEqual(game.finishScoring(99999), [])
  assert.equal(state(game), initial)
  game.toggleCard(game.hand.value[0].id)
  const result = game.playHand(), pending = state(game)
  assert.deepEqual(game.finishScoring(result.score + 1), [])
  assert.equal(state(game), pending)
  assert.equal(game.isScoring.value, true)
  assert.equal(game.createSnapshot(), null)
  game.finishScoring(result.score)
  assert.equal(game.blindScore.value, result.score)
  assert.equal(game.hand.value.length, 8)
  const complete = state(game)
  game.finishScoring(result.score)
  assert.equal(state(game), complete)
  game.toggleCard(game.hand.value[0].id)
  const old = game.playHand()
  game.restart()
  const fresh = state(game)
  game.finishScoring(old.score)
  assert.equal(state(game), fresh)
})

test('stale, duplicate, unknown and oversized selections spend no resources', () => {
  const game = useGameState({ random: seeded(13) })
  game.toggleCard(-1)
  assert.deepEqual(game.selectedCards.value, [])
  for (const ids of [[99], [game.hand.value[0].id, game.hand.value[0].id], game.hand.value.slice(0, 6).map(card => card.id)]) {
    game.selectedCards.value = ids
    const before = state(game)
    assert.equal(game.playHand(), null)
    assert.deepEqual(game.discardCards(), [])
    assert.equal(state(game), before)
  }
})

test('classic replacement is atomic and matches manual sale/purchase ordering and score', () => {
  const make = () => {
    const game = useGameState({ random: seeded(14) })
    game.phase.value = 'shop'
    game.jokers.value = ['jester', 'heart_collector', 'blue_joker', 'runner', 'banner'].map(joker)
    game.shopItems.value = [joker('half_joker'), joker('dynasty')]
    game.money.value = 4
    return game
  }
  const atomic = make(), manual = make()
  const before = state(atomic)
  assert.equal(atomic.replaceJoker('missing', 'half_joker'), false)
  assert.equal(atomic.replaceJoker('jester', 'dynasty'), false)
  assert.equal(state(atomic), before)
  assert.equal(atomic.replaceJoker('jester', 'half_joker'), true)
  assert.equal(manual.sellJoker('jester'), true)
  assert.equal(manual.buyJoker('half_joker'), true)
  assert.deepEqual(atomic.jokers.value, manual.jokers.value)
  assert.equal(atomic.money.value, manual.money.value)
  assert.ok(atomic.soldItems.value.has('half_joker'))
  const cards = ['2', '5', '8'].map((rank, id) => ({ id, rank, suit: '♥' }))
  assert.equal(calcScore(cards, atomic.jokers.value).score, calcScore(cards, manual.jokers.value).score)
  const after = state(atomic)
  assert.equal(atomic.replaceJoker('runner', 'half_joker'), false)
  assert.equal(state(atomic), after)
})

test('snapshots round trip exact stable cards, growth, resources and random draws', () => {
  const game = useGameState({ random: seeded(15) })
  game.jokers.value = [joker('green_joker'), joker('rebate')]
  game.toggleCard(game.hand.value[0].id)
  game.discardCards()
  onePlay(game)
  const saved = game.createSnapshot()
  assert.equal(saved.schema, 1)
  assert.deepEqual(saved.jokers, [{ id: 'green_joker', progress: 1 }, { id: 'rebate', progress: 0 }])
  assert.equal(JSON.stringify(saved).includes('effect'), false)
  const restore = useGameState({ random: seeded(999) })
  assert.equal(restore.restoreSnapshot(clone(saved)), true)
  assert.deepEqual(restore.createSnapshot(), saved)
  assert.equal(typeof restore.jokers.value[0].effect, 'function')
  assert.equal(onePlay(game).score, onePlay(restore).score)
  assert.deepEqual(restore.hand.value, game.hand.value)
  assert.deepEqual(restore.deck.value, game.deck.value)
})

test('corrupt snapshots are rejected without touching current game', () => {
  const game = useGameState({ random: seeded(16) })
  const saved = game.createSnapshot(), before = state(game)
  const changes = [
    data => { data.schema = 2 }, data => { data.money = -1 }, data => { data.roundIndex = 12 },
    data => { data.hand[0].rank = 'invalid' }, data => { data.deck[0] = data.hand[0] },
    data => { data.jokers = [{ id: 'green_joker', progress: 13 }] },
    data => { data.jokers = [{ id: 'unknown', progress: 0 }] },
    data => { data.phase = 'won' }, data => { data.handsLeft = 0 },
    data => { data.soldItems = ['jester'] }, data => { data.lastReward = { base: 5, bonus: 2, total: 999 } },
  ]
  for (const change of changes) {
    const bad = clone(saved); change(bad)
    assert.equal(game.restoreSnapshot(bad), false)
    assert.equal(state(game), before)
  }
  game.toggleCard(game.hand.value[0].id)
  game.playHand()
  const pending = state(game)
  assert.equal(game.restoreSnapshot(saved), false)
  assert.equal(state(game), pending)
})

test('shop purchases and a real lost round restore without reopening sold stock or dealing new cards', () => {
  const game = useGameState({ random: seeded(2026101300) })
  while (game.phase.value === 'playing') {
    findBestPlay(game.hand.value, game.jokers.value, game.scoreContext.value).forEach(card => game.toggleCard(card.id))
    const result = game.playHand()
    game.finishScoring(result.score)
  }
  assert.equal(game.phase.value, 'shop')
  const bought = game.shopItems.value.find(item => item.price <= game.money.value)
  assert.equal(game.buyJoker(bought.id), true)
  const savedShop = game.createSnapshot()
  const restoredShop = useGameState({ random: () => 0.99 })
  assert.equal(restoredShop.restoreSnapshot(savedShop), true)
  assert.deepEqual(restoredShop.createSnapshot(), savedShop)
  assert.equal(restoredShop.buyJoker(bought.id), false)
  assert.equal(typeof restoredShop.shopItems.value[0].effect, 'function')

  const lost = useGameState({ random: seeded(18) })
  for (let index = 0; index < 4; index++) onePlay(lost)
  assert.equal(lost.phase.value, 'lost')
  const savedLost = lost.createSnapshot()
  assert.ok(savedLost)
  const restoredLost = useGameState()
  assert.equal(restoredLost.restoreSnapshot(savedLost), true)
  assert.deepEqual(restoredLost.createSnapshot(), savedLost)
  assert.equal(restoredLost.playHand(), null)
})

test('deterministic random option controls both decks and shop generation', () => {
  const a = useGameState({ random: seeded(17) }), b = useGameState({ random: seeded(17) })
  assert.deepEqual(a.hand.value, b.hand.value)
  assert.deepEqual(a.deck.value, b.deck.value)
  a.generateShop(); b.generateShop()
  assert.deepEqual(a.shopItems.value.map(j => j.id), b.shopItems.value.map(j => j.id))
  a.restart(); b.restart()
  assert.deepEqual(a.hand.value, b.hand.value)
  assert.throws(() => useGameState({ random: 42 }), TypeError)
})
