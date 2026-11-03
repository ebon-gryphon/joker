import { cardValue, detectHand, applyJoker } from '../composables/useHandDetector.js'

// The current catalog has positive additive effects and these conditional
// multipliers. Stable partitioning is the same legal ordering players can make.
const multiplierIds=new Set(['heart_collector','club_lover','royal_face','trio','empty_pockets','last_hand','dynasty','phoenix'])
export function computerJokerOrder(jokers) {
  return [...jokers.filter(j=>!multiplierIds.has(j.id)),...jokers.filter(j=>multiplierIds.has(j.id))]
}


// Public legal archetypes rotate ranks and suits instead of hard-coding one
// face-heavy hand. Short plays qualify half/square jokers and hermit as well.
const scenarioRanks=['A','2','3','4','5','6','7','8','9','10','J','Q','K']
const scenarioSuits=['♠','♥','♦','♣']
const scenarios=[]
function addScenario(ranks,suits,weight) {
  scenarios.push(Object.freeze({
    cards:Object.freeze(ranks.map((rank,i)=>Object.freeze({id:i,rank,suit:suits[i]}))),weight,
  }))
}
const templates=[
  {offsets:[0,3,6,8,11],suits:[0,1,2,3,0],weight:2,count:13},
  {offsets:[0,0,3,7,10],suits:[0,1,2,3,0],weight:8,count:13},
  {offsets:[0,0,5,5,9],suits:[0,1,2,3,0],weight:4,count:13},
  {offsets:[0,0,0,4,10],suits:[0,1,2,3,0],weight:2,count:13},
  {offsets:[0,3,6,8,11],suits:[0,0,0,0,0],weight:3,count:13},
  {offsets:[0,0,0,5,5],suits:[0,1,2,3,0],weight:1,count:7},
  {offsets:[0,0,0,0,8],suits:[0,1,2,3,0],weight:0.5,count:7},
  {offsets:[0],suits:[0],weight:1,count:13},
  {offsets:[0,0,5],suits:[0,1,2],weight:2,count:5},
  {offsets:[0,0,5,8],suits:[0,1,2,3],weight:2,count:5},
]
for(const [kind,{offsets,suits,weight,count}] of templates.entries()) {
  for(let i=0;i<count;i++) {
    const rank=(i*(count===13?1:2)+kind)%13,suit=(i+kind)%4
    addScenario(offsets.map(offset=>scenarioRanks[(rank+offset)%13]),
      suits.map(offset=>scenarioSuits[(suit+offset)%4]),weight/count)
  }
}
const straightRanks=[...scenarioRanks,'A']
for(let start=0;start<10;start++) {
  addScenario(straightRanks.slice(start,start+5),
    [0,1,2,3,0].map(offset=>scenarioSuits[(start+offset)%4]),3/10)
}
for(let i=0;i<8;i++) {
  const start=Math.floor(i*9/7)
  addScenario(straightRanks.slice(start,start+5),Array(5).fill(scenarioSuits[i%4]),0.5/8)
}
export const SHOP_SCENARIOS=Object.freeze(scenarios)
const scenarioWeight=SHOP_SCENARIOS.reduce((sum,scenario)=>sum+scenario.weight,0)

// Cache public hand types and base chips once; model scores still use the same
// applyJoker function as actual gameplay, including order and growth semantics.
const evaluatedScenarios=SHOP_SCENARIOS.map(({cards,weight})=>({
  weight,
  plays:Array.from({length:(1<<cards.length)-1},(_,index)=>{
    const play=cards.filter((_,i)=>(index+1)&(1<<i))
    const hand=detectHand(play)
    return {cards:play,hand,chips:hand.chips+play.reduce((sum,c)=>sum+cardValue(c.rank),0)}
  }),
}))
function buildValue(jokers,money,{handsPerRound,discardsPerRound}) {
  let total=0
  for(const {plays,weight} of evaluatedScenarios) {
    for(const resources of [{handsLeft:handsPerRound,discardsLeft:discardsPerRound},{handsLeft:1,discardsLeft:0}]) {
      const x={...resources,money}
      let best=0
      for(const play of plays) {
        let chips=play.chips,mult=play.hand.mult
        for(const j of jokers) {
          const effect=applyJoker(j,play.cards,play.hand,chips,mult,x)
          chips=effect.chips;mult=effect.mult
        }
        best=Math.max(best,chips*mult)
      }
      total+=best*weight/2
    }
  }
  return total/scenarioWeight
}

export function chooseShopMove(player,offers,options={}) {
  const {remainingRounds=1,maxRemainingRounds=12,maxJokers=5,handsPerRound=4,discardsPerRound=3}=options
  if(player.jokers.length>maxJokers||remainingRounds<=0)return {type:'finish'}
  // Income earned after the final round cannot fund another shop. Existing
  // economy cards lose this same future value when replaced, avoiding churn.
  const futureShops=Math.max(0,Math.min(maxRemainingRounds,remainingRounds)-1)
  // Conservative investment forecast: discard penalties leave about +0.5
  // green progress per future play, averaged across the remaining four-hand
  // rounds. This view is only for shopping; actual progress is never changed.
  const forecastHands=handsPerRound*Math.min(maxRemainingRounds,remainingRounds)
  const growthView=jokers=>jokers.map(j=>j.id==='green_joker'?{
    ...j,progress:Math.min(12,(j.progress||0)+0.25*(forecastHands-1)),
  }:j)
  const valueOf=(jokers,money)=>buildValue(computerJokerOrder(growthView(jokers)),money,{handsPerRound,discardsPerRound})+jokers.reduce((total,j)=>
    total+(j.id==='golden_joker'?4:j.id==='rebate'?3:0)*futureShops,0)
  const baseline=valueOf(player.jokers,player.money)
  const items=offers.filter(item=>!item.soldTo&&!player.jokers.some(j=>j.id===item.id))
  const candidates=[]
  for(const item of items) {
    if(player.jokers.length<maxJokers) {
      if(item.price>player.money)continue
      const gain=valueOf([...player.jokers,{...item,progress:0}],player.money-item.price)-baseline
      if(gain>0)candidates.push({move:{type:'buy',id:item.id},gain,value:gain/item.price})
    } else {
      for(const sold of player.jokers) {
        const resale=Math.max(1,Math.floor(sold.price/2))
        const money=player.money+resale-item.price
        if(money<0)continue
        const next=[...player.jokers.filter(j=>j.id!==sold.id),{...item,progress:0}]
        const gain=valueOf(next,money)-baseline
        // Require a visible improvement before sacrificing an existing build.
        if(gain>Math.max(8,baseline*0.02))candidates.push({
          move:{type:'replace',id:item.id,sellId:sold.id},gain,value:gain/Math.max(1,item.price-resale),
        })
      }
    }
  }
  candidates.sort((a,b)=>b.value-a.value||b.gain-a.gain||a.move.id.localeCompare(b.move.id))
  return candidates[0]?.move??{type:'finish'}
}
