import test from 'node:test'
import assert from 'node:assert/strict'
import { JOKER_POOL, advanceJokers } from '../src/composables/jokerCatalog.js'
import { BLINDS, useGameState } from '../src/composables/useGameState.js'
import { SHOP_RARITY_WEIGHTS, selectShopItems } from '../src/composables/shopSelection.js'
import { calcScore } from '../src/composables/useHandDetector.js'
const j = id => ({ ...JOKER_POOL.find(j => j.id === id), progress:0 })
const cards = (ranks, suits = []) => ranks.map((rank,id)=>({id,rank,suit:suits[id] || '♥'}))
const fixtures = [
  ['straight_flush_master', cards(['2','3','4','5','6']), {}, 0, 20, 1],
  ['constellation', cards(['2','4','6','8','K']), {}, 0, 10, 1],
  ['four_seasons', cards(['2','2','3','3'], ['♥','♠','♦','♣']), {}, 60, 0, 1],
  ['dynasty', cards(['2','2','2','3','3']), {}, 0, 0, 3],
  ['hermit', cards(['A']), {}, 40, 6, 1],
  ['phoenix', cards(['A']), {handsLeft:1,discardsLeft:0}, 0, 0, 3],
]
for (const [id,hand,context,chips,mult,times] of fixtures) {
  test(`legendary ${id} activates with its stated condition`, ()=>{
    const base = calcScore(hand, [])
    const scored = calcScore(hand,[j(id)],context)
    assert.equal(scored.chips,base.chips+chips)
    assert.equal(scored.mult,(base.mult+mult)*times)
  })
}
test('legends are conditional, phoenix needs both resources depleted', ()=>{
  const hand = cards(['2','2','4'])
  for (const [id] of fixtures) assert.equal(calcScore(hand,[j(id)]).score,calcScore(hand,[]).score,id)
  for (const context of [{handsLeft:2,discardsLeft:0},{handsLeft:1,discardsLeft:1}]) assert.equal(calcScore(hand,[j('phoenix')],context).score,calcScore(hand,[]).score)
  assert.equal(calcScore(cards(['2','3','4','5','6'],['♥','♠','♥','♠','♥']),[j('straight_flush_master')]).mult,10)
})
test('growth caps agree in preview and committed progress, including discard at cap',()=>{
  const hand = cards(['2','3','4','5','6']), type = calcScore(hand,[]).hand
  for (const [id,cap,played] of [['green_joker',12,hand],['runner',80,hand],['square_joker',60,hand.slice(0,4)]]) {
    let owned=[j(id)]
    for(let i=0;i<100;i++) owned=advanceJokers(owned,'play',played,type)
    assert.equal(owned[0].progress,cap)
    const score=calcScore(played,owned), base=calcScore(played,[])
    assert.equal(id === 'green_joker' ? score.mult-base.mult : score.chips-base.chips,cap)
  }
  assert.equal(advanceJokers([{...j('green_joker'),progress:12}],'discard')[0].progress,11)
})
test('all twelve rounds transition, sixth is a shop, only twelfth wins',()=>{
  const game = useGameState()
  assert.equal(SHOP_RARITY_WEIGHTS.length, BLINDS.length-1)
  for (let round=0;round<12;round++) {
    assert.equal(game.roundIndex.value,round)
    game.finishScoring(BLINDS[round].target)
    assert.equal(game.phase.value,round === 11 ? 'won' : 'shop')
    if(round < 11) game.skipShop()
  }
  game.restart()
  assert.equal(game.roundIndex.value,0)
  assert.equal(game.currentBlind.value.target,250)
})
test('six distinct legends are available in later shops',()=>{
  const legends=JOKER_POOL.filter(j=>j.rarity==='legendary')
  assert.equal(legends.length,6)
  const owned=new Set(JOKER_POOL.filter(j=>j.rarity!=='legendary').map(j=>j.id))
  const first=selectShopItems(JOKER_POOL,owned,10,()=>0)
  first.forEach(j=>owned.add(j.id))
  const second=selectShopItems(JOKER_POOL,owned,10,()=>0)
  assert.equal(new Set([...first,...second].map(j=>j.id)).size,6)
  assert.ok(SHOP_RARITY_WEIGHTS.every(w=>w.common+w.rare+w.legendary===100))
})
