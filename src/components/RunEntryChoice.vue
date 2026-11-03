<script setup>
import { ref, onMounted, nextTick } from 'vue'
defineProps({ run: { type: Object, required: true } })
const emit = defineEmits(['continue', 'new'])
const dialog = ref(null), continueButton = ref(null)
const stages = { playing: '出牌中', shop: '商店阶段', roundEnd: '本轮已结束', finished: '整桌已结束', won: '已通关', lost: '已结束' }
onMounted(() => nextTick(() => continueButton.value?.focus()))
function trapFocus(event) {
  if (event.key !== 'Tab') return
  const buttons = Array.from(dialog.value?.querySelectorAll('button') || [])
  const first = buttons[0], last = buttons.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
</script>

<template>
  <div class="run-entry-overlay" :class="{'duel-entry': run.mode === 'duel'}">
    <section ref="dialog" class="run-entry-dialog" role="dialog" aria-modal="true" aria-labelledby="run-entry-title" aria-describedby="run-entry-description" @keydown="trapFocus">
      <span class="entry-eyebrow">本地存档</span>
      <h2 id="run-entry-title">继续上次，还是新开一局？</h2>
      <p id="run-entry-description">发现之前留下的牌局。继续会保留原有进度，新局从第一{{run.mode === 'duel' ? '轮' : '关'}}、空小丑阵容开始。</p>
      <div class="run-entry-summary"><strong>{{run.name}}</strong><span>第 {{run.round}} / {{run.total}} {{run.mode === 'duel' ? '轮' : '关'}} · {{stages[run.phase]}}</span><small>{{run.jokers}} 张小丑 · ${{run.money}}</small></div>
      <div class="entry-actions"><button ref="continueButton" class="entry-continue" @click="emit('continue')">继续上次牌局</button><button class="entry-new" @click="emit('new')">新开一局</button></div>
      <p class="entry-replace-note">新开一局会替换这个模式的存档。</p>
    </section>
  </div>
</template>

<style scoped>
.run-entry-overlay { position:fixed; inset:0; z-index:800; display:grid; place-items:center; padding:22px; background:#030908b8; backdrop-filter:blur(7px); color:#e5d5b7; }
.run-entry-dialog { width:min(100%,440px); padding:30px; border:1px solid #b599625f; background:linear-gradient(145deg,#17291f,#0c1713); box-shadow:0 25px 90px #000a; }
.duel-entry .run-entry-dialog { background:linear-gradient(145deg,#202236,#16131e); border-color:#b488635f; }
.entry-eyebrow { font-size:10px; letter-spacing:4px; color:#b49a74; }
h2 { font:500 22px/1.6 'Songti SC',serif; margin:10px 0; }
p { font-size:12px; line-height:1.9; color:#aaa99a; margin:0 0 20px; }
.run-entry-summary { display:grid; gap:5px; padding:16px; border-block:1px solid #a18c5e35; background:#0002; font-size:12px; }
.run-entry-summary strong { font-weight:500; color:#ddc6a2; }.run-entry-summary small { color:#a5a194; font-size:11px; }
.entry-actions { display:flex; gap:10px; margin-top:22px; }
button { cursor:pointer; font:12px system-ui; min-height:44px; border:1px solid #a88d6260; padding:10px 13px; }
.entry-actions button { flex:1; }.entry-continue { background:#d1b382; color:#201d16; }.entry-new { background:#171e1b; color:#dac6a4; }.duel-entry .entry-new { background:#252333; }
.entry-replace-note { margin:10px 0 14px; font-size:10px; color:#8e8b80; }
button:focus-visible { outline:2px solid #eed1a0; outline-offset:4px; }
@media(max-width:420px) { .run-entry-dialog { padding:22px; } h2 { font-size:20px; }.run-entry-overlay { padding:18px; } }
</style>
