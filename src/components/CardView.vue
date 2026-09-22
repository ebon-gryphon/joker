<template>
  <component :is="selectable ? 'button' : 'div'" class="card-view" :class="{ selected: isSelected, 'suit-red': red, 'suit-black': !red }" :type="selectable ? 'button' : undefined" :disabled="selectable ? disabled : undefined" :aria-pressed="selectable ? isSelected : undefined" :aria-label="`${card.suit}${card.rank}`" @click="selectable && !disabled && $emit('click', card)">
    <div class="card-corner card-corner-tl"><div class="card-rank">{{ card.rank }}</div><div class="card-suit-small">{{ card.suit }}</div></div>
    <div v-if="face" class="card-face"><span class="face-crown">♛</span><strong>{{ card.rank }}</strong><span>{{ card.suit }}</span></div>
    <div v-else-if="card.rank === 'A'" class="card-ace">{{ card.suit }}</div>
    <div v-else class="card-pips" :class="`pips-${card.rank}`"><span v-for="i in Number(card.rank)" :key="i">{{ card.suit }}</span></div>
    <div class="card-corner card-corner-br"><div class="card-rank">{{ card.rank }}</div><div class="card-suit-small">{{ card.suit }}</div></div>
  </component>
</template>
<script setup>
import { computed } from 'vue'
const props = defineProps({ card: { type: Object, required: true }, isSelected: Boolean, selectable: Boolean, disabled: Boolean })
defineEmits(['click'])
const red = computed(() => ['♥','♦'].includes(props.card.suit))
const face = computed(() => ['J','Q','K'].includes(props.card.rank))
</script>
<style scoped>
.card-view { width: 100px; height: 145px; border-radius: 5px; background: radial-gradient(ellipse at 35% 30%,#f6edda,#e2d2ae); border: 1px solid #bca982; position: relative; user-select: none; transition: transform .16s,box-shadow .16s,border-color .16s; flex-shrink: 0; display: flex; align-items: center; justify-content: center; box-shadow: 2px 4px 7px #0006,inset 0 0 0 3px #f7ead280; padding: 0; font-family: Georgia,'Times New Roman',serif; container-type: inline-size; color: #292b25; }
button.card-view { cursor: pointer; } button.card-view:hover:not(:disabled) { transform: translateY(-7px); z-index: 2; box-shadow: 2px 10px 18px #0006; } .card-view.selected,button.card-view.selected:hover:not(:disabled) { transform: translateY(-18px); border-color: #f0d393; box-shadow: 0 0 0 2px #c9a85c,0 0 17px #f1ca6660,2px 10px 12px #0006; z-index: 3; }
.card-corner { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 1px; line-height: 1; } .card-corner-tl { top: 6%; left: 7%; }.card-corner-br { bottom: 6%; right: 7%; transform: rotate(180deg); }.card-rank { font-size: 23cqw; font-weight: bold; }.card-suit-small { font-size: 17cqw; }.card-ace { font-size: 55cqw; }
.suit-red { color: #942c2a; }.suit-black { color: #252c26; }.card-face { width: 58%; height: 71%; margin-top: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 3px double #a48b58; outline: 1px solid #a48b5844; outline-offset: 3px; background: repeating-linear-gradient(45deg,#ae8d4710 0px,#ae8d4710 2px,transparent 2px,transparent 7px); gap: 3px; }.card-face strong { font: bold 39cqw/1 Georgia,serif; }.card-face > span { font-size: 21cqw; line-height: 1; }.card-face .face-crown { color: #8d733d; font-size: 26cqw; }
.card-pips { width: 52%; height: 65%; display: grid; grid-template-columns: repeat(2,1fr); align-content: space-around; justify-items: center; gap: 1px; font-size: 21cqw; line-height: 1; }.pips-2,.pips-3 { grid-template-columns: 1fr; font-size: 28cqw; }.pips-5 span:last-child,.pips-7 span:last-child,.pips-9 span:last-child { grid-column: 1/-1; }.card-view:disabled { cursor: default; }
</style>
