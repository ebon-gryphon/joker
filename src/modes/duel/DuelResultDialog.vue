<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import DuelResultBanter from './DuelResultBanter.vue'
import DuelFinale from './DuelFinale.vue'
import { playSfx } from '../../composables/useAudio.js'

const props = defineProps({
  round: { type: Number, required: true },
  youScore: { type: Number, required: true },
  botScore: { type: Number, required: true },
  wins: { type: Array, required: true },
  results: { type: Array, required: true },
  finished: Boolean,
  clinched: { type: String, default: null },
})
const emit = defineEmits(['shop', 'settle', 'restart', 'cinematic'])
const dialog = ref(null), primaryButton = ref(null)
const finale = ref(null), showFinale = ref(props.finished), finalePlayed = ref(false)
const roundWinner = computed(() => props.youScore === props.botScore ? 'draw' : props.youScore > props.botScore ? 'you' : 'bot')
const winner = computed(() => props.finished
  ? props.wins[0] === props.wins[1] ? 'draw' : props.wins[0] > props.wins[1] ? 'you' : 'bot'
  : roundWinner.value)
const title = computed(() => winner.value === 'draw'
  ? props.finished ? '这一桌，平分秋色。' : '这一轮，平分秋色。'
  : `${props.finished ? '这一桌' : '这一轮'}，${winner.value === 'you' ? '你赢了' : '小丑赢了'}。`)
const firstSide = computed(() => roundWinner.value === 'draw' ? props.round % 2 ? '你' : '小丑' : roundWinner.value === 'you' ? '你' : '小丑')
const draws = computed(() => props.results.length - props.wins[0] - props.wins[1])
const banterContext = computed(() => ({ round:props.round, youScore:props.youScore, botScore:props.botScore, wins:props.wins, results:props.results, finished:props.finished }))
function focusPrimary() { if (showFinale.value) finale.value?.focusSkip(); else primaryButton.value?.focus({ preventScroll: true }) }
async function completeFinale() { showFinale.value = false; finalePlayed.value = true; await nextTick(); focusPrimary() }
watch(() => props.finished, finished => { if (finished) showFinale.value = true }, { flush:'sync' })
watch(showFinale, (playing, previous) => { if (playing || previous) emit('cinematic', playing) }, { immediate:true })
onBeforeUnmount(() => { if (showFinale.value) emit('cinematic', false) })
function trapFocus(event) {
  if (event.key === 'Escape') { event.preventDefault(); return }
  if (event.key !== 'Tab') return
  const controls = [...(dialog.value?.querySelectorAll('button:not(:disabled), summary') || [])]
  const first = controls[0], last = controls.at(-1)
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
onMounted(() => {
  nextTick(focusPrimary)
  if (!props.finished) playSfx(winner.value === 'you' ? 'win' : winner.value === 'bot' ? 'grin' : 'joker')
})
defineExpose({ focusPrimary })
</script>

<template>
  <div class="duel-result-presentation">
   <DuelFinale v-if="showFinale" ref="finale" :outcome="winner" :wins="wins" @complete="completeFinale" />
   <div v-else class="duel-result-overlay" :class="{'after-finale': finalePlayed, 'defeat-aftermath': finalePlayed && winner === 'bot'}">
    <section ref="dialog" class="duel-result-dialog" :class="`result-${winner}`" role="dialog" aria-modal="true" aria-labelledby="duel-result-title" aria-describedby="duel-result-description" @keydown="trapFocus">
      <DuelResultBanter :key="`${round}-${finished}`" :context="banterContext" />
      <div class="result-verdict"><span class="result-eyebrow">{{finished ? 'MATCH COMPLETE' : `ROUND ${String(round).padStart(2, '0')} COMPLETE`}}</span><h2 id="duel-result-title">{{title}}</h2></div>
      <div class="result-score" :aria-label="finished ? `赢下轮数：你 ${wins[0]}，小丑 ${wins[1]}` : `本轮得分：你 ${youScore}，小丑 ${botScore}`">
        <span class="result-score-label">{{finished ? '赢下轮数' : '本轮得分'}}</span>
        <div class="result-score-pair"><div :class="{victor: winner === 'you'}"><span>你</span><strong>{{(finished ? wins[0] : youScore).toLocaleString()}}</strong></div><i aria-hidden="true">:</i><div :class="{victor: winner === 'bot'}"><span>小丑</span><strong>{{(finished ? wins[1] : botScore).toLocaleString()}}</strong></div></div>
      </div>
      <p id="duel-result-description" class="result-description">{{finished ? '按赢下轮数决定整桌胜负。' : `双方金币已到账。共享商店由${firstSide}先选，每次购买一张后换对方。`}}<span v-if="finished && draws">本桌平局 {{draws}} 轮。</span></p>
      <div v-if="!finished" class="result-standing">当前胜轮 <span>你 <b>{{wins[0]}}</b><i>:</i><b>{{wins[1]}}</b> 小丑</span></div>
      <p v-if="!finished && clinched" class="result-clinched">{{clinched === 'you' ? '你' : '小丑'}}已锁定本桌胜利，可以继续构筑、打满七轮。</p>
      <div class="result-actions"><button ref="primaryButton" class="result-primary" @click="finished ? emit('restart') : emit('shop')">{{finished ? '再来一桌' : '进入共享商店'}} <span aria-hidden="true">↗</span></button><button v-if="finished" class="result-secondary" @click="showFinale = true">重看结局</button><button v-if="!finished && clinched" class="result-secondary" @click="emit('settle')">提前结算本桌</button></div>
      <details v-if="finished" class="result-history"><summary>查看 {{results.length}} 轮比分</summary><div><span v-for="(result, index) in results" :key="index">第 {{index + 1}} 轮 <b>{{result.you.toLocaleString()}} : {{result.bot.toLocaleString()}}</b></span></div></details>
    </section>
   </div>
  </div>
</template>

<style scoped>
.duel-result-presentation { position:fixed; inset:0; z-index:500; }
.duel-result-overlay { position:fixed; inset:0; z-index:500; display:grid; place-items:center; padding:24px; color:#ddd3b9; color-scheme:dark; background:#030704c9; backdrop-filter:blur(3px); overscroll-behavior:contain; }
.duel-result-overlay.after-finale { animation:aftermath-light .5s ease-out both; }.duel-result-overlay.defeat-aftermath { background:#020302; backdrop-filter:none; animation:none; }.after-finale .duel-result-dialog { animation:result-impact .65s ease-out,aftermath-reveal .45s ease-out both; }
.duel-result-dialog { position:relative; width:min(100%,640px); max-height:calc(100dvh - 48px); overflow-y:auto; padding:22px 28px 24px; text-align:center; border:1px solid #8c774e8a; border-radius:2px; background:linear-gradient(145deg,#14231dee,#08110df5),url('/duel/arena-dark-v3.png') center bottom / cover; box-shadow:0 30px 100px #000d,inset 0 0 0 5px #ad895409; scrollbar-width:thin; animation:result-impact .65s ease-out; }
.duel-result-dialog::before { content:''; position:absolute; inset:7px; border:1px solid #b48c5c24; border-radius:2px; pointer-events:none; }
.result-you { --impact-color:#637b4c45; }
.result-bot { --impact-color:#9c3c2c45; }
.result-draw { --impact-color:#8e754445; }
.result-verdict { position:relative; animation:verdict-arrive .55s cubic-bezier(.2,.8,.2,1) both; }.result-verdict::before,.result-verdict::after { content:'✦'; position:absolute; top:24px; font-size:12px; color:#b49363; }.result-verdict::before { left:16%; }.result-verdict::after { right:16%; }
.result-eyebrow { color:#b59b7c; font:9px Georgia,serif; letter-spacing:3px; }
.duel-result-dialog h2 { margin:6px 0 15px; color:#efdcaf; font:500 clamp(24px,4vw,30px)/1.4 'Songti SC',serif; letter-spacing:1px; }
.result-score { padding:12px 0 13px; border-block:1px solid #92784b38; background:#03090448; }
.result-score-label { color:#aca991; font-size:10px; letter-spacing:3px; }
.result-score-pair { display:grid; grid-template-columns:minmax(0,1fr) 25px minmax(0,1fr); align-items:center; margin-top:10px; gap:6px; }
.result-score-pair > div { display:flex; flex-direction:column; gap:5px; min-width:0; }.result-score-pair div > span { color:#b5b69f; font-size:12px; }.result-score-pair strong { color:#d0c7ab; font:clamp(26px,6vw,38px)/1.15 Georgia,serif; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }.result-score-pair .victor strong { color:#e2c58a; }.result-score-pair > i { color:#8b7b5c; font:23px Georgia,serif; }
.result-description { margin:13px 0 10px; color:#b7b6a2; font-size:12px; line-height:1.9; }.result-description > span { display:block; }
.result-standing { display:flex; align-items:center; justify-content:center; gap:17px; color:#a3a38b; font-size:10px; }.result-standing span { color:#bfb69e; }.result-standing b { padding:0 5px; color:#dbc18d; font:16px Georgia,serif; }.result-standing i { font-style:normal; color:#8b8166; padding:0 3px; }
.result-clinched { color:#c5a987; font-size:11px; line-height:1.8; margin:14px 0 0; }
.result-actions { display:flex; flex-direction:column; align-items:stretch; gap:9px; margin-top:16px; }
.result-actions button { cursor:pointer; font:13px system-ui; min-height:48px; border:1px solid #d7b380; border-radius:2px; padding:12px 20px; }
.result-primary { display:flex; justify-content:center; align-items:center; gap:25px; background:linear-gradient(125deg,#bca06b,#8f7148); color:#11170f; box-shadow:0 5px 20px #0006; }.result-primary:hover { filter:brightness(1.08); }.result-primary > span { font-size:17px; }
.result-actions .result-secondary { background:transparent; color:#b9b19a; border-color:#8b774f55; min-height:38px; padding:8px; font-size:11px; }
button:focus-visible,summary:focus-visible { outline:2px solid #f4d9ad; outline-offset:4px; }
.result-history { margin-top:17px; text-align:left; color:#aaa88f; font-size:11px; }.result-history summary { cursor:pointer; padding:7px 0; text-align:center; }.result-history > div { display:grid; gap:8px; margin-top:10px; }.result-history span { display:flex; justify-content:space-between; gap:12px; padding:7px 10px; background:#02080548; }.result-history b { color:#cfbd95; font:14px Georgia,serif; }
.duel-result-enter-active,.duel-result-leave-active { transition:opacity .22s ease; }.duel-result-enter-active .duel-result-dialog,.duel-result-leave-active .duel-result-dialog { transition:transform .26s cubic-bezier(.2,.8,.2,1); }.duel-result-enter-from,.duel-result-leave-to { opacity:0; }.duel-result-enter-from .duel-result-dialog { transform:translateY(16px) scale(.97); }.duel-result-leave-to .duel-result-dialog { transform:scale(.98); }
@keyframes verdict-arrive { 0% { opacity:0; transform:translateY(-8px) scale(1.06); filter:blur(3px); }100% { opacity:1; transform:translateY(0) scale(1); filter:blur(0); } }
@keyframes result-impact { 0% { box-shadow:0 0 70px var(--impact-color),0 30px 100px #000b; }100% { box-shadow:0 30px 100px #000b,inset 0 0 0 5px #c89c5e08; } }
@keyframes aftermath-light { from { background:#020302; }to { background:#030704c9; } }@keyframes aftermath-reveal { from { opacity:0; }to { opacity:1; } }
@media(max-width:520px) { .duel-result-overlay { padding:18px; }.duel-result-dialog { padding:20px; max-height:calc(100dvh - 36px); }.duel-result-dialog h2 { font-size:25px; }.result-score-pair strong { font-size:30px; }.result-verdict::before { left:4%; }.result-verdict::after { right:4%; } }
@media(max-height:600px) and (min-width:521px) { .duel-result-dialog { padding:18px 28px; }.duel-result-dialog h2 { margin:6px 0 10px; font-size:24px; }.result-score { padding:10px 0; }.result-description { margin-top:10px; }.result-actions { margin-top:12px; } }
@media(prefers-reduced-motion:reduce) { .duel-result-dialog,.result-verdict { animation:none; }.duel-result-enter-active,.duel-result-leave-active,.duel-result-enter-active .duel-result-dialog,.duel-result-leave-active .duel-result-dialog { transition:none; } }
@media(prefers-reduced-motion:reduce) { .duel-result-overlay.after-finale,.after-finale .duel-result-dialog { animation:none; } }
</style>
