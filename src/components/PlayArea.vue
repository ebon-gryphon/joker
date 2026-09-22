<template>
  <section class="play-area" aria-label="出牌结算区">
    <div class="played-zone">
      <div v-if="!playedCards.length && !isScoring" class="played-empty"><div class="table-seal">♠</div><p>选择手牌组成牌型</p><small>每一次选择，都在改变命运</small></div>
      <div v-if="playedCards.length" class="played-cards"><CardView v-for="card in playedCards" :key="card.id" :card="card" /></div>
      <div v-if="scoringState.handType" class="scoring-display" aria-live="polite"><strong class="scoring-hand-name">{{ scoringState.handType.name }}</strong><div class="scoring-chips-block"><span>筹码</span><b>{{ scoringState.chips }}</b></div><span class="scoring-x">×</span><div class="scoring-mult-block"><span>倍率</span><b>{{ scoringState.mult }}</b></div></div>
    </div>
    <div class="deck-pile"><div class="deck-card-back"><div class="deck-inner">♠<span>JOKER</span>♦</div></div><p>牌堆 <strong>{{ deckCount }}</strong><span>/52</span></p></div>
  </section>
</template>
<script setup>
import CardView from './CardView.vue'
defineProps({ playedCards: { type: Array, default: () => [] }, deckCount: Number, isScoring: Boolean, scoringState: { type: Object, default: () => ({ handType: null, chips: 0, mult: 0 }) } })
</script>
<style scoped>
.play-area { position: relative; min-height: 140px; display: flex; align-items: center; justify-content: center; padding: 14px 130px 14px 30px; z-index: 30; }
.played-zone { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; width: 100%; }
.played-empty { text-align: center; color: #b1aa7863; } .table-seal { font: 58px/1 Georgia,serif; margin-bottom: 10px; } .played-empty p { font: 18px var(--font-display); letter-spacing: 5px; } .played-empty small { display: block; font-size: 10px; letter-spacing: 3px; margin-top: 10px; color: #b1aa7845; }
.played-cards { display: flex; gap: 8px; align-items: center; justify-content: center; } .played-cards :deep(.card-view) { width: clamp(55px,5.5vw,78px); height: auto; aspect-ratio: 2/3; }
.scoring-display { display: flex; align-items: center; gap: 15px; background: #0d1a16ec; border: 1px solid #a58b53; padding: 9px 20px; border-radius: 3px; }
.scoring-hand-name { font: 18px var(--font-display); color: var(--gold); margin-right: 5px; }.scoring-chips-block,.scoring-mult-block { display: flex; align-items: center; gap: 8px; } .scoring-display span { font-size: 11px; color: #c4b99d; } .scoring-display b { font: 28px Georgia,serif; } .scoring-chips-block b { color: var(--chips-from); } .scoring-mult-block b { color: var(--mult-from); }
.deck-pile { position: absolute; right: clamp(20px,3vw,46px); top: 50%; transform: translateY(-50%); text-align: center; }.deck-card-back { width: clamp(64px,6vw,88px); aspect-ratio: 2/3; padding: 6px; border: 3px solid #cab789; border-radius: 5px; background: repeating-linear-gradient(45deg,#4c1820 0px,#4c1820 3px,#59212a 3px,#59212a 5px); box-shadow: 2px 3px #836f4c,4px 6px #cfba8f,6px 9px #68593b,8px 12px 12px #0008; transform: rotate(6deg); }
.deck-inner { border: 1px solid #b6975b; outline: 1px solid #b6975b88; outline-offset: -4px; height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 9px; font: 23px Georgia,serif; color: #bba273; } .deck-inner span { font-size: 9px; letter-spacing: 2px; }.deck-pile p { margin-top: 18px; color: #bdb499; font-size: 11px; } .deck-pile strong { font: 17px Georgia,serif; }.deck-pile p span { opacity: .65; }
@media(max-height:750px) { .play-area { min-height: 130px; padding-top: 8px; padding-bottom: 8px; } .played-cards :deep(.card-view) { width: 56px; } .scoring-display { padding: 5px 14px; } .scoring-display b { font-size: 23px; } .played-empty small { display: none; } .deck-card-back { width: 60px; } }
@media(max-width:700px) { .play-area { padding-right: 75px; padding-left: 8px; } .deck-card-back { width: 44px; } .deck-pile { right: 16px; } .deck-inner { font-size: 15px; gap: 4px; } .deck-inner span { font-size: 6px; }.played-empty p { font-size: 13px; letter-spacing: 1px; }.played-empty small { display: none; } .played-cards { gap: 4px; } .played-cards :deep(.card-view) { width: 42px; } .scoring-display { gap: 6px; padding: 7px; } .scoring-hand-name { font-size: 13px; } }
</style>
