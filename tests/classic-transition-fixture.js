import { JOKER_POOL } from '../src/composables/useGameState.js'

// Controlled legal-card fixtures exercise phase transitions only. These are not
// played-run evidence: the late-game build is explicitly supplied by the test.
export function clearBlindFixture(game) {
  const suits = ['♠', '♥', '♦', '♣']
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
  const deck = suits.flatMap((suit, s) => ranks.map((rank, r) => ({ id: s * 13 + r, suit, rank })))
  const ids = [22, 23, 24, 25, 13, 0, 27, 41]
  game.hand.value = ids.map(id => deck[id])
  game.deck.value = deck.filter(card => !ids.includes(card.id))
  game.deckCount.value = game.deck.value.length
  game.jokers.value = ['jester', 'constellation', 'royal_face', 'heart_collector', 'empty_pockets'].map(id => ({ ...JOKER_POOL.find(j => j.id === id), progress: 0 }))
  game.discardsLeft.value = 0
  ids.slice(0, 5).forEach(id => game.toggleCard(id))
  const result = game.playHand()
  if (!result || result.score < game.currentBlind.value.target) throw Error('Transition fixture must clear this target')
  game.finishScoring(result.score)
  return result
}
