import { calcScore, cardValue } from '../../composables/useHandDetector.js'
import { findBestPlay } from '../../composables/useAI.js'
import { JOKER_POOL, advanceJokers } from '../../composables/jokerCatalog.js'
import { DUEL_RULES, selectDuelShopItems } from './config.js'
import { chooseShopMove } from '../../strategy/jokerPlanning.js'
export { computerJokerOrder, SHOP_SCENARIOS } from '../../strategy/jokerPlanning.js'
export { DUEL_RULES, DUEL_SHOP_WEIGHTS, selectDuelShopItems } from './config.js'
export const joker = id => ({ ...JOKER_POOL.find(j => j.id === id) })
export function makePlayer(jokers = [], random = Math.random, money = DUEL_RULES.startingMoney) {
  const deck = ['♠','♥','♦','♣'].flatMap((suit,s) => ['A','2','3','4','5','6','7','8','9','10','J','Q','K'].map((rank,r) => ({id:s*13+r,rank,suit})))
  for(let i=deck.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[deck[i],deck[j]]=[deck[j],deck[i]]}
  return { deck, hand:deck.splice(0,DUEL_RULES.handSize), jokers:jokers.map(j=>({...j})),money,score:0,handsLeft:DUEL_RULES.hands,discardsLeft:DUEL_RULES.discards,last:null,roundAwarded:false }
}
export const context = p => ({handsLeft:p.handsLeft,discardsLeft:p.discardsLeft,money:p.money ?? 0})
export function selected(p,ids) {
  if(!Array.isArray(ids)||ids.length<1||ids.length>5||new Set(ids).size!==ids.length)throw Error('请选择 1 到 5 张手牌')
  const cards=ids.map(id=>p.hand.find(c=>c.id===id));if(cards.some(c=>!c))throw Error('手牌已变化');return cards
}
export function act(p,ids,type='play') {
  if(p.handsLeft<=0)throw Error('本轮出牌已结束')
  if(type!=='play'&&type!=='discard')throw Error('无效操作')
  if(type==='discard'&&p.discardsLeft<=0)throw Error('弃牌次数不足')
  const cards=selected(p,ids)
  let result=null
  if(type==='play') {result=calcScore(cards,p.jokers,context(p));p.score+=result.score;p.handsLeft--;p.jokers=advanceJokers(p.jokers,'play',cards,result.hand);p.last={cards,...result}}
  else {p.discardsLeft--;p.jokers=advanceJokers(p.jokers,'discard');if(p.jokers.some(j=>j.id==='rebate'))p.money=(p.money??0)+1}
  p.hand=p.hand.filter(c=>!ids.includes(c.id));p.hand.push(...p.deck.splice(0,Math.min(cards.length,p.deck.length)))
  return result
}
// Only public current hand and resources are supplied: no access to the deck.
export function computerChoice({hand,jokers,handsLeft,discardsLeft,money=0},allowDiscard=true) {
  const best=findBestPlay(hand,jokers,{handsLeft,discardsLeft,money})
  const result=calcScore(best,jokers,{handsLeft,discardsLeft,money})
  if(allowDiscard&&discardsLeft>0) {
    // Replacing one card outside the scoring core keeps that core available.
    // Compare only known effects after the discard, never the unknown draw.
    const spare=hand.filter(c=>!best.some(k=>k.id===c.id)).sort((a,b)=>cardValue(a.rank)-cardValue(b.rank)||a.id-b.id)
    if(spare.length) {
      const nextJokers=advanceJokers(jokers,'discard')
      const nextContext={handsLeft,discardsLeft:discardsLeft-1,money:money+(jokers.some(j=>j.id==='rebate')?1:0)}
      const guaranteed=calcScore(best,nextJokers,nextContext).score
      if(guaranteed>result.score*1.05) {
        const exhausted=discardsLeft===1
        const reason=exhausted&&jokers.some(j=>j.id==='empty_pockets')
          ?'弃掉未计分的牌，耗尽弃牌机会，激活孤注一掷'
          :exhausted&&handsLeft===1&&jokers.some(j=>j.id==='phoenix')
            ?'保留计分牌，耗尽弃牌机会，激活不死鸟'
            :'保留计分牌，利用已知弃牌效果提高得分'
        return {type:'discard',ids:[spare[0].id],reason,guaranteedScore:guaranteed}
      }
    }
    const suits=['♠','♥','♦','♣'].map(s=>hand.filter(c=>c.suit===s)).sort((a,b)=>b.length-a.length)
    let keep=[]
    if(suits[0].length===4&&result.score<500)keep=suits[0]
    else if(['高牌','对子'].includes(result.hand.name)) {
      const counts=new Map();hand.forEach(c=>counts.set(c.rank,(counts.get(c.rank)||0)+1))
      keep=hand.filter(c=>counts.get(c.rank)>=2)
      if(!keep.length)keep=[...hand].sort((a,b)=>cardValue(b.rank)-cardValue(a.rank)).slice(0,3)
    }
    if(keep.length){const ids=hand.filter(c=>!keep.some(k=>k.id===c.id)).slice(0,5).map(c=>c.id);if(ids.length)return {type:'discard',ids}}
  }
  return {type:'play',ids:best.map(c=>c.id)}
}

// Both sides receive the same baseline; economy jokers retain their original effects.
// The original game has no interest. Winning grants shop initiative, not extra money.
export function awardRound(p) {
  if(p.handsLeft!==0)throw Error('双方完成出牌后才能领取奖励')
  if(p.roundAwarded)return {base:0,bonus:0,total:0}
  const bonus=p.jokers.some(j=>j.id==='golden_joker')?2:0
  p.money+=DUEL_RULES.roundReward+bonus
  p.roundAwarded=true
  return {base:DUEL_RULES.roundReward,bonus,total:DUEL_RULES.roundReward+bonus}
}

export function resetRound(p,random=Math.random) {
  return makePlayer(p.jokers,random,p.money)
}

const sides=['you','bot']
const otherSide=side=>side==='you'?'bot':'you'
const canShop=(shop,side)=>sides.includes(side)&&!shop.complete&&shop.turn===side&&!shop.finished[side]


export function createShop(players,round,claimedIds=new Set(),random=Math.random) {
  if(!Number.isInteger(round)||round<1||round>=DUEL_RULES.rounds)throw Error('该轮结束后没有商店')
  // Owned jokers and all previously purchased jokers stay excluded after a sale.
  for(const side of sides)for(const item of players[side].jokers)claimedIds.add(item.id)
  const turn=players.you.score===players.bot.score
    ?(round%2===1?'you':'bot')
    :(players.you.score>players.bot.score?'you':'bot')
  return {
    round,turn,firstSide:turn,finished:{you:false,bot:false},complete:false,claimedIds,
    items:selectDuelShopItems(JOKER_POOL,claimedIds,round-1,random).map(item=>({...item,soldTo:null})),
  }
}

export function buyFromShop(shop,players,side,id) {
  if(!canShop(shop,side))return false
  const p=players[side]
  const item=shop.items.find(j=>j.id===id)
  if(!item||item.soldTo||shop.claimedIds.has(id)||p.jokers.length>=DUEL_RULES.maxJokers||p.money<item.price)return false
  if(sides.some(owner=>players[owner].jokers.some(j=>j.id===id)))return false
  p.money-=item.price
  const {soldTo,...purchased}=item
  p.jokers=[...p.jokers,{...purchased,progress:0}]
  item.soldTo=side
  shop.claimedIds.add(id)
  const other=otherSide(side)
  shop.turn=shop.finished[other]?side:other
  return true
}

export function replaceFromShop(shop,players,side,sellId,buyId) {
  if(!canShop(shop,side))return false
  const p=players[side]
  const sold=p.jokers.find(j=>j.id===sellId)
  const item=shop.items.find(j=>j.id===buyId)
  // A replacement is a single purchase action. Validate everything before the
  // sale, so a stale stock item or insufficient combined budget cannot lose a card.
  if(!sold||!item||item.soldTo||shop.claimedIds.has(buyId)||p.jokers.length>DUEL_RULES.maxJokers)return false
  if(sides.some(owner=>players[owner].jokers.some(j=>j.id===buyId)))return false
  const resale=Math.max(1,Math.floor(sold.price/2))
  if(p.money+resale<item.price)return false
  const {soldTo,...purchased}=item
  p.money+=resale-item.price
  p.jokers=[...p.jokers.filter(j=>j.id!==sellId),{...purchased,progress:0}]
  item.soldTo=side
  shop.claimedIds.add(sellId)
  shop.claimedIds.add(buyId)
  const other=otherSide(side)
  shop.turn=shop.finished[other]?side:other
  return true
}

export function finishShopping(shop,side) {
  if(!canShop(shop,side))return false
  shop.finished[side]=true
  const other=otherSide(side)
  shop.complete=shop.finished[other]
  shop.turn=shop.complete?null:other
  return true
}

export function reorderJokers(shop,players,side,id,direction) {
  if(!canShop(shop,side)||![1,-1].includes(direction))return false
  const p=players[side]
  const index=p.jokers.findIndex(j=>j.id===id)
  const target=index+direction
  if(index<0||target<0||target>=p.jokers.length)return false
  const ordered=[...p.jokers]
  ;[ordered[index],ordered[target]]=[ordered[target],ordered[index]]
  p.jokers=ordered
  return true
}

export function sellJoker(shop,players,side,id) {
  if(!canShop(shop,side))return false
  const p=players[side]
  const item=p.jokers.find(j=>j.id===id)
  if(!item)return false
  p.money+=Math.max(1,Math.floor(item.price/2))
  p.jokers=p.jokers.filter(j=>j.id!==id)
  shop.claimedIds.add(id)
  return true
}

export function computerShopChoice(player,offers,remainingRounds=DUEL_RULES.rounds-1) {
  return chooseShopMove(player,offers,{
    remainingRounds,maxRemainingRounds:DUEL_RULES.rounds-1,maxJokers:DUEL_RULES.maxJokers,
    handsPerRound:DUEL_RULES.hands,discardsPerRound:DUEL_RULES.discards,
  })
}
