import test from 'node:test'
import assert from 'node:assert/strict'
import { describeSavedRun } from '../src/composables/runEntry.js'
import { useGameState } from '../src/composables/useGameState.js'
import { findBestPlay } from '../src/composables/useAI.js'
import { makePlayer, act, awardRound, createShop, buyFromShop, finishShopping, resetRound } from '../src/modes/duel/engine.js'
import { encodeDuelSnapshot, decodeDuelSnapshot } from '../src/modes/duel/snapshot.js'

const seeded = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32)
const clone = value => JSON.parse(JSON.stringify(value))

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}

function describeWithoutMutation(mode, snapshot) {
  const before = clone(snapshot)
  const description = describeSavedRun(mode, freeze(snapshot))
  assert.deepEqual(snapshot, before, 'entry summaries must never rewrite the saved run')
  return description
}

function classicPlay(game, cards = [game.hand.value[0]]) {
  cards.forEach(card => game.toggleCard(card.id))
  const result = game.playHand()
  assert.ok(result)
  game.finishScoring(result.score)
}

function classicShop() {
  const game = useGameState({ random: seeded(2026101300) })
  while (game.phase.value === 'playing') {
    classicPlay(game, findBestPlay(game.hand.value, game.jokers.value, game.scoreContext.value))
  }
  assert.equal(game.phase.value, 'shop', 'the fixture must reach a real earned shop')
  return game
}

function duelRun() {
  return {
    you: makePlayer(undefined, seeded(12)), bot: makePlayer(undefined, seeded(24)),
    round: 1, phase: 'playing', results: [], claimedIds: new Set(), shop: null,
    pendingBotPlay: false, handSort: 'rank', pace: 'normal', logs: [], status: '',
  }
}

function completeDuelRound(run) {
  while (run.you.handsLeft || run.bot.handsLeft) {
    for (const side of ['you', 'bot']) if (run[side].handsLeft) act(run[side], [run[side].hand[0].id])
  }
  awardRound(run.you)
  awardRound(run.bot)
  run.results.push({ you: run.you.score, bot: run.bot.score })
  run.phase = 'roundEnd'
}

test('untouched empty first deals in either mode open directly without a continuation prompt', () => {
  const classic = useGameState({ random: seeded(1) })
  const duel = duelRun()
  assert.deepEqual(classic.jokers.value, [])
  assert.deepEqual(duel.you.jokers, [])
  assert.deepEqual(duel.bot.jokers, [])
  const classicSnapshot = classic.createSnapshot()
  const duelSnapshot = encodeDuelSnapshot(duel)
  assert.ok(classicSnapshot)
  assert.ok(decodeDuelSnapshot(duelSnapshot), 'the fresh save is valid, rather than being mistaken for a corrupt save')
  assert.equal(describeWithoutMutation('classic', classicSnapshot), null)
  assert.equal(describeWithoutMutation('duel', duelSnapshot), null)
})

test('a real classic play or discard offers the correct first-round continuation', () => {
  const played = useGameState({ random: seeded(2) })
  classicPlay(played)
  assert.deepEqual(describeWithoutMutation('classic', played.createSnapshot()), {
    mode: 'classic', name: '经典闯关', round: 1, total: 12, phase: 'playing', jokers: 0, money: 5,
  })
  const discarded = useGameState({ random: seeded(3) })
  discarded.toggleCard(discarded.hand.value[0].id)
  assert.equal(discarded.discardCards().length, 1)
  assert.deepEqual(describeWithoutMutation('classic', discarded.createSnapshot()), {
    mode: 'classic', name: '经典闯关', round: 1, total: 12, phase: 'playing', jokers: 0, money: 5,
  })
})

test('earned classic purchases and the next untouched deal retain the true inventory and money', () => {
  const game = classicShop()
  const item = game.shopItems.value.find(joker => joker.price <= game.money.value)
  assert.ok(item)
  const expectedMoney = game.money.value - item.price
  assert.equal(game.buyJoker(item.id), true)
  assert.deepEqual(describeWithoutMutation('classic', game.createSnapshot()), {
    mode: 'classic', name: '经典闯关', round: 1, total: 12, phase: 'shop', jokers: 1, money: expectedMoney,
  })
  game.skipShop()
  assert.equal(game.handsLeft.value, 4)
  assert.equal(game.discardsLeft.value, 3)
  assert.deepEqual(describeWithoutMutation('classic', game.createSnapshot()), {
    mode: 'classic', name: '经典闯关', round: 2, total: 12, phase: 'playing', jokers: 1, money: expectedMoney,
  })

  const skipped = classicShop()
  const savedMoney = skipped.money.value
  skipped.skipShop()
  assert.deepEqual(describeWithoutMutation('classic', skipped.createSnapshot()), {
    mode: 'classic', name: '经典闯关', round: 2, total: 12, phase: 'playing', jokers: 0, money: savedMoney,
  }, 'a later empty deal is still an existing run')
})

test('a real duel play or either side discarding is saved progress even with an empty build', () => {
  const played = duelRun()
  act(played.you, [played.you.hand[0].id])
  assert.deepEqual(describeWithoutMutation('duel', encodeDuelSnapshot(played)), {
    mode: 'duel', name: '明牌对决', round: 1, total: 7, phase: 'playing', jokers: 0, money: 5,
  })
  const discarded = duelRun()
  act(discarded.you, [discarded.you.hand[0].id], 'discard')
  assert.deepEqual(describeWithoutMutation('duel', encodeDuelSnapshot(discarded)), {
    mode: 'duel', name: '明牌对决', round: 1, total: 7, phase: 'playing', jokers: 0, money: 5,
  })
  const response = duelRun()
  act(response.you, [response.you.hand[0].id])
  act(response.bot, [response.bot.hand[0].id], 'discard')
  response.pendingBotPlay = true
  assert.deepEqual(describeWithoutMutation('duel', encodeDuelSnapshot(response)), {
    mode: 'duel', name: '明牌对决', round: 1, total: 7, phase: 'playing', jokers: 0, money: 5,
  })
  const legacy = duelRun()
  act(legacy.bot, [legacy.bot.hand[0].id], 'discard')
  legacy.pendingBotPlay = true
  const legacySnapshot = encodeDuelSnapshot(legacy)
  delete legacySnapshot.actionTurn
  assert.deepEqual(describeWithoutMutation('duel', legacySnapshot), {
    mode: 'duel', name: '明牌对决', round: 1, total: 7, phase: 'playing', jokers: 0, money: 5,
  }, 'old independent-play saves can contain progress by the opponent alone')
})

test('real duel purchases and round progression report the player inventory rather than the opponent inventory', () => {
  const run = duelRun()
  completeDuelRound(run)
  run.shop = createShop(run, 1, run.claimedIds, () => 0)
  run.phase = 'shop'
  if (run.shop.turn === 'bot') assert.equal(finishShopping(run.shop, 'bot'), true)
  assert.equal(buyFromShop(run.shop, run, 'you', 'jester'), true)
  assert.deepEqual(describeWithoutMutation('duel', encodeDuelSnapshot(run)), {
    mode: 'duel', name: '明牌对决', round: 1, total: 7, phase: 'shop', jokers: 1, money: 7,
  })
  while (!run.shop.complete) assert.equal(finishShopping(run.shop, run.shop.turn), true)
  run.you = resetRound(run.you, seeded(36))
  run.bot = resetRound(run.bot, seeded(48))
  run.round = 2
  run.phase = 'playing'
  run.shop = null
  assert.deepEqual(describeWithoutMutation('duel', encodeDuelSnapshot(run)), {
    mode: 'duel', name: '明牌对决', round: 2, total: 7, phase: 'playing', jokers: 1, money: 7,
  })

  const empty = duelRun()
  completeDuelRound(empty)
  empty.shop = createShop(empty, 1, empty.claimedIds, () => 0)
  while (!empty.shop.complete) assert.equal(finishShopping(empty.shop, empty.shop.turn), true)
  empty.you = resetRound(empty.you, seeded(60))
  empty.bot = resetRound(empty.bot, seeded(72))
  empty.round = 2
  empty.phase = 'playing'
  empty.shop = null
  assert.deepEqual(describeWithoutMutation('duel', encodeDuelSnapshot(empty)), {
    mode: 'duel', name: '明牌对决', round: 2, total: 7, phase: 'playing', jokers: 0, money: 10,
  }, 'skipping all purchases cannot hide progress into a later round')
})

test('malformed, wrong-mode or absent saves never offer a misleading continuation', () => {
  const classic = useGameState({ random: seeded(4) })
  classicPlay(classic)
  const classicSnapshot = classic.createSnapshot()
  const duel = duelRun()
  act(duel.you, [duel.you.hand[0].id])
  const duelSnapshot = encodeDuelSnapshot(duel)
  for (const mode of ['classic', 'duel']) {
    for (const bad of [null, undefined, {}, 'broken', { schema: 99 }]) assert.equal(describeSavedRun(mode, bad), null)
  }
  assert.equal(describeWithoutMutation('classic', duelSnapshot), null)
  assert.equal(describeWithoutMutation('duel', classicSnapshot), null)
  assert.equal(describeWithoutMutation('unknown', clone(classicSnapshot)), null)
  for (const [mode, valid] of [['classic', classicSnapshot], ['duel', duelSnapshot]]) {
    const bad = clone(valid)
    if (mode === 'classic') bad.money = -1
    else bad.you.money = -1
    assert.equal(describeWithoutMutation(mode, bad), null)
  }
})
