import test from 'node:test'
import assert from 'node:assert/strict'
import { chooseShopMove, computerJokerOrder, SHOP_SCENARIOS } from '../src/strategy/jokerPlanning.js'
import { computerShopChoice, joker, makePlayer } from '../src/modes/duel/engine.js'

test('shared planner preserves duel mode options and remains pure across public builds', () => {
  const offers = ['green_joker', 'blue_joker', 'jolly_joker'].map(joker)
  for (const build of [[], [joker('jester'), joker('pair_engine')], [joker('jester'), { ...joker('green_joker'), progress: 7 }, joker('bull')]]) {
    const p = makePlayer(build, () => 0, 10)
    const before = JSON.stringify({ p, offers })
    for (const remainingRounds of [1, 3, 6]) {
      assert.deepEqual(chooseShopMove(p, offers, { remainingRounds, maxRemainingRounds: 6 }), computerShopChoice(p, offers, remainingRounds))
    }
    assert.equal(JSON.stringify({ p, offers }), before)
  }
  assert.equal(SHOP_SCENARIOS.length, 120)
})

test('shared planner accepts a twelve-round horizon without changing card stats or actual progress', () => {
  const p = makePlayer(undefined, () => 0, 12)
  const before = JSON.stringify(p)
  assert.deepEqual(chooseShopMove(p, [joker('golden_joker')], { remainingRounds: 1 }), { type: 'finish' })
  assert.deepEqual(chooseShopMove(p, [joker('golden_joker')], { remainingRounds: 12, maxRemainingRounds: 12 }), { type: 'buy', id: 'golden_joker' })
  assert.deepEqual(chooseShopMove(p, ['green_joker', 'blue_joker'].map(joker), { remainingRounds: 12, maxRemainingRounds: 12 }), { type: 'buy', id: 'green_joker' })
  assert.equal(JSON.stringify(p), before)
  assert.deepEqual(computerJokerOrder(p.jokers), p.jokers)
})

test('shared planner honors explicit mode capacity and sale budget', () => {
  const p = makePlayer(['jester', 'golden_joker', 'rebate'].map(joker), () => 0, 4)
  const move = chooseShopMove(p, [joker('trio')], { remainingRounds: 1, maxJokers: 3 })
  assert.equal(move.type, 'replace')
  assert.ok(['golden_joker', 'rebate'].includes(move.sellId))
  assert.equal(move.id, 'trio')
  assert.deepEqual(chooseShopMove({ ...p, money: 0 }, [joker('dynasty')], { remainingRounds: 1, maxJokers: 3 }), { type: 'finish' })
})
