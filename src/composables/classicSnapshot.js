import { JOKER_POOL } from './jokerCatalog.js'

const suits = ['♠', '♥', '♦', '♣']
const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const catalog = new Map(JOKER_POOL.map(joker => [joker.id, joker]))
const growthCaps = { green_joker: 12, square_joker: 60, runner: 80 }
const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value)

function cards(value) {
  if (!Array.isArray(value) || value.length > 52) return null
  if (!value.every(card => object(card) && integer(card.id, 0, 51) && card.suit === suits[Math.floor(card.id / 13)] && card.rank === ranks[card.id % 13])) return null
  return value.map(({ id, suit, rank }) => ({ id, suit, rank }))
}

// Catalog metadata and effect functions are never trusted from persisted data.
// Only ids and bounded growth counters are serialized, then rehydrated here.
export function decodeClassicSnapshot(snapshot, blinds) {
  if (!object(snapshot) || snapshot.schema !== 1 || !['playing', 'shop', 'won', 'lost'].includes(snapshot.phase)) return null
  if (!integer(snapshot.roundIndex, 0, blinds.length - 1)) return null
  if (!integer(snapshot.money, 0, 1_000_000) || !integer(snapshot.blindScore, 0, 100_000_000)) return null
  if (!integer(snapshot.handsLeft, 0, 4) || !integer(snapshot.discardsLeft, 0, 3)) return null
  const hand = cards(snapshot.hand), deck = cards(snapshot.deck)
  if (!hand || !deck || hand.length !== 8) return null
  const allCards = [...hand, ...deck]
  if (new Set(allCards.map(card => card.id)).size !== allCards.length) return null
  const actions = 4 - snapshot.handsLeft + 3 - snapshot.discardsLeft
  const removed = 52 - allCards.length
  if (removed < actions || removed > actions * 5 || (snapshot.handsLeft === 4 && snapshot.blindScore !== 0)) return null
  if (!Array.isArray(snapshot.jokers) || snapshot.jokers.length > 5) return null
  if (!snapshot.jokers.every(joker => object(joker) && catalog.has(joker.id) && integer(joker.progress, 0, growthCaps[joker.id] || 0))) return null
  if (new Set(snapshot.jokers.map(joker => joker.id)).size !== snapshot.jokers.length) return null
  if (!Array.isArray(snapshot.shopItems) || snapshot.shopItems.length > 3 || !snapshot.shopItems.every(id => catalog.has(id))) return null
  if (new Set(snapshot.shopItems).size !== snapshot.shopItems.length) return null
  if (!Array.isArray(snapshot.soldItems) || new Set(snapshot.soldItems).size !== snapshot.soldItems.length || !snapshot.soldItems.every(id => snapshot.shopItems.includes(id))) return null
  const target = blinds[snapshot.roundIndex].target
  if (snapshot.phase === 'playing' && (snapshot.handsLeft === 0 || snapshot.blindScore >= target)) return null
  if (snapshot.phase === 'shop' && (snapshot.roundIndex === blinds.length - 1 || snapshot.blindScore < target)) return null
  if (snapshot.phase === 'won' && (snapshot.roundIndex !== blinds.length - 1 || snapshot.blindScore < target)) return null
  if (snapshot.phase === 'lost' && (snapshot.handsLeft !== 0 || snapshot.blindScore >= target)) return null
  if (snapshot.phase === 'shop' && snapshot.shopItems.some(id => snapshot.jokers.some(joker => joker.id === id) && !snapshot.soldItems.includes(id))) return null
  let lastReward = null
  if (snapshot.lastReward !== null) {
    const reward = snapshot.lastReward
    if (!object(reward) || !integer(reward.base, 5, 8) || ![0, 2].includes(reward.bonus) || reward.total !== reward.base + reward.bonus) return null
    lastReward = { base: reward.base, bonus: reward.bonus, total: reward.total }
  }
  if (['shop', 'won'].includes(snapshot.phase) && !lastReward) return null
  return {
    phase: snapshot.phase, roundIndex: snapshot.roundIndex,
    blindScore: snapshot.blindScore, money: snapshot.money,
    handsLeft: snapshot.handsLeft, discardsLeft: snapshot.discardsLeft,
    hand, deck,
    jokers: snapshot.jokers.map(({ id, progress }) => ({ ...catalog.get(id), progress })),
    shopItems: snapshot.shopItems.map(id => ({ ...catalog.get(id) })),
    soldItems: new Set(snapshot.soldItems), lastReward,
  }
}

export function encodeClassicSnapshot(state, blinds) {
  if (state.isScoring) return null
  const snapshot = {
    schema: 1, phase: state.phase, roundIndex: state.roundIndex,
    blindScore: state.blindScore, money: state.money,
    handsLeft: state.handsLeft, discardsLeft: state.discardsLeft,
    deck: state.deck.map(({ id, suit, rank }) => ({ id, suit, rank })),
    hand: state.hand.map(({ id, suit, rank }) => ({ id, suit, rank })),
    jokers: state.jokers.map(joker => ({ id: joker.id, progress: joker.progress || 0 })),
    shopItems: state.shopItems.map(joker => joker.id),
    soldItems: [...state.soldItems],
    lastReward: state.lastReward ? { ...state.lastReward } : null,
  }
  return decodeClassicSnapshot(snapshot, blinds) ? snapshot : null
}
