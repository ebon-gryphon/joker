// 固定成型阵容的得分基准，不代表真实通关率（未模拟买牌、弃牌决策）。
import { JOKER_POOL, advanceJokers } from '../src/composables/jokerCatalog.js'
import { calcScore } from '../src/composables/useHandDetector.js'
import { findBestPlay } from '../src/composables/useAI.js'
const setups = {
  '无小丑': [],
  '普通成长满级': ['blue_joker','square_joker','green_joker','jester','half_joker'],
  '单牌传奇': ['square_joker','green_joker','jester','hermit','last_hand'],
  '同点传奇': ['pair_engine','green_joker','jolly_joker','trio','dynasty'],
  '花色传奇': ['flush_flag','green_joker','droll_joker','constellation','heart_collector'],
}
for (const [name, ids] of Object.entries(setups)) {
  let seed = 20260921
  const random = () => ((seed = (Math.imul(seed,1664525) + 1013904223) >>> 0) / 2 ** 32)
  const totals = []
  for (let trial = 0; trial < 120; trial++) {
    const deck = ['♠','♥','♦','♣'].flatMap((suit, i) => ['A','2','3','4','5','6','7','8','9','10','J','Q','K'].map((rank,j) => ({id:i*13+j,rank,suit})))
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(random()*(i+1)); [deck[i],deck[j]]=[deck[j],deck[i]] }
    let hand = deck.splice(0,8)
    let jokers = ids.map(id => ({...JOKER_POOL.find(j => j.id === id), progress: id === 'green_joker' ? 12 : id === 'square_joker' ? 60 : 0}))
    let total = 0
    for (let handsLeft = 4; handsLeft > 0; handsLeft--) {
      const context = {handsLeft, discardsLeft:3, money:15}
      const chosen = findBestPlay(hand, jokers, context)
      const result = calcScore(chosen, jokers, context)
      total += result.score
      jokers = advanceJokers(jokers, 'play', chosen, result.hand)
      const played = new Set(chosen.map(c=>c.id))
      hand = hand.filter(c=>!played.has(c.id)).concat(deck.splice(0,chosen.length))
    }
    totals.push(total)
  }
  totals.sort((a,b)=>a-b)
  console.log(JSON.stringify({name, samples:totals.length, p10:totals[12], median:totals[60], p90:totals[108]}))
}
