const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const suits = ['♠', '♥', '♦', '♣']

// Sorting changes the displayed order only. Card identity/selection stays intact.
export function sortHand(hand, mode = 'rank') {
  const rank = (a, b) => ranks.indexOf(b.rank) - ranks.indexOf(a.rank)
  const suit = (a, b) => suits.indexOf(a.suit) - suits.indexOf(b.suit)
  return [...hand].sort((a, b) => mode === 'suit' ? suit(a, b) || rank(a, b) : rank(a, b) || suit(a, b))
}

export function matchStanding(results, totalRounds) {
  const wins = [results.filter(r => r.you > r.bot).length, results.filter(r => r.bot > r.you).length]
  const remaining = Math.max(0, totalRounds - results.length)
  // A tie does not award a win. A lead equal to all remaining rounds is not safe.
  const clinched = wins[0] > wins[1] + remaining ? 'you' : wins[1] > wins[0] + remaining ? 'bot' : null
  return { wins, remaining, clinched }
}
