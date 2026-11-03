import test from 'node:test'
import assert from 'node:assert/strict'
import {
  makePlayer, act, computerChoice, joker, context, awardRound, resetRound,
  createShop, buyFromShop, replaceFromShop, finishShopping, sellJoker, computerShopChoice, computerJokerOrder, reorderJokers, SHOP_SCENARIOS,
} from './engine.js'
import { calcScore } from '../../src/composables/useHandDetector.js'
import { findBestPlay } from '../../src/composables/useAI.js'
import { advanceJokers } from '../../src/composables/jokerCatalog.js'
import { JOKER_POOL } from '../../src/composables/jokerCatalog.js'
import { DUEL_RULES, DUEL_SHOP_WEIGHTS, selectDuelShopItems } from './config.js'

const players = () => ({ you: makePlayer(), bot: makePlayer() })
const state = (shop, ps) => JSON.stringify({ shop: { ...shop, claimedIds: [...shop.claimedIds] }, players: ps })
const withOffers = (ps, ids, round = 1, claimed = new Set()) => {
  const shop = createShop(ps, round, claimed, () => 0)
  shop.items = ids.map(id => ({ ...joker(id), soldTo: null }))
  return shop
}

test('new duel players start with independent empty builds and the full opening resources', () => {
  const ps = players()
  for (const side of ['you', 'bot']) {
    const p = ps[side]
    assert.deepEqual(p.jokers, [])
    assert.equal(p.money, 5)
    assert.equal(p.score, 0)
    assert.equal(p.handsLeft, 4)
    assert.equal(p.discardsLeft, 3)
    assert.equal(p.hand.length, 8)
    assert.equal(p.deck.length, 44)
    assert.equal(new Set([...p.hand, ...p.deck].map(c => c.id)).size, 52)
    assert.equal(p.last, null)
    assert.equal(p.roundAwarded, false)
  }
  assert.notEqual(ps.you.jokers, ps.bot.jokers)
  ps.you.jokers.push(joker('jester'))
  assert.deepEqual(ps.bot.jokers, [])
})

test('the first shared shop can sell the basic joker and its purchase is exclusive even after resale', () => {
  const ps = players()
  for (const side of ['you', 'bot']) {
    while (ps[side].handsLeft) act(ps[side], [ps[side].hand[0].id])
    awardRound(ps[side])
  }
  const claimed = new Set()
  const shop = createShop(ps, 1, claimed, () => 0)
  assert.equal(claimed.has('jester'), false)
  assert.ok(shop.items.some(j => j.id === 'jester' && j.soldTo === null))
  const side = shop.turn
  const opponent = side === 'you' ? 'bot' : 'you'
  const beforeGold = ps[side].money
  assert.equal(buyFromShop(shop, ps, side, 'jester'), true)
  assert.equal(ps[side].money, beforeGold - joker('jester').price)
  assert.deepEqual(ps[side].jokers.map(j => j.id), ['jester'])
  assert.deepEqual(ps[opponent].jokers, [])
  assert.ok(claimed.has('jester'))
  const before = state(shop, ps)
  assert.equal(buyFromShop(shop, ps, opponent, 'jester'), false)
  assert.equal(state(shop, ps), before)
  assert.equal(finishShopping(shop, opponent), true)
  assert.equal(sellJoker(shop, ps, side, 'jester'), true)
  assert.deepEqual(ps[side].jokers, [])
  const later = createShop(ps, 2, claimed, () => 0)
  assert.ok(later.items.every(j => j.id !== 'jester'))
})

test('52 unique cards; discards conserve cards and consume only discard resource', () => {
  const p = makePlayer()
  assert.equal(p.money, 5)
  const ids = p.hand.slice(0, 5).map(c => c.id)
  act(p, ids, 'discard')
  assert.equal(p.handsLeft, 4)
  assert.equal(p.discardsLeft, 2)
  assert.equal(p.hand.length, 8)
  assert.equal(p.deck.length, 39)
  assert.equal(new Set([...p.hand, ...p.deck].map(c => c.id)).size, 47)
  assert.ok(ids.every(id => !p.hand.some(c => c.id === id)))
})

test('invalid selections and exhausted resources do not mutate the game', () => {
  const p = makePlayer()
  let before = JSON.stringify(p)
  for (const ids of [[], [99], [p.hand[0].id, p.hand[0].id], p.hand.slice(0, 6).map(c => c.id)]) {
    assert.throws(() => act(p, ids))
    assert.equal(JSON.stringify(p), before)
  }
  p.discardsLeft = 0
  before = JSON.stringify(p)
  assert.throws(() => act(p, [p.hand[0].id], 'discard'))
  assert.throws(() => act(p, [p.hand[0].id], 'unknown'))
  assert.equal(JSON.stringify(p), before)
})

test('computer completes four legal plays from empty or developed builds using only public hand and cash', () => {
  for (const build of [[], [joker('jester'), joker('green_joker'), joker('bull')]]) {
    const p = makePlayer(build, seededRandom(404))
    let total = 0
    for (let t = 0; t < 4; t++) {
      const snapshot = { hand: p.hand, jokers: p.jokers, ...context(p) }
      Object.defineProperty(snapshot, 'deck', { get() { throw Error('Planning must not inspect the deck') } })
      let move = computerChoice(snapshot)
      if (move.type === 'discard') {
        act(p, move.ids, 'discard')
        move = computerChoice({ hand: p.hand, jokers: p.jokers, ...context(p) }, false)
      }
      const cards = p.hand.filter(c => move.ids.includes(c.id))
      const expected = calcScore(cards, p.jokers, context(p)).score
      total += expected
      assert.equal(act(p, move.ids).score, expected)
    }
    assert.equal(p.handsLeft, 0)
    assert.equal(p.score, total)
    assert.throws(() => act(p, [p.hand[0].id]))
    assert.ok(p.discardsLeft >= 0)
  }
})

test('actual money affects cash jokers and rebate pays on a valid discard', () => {
  const p = makePlayer([joker('bull'), joker('rebate'), joker('green_joker')])
  p.money = 20
  const cards = p.hand.slice(0, 2)
  const expected = calcScore(cards, p.jokers, context(p)).score
  assert.notEqual(expected, calcScore(cards, p.jokers, { ...context(p), money: 0 }).score)
  assert.equal(act(p, cards.map(c => c.id)).score, expected)
  assert.equal(p.jokers.find(j => j.id === 'green_joker').progress, 1)
  act(p, [p.hand[0].id], 'discard')
  assert.equal(p.money, 21)
  assert.equal(p.jokers.find(j => j.id === 'green_joker').progress, 0)
  const before = JSON.stringify(p)
  assert.throws(() => act(p, [99], 'discard'))
  assert.equal(JSON.stringify(p), before)
})

test('equal baseline reward, golden bonus once, next round preserves money and growth', () => {
  const ps = players()
  ps.you.jokers.push({ ...joker('green_joker'), progress: 7 }, joker('golden_joker'))
  assert.throws(() => awardRound(ps.you))
  ps.you.handsLeft = ps.bot.handsLeft = 0
  ps.you.score = 9999
  ps.bot.score = 100
  assert.deepEqual(awardRound(ps.you), { base: 5, bonus: 2, total: 7 })
  assert.deepEqual(awardRound(ps.bot), { base: 5, bonus: 0, total: 5 })
  assert.equal(ps.you.money, 12)
  assert.equal(ps.bot.money, 10)
  assert.deepEqual(awardRound(ps.you), { base: 0, bonus: 0, total: 0 })
  const next = resetRound(ps.you, () => 0)
  assert.equal(next.money, 12)
  assert.equal(next.jokers.find(j => j.id === 'green_joker').progress, 7)
  assert.equal(next.score, 0)
  assert.equal(next.handsLeft, 4)
  assert.equal(next.discardsLeft, 3)
  assert.equal(next.roundAwarded, false)
  next.jokers.find(j => j.id === 'green_joker').progress = 8
  assert.equal(ps.you.jokers.find(j => j.id === 'green_joker').progress, 7)
})

test('higher score gets first purchase; tied round initiative alternates', () => {
  const ps = players()
  ps.you.score = 100
  ps.bot.score = 101
  assert.equal(createShop(ps, 1).turn, 'bot')
  ps.you.score = 102
  assert.equal(createShop(ps, 2).turn, 'you')
  ps.you.score = ps.bot.score
  assert.equal(createShop(ps, 1).turn, 'you')
  assert.equal(createShop(ps, 2).turn, 'bot')
  assert.equal(createShop(ps, 3).turn, 'you')
})

test('shared offers use independent duel rarity weights with match-wide claims excluded', () => {
  const ps = players()
  ps.bot.jokers.push(joker('pair_engine'))
  const claimed = new Set(['green_joker'])
  const expected = selectDuelShopItems(JOKER_POOL, new Set(['green_joker', 'pair_engine']), 2, () => 0.7)
  const shop = createShop(ps, 3, claimed, () => 0.7)
  assert.deepEqual(shop.items.map(j => j.id), expected.map(j => j.id))
  assert.ok(shop.items.every(j => j.soldTo === null && !claimed.has(j.id)))
  assert.equal(shop.claimedIds, claimed)
  assert.equal(new Set(shop.items.map(j => j.id)).size, shop.items.length)
})

test('buys alternate, deduct own gold, and publish ownership immediately', () => {
  const ps = players()
  ps.you.money = ps.bot.money = 15
  const shop = withOffers(ps, ['blue_joker', 'scholar', 'jolly_joker'])
  assert.equal(buyFromShop(shop, ps, 'you', 'blue_joker'), true)
  assert.equal(ps.you.money, 12)
  assert.equal(ps.bot.money, 15)
  assert.equal(shop.items[0].soldTo, 'you')
  assert.equal(shop.turn, 'bot')
  const before = state(shop, ps)
  assert.equal(buyFromShop(shop, ps, 'you', 'scholar'), false)
  assert.equal(state(shop, ps), before)
  assert.equal(buyFromShop(shop, ps, 'bot', 'scholar'), true)
  assert.equal(shop.turn, 'you')
  assert.equal(buyFromShop(shop, ps, 'you', 'jolly_joker'), true)
  assert.equal(shop.turn, 'bot')
  assert.deepEqual(ps.you.jokers.map(j => j.id), ['blue_joker', 'jolly_joker'])
  assert.equal(ps.you.jokers.at(-1).progress, 0)
})

test('ending shopping is permanent, leaves cash, lets other side keep buying', () => {
  const ps = players()
  ps.bot.money = 20
  const shop = withOffers(ps, ['blue_joker', 'scholar', 'jolly_joker'])
  assert.equal(finishShopping(shop, 'you'), true)
  assert.equal(ps.you.money, 5)
  assert.equal(shop.finished.you, true)
  assert.equal(shop.turn, 'bot')
  const before = state(shop, ps)
  assert.equal(buyFromShop(shop, ps, 'you', 'blue_joker'), false)
  assert.equal(finishShopping(shop, 'you'), false)
  assert.equal(state(shop, ps), before)
  assert.equal(buyFromShop(shop, ps, 'bot', 'blue_joker'), true)
  assert.equal(shop.turn, 'bot')
  assert.equal(buyFromShop(shop, ps, 'bot', 'scholar'), true)
  assert.equal(shop.turn, 'bot')
  assert.equal(finishShopping(shop, 'bot'), true)
  assert.equal(shop.complete, true)
  assert.equal(shop.turn, null)
  const completeState = state(shop, ps)
  assert.equal(buyFromShop(shop, ps, 'bot', 'jolly_joker'), false)
  assert.equal(sellJoker(shop, ps, 'bot', 'blue_joker'), false)
  assert.equal(finishShopping(shop, 'bot'), false)
  assert.equal(state(shop, ps), completeState)
})

test('insufficient funds, full slots, unknown side and stale cards are atomic', () => {
  const ps = players()
  ps.you.money = 2
  const shop = withOffers(ps, ['blue_joker', 'scholar', 'jolly_joker'])
  let before = state(shop, ps)
  for (const [side, id] of [['you', 'blue_joker'], ['you', 'absent'], ['intruder', 'scholar'], ['bot', 'scholar']]) {
    assert.equal(buyFromShop(shop, ps, side, id), false)
    assert.equal(state(shop, ps), before)
  }
  assert.equal(finishShopping(shop, 'bot'), false)
  assert.equal(finishShopping(shop, 'intruder'), false)
  assert.equal(state(shop, ps), before)
  ps.you.money = 10
  ps.you.jokers.push(...['jester', 'runner', 'bull', 'rebate', 'green_joker'].map(joker))
  before = state(shop, ps)
  assert.equal(buyFromShop(shop, ps, 'you', 'scholar'), false)
  assert.equal(state(shop, ps), before)
  assert.equal(sellJoker(shop, ps, 'you', 'runner'), true)
  assert.equal(buyFromShop(shop, ps, 'you', 'scholar'), true)
  before = state(shop, ps)
  assert.equal(buyFromShop(shop, ps, 'bot', 'scholar'), false)
  assert.equal(state(shop, ps), before)
})

test('selling requires active ownership, pays original half price, preserves turn and claim', () => {
  const ps = players()
  ps.you.money = ps.bot.money = 20
  const claimed = new Set()
  const shop = withOffers(ps, ['pair_engine', 'blue_joker', 'scholar'], 1, claimed)
  assert.equal(buyFromShop(shop, ps, 'you', 'pair_engine'), true)
  let before = state(shop, ps)
  assert.equal(sellJoker(shop, ps, 'you', 'pair_engine'), false)
  assert.equal(sellJoker(shop, ps, 'bot', 'pair_engine'), false)
  assert.equal(state(shop, ps), before)
  assert.equal(buyFromShop(shop, ps, 'bot', 'blue_joker'), true)
  assert.equal(sellJoker(shop, ps, 'you', 'pair_engine'), true)
  assert.equal(ps.you.money, 17)
  assert.equal(shop.turn, 'you')
  assert.equal(shop.items[0].soldTo, 'you')
  assert.ok(claimed.has('pair_engine'))
  before = state(shop, ps)
  assert.equal(sellJoker(shop, ps, 'you', 'pair_engine'), false)
  assert.equal(state(shop, ps), before)
  const later = createShop(ps, 4, claimed, () => 0.95)
  assert.ok(later.items.every(j => !['pair_engine', 'blue_joker'].includes(j.id)))
  assert.ok(claimed.has('pair_engine'))
  later.items.push({ ...joker('pair_engine'), soldTo: null })
  assert.equal(buyFromShop(later, ps, later.turn, 'pair_engine'), false)
})

test('computer shop considers build synergy and never chooses sold, owned or unaffordable goods', () => {
  const p = makePlayer([joker('jester'), joker('pair_engine')])
  p.money = 10
  assert.deepEqual(computerShopChoice(p, ['jolly_joker', 'droll_joker'].map(joker)), { type: 'buy', id: 'jolly_joker' })
  assert.deepEqual(computerShopChoice(p, [{ ...joker('jolly_joker'), soldTo: 'you' }, joker('pair_engine'), joker('dynasty')]), { type: 'finish' })
  p.money = 0
  assert.deepEqual(computerShopChoice(p, [joker('blue_joker')]), { type: 'finish' })
  assert.deepEqual(computerShopChoice(p, [joker('blue_joker')], 0), { type: 'finish' })
})

function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

test('frozen seven-round rules define six exact independent shop tiers', () => {
  assert.deepEqual(DUEL_RULES, { rounds: 7, hands: 4, discards: 3, handSize: 8, maxJokers: 5, startingMoney: 5, roundReward: 5 })
  assert.ok(Object.isFrozen(DUEL_RULES))
  assert.ok(Object.isFrozen(DUEL_SHOP_WEIGHTS))
  assert.ok(DUEL_SHOP_WEIGHTS.every(Object.isFrozen))
  assert.deepEqual(DUEL_SHOP_WEIGHTS.map(w => [w.common, w.rare, w.legendary]), [
    [80, 20, 0], [70, 28, 2], [60, 35, 5], [50, 40, 10], [40, 45, 15], [35, 45, 20],
  ])
  const p = makePlayer()
  assert.equal(p.hand.length, DUEL_RULES.handSize)
  assert.equal(p.handsLeft, DUEL_RULES.hands)
  assert.equal(p.discardsLeft, DUEL_RULES.discards)
  assert.equal(p.money, DUEL_RULES.startingMoney)
})

test('seeded independent shop samples follow each tier without duplicate offers', () => {
  const random = seededRandom(20261012)
  const excluded = new Set(['jester'])
  const beforePool = JSON.stringify(JOKER_POOL)
  for (let stage = 0; stage < DUEL_SHOP_WEIGHTS.length; stage++) {
    const counts = { common: 0, rare: 0, legendary: 0 }
    const shops = 5000
    for (let i = 0; i < shops; i++) {
      const items = selectDuelShopItems(JOKER_POOL, excluded, stage, random)
      assert.equal(items.length, 3)
      assert.equal(new Set(items.map(j => j.id)).size, 3)
      for (const item of items) counts[item.rarity]++
    }
    for (const [rarity, percent] of Object.entries(DUEL_SHOP_WEIGHTS[stage])) {
      const actual = counts[rarity] / (shops * 3) * 100
      assert.ok(Math.abs(actual - percent) < 1.8, `stage ${stage + 1}: ${rarity} expected ${percent}%, got ${actual.toFixed(2)}%`)
      if (percent === 0) assert.equal(counts[rarity], 0)
    }
  }
  assert.equal(JSON.stringify(JOKER_POOL), beforePool)
  assert.deepEqual([...excluded], ['jester'])
})

test('exhaustion redistributes only unlocked tiers; invalid shop stages do not claim anything', () => {
  const rare = joker('pair_engine')
  const legendary = joker('dynasty')
  const pool = [rare, legendary]
  assert.deepEqual(selectDuelShopItems(pool, new Set(), 0, () => 0), [rare])
  assert.deepEqual(selectDuelShopItems(pool, new Set(['pair_engine']), 0, () => 0), [])
  assert.deepEqual(selectDuelShopItems(pool, new Set(), 5, () => 0), [rare, legendary])
  assert.deepEqual(selectDuelShopItems(pool, new Set(pool.map(j => j.id)), 5), [])
  const ps = players()
  const claimed = new Set(['rebate'])
  for (const round of [0, 7, 8, -1, 1.5, NaN]) {
    assert.throws(() => createShop(ps, round, claimed))
    assert.deepEqual([...claimed], ['rebate'])
  }
  for (const index of [-1, 6, 0.5, NaN]) assert.throws(() => selectDuelShopItems(pool, claimed, index))
})

test('atomic replacement uses sale budget, consumes one purchase turn and preserves other growth', () => {
  const ps = players()
  ps.you.jokers = [joker('jester'), { ...joker('runner'), progress: 40 }, { ...joker('green_joker'), progress: 9 }, joker('blue_joker'), joker('scholar')]
  ps.you.money = 4
  const claimed = new Set()
  const shop = withOffers(ps, ['dynasty', 'flush_flag'], 1, claimed)
  const before = state(shop, ps)
  assert.equal(replaceFromShop(shop, ps, 'you', 'scholar', 'dynasty'), false)
  assert.equal(state(shop, ps), before)
  // $4 plus the $2 resale buys a $6 card, even though a direct buy is impossible.
  assert.equal(replaceFromShop(shop, ps, 'you', 'runner', 'flush_flag'), true)
  assert.equal(ps.you.money, 0)
  assert.equal(ps.you.jokers.length, DUEL_RULES.maxJokers)
  assert.equal(ps.you.jokers.at(-1).id, 'flush_flag')
  assert.equal(ps.you.jokers.at(-1).progress, 0)
  assert.equal(ps.you.jokers.find(j => j.id === 'green_joker').progress, 9)
  assert.equal(shop.turn, 'bot')
  assert.equal(shop.items[1].soldTo, 'you')
  assert.ok(claimed.has('runner') && claimed.has('flush_flag'))
  const after = state(shop, ps)
  assert.equal(replaceFromShop(shop, ps, 'you', 'scholar', 'dynasty'), false)
  assert.equal(replaceFromShop(shop, ps, 'bot', 'jester', 'flush_flag'), false)
  assert.equal(state(shop, ps), after)
  const nextShop = createShop(ps, 6, claimed, () => 0)
  assert.ok(nextShop.items.every(j => !['runner', 'flush_flag'].includes(j.id)))
})

test('failed or stale replacement never sells first; after other finishes initiative stays active', () => {
  const ps = { you: makePlayer([joker('jester')]), bot: makePlayer([joker('jester')]) }
  ps.you.money = 20
  const shop = withOffers(ps, ['blue_joker', 'dynasty'])
  shop.items[0].soldTo = 'bot'
  shop.claimedIds.add('dynasty')
  const before = state(shop, ps)
  for (const [side, sellId, buyId] of [
    ['you', 'missing', 'blue_joker'], ['bot', 'jester', 'dynasty'], ['intruder', 'jester', 'dynasty'],
    ['you', 'jester', 'blue_joker'], ['you', 'jester', 'dynasty'], ['you', 'jester', 'missing'],
  ]) {
    assert.equal(replaceFromShop(shop, ps, side, sellId, buyId), false)
    assert.equal(state(shop, ps), before)
  }
  shop.items.push({ ...joker('jolly_joker'), soldTo: null })
  assert.equal(finishShopping(shop, 'you'), true)
  ps.bot.money = 0
  assert.equal(replaceFromShop(shop, ps, 'bot', 'jester', 'jolly_joker'), false)
  ps.bot.money = 5
  assert.equal(replaceFromShop(shop, ps, 'bot', 'jester', 'jolly_joker'), true)
  assert.equal(shop.turn, 'bot')
  assert.equal(ps.bot.money, 2)
})

test('atomic replacement matches manual sale-plus-purchase order and resulting score', () => {
  const starting = ['jester', 'heart_collector', 'blue_joker', 'runner', 'banner'].map(joker)
  const automatic = { you: makePlayer(starting), bot: makePlayer() }
  const manual = { you: makePlayer(starting), bot: makePlayer() }
  const automaticShop = withOffers(automatic, ['half_joker'])
  const manualShop = withOffers(manual, ['half_joker'])
  assert.equal(replaceFromShop(automaticShop, automatic, 'you', 'jester', 'half_joker'), true)
  assert.equal(sellJoker(manualShop, manual, 'you', 'jester'), true)
  assert.equal(buyFromShop(manualShop, manual, 'you', 'half_joker'), true)
  assert.deepEqual(automatic.you.jokers, manual.you.jokers)
  assert.equal(automatic.you.money, manual.you.money)
  const cards = ['2', '5', '8'].map((rank, id) => ({ rank, id, suit: '♥' }))
  assert.equal(calcScore(cards, automatic.you.jokers, context(automatic.you)).score,
    calcScore(cards, manual.you.jokers, context(manual.you)).score)
  assert.equal(automaticShop.turn, manualShop.turn)
})

test('computer replaces weak full-slot support, accounts for sale budget, and never mutates its input', () => {
  const p = makePlayer(['jester', 'pair_engine', 'jolly_joker', 'golden_joker', 'rebate'].map(joker))
  p.money = 4
  const offers = [joker('trio')]
  const before = JSON.stringify({ p, offers })
  const move = computerShopChoice(p, offers, 1)
  assert.equal(move.type, 'replace')
  assert.equal(move.id, 'trio')
  assert.ok(['golden_joker', 'rebate'].includes(move.sellId))
  assert.equal(JSON.stringify({ p, offers }), before)
  p.money = 0
  assert.deepEqual(computerShopChoice(p, [joker('dynasty')], 1), { type: 'finish' })
})

test('computer preserves mature growth over weaker support and discounts end-of-match economy', () => {
  const p = makePlayer([
    { ...joker('green_joker'), progress: 12 }, { ...joker('runner'), progress: 80 },
    { ...joker('square_joker'), progress: 60 }, joker('constellation'), joker('hermit'),
  ])
  p.money = 20
  assert.deepEqual(computerShopChoice(p, [joker('scholar')], 1), { type: 'finish' })
  const early = makePlayer()
  early.money = 5
  assert.deepEqual(computerShopChoice(early, [joker('golden_joker')], 6), { type: 'buy', id: 'golden_joker' })
  assert.deepEqual(computerShopChoice(early, [joker('golden_joker')], 1), { type: 'finish' })
})

test('seven complete rounds visit exactly six shared shops and preserve legal builds and cash', () => {
  const random = seededRandom(7712)
  let ps = { you: makePlayer(undefined, random), bot: makePlayer(undefined, random) }
  const claimed = new Set()
  let shops = 0
  let replacements = 0
  for (let round = 1; round <= DUEL_RULES.rounds; round++) {
    for (const side of ['you', 'bot']) {
      while (ps[side].handsLeft > 0) {
        // The snapshot deliberately contains no deck; planning cannot inspect draws.
        const move = computerChoice({ hand: ps[side].hand, jokers: ps[side].jokers, ...context(ps[side]) })
        act(ps[side], move.ids, move.type)
      }
      awardRound(ps[side])
      assert.ok(ps[side].money >= 0)
    }
    if (round === DUEL_RULES.rounds) {
      assert.throws(() => createShop(ps, round, claimed, random))
      continue
    }
    const shop = createShop(ps, round, claimed, random)
    shops++
    let actions = 0
    while (!shop.complete) {
      const side = shop.turn
      const move = computerShopChoice(ps[side], shop.items, DUEL_RULES.rounds - round)
      if (move.type === 'buy') assert.equal(buyFromShop(shop, ps, side, move.id), true)
      else if (move.type === 'replace') {
        assert.equal(replaceFromShop(shop, ps, side, move.sellId, move.id), true)
        replacements++
      } else assert.equal(finishShopping(shop, side), true)
      assert.ok(++actions <= 5, 'three shared products and two finish actions bound each shop')
    }
    assert.ok(ps.you.jokers.every(j => !ps.bot.jokers.some(other => other.id === j.id)))
    for (const side of ['you', 'bot']) {
      assert.ok(ps[side].jokers.length <= DUEL_RULES.maxJokers)
      assert.ok(ps[side].money >= 0)
      const previousMoney = ps[side].money
      const previousBuild = ps[side].jokers
      ps[side] = resetRound(ps[side], random)
      assert.equal(ps[side].money, previousMoney)
      assert.deepEqual(ps[side].jokers, previousBuild)
    }
  }
  assert.equal(shops, DUEL_RULES.rounds - 1)
  assert.ok(replacements > 0, 'later shops must exercise full-slot upgrades')
})

test('public shop scenarios cover every rank/suit and all combat joker conditions', () => {
  const ranks = new Map()
  const contexts = [{ money: 10, handsLeft: 4, discardsLeft: 3 }, { money: 10, handsLeft: 1, discardsLeft: 0 }]
  for (const { cards } of SHOP_SCENARIOS) {
    assert.ok(cards.length >= 1 && cards.length <= 5)
    assert.equal(new Set(cards.map(c => `${c.rank}${c.suit}`)).size, cards.length, 'every scenario is a legal play from one standard deck')
    for (const card of cards) {
      if (!ranks.has(card.rank)) ranks.set(card.rank, new Set())
      ranks.get(card.rank).add(card.suit)
    }
  }
  assert.equal(ranks.size, 13)
  assert.ok([...ranks.values()].every(suits => suits.size === 4))
  assert.ok(SHOP_SCENARIOS.some(s => s.cards.length === 1), 'hermit has a qualifying play')
  assert.ok(SHOP_SCENARIOS.some(s => s.cards.length === 4), 'square joker has a qualifying play')
  assert.equal(JOKER_POOL.length, 37)
  const noCombatEffect = JOKER_POOL.filter(j => !SHOP_SCENARIOS.some(s => contexts.some(x =>
    calcScore(s.cards, [j], x).score > calcScore(s.cards, [], x).score,
  ))).map(j => j.id)
  assert.deepEqual(noCombatEffect, ['golden_joker', 'rebate'], 'all 35 scoring cards contribute; both economy cards are evaluated by future-shop income separately')
  const p = makePlayer(undefined, () => 0, 10)
  assert.deepEqual(computerShopChoice(p, [joker('walkie_talkie')], 6), { type: 'buy', id: 'walkie_talkie' })
})

test('shop reordering changes multiplier order without spending money or initiative', () => {
  const ps = players()
  ps.you.jokers = [joker('jester'), joker('heart_collector'), { ...joker('green_joker'), progress: 7 }]
  const shop = withOffers(ps, ['blue_joker'])
  const cards = ['2', '5', '8'].map((rank, id) => ({ id, rank, suit: '♥' }))
  const beforeScore = calcScore(cards, ps.you.jokers, context(ps.you)).score
  const beforeGold = ps.you.money
  const beforeShop = JSON.stringify({ ...shop, claimedIds: [...shop.claimedIds] })
  assert.equal(reorderJokers(shop, ps, 'you', 'jester', 1), true)
  assert.deepEqual(ps.you.jokers.map(j => j.id), ['heart_collector', 'jester', 'green_joker'])
  assert.equal(ps.you.jokers.find(j => j.id === 'green_joker').progress, 7)
  assert.equal(ps.you.money, beforeGold)
  assert.equal(JSON.stringify({ ...shop, claimedIds: [...shop.claimedIds] }), beforeShop)
  assert.ok(calcScore(cards, ps.you.jokers, context(ps.you)).score < beforeScore)
  assert.equal(reorderJokers(shop, ps, 'you', 'jester', -1), true)
  assert.equal(calcScore(cards, ps.you.jokers, context(ps.you)).score, beforeScore)
})

test('reordering rejects wrong ownership, inactive turns, boundaries and stale shop actions atomically', () => {
  const ps = { you: makePlayer([joker('jester')]), bot: makePlayer([joker('jester')]) }
  ps.you.jokers.push(joker('blue_joker'))
  ps.bot.jokers.push(joker('pair_engine'))
  const shop = withOffers(ps, ['scholar'])
  const before = state(shop, ps)
  for (const [side, id, direction] of [
    ['you', 'jester', -1], ['you', 'blue_joker', 1], ['you', 'pair_engine', 1],
    ['you', 'missing', 1], ['bot', 'jester', 1], ['other', 'jester', 1],
    ['you', 'jester', 0], ['you', 'jester', 2], ['you', 'jester', '1'],
  ]) {
    assert.equal(reorderJokers(shop, ps, side, id, direction), false)
    assert.equal(state(shop, ps), before)
  }
  assert.equal(finishShopping(shop, 'you'), true)
  const afterFinished = state(shop, ps)
  assert.equal(reorderJokers(shop, ps, 'you', 'jester', 1), false)
  assert.equal(state(shop, ps), afterFinished)
  assert.equal(finishShopping(shop, 'bot'), true)
  const afterComplete = state(shop, ps)
  assert.equal(reorderJokers(shop, ps, 'bot', 'jester', 1), false)
  assert.equal(state(shop, ps), afterComplete)
})

test('computer ordering is pure, stable, preserves growth and improves actual multiplier scoring', () => {
  const jokers = [joker('heart_collector'), joker('jester'), { ...joker('green_joker'), progress: 7 }, joker('club_lover'), { ...joker('runner'), progress: 40 }]
  const before = JSON.stringify(jokers)
  const ordered = computerJokerOrder(jokers)
  assert.equal(JSON.stringify(jokers), before)
  assert.notEqual(ordered, jokers)
  assert.deepEqual(ordered.map(j => j.id), ['jester', 'green_joker', 'runner', 'heart_collector', 'club_lover'])
  assert.equal(ordered[1], jokers[2])
  assert.equal(ordered[2].progress, 40)
  const cards = ['2', '5', '8'].map((rank, id) => ({ id, rank, suit: '♥' }))
  const x = { money: 5, handsLeft: 4, discardsLeft: 3 }
  assert.ok(calcScore(cards, ordered, x).score > calcScore(cards, jokers, x).score)
  const ps = { you: makePlayer(), bot: makePlayer(jokers) }
  ps.bot.score = 100
  const shop = withOffers(ps, ['scholar'])
  const beforeShop = JSON.stringify({ ...shop, claimedIds: [...shop.claimedIds] })
  const beforeGold = ps.bot.money
  // Reach the exact same order exclusively through human-legal adjacent swaps.
  for (let target = 0; target < ordered.length; target++) {
    let index = ps.bot.jokers.findIndex(j => j.id === ordered[target].id)
    while (index > target) {
      assert.equal(reorderJokers(shop, ps, 'bot', ordered[target].id, -1), true)
      index--
    }
  }
  assert.deepEqual(ps.bot.jokers, ordered)
  assert.equal(ps.bot.money, beforeGold)
  assert.equal(JSON.stringify({ ...shop, claimedIds: [...shop.claimedIds] }), beforeShop)
  assert.deepEqual(computerJokerOrder(ordered), ordered)
})


test('shop growth forecast prefers immediate support late and green investment with time to mature', () => {
  const p = makePlayer([joker('jester')], () => 0, 10)
  const offers = ['green_joker', 'blue_joker', 'jolly_joker'].map(joker)
  const before = JSON.stringify({ p, offers })
  assert.deepEqual(computerShopChoice(p, offers, 1), { type: 'buy', id: 'blue_joker' })
  assert.deepEqual(computerShopChoice(p, offers, 2), { type: 'buy', id: 'blue_joker' })
  for (const remaining of [3, 4, 5, 6]) {
    assert.deepEqual(computerShopChoice(p, offers, remaining), { type: 'buy', id: 'green_joker' })
  }
  assert.equal(JSON.stringify({ p, offers }), before, 'forecasts never mature actual players or stock')
  const ps = { you: p, bot: makePlayer() }
  const shop = withOffers(ps, ['green_joker'])
  assert.equal(buyFromShop(shop, ps, 'you', 'green_joker'), true)
  assert.equal(ps.you.jokers.find(j => j.id === 'green_joker').progress, 0, 'a projected shop value does not grant free growth')
})

test('existing mature green receives the same forecast and is retained over weak replacement', () => {
  const p = makePlayer([
    { ...joker('green_joker'), progress: 12 }, { ...joker('runner'), progress: 80 },
    { ...joker('square_joker'), progress: 60 }, joker('constellation'), joker('hermit'),
  ], () => 0, 20)
  const before = JSON.stringify(p)
  for (const remaining of [1, 3, 6]) {
    assert.deepEqual(computerShopChoice(p, [joker('scholar')], remaining), { type: 'finish' })
  }
  assert.equal(JSON.stringify(p), before)
  assert.equal(p.jokers[0].progress, 12)
})

const knownTwoPair = () => ['K','K','Q','Q','10','7','5','2'].map((rank,id)=>({id,rank,suit:['♠','♥','♦','♣'][id%4]}))
test('computer activates known discard multipliers using a spare while preserving the best core', () => {
  const p = makePlayer([joker('jester'), { ...joker('green_joker'), progress: 6 }, joker('banner'), joker('empty_pockets'), joker('rebate')])
  p.hand = knownTwoPair()
  p.deck = []
  p.handsLeft = 1
  p.discardsLeft = 1
  const snapshot = { hand: p.hand, jokers: p.jokers, ...context(p) }
  Object.defineProperty(snapshot, 'deck', { get() { throw Error('Planning must not inspect the deck') } })
  const before = JSON.stringify(p)
  const core = findBestPlay(p.hand, p.jokers, context(p))
  const scoreBefore = calcScore(core, p.jokers, context(p)).score
  const move = computerChoice(snapshot)
  assert.equal(move.type, 'discard')
  assert.equal(move.ids.length, 1)
  assert.ok(move.ids.every(id => !core.some(c => c.id === id)))
  assert.match(move.reason, /孤注一掷/)
  assert.ok(move.guaranteedScore > scoreBefore)
  assert.equal(JSON.stringify(p), before, 'planning is pure')
  act(p, move.ids, 'discard')
  assert.equal(p.money, 6)
  assert.equal(p.jokers.find(j => j.id === 'green_joker').progress, 5)
  assert.ok(core.every(c => p.hand.some(held => held.id === c.id)))
  const nextMove = computerChoice(p, false)
  const actual = act(p, nextMove.ids)
  assert.ok(actual.score >= move.guaranteedScore)
})

test('computer respects discard penalties and the pending-play no-discard gate', () => {
  const hand = knownTwoPair()
  const p = { hand, jokers: [{ ...joker('green_joker'), progress: 12 }, joker('banner')], handsLeft: 2, discardsLeft: 1, money: 5 }
  const core = findBestPlay(hand, p.jokers, context(p))
  assert.ok(calcScore(core, advanceJokers(p.jokers, 'discard'), { ...context(p), discardsLeft: 0 }).score < calcScore(core, p.jokers, context(p)).score)
  assert.equal(computerChoice(p).type, 'play')
  p.jokers = [joker('phoenix')]
  assert.equal(computerChoice(p).type, 'play', 'phoenix does not activate before the final play')
  p.handsLeft = 1
  const move = computerChoice(p)
  assert.equal(move.type, 'discard')
  assert.match(move.reason, /不死鸟/)
  assert.equal(computerChoice(p, false).type, 'play', 'committed discard is followed by a play')
  p.discardsLeft = 0
  assert.equal(computerChoice(p).type, 'play')
})
