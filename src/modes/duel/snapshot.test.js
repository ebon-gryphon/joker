import test from 'node:test'
import assert from 'node:assert/strict'
import { encodeDuelSnapshot, decodeDuelSnapshot } from './snapshot.js'
import { makePlayer, joker, act, awardRound, createShop, buyFromShop, sellJoker, finishShopping, resetRound, computerChoice, computerShopChoice, replaceFromShop } from './engine.js'

const copy = value => JSON.parse(JSON.stringify(value))
function state(jokers = []) {
  return {
    you: makePlayer(jokers, () => 0.3), bot: makePlayer(jokers, () => 0.3),
    round: 1, phase: 'playing', results: [], claimedIds: new Set(jokers.map(joker => joker.id)), shop: null,
    pendingBotPlay: false, handSort: 'rank', pace: 'normal', logs: [], status: '测试牌桌',
  }
}
function completeRound(run) {
  for (const side of ['you', 'bot']) {
    while (run[side].handsLeft) act(run[side], run[side].hand.slice(0, 5).map(card => card.id))
    awardRound(run[side])
  }
  run.results.push({ you: run.you.score, bot: run.bot.score })
  run.phase = run.round === 7 ? 'finished' : 'roundEnd'
  return run
}

test('a new empty-lineup save restores the first player turn with no claimed stock', () => {
  const restored = decodeDuelSnapshot(copy(encodeDuelSnapshot(state())))
  assert.ok(restored)
  assert.equal(restored.round, 1)
  assert.equal(restored.actionTurn, 'you')
  assert.deepEqual(restored.you.jokers, [])
  assert.deepEqual(restored.bot.jokers, [])
  assert.equal(restored.claimedIds.size, 0)
})

test('legacy shared-starter saves infer the remaining turn and stay compatible after saving again', () => {
  for (const side of ['you', 'bot']) {
    const run = state([joker('jester')])
    for (let i = 0; i < 4; i++) act(run[side], [run[side].hand[0].id])
    const old = copy(encodeDuelSnapshot(run))
    delete old.actionTurn
    const restored = decodeDuelSnapshot(old)
    assert.ok(restored)
    assert.equal(restored.actionTurn, side === 'you' ? 'bot' : 'you')
    assert.equal(restored.you.jokers[0].id, 'jester')
    assert.equal(restored.bot.jokers[0].id, 'jester')
    assert.ok(decodeDuelSnapshot(copy(encodeDuelSnapshot(restored))))
  }
})

test('duel snapshot restores deck order and canonical catalog effects, with independent mutable state', () => {
  const run = state([joker('jester')])
  run.you.jokers.push(joker('green_joker'))
  run.claimedIds.add('green_joker')
  act(run.you, run.you.hand.slice(0, 4).map(card => card.id))
  act(run.you, run.you.hand.slice(0, 2).map(card => card.id), 'discard')
  const raw = copy(encodeDuelSnapshot(run))
  raw.you.jokers[0].name = '坏元数据'
  raw.you.jokers[0].price = 999
  const restored = decodeDuelSnapshot(raw)
  assert.ok(restored)
  assert.deepEqual(restored.you.deck, run.you.deck)
  assert.deepEqual(restored.you.hand, run.you.hand)
  assert.equal(restored.you.jokers[0].name, '小丑')
  assert.equal(restored.you.jokers[0].price, 3)
  assert.equal(typeof restored.you.jokers[0].effect, 'function')
  assert.equal(restored.you.jokers[1].progress, 0)
  const ids = run.you.hand.slice(0, 5).map(card => card.id)
  assert.deepEqual(act(restored.you, ids), act(run.you, ids))
  assert.notEqual(restored.you.hand, run.you.hand)
})

test('a committed computer discard survives pause/reload and forces its next move to be a play', () => {
  const run = state()
  act(run.bot, run.bot.hand.slice(0, 3).map(card => card.id), 'discard')
  run.pendingBotPlay = true
  const restored = decodeDuelSnapshot(copy(encodeDuelSnapshot(run)))
  assert.ok(restored)
  assert.equal(restored.bot.discardsLeft, 2)
  assert.equal(restored.pendingBotPlay, true)
  assert.deepEqual(restored.bot.hand, run.bot.hand)
  assert.equal(computerChoice(restored.bot, !restored.pendingBotPlay).type, 'play')
})

test('shared-shop restore preserves sold ownership, sale proceeds, turn and permanent claims', () => {
  const run = completeRound(state())
  run.shop = createShop({ you: run.you, bot: run.bot }, run.round, run.claimedIds, () => 0)
  run.phase = 'shop'
  const id = run.shop.items[0].id
  assert.ok(buyFromShop(run.shop, run, 'you', id))
  assert.ok(finishShopping(run.shop, 'bot'))
  assert.ok(sellJoker(run.shop, run, 'you', id))
  const restored = decodeDuelSnapshot(copy(encodeDuelSnapshot(run)))
  assert.ok(restored)
  assert.equal(restored.you.money, run.you.money)
  assert.equal(restored.shop.turn, 'you')
  assert.equal(restored.shop.finished.bot, true)
  assert.equal(restored.shop.items[0].soldTo, 'you')
  assert.ok(restored.claimedIds.has(id))
  assert.ok(!restored.you.jokers.some(j => j.id === id))
  assert.equal(restored.shop.claimedIds, restored.claimedIds)
  assert.ok(finishShopping(restored.shop, 'you'))
  const complete = decodeDuelSnapshot(copy(encodeDuelSnapshot(restored)))
  assert.equal(complete.shop.turn, null)
  assert.equal(complete.shop.complete, true)
})

test('round-end and final ledgers restore without paying rewards twice', () => {
  const run = completeRound(state())
  let restored = decodeDuelSnapshot(copy(encodeDuelSnapshot(run)))
  assert.ok(restored)
  assert.deepEqual(awardRound(restored.you), { base: 0, bonus: 0, total: 0 })
  for (let round = 2; round <= 7; round++) {
    run.round = round; run.phase = 'playing'
    run.you = resetRound(run.you, () => 0.3)
    run.bot = resetRound(run.bot, () => 0.3)
    completeRound(run)
  }
  restored = decodeDuelSnapshot(copy(encodeDuelSnapshot(run)))
  assert.ok(restored)
  assert.equal(restored.phase, 'finished')
  assert.equal(restored.results.length, 7)
  assert.equal(restored.you.money, 40)
})

test('a save between the final play and round settlement remains resumable', () => {
  const run = state()
  for (const side of ['you', 'bot']) while (run[side].handsLeft) act(run[side], [run[side].hand[0].id])
  const restored = decodeDuelSnapshot(copy(encodeDuelSnapshot(run)))
  assert.ok(restored)
  assert.equal(restored.phase, 'playing')
  assert.equal(restored.you.handsLeft, 0)
  assert.equal(restored.you.roundAwarded, false)
  assert.equal(awardRound(restored.you).total, 5)
})

test('invalid schemas, duplicate cards, unknown jokers and invalid growth are rejected atomically', () => {
  const valid = encodeDuelSnapshot(state([joker('jester')]))
  const corruptions = [
    raw => { raw.schema = 99 },
    raw => { raw.you.hand[0] = raw.you.deck[0] },
    raw => { raw.you.deck.push(52) },
    raw => { raw.bot.jokers[0].id = 'missing' },
    raw => { raw.you.jokers[0].progress = 1 },
    raw => { raw.you.money = -1 },
    raw => { raw.bot.handsLeft = 5 },
    raw => { raw.claimedIds.push('jester') },
    raw => { raw.pendingBotPlay = true },
    raw => { raw.actionTurn = 'bot' },
    raw => { raw.phase = 'finished' },
  ]
  for (const corrupt of corruptions) {
    const raw = copy(valid)
    corrupt(raw)
    const before = JSON.stringify(raw)
    assert.equal(decodeDuelSnapshot(raw), null)
    assert.equal(JSON.stringify(raw), before)
  }
  assert.ok(decodeDuelSnapshot(valid))
  assert.equal(decodeDuelSnapshot(null), null)
  assert.equal(decodeDuelSnapshot({}), null)
})

test('inconsistent score breakdowns, round ledgers and premature winners are rejected', () => {
  const run = completeRound(state([joker('jester')]))
  const valid = encodeDuelSnapshot(run)
  for (const corrupt of [
    raw => { raw.you.last.score++ },
    raw => { raw.you.last.cards[0] = raw.you.hand[0] },
    raw => { raw.you.last.steps[0].id = 'unknown' },
    raw => { raw.results[0].you++ },
    raw => { raw.bot.roundAwarded = false },
    raw => { raw.phase = 'finished' },
  ]) {
    const raw = copy(valid); corrupt(raw)
    assert.equal(decodeDuelSnapshot(raw), null)
  }
})

test('shop saves cannot revive claimed stock, cross ownership or restore an inactive turn', () => {
  const run = completeRound(state())
  run.shop = createShop(run, 1, run.claimedIds, () => 0)
  run.phase = 'shop'
  assert.ok(buyFromShop(run.shop, run, 'you', run.shop.items[0].id))
  const valid = encodeDuelSnapshot(run)
  for (const corrupt of [
    raw => { raw.shop.items[0].soldTo = null },
    raw => { raw.shop.items[0].soldTo = 'bot' },
    raw => { raw.shop.items[1].id = raw.shop.items[0].id },
    raw => { raw.shop.finished.bot = true },
    raw => { raw.shop.firstSide = 'bot' },
    raw => { raw.shop.complete = true },
  ]) {
    const raw = copy(valid); corrupt(raw)
    assert.equal(decodeDuelSnapshot(raw), null)
  }
  assert.ok(decodeDuelSnapshot(valid))
})

test('all committed states across seven rounds, alternate purchases and replacements remain decodable', () => {
  const run = state()
  const checkpoint = () => assert.ok(decodeDuelSnapshot(copy(encodeDuelSnapshot(run))), `round ${run.round}, ${run.phase}`)
  for (let round = 1; round <= 7; round++) {
    if (round > 1) {
      run.round = round; run.phase = 'playing'; run.shop = null
      run.you = resetRound(run.you, () => 0.43)
      run.bot = resetRound(run.bot, () => 0.63)
    }
    checkpoint()
    for (const side of ['you', 'bot']) {
      while (run[side].handsLeft) {
        let move = computerChoice(run[side])
        if (move.type === 'discard') {
          act(run[side], move.ids, 'discard')
          run.pendingBotPlay = side === 'bot'
          checkpoint()
          move = computerChoice(run[side], false)
        }
        act(run[side], move.ids)
        run.pendingBotPlay = false
        checkpoint()
      }
    }
    completeRound(run)
    checkpoint()
    if (round === 7) break
    run.shop = createShop(run, round, run.claimedIds, () => 0.52)
    run.phase = 'shop'
    checkpoint()
    for (let turns = 0; !run.shop.complete && turns < 12; turns++) {
      const side = run.shop.turn
      const move = computerShopChoice(run[side], run.shop.items, 7 - round)
      if (move.type === 'buy') assert.ok(buyFromShop(run.shop, run, side, move.id))
      else if (move.type === 'replace') assert.ok(replaceFromShop(run.shop, run, side, move.sellId, move.id))
      else assert.ok(finishShopping(run.shop, side))
      checkpoint()
    }
    assert.equal(run.shop.complete, true)
  }
})
