<template>
  <div class="route-overlay" @click.self="$emit('close')" @keydown.esc="$emit('close')">
    <section ref="dialog" class="route-dialog" role="dialog" aria-modal="true" aria-labelledby="route-title" @keydown.tab="trapFocus">
      <header><div><p class="eyebrow">THE JOURNEY</p><h2 id="route-title">关卡路线</h2></div><button ref="close" class="px-btn btn-sort" @click="$emit('close')">关闭</button></header>
      <div class="acts"><article v-for="act in 4" :key="act"><h3>第 {{ act }} 幕</h3><div v-for="(blind, index) in BLINDS.slice((act-1)*3, act*3)" :key="blind.name" class="route-blind" :class="{ current: (act-1)*3+index === roundIndex, done: (act-1)*3+index < roundIndex }"><span>{{ (act-1)*3+index < roundIndex ? '✓' : String((act-1)*3+index+1).padStart(2,'0') }}</span><div><strong>{{ blind.name }}</strong><small>目标 {{ blind.target.toLocaleString() }}</small></div><b v-if="(act-1)*3+index === roundIndex">当前</b></div></article></div>
      <p class="route-note">每幕三关 · 每关 4 次出牌、3 次弃牌 · 过关后进入商店</p>
    </section>
  </div>
</template>
<script setup>
import { ref } from 'vue'
import { BLINDS } from '../composables/useGameState.js'
import { useDialogFocus } from '../composables/useDialogFocus.js'
defineProps({ roundIndex: Number })
defineEmits(['close'])
const dialog = ref(null), close = ref(null)
const { trapFocus } = useDialogFocus(dialog, close)
</script>
<style scoped>
.route-overlay { position: fixed; inset: 0; z-index: 300; background: #050806dd; display: grid; place-items: center; padding: 20px; }
.route-dialog { width: min(870px,100%); max-height: 90dvh; overflow: auto; background: #16211a; border: 1px solid #9b8050; padding: 30px; box-shadow: 0 20px 80px #000a; }
header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 25px; } h2 { font: 28px var(--font-display); color: var(--gold); margin-top: 8px; }
.acts { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; } h3 { font: 16px var(--font-display); color: #b9aa86; margin-bottom: 12px; }
.route-blind { display: flex; gap: 12px; align-items: center; padding: 12px; border: 1px solid #bc9c5733; margin-bottom: 6px; } .route-blind > span { font: 22px Georgia,serif; color: #968364; } .route-blind div { flex: 1; } small { display: block; margin-top: 5px; color: #a69d85; font-size: 11px; } strong { font-size: 14px; font-weight: 500; } b { font-size: 10px; color: var(--gold); } .current { border-color: #bd9854; background: #b69b5015; } .done { opacity: .5; } .route-note { color: #a89d84; margin-top: 20px; font-size: 12px; }
@media(max-width: 600px) { .acts { grid-template-columns: 1fr; } }
</style>
