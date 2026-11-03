<script setup>
import { computed } from 'vue'
const props = defineProps({ card: { type: Object, required: true }, isSelected: Boolean, selectable: Boolean, disabled: Boolean })
defineEmits(['click'])
const red = computed(() => ['♥', '♦'].includes(props.card.suit))
const royal = computed(() => ['J', 'Q', 'K'].includes(props.card.rank))
</script>

<template>
  <component :is="selectable ? 'button' : 'div'" class="card-view duel-card" :class="{selected:isSelected, 'suit-red':red, 'suit-black':!red}" :type="selectable ? 'button' : undefined" :disabled="selectable ? disabled : undefined" :aria-pressed="selectable ? isSelected : undefined" :aria-label="`${card.suit}${card.rank}`" @click="selectable && !disabled && $emit('click', card)">
    <span class="duel-card-corner"><b>{{card.rank}}</b><i>{{card.suit}}</i></span>
    <span class="duel-card-crest" aria-hidden="true">
      <span v-if="royal" class="duel-card-portrait" :class="card.rank.toLowerCase()"></span>
      <span v-else class="duel-card-suit">{{card.suit}}</span>
    </span>
    <span class="duel-card-corner reverse"><b>{{card.rank}}</b><i>{{card.suit}}</i></span>
    <span class="duel-card-edition" aria-hidden="true">✦</span>
  </component>
</template>

<style scoped>
.duel-card { position:relative; display:flex; align-items:center; justify-content:center; width:78px; height:113px; flex-shrink:0; padding:0; border:1px solid #bfaf94; border-radius:3px; color:#263149; background:radial-gradient(ellipse at 25% 20%,#f5ebd7,#d3c5ac); box-shadow:2px 4px 9px #0009,inset 0 0 0 3px #f1e6ce,inset 0 0 0 4px #8e785a55; container-type:inline-size; font-family:Georgia,serif; user-select:none; transition:transform .22s,box-shadow .22s,border-color .22s; }
.duel-card::before { content:''; position:absolute; inset:12% 10%; border:1px solid currentColor; opacity:.22; clip-path:polygon(0 15%,15% 0,85% 0,100% 15%,100% 85%,85% 100%,15% 100%,0 85%); background:repeating-linear-gradient(135deg,transparent 0 4px,#7059450b 4px 5px); }
.duel-card.suit-red { color:#922f3e; }
.duel-card-corner { position:absolute; left:8%; top:6%; display:flex; flex-direction:column; align-items:center; line-height:1; z-index:1; }
.duel-card-corner b { font-size:27cqw; font-weight:700; letter-spacing:-2cqw; }
.duel-card-corner i { font-size:18cqw; font-style:normal; margin-top:1px; }
.duel-card-corner.reverse { left:auto; top:auto; right:8%; bottom:6%; transform:rotate(180deg); }
.duel-card-crest { display:grid; place-items:center; width:72%; height:74%; }
.duel-card-portrait { display:block; width:100%; height:100%; background:url('/duel/royalty-v2.webp') 0 0 / 300% 100%; mask-image:linear-gradient(transparent,#000 10%,#000 83%,transparent); opacity:.93; }
.duel-card-portrait.q { background-position:50% 0; }
.duel-card-portrait.k { background-position:100% 0; }
.duel-card-suit { font-size:52cqw; line-height:1; text-shadow:1px 1px #fff8; }
.duel-card-edition { position:absolute; bottom:8%; left:45%; font-size:9cqw; opacity:.55; }
button.duel-card:hover:not(:disabled) { transform:translateY(-7px); box-shadow:2px 12px 18px #0008; }
.duel-card.selected, button.duel-card.selected:hover:not(:disabled) { transform:translateY(-13px); border-color:#ffd6a0; box-shadow:0 0 0 2px #d69d65,0 0 24px #d591543f,2px 12px 20px #0008; z-index:3; }
button.duel-card:focus-visible { outline:2px solid #f1c38e; outline-offset:4px; }
</style>
