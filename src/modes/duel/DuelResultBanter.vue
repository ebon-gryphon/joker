<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { chooseResultBanter } from './resultBanter.js'
import { frameAt, resultMotion } from './resultMotion.js'
import { playSfx } from '../../composables/useAudio.js'

const props = defineProps({ context: { type: Object, required: true } })
const variant = ref(0), replied = ref(false), fullLine = ref(''), shown = ref(0), reducedMotion = ref(false)
const replyOffset = ref(0)
const atlasReady = ref(false), acting = ref(false), motionFrame = ref(0)
const motion = ref(resultMotion('amused'))
const banter = computed(() => chooseResultBanter(props.context, variant.value))
const playerReply = computed(() => chooseResultBanter(props.context, variant.value + replyOffset.value))
const typing = computed(() => shown.value < fullLine.value.length)
// This atlas has slightly different chest baselines in each gesture row.
const poseOffsets = [0, 1, 2, 5]
const spriteStyle = computed(() => atlasReady.value ? {
  backgroundImage: `url("${import.meta.env.BASE_URL}duel/result-actions-closeup-v3.png")`,
  backgroundSize: '400% 400%',
  backgroundPosition: `${motionFrame.value / 3 * 100}% ${motion.value.row / 3 * 100}%`,
  '--pose-shift': `${poseOffsets[motion.value.row]}%`,
} : {})
const moodLabel = computed(() => banter.value.mood === 'smug' ? '笑意藏不住' : banter.value.mood === 'irked' ? '笑容冷了下来' : '他还在等你失手')
let timer, mounted = false, motionQuery, motionRaf, actionArt, activeAction = 'outcome'
function stopMotion() { cancelAnimationFrame(motionRaf); acting.value = false }
function startMotion(action = 'outcome') {
  stopMotion()
  activeAction = action
  motion.value = resultMotion(banter.value.mood, action)
  motionFrame.value = reducedMotion.value ? frameAt(motion.value, Infinity) : frameAt(motion.value, 0)
  if (!atlasReady.value || reducedMotion.value || !mounted) return
  acting.value = true
  let started
  function tick(now) {
    if (!mounted) return
    started ??= now
    const elapsed = now - started
    motionFrame.value = frameAt(motion.value, elapsed)
    if (elapsed >= motion.value.duration) { acting.value = false; return }
    motionRaf = requestAnimationFrame(tick)
  }
  motionRaf = requestAnimationFrame(tick)
}
function cancelTyping() { clearTimeout(timer) }
function showWholeLine() { cancelTyping(); shown.value = fullLine.value.length }
function typeLine(text) {
  cancelTyping()
  fullLine.value = text
  shown.value = reducedMotion.value ? text.length : 0
  function tick() {
    if (shown.value >= fullLine.value.length) return
    shown.value++
    const punctuation = /[，。？！、]/.test(fullLine.value[shown.value - 1])
    timer = setTimeout(tick, punctuation ? 150 : 38)
  }
  if (!reducedMotion.value) timer = setTimeout(tick, 180)
}
function begin(action = 'outcome') { replied.value = false; replyOffset.value = 0; typeLine(banter.value.line); startMotion(action) }
function changeReply() { if (!replied.value) { playSfx('select'); replyOffset.value = (replyOffset.value + 1) % 3 } }
function tauntAgain() {
  playSfx('select')
  variant.value++
  begin(variant.value % 2 ? 'beckon' : 'outcome')
}
function retort() {
  if (replied.value) return
  playSfx('joker')
  replied.value = true
  typeLine(playerReply.value.retort)
  startMotion('retort')
}
function motionChanged(event) { reducedMotion.value = event.matches; if (event.matches) showWholeLine(); startMotion(activeAction) }
watch(() => props.context, async () => {
  variant.value = 0
  if (mounted) { await nextTick(); if (mounted) begin() }
})
onMounted(() => {
  mounted = true
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion.value = motionQuery.matches
  motionQuery.addEventListener('change', motionChanged)
  actionArt = new Image()
  actionArt.onload = () => { if (mounted) { atlasReady.value = true; startMotion(activeAction) } }
  actionArt.src = `${import.meta.env.BASE_URL}duel/result-actions-closeup-v3.png`
  begin()
})
onBeforeUnmount(() => { mounted = false; cancelTyping(); stopMotion(); if (actionArt) actionArt.onload = null; motionQuery?.removeEventListener('change', motionChanged) })
</script>

<template>
  <div class="jester-encounter" :class="[`mood-${banter.mood}`, {speaking: typing, 'has-retort': replied}]">
    <div class="encounter-lights" aria-hidden="true"></div>
    <button class="jester-reaction" aria-label="让小丑再说一句" title="点一下，看看他还有什么话" @click="tauntAgain"><span class="jester-aura" aria-hidden="true"></span><span class="jester-sprite" :class="{'is-acting': acting, 'actions-ready': atlasReady}" :style="spriteStyle" :data-motion="motion.name" :data-frame="motionFrame" :data-playing="acting" aria-hidden="true"></span><span class="portrait-cue" aria-hidden="true">再听他一句 ↗</span></button>
    <div class="jester-conversation">
      <div class="speaker-label"><span>THE JESTER <b>小丑</b></span><small>{{moodLabel}}</small></div>
      <button class="taunt-bubble" aria-label="显示完整的小丑台词" @click="showWholeLine"><span class="spoken-line" aria-hidden="true">{{fullLine.slice(0, shown)}}<i v-if="typing" class="speech-caret"></i></span><span class="sr-only" aria-live="polite">{{fullLine}}</span><span class="speech-hint" aria-hidden="true">{{typing ? '点击台词，直接看完' : '点小丑，听他再说一句'}}</span></button>
      <div class="retort-row" :data-reply-key="playerReply.replyKey"><span id="duel-reply-preview" class="player-retort" :class="{'reply-preview': !replied}"><b>{{replied ? '你' : '你可以说'}}</b> {{playerReply.response}}</span><button v-if="!replied" class="change-reply" @click="changeReply">换句回敬</button><button class="retort-button" :aria-disabled="replied" aria-describedby="duel-reply-preview" @click="retort">{{replied ? '已回敬 ✓' : '回敬一句 ↗'}}</button></div>
    </div>
  </div>
</template>

<style scoped>
.jester-encounter { position:relative; isolation:isolate; display:grid; grid-template-columns:164px minmax(0,1fr); align-items:center; min-height:214px; margin:-22px -28px 19px; padding:15px 25px 11px 9px; border-bottom:1px solid #8b6b4459; background:linear-gradient(105deg,#11221ce8,#0a0e0de8 70%,#28120fce),url('/duel/arena-dark-v3.png') center 20% / cover; }
.jester-encounter::after { content:'♠  ♦'; position:absolute; inset:10px 15px auto auto; color:#a48b5f15; font:42px Georgia; letter-spacing:10px; z-index:-1; }
.encounter-lights { position:absolute; inset:0; z-index:-1; overflow:hidden; }.encounter-lights::before { content:''; position:absolute; width:150px; height:240px; left:0; top:-110px; transform:rotate(-22deg); background:linear-gradient(#c8ab6c25,transparent); filter:blur(20px); animation:encounter-light 7s ease-in-out infinite alternate; }
.jester-reaction { position:relative; display:block; align-self:stretch; overflow:hidden; padding:0; border:0; background:none; min-width:0; animation:jester-enter .45s cubic-bezier(.2,.8,.2,1) both; }
.jester-aura { position:absolute; width:133px; height:133px; left:9px; top:25px; border:0; border-radius:50%; background:radial-gradient(ellipse at 35% 35%,#b4955d24,transparent 68%); }
.jester-sprite { position:absolute; left:50%; top:calc(50% + 4px); width:176px; height:176px; display:block; background:url('/duel/rival-closeup-v4.png') center / contain no-repeat; transform:translate(-50%,calc(-50% + var(--pose-shift,0%))); }
.jester-sprite:not(.actions-ready) { width:160px; height:160px; top:calc(50% + 2px); }
.has-retort .jester-aura { animation:retort-glow .45s ease-out; }
.portrait-cue { position:absolute; bottom:0; left:16px; right:0; color:#b4a47c; font-size:9px; letter-spacing:1px; opacity:.8; }.jester-reaction:hover .portrait-cue { opacity:1; }
.jester-conversation { position:relative; min-width:0; padding:6px 0; animation:conversation-enter .35s .08s ease-out both; }
.speaker-label { display:flex; justify-content:space-between; align-items:center; gap:7px; margin-bottom:9px; color:#a18b66; font:8px Georgia,serif; letter-spacing:1px; }.speaker-label b { font:12px 'Songti SC',serif; color:#cbb68b; margin-left:7px; }.speaker-label small { font:9px system-ui; color:#9d8a75; letter-spacing:0; }
.taunt-bubble { position:relative; display:block; width:100%; min-height:91px; border:1px solid #8d774c52; border-radius:2px; padding:13px 15px 24px; background:linear-gradient(135deg,#252b20e8,#111712f0); color:#e3d7ba; text-align:left; box-shadow:0 6px 20px #0006; }
.taunt-bubble::before { content:''; position:absolute; width:10px; height:10px; left:-6px; top:27px; border-left:1px solid #8d774c52; border-bottom:1px solid #8d774c52; background:#22291e; transform:rotate(45deg); }
.spoken-line { font:500 17px/1.75 'Songti SC','STSong',serif; letter-spacing:.5px; }.speech-caret { display:inline-block; width:3px; height:16px; margin-left:3px; vertical-align:-2px; background:#d3aa72; animation:speech-blink .5s steps(2) infinite; }
.speech-hint { position:absolute; bottom:6px; right:10px; color:#9b947e; font:9px system-ui; }
.retort-row { display:flex; flex-wrap:wrap; align-items:center; justify-content:flex-end; gap:8px; min-height:31px; margin-top:7px; }
.change-reply { flex-shrink:0; min-height:36px; padding:5px 8px; border:0; background:transparent; color:#b3aa91; font-size:10px!important; }.change-reply:hover { color:#e1c28b; }
.retort-button { flex-shrink:0; border:1px solid #9d774c6a; border-radius:2px; padding:5px 10px; background:#71463124; color:#d3b88a; font-size:10px!important; min-height:36px; }.retort-button[aria-disabled='true'] { color:#a19880; border-color:transparent; background:transparent; cursor:default; }
.player-retort { flex:1 1 150px; color:#b4c1aa; font-size:10px; line-height:1.6; animation:retort-in .22s ease-out; }.player-retort b { color:#d0bd91; margin-right:5px; }.player-retort.reply-preview { color:#aaa993; }
.sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; border:0; }
.jester-reaction:focus-visible,.taunt-bubble:focus-visible,.retort-button:focus-visible,.change-reply:focus-visible { outline:2px solid #f4d9ad; outline-offset:3px; }
@keyframes jester-enter { from { opacity:0; transform:translateX(-18px) rotate(-5deg); }to { opacity:1; transform:translateX(0) rotate(0); } }@keyframes conversation-enter { from { opacity:0; transform:translateX(10px); }to { opacity:1; transform:translateX(0); } }
@keyframes speech-blink { to { opacity:0; } }@keyframes retort-in { from { opacity:0; transform:translateX(8px); }to { opacity:1; transform:translateX(0); } }
@keyframes retort-glow { 50% { box-shadow:0 0 24px #79492d33; } }@keyframes encounter-light { to { transform:translateX(8px) rotate(-18deg); opacity:.7; } }
@media(max-width:520px) { .jester-encounter { grid-template-columns:108px minmax(0,1fr); padding:13px 16px 9px 0; margin:-20px -20px 15px; min-height:190px; }.jester-aura { width:102px; height:102px; left:1px; top:30px; }.jester-sprite { left:-7px; width:calc(100% + 14px); }.portrait-cue { left:2px; font-size:8px; letter-spacing:0; }.speaker-label { gap:4px; }.speaker-label > span { font-size:7px; letter-spacing:0; }.speaker-label b { margin-left:4px; }.speaker-label small { display:none; }.taunt-bubble { padding:11px 11px 25px; min-height:104px; }.spoken-line { font-size:15px; letter-spacing:0; }.speech-hint { font-size:8px; right:6px; }.retort-row { flex-wrap:wrap; gap:4px; }.player-retort { width:100%; font-size:9px; }.retort-button { min-height:44px; padding:8px 10px; } }
@media(max-height:600px) and (min-width:521px) { .jester-encounter { min-height:154px; margin-top:-18px; }.jester-aura { width:110px; height:110px; top:8px; } }
@media(max-width:520px) { .jester-sprite { left:50%; top:calc(50% - 3px); width:128px; height:128px; }.portrait-cue { top:calc(50% + 65px); bottom:auto; } }
@media(max-width:520px) { .change-reply { min-height:44px; }.player-retort { flex-basis:100%; } }
@media(max-width:520px) { .jester-sprite:not(.actions-ready) { width:120px; height:120px; } }
@media(prefers-reduced-motion:reduce) { .jester-reaction,.jester-conversation,.encounter-lights::before,.has-retort .jester-aura,.player-retort,.speech-caret { animation:none; } }
</style>
