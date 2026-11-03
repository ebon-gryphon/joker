import { JOKER_POOL } from '../../composables/jokerCatalog.js'
import { cardValue, detectHand } from '../../composables/useHandDetector.js'
import { DUEL_RULES } from './config.js'
import { matchStanding } from './player-tools.js'
import { nextDuelTurn } from './turns.js'

const catalog = new Map(JOKER_POOL.map(joker => [joker.id, joker]))
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const suits = ['♠', '♥', '♦', '♣']
const phases = new Set(['playing', 'roundEnd', 'shop', 'finished'])
const sides = ['you', 'bot']
const growth = { runner: [80, 8], square_joker: [60, 4], green_joker: [12, 1] }
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const integer = (value, max = 1e12) => Number.isSafeInteger(value) && value >= 0 && value <= max
const assert = valid => { if (!valid) throw Error('Invalid duel save') }
const cardIds = cards => cards.map(card => card.id)

function packLast(last) {
  if (!last) return null
  return {
    cards: cardIds(last.cards), chips: last.chips, mult: last.mult, score: last.score,
    steps: last.steps.map(({ id, chips, mult, label }) => ({ id, chips, mult, label })),
  }
}
function packPlayer(player) {
  return {
    deck: cardIds(player.deck), hand: cardIds(player.hand),
    jokers: player.jokers.map(joker => ({ id: joker.id, progress: joker.progress || 0 })),
    money: player.money, score: player.score, handsLeft: player.handsLeft,
    discardsLeft: player.discardsLeft, roundAwarded: player.roundAwarded,
    last: packLast(player.last),
  }
}

// Store identities and committed game state, never functions or transient selections.
export function encodeDuelSnapshot(state) {
  return {
    schema: 1, mode: 'duel', round: state.round, phase: state.phase,
    you: packPlayer(state.you), bot: packPlayer(state.bot),
    results: state.results.map(({ you, bot }) => ({ you, bot })),
    claimedIds: [...state.claimedIds], pendingBotPlay: !!state.pendingBotPlay,
    actionTurn: state.phase === 'playing' ? nextDuelTurn(state.you, state.bot, state.pendingBotPlay) : null,
    shop: state.shop ? {
      round: state.shop.round, turn: state.shop.turn, firstSide: state.shop.firstSide,
      complete: state.shop.complete, finished: { ...state.shop.finished },
      items: state.shop.items.map(({ id, soldTo }) => ({ id, soldTo })),
    } : null,
    handSort: state.handSort || 'rank', pace: state.pace || 'normal',
    logs: [...(state.logs || [])].slice(0, 8), status: state.status || '',
  }
}

function unpackCards(ids, max = 52) {
  assert(Array.isArray(ids) && ids.length <= max && new Set(ids).size === ids.length)
  return ids.map(id => {
    assert(integer(id, 51))
    return { id, rank: ranks[id % 13], suit: suits[Math.floor(id / 13)] }
  })
}
function unpackJokers(values) {
  assert(Array.isArray(values) && values.length <= DUEL_RULES.maxJokers)
  const ids = new Set()
  return values.map(value => {
    assert(object(value) && catalog.has(value.id) && !ids.has(value.id))
    ids.add(value.id)
    const progress = value.progress ?? 0
    const [max, step] = growth[value.id] || [0, 1]
    assert(integer(progress, max) && progress % step === 0)
    return { ...catalog.get(value.id), progress }
  })
}
function unpackLast(value, remaining) {
  if (value === null) return null
  assert(object(value))
  const cards = unpackCards(value.cards, 5)
  assert(cards.length > 0 && cards.every(card => !remaining.has(card.id)))
  const hand = detectHand(cards)
  let previousChips = hand.chips + cards.reduce((sum, card) => sum + cardValue(card.rank), 0)
  let previousMult = hand.mult
  assert(Array.isArray(value.steps) && value.steps.length <= DUEL_RULES.maxJokers)
  const ids = new Set()
  const steps = value.steps.map(step => {
    assert(object(step) && catalog.has(step.id) && !ids.has(step.id))
    assert(integer(step.chips) && integer(step.mult) && step.chips >= previousChips && step.mult >= previousMult)
    assert(typeof step.label === 'string' && step.label.length <= 200)
    ids.add(step.id)
    previousChips = step.chips; previousMult = step.mult
    return { id: step.id, chips: step.chips, mult: step.mult, label: step.label }
  })
  assert(integer(value.chips) && integer(value.mult) && integer(value.score))
  assert(value.chips === previousChips && value.mult === previousMult && value.score === value.chips * value.mult)
  return { cards, hand, steps, chips: value.chips, mult: value.mult, score: value.score }
}
function unpackPlayer(value) {
  assert(object(value))
  const deck = unpackCards(value.deck, 44)
  const hand = unpackCards(value.hand, DUEL_RULES.handSize)
  assert(hand.length === DUEL_RULES.handSize)
  const remaining = new Set([...deck, ...hand].map(card => card.id))
  assert(remaining.size === deck.length + hand.length)
  assert(integer(value.handsLeft, DUEL_RULES.hands) && integer(value.discardsLeft, DUEL_RULES.discards))
  assert(integer(value.money, 1e6) && integer(value.score) && typeof value.roundAwarded === 'boolean')
  const actions = DUEL_RULES.hands - value.handsLeft + DUEL_RULES.discards - value.discardsLeft
  const consumed = 52 - remaining.size
  assert(consumed >= actions && consumed <= actions * 5)
  const last = unpackLast(value.last, remaining)
  assert(value.handsLeft === DUEL_RULES.hands ? last === null && value.score === 0 : last !== null && value.score >= last.score)
  return {
    deck, hand, jokers: unpackJokers(value.jokers), last,
    money: value.money, score: value.score, handsLeft: value.handsLeft,
    discardsLeft: value.discardsLeft, roundAwarded: value.roundAwarded,
  }
}
function unpackShop(value, state) {
  assert(object(value) && value.round === state.round && state.round < DUEL_RULES.rounds)
  assert(sides.includes(value.firstSide) && object(value.finished) && typeof value.complete === 'boolean')
  assert(sides.every(side => typeof value.finished[side] === 'boolean'))
  assert(value.complete === (value.finished.you && value.finished.bot))
  assert(value.complete ? value.turn === null : sides.includes(value.turn) && !value.finished[value.turn])
  const first = state.you.score === state.bot.score ? (state.round % 2 ? 'you' : 'bot') : state.you.score > state.bot.score ? 'you' : 'bot'
  assert(value.firstSide === first && Array.isArray(value.items) && value.items.length <= 3)
  const ids = new Set()
  const items = value.items.map(item => {
    assert(object(item) && catalog.has(item.id) && !ids.has(item.id))
    assert(item.soldTo === null || sides.includes(item.soldTo))
    assert(state.claimedIds.has(item.id) === (item.soldTo !== null))
    for (const side of sides) if (state[side].jokers.some(joker => joker.id === item.id)) assert(item.soldTo === side)
    ids.add(item.id)
    return { ...catalog.get(item.id), soldTo: item.soldTo }
  })
  return { round: value.round, firstSide: value.firstSide, turn: value.turn, complete: value.complete, finished: { you: value.finished.you, bot: value.finished.bot }, items, claimedIds: state.claimedIds }
}

// Decode atomically. Unknown schemas or inconsistent saves start a fresh table.
export function decodeDuelSnapshot(value) {
  try {
    assert(object(value) && value.schema === 1 && value.mode === 'duel')
    assert(integer(value.round, DUEL_RULES.rounds) && value.round >= 1 && phases.has(value.phase))
    const state = { round: value.round, phase: value.phase, you: unpackPlayer(value.you), bot: unpackPlayer(value.bot) }
    assert(Array.isArray(value.results) && value.results.length <= DUEL_RULES.rounds)
    state.results = value.results.map(result => {
      assert(object(result) && integer(result.you) && integer(result.bot))
      return { you: result.you, bot: result.bot }
    })
    assert(Array.isArray(value.claimedIds) && value.claimedIds.length <= catalog.size && new Set(value.claimedIds).size === value.claimedIds.length)
    assert(value.claimedIds.every(id => catalog.has(id)))
    state.claimedIds = new Set(value.claimedIds)
    for (const side of sides) assert(state[side].jokers.every(joker => state.claimedIds.has(joker.id)))
    // Older runs gave both sides the same starter. Keep those runs resumable;
    // new empty-lineup games obtain every joker exclusively through the shop.
    assert(state.you.jokers.every(joker => joker.id === 'jester' || !state.bot.jokers.some(other => other.id === joker.id)))
    if (state.phase === 'playing') {
      assert(state.results.length === state.round - 1 && value.shop === null)
      assert(!state.you.roundAwarded && !state.bot.roundAwarded)
    } else {
      assert(state.results.length === state.round)
      assert(sides.every(side => state[side].handsLeft === 0 && state[side].roundAwarded && state.results.at(-1)[side] === state[side].score))
      assert(state.phase !== 'roundEnd' || state.round < DUEL_RULES.rounds)
      assert(state.phase !== 'finished' || state.round === DUEL_RULES.rounds || matchStanding(state.results, DUEL_RULES.rounds).clinched !== null)
      assert(state.phase === 'shop' || value.shop === null)
    }
    state.shop = state.phase === 'shop' ? unpackShop(value.shop, state) : null
    assert(typeof value.pendingBotPlay === 'boolean')
    assert(!value.pendingBotPlay || state.phase === 'playing' && state.bot.handsLeft > 0 && state.bot.discardsLeft < DUEL_RULES.discards)
    state.pendingBotPlay = value.pendingBotPlay
    state.actionTurn = state.phase === 'playing' ? nextDuelTurn(state.you, state.bot, state.pendingBotPlay) : null
    // Schema 1 saves from independent play have no actionTurn. Their remaining
    // hands recover who owes a response without inventing any extra actions.
    assert(value.actionTurn === undefined || value.actionTurn === state.actionTurn)
    assert(Array.isArray(value.logs) && value.logs.length <= 8 && value.logs.every(line => typeof line === 'string' && line.length <= 500))
    assert(typeof value.status === 'string' && value.status.length <= 500)
    state.logs = [...value.logs]; state.status = value.status
    state.handSort = value.handSort === 'suit' ? 'suit' : 'rank'
    state.pace = value.pace === 'quick' ? 'quick' : 'normal'
    return state
  } catch {
    return null
  }
}
