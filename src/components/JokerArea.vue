<template>
  <section class="joker-area" aria-label="小丑牌组合">
    <header><span class="joker-title">小丑牌 <b>{{ jokers.length }} / 5</b></span><span class="order-hint">从左到右结算</span><button class="catalog-link" @click="$emit('catalog')">图鉴 · {{ JOKER_POOL.length }} 张 ↗</button></header>
    <div class="joker-slots">
      <div v-for="i in 5" :key="i" class="joker-slot" :class="{ filled: jokers[i - 1] }">
        <template v-if="jokers[i - 1]">
          <div class="joker-card" :class="'rarity-' + jokers[i - 1].rarity" :data-joker-index="i - 1">
            <button class="joker-inspect" :aria-label="`查看${jokers[i - 1].name}效果`" :aria-expanded="active === i" @click="active = active === i ? null : i" @keydown.esc="active = null" @blur="active = null">
              <JokerArt :joker="jokers[i - 1]" /><span class="joker-name">{{ jokers[i - 1].name }}</span>
            </button>
            <div class="joker-tooltip" :class="{ open: active === i }"><strong>{{ jokers[i - 1].name }} <small>{{ rarityLabel(jokers[i - 1].rarity) }}</small></strong><p>{{ jokers[i - 1].desc }}</p><p v-if="jokerStatus(jokers[i - 1])" class="growth-status">{{ jokerStatus(jokers[i - 1]) }}</p></div>
          </div>
          <div class="move-controls"><button :disabled="disabled || i === 1" :aria-label="`左移${jokers[i - 1].name}`" @click="$emit('move', i - 1, -1)">←</button><span>{{ jokerStatus(jokers[i - 1]) || rarityLabel(jokers[i - 1].rarity) }}</span><button :disabled="disabled || i === jokers.length" :aria-label="`右移${jokers[i - 1].name}`" @click="$emit('move', i - 1, 1)">→</button></div>
        </template>
        <div v-else class="joker-empty"><span>♧</span><small>空槽 {{ String(i).padStart(2,'0') }}</small></div>
      </div>
    </div>
  </section>
</template>
<script setup>
import { ref } from 'vue'
import JokerArt from './JokerArt.vue'
import { JOKER_POOL, jokerStatus } from '../composables/jokerCatalog.js'
defineProps({ disabled: Boolean, jokers: { type: Array, default: () => [] } })
defineEmits(['move', 'catalog'])
const active = ref(null)
function rarityLabel(rarity) { return { common: '普通', rare: '稀有', legendary: '传说' }[rarity] || rarity }
</script>
<style scoped>
.joker-area { min-height: 0; padding: 22px 6% 0; position: relative; z-index: 80; }
header { display: flex; align-items: center; gap: 15px; max-width: 790px; margin: 0 auto 12px; }
.joker-title { font: 18px var(--font-display); color: #e2d0a6; } .joker-title b { font: 15px Georgia,serif; margin-left: 9px; color: #c7b68f; }
.order-hint { color: #a09f84; font-size: 11px; } .catalog-link { margin-left: auto; background: none; border: none; color: #c3b58e; cursor: pointer; font-size: 12px; padding: 5px; }
.joker-slots { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: clamp(12px,2vw,30px); max-width: 750px; margin: 0 auto; }
.joker-slot { min-width: 0; }
.joker-card { position: relative; border-radius: 5px; box-shadow: 2px 6px 9px #0007; border: 1px solid #bda370; transition: transform .2s; }
.joker-card:has(.joker-tooltip.open) { z-index: 6; }
.joker-card:hover,.joker-card:focus-within { z-index: 5; transform: translateY(-4px); }
.joker-inspect { display: block; padding: 0; width: 100%; border: 0; border-radius: 4px; background: #e5d4ad; color: #302c21; cursor: pointer; position: relative; }
.joker-inspect :deep(img) { border-radius: 4px; }
.joker-name { position: absolute; bottom: 7%; left: 5%; right: 5%; text-align: center; padding: 4px 1px; background: #e6d4a9f5; font: 600 clamp(10px,1vw,13px) var(--font-display); border-top: 1px solid #91764466; border-bottom: 1px solid #91764466; }
.rarity-rare { border-color: #b77669; } .rarity-legendary { border-color: #c4a0ce; }
.joker-tooltip { display: none; position: absolute; top: 88%; left: 50%; transform: translateX(-50%); width: 218px; padding: 14px; color: #e6d7b8; border: 1px solid #9c8455; background: #171d16fa; box-shadow: 0 10px 24px #0008; pointer-events: none; z-index: 100; }
.joker-card:hover .joker-tooltip,.joker-card:has(.joker-inspect:focus-visible) .joker-tooltip,.joker-tooltip.open { display: block; }
.joker-tooltip strong { font-size: 14px; } .joker-tooltip small { font-weight: 400; font-size: 10px; color: #b9a984; margin-left: 6px; } .joker-tooltip p { margin-top: 8px; font-size: 12px; line-height: 1.65; } .growth-status { color: #9dc7a1; }
.move-controls { display: flex; align-items: center; justify-content: space-between; margin-top: 5px; gap: 3px; }
.move-controls span { font-size: 10px; color: #c5b692; text-align: center; } .move-controls button { background: transparent; color: #e1c996; border: 0; padding: 3px 6px; cursor: pointer; } .move-controls button:disabled { opacity: .2; cursor: default; }
.joker-empty { aspect-ratio: 2/3; border: 1px solid #b296573b; border-radius: 5px; box-shadow: inset 0 0 25px #0003; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #afaa8059; outline: 1px solid #a9934b17; outline-offset: -7px; gap: 14px; background: #02140b18; }
.joker-empty span { font: 42px Georgia,serif; } .joker-empty small { font-size: 10px; letter-spacing: 2px; }
@media(max-height:750px) { .joker-area { padding-top: 14px; } .joker-slots { max-width: 610px; } header { max-width: 650px; margin-bottom: 8px; } }
@media(max-width:700px) { .joker-area { padding: 15px 18px 0; } .order-hint { display: none; } .joker-slots { gap: 8px; } .joker-title { font-size: 15px; } }
@media(max-width:700px) { .move-controls span { display: none; } .move-controls { justify-content: center; gap: 10px; } .joker-slot:first-child .joker-tooltip { left: 0; transform: none; } .joker-slot:last-child .joker-tooltip { left: auto; right: 0; transform: none; } }
</style>
