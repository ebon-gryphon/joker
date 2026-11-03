<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { pauseSfx, playSfx } from '../../composables/useAudio.js'
import { finaleAt } from './finale.js'
import { grabPose } from './grabMotion.js'
import DuelGrabRig from './DuelGrabRig.vue'

const props = defineProps({
  outcome: { type: String, default: 'draw' },
  wins: { type: Array, default: () => [0, 0] },
  active: { type: Boolean, default: true },
})
const emit = defineEmits(['complete'])
const skipButton = ref(null), elapsed = ref(0), reducedMotion = ref(false)
const actorFailed = ref(false)
const lossRigReady = ref(false)
const lossArtUnavailable = ref(false)
const effectiveReduced = computed(() => reducedMotion.value || (props.outcome === 'bot' && lossArtUnavailable.value))
const scene = computed(() => finaleAt(props.outcome, elapsed.value, { reducedMotion: effectiveReduced.value }))
const asset = name => `${import.meta.env.BASE_URL}duel/${name}`
let mounted = false, completed = false, openingCuePlayed = false, raf, segmentStarted = null, elapsedBeforeSegment = 0, mediaQuery, previousStage
const smooth = value => value * value * (3 - 2 * value)

const sceneStyle = computed(() => {
  const { outcome, elapsed: time, stageProgress, stage, effects } = scene.value
  const still = effectiveReduced.value
  const approach = smooth(effects.approach)
  const grab = grabPose(time, { reducedMotion: still })
  const cover = outcome === 'bot' ? grab.cover : 0
  const retreat = smooth(effects.retreat)
  const dim = smooth(effects.dim)
  const quoteOpacity = still ? 1 : stage === 'dark' || stage === 'resolve' || stage === 'restore'
    ? Math.min(1, stageProgress * 6)
    : outcome === 'bot' ? Math.min(1, time / 260) * (1 - Math.min(1, Math.max(0, (time - 1700) / 250))) : Math.min(1, time / 260)
  return {
    '--actor-opacity': String(still ? 1 : outcome === 'you' ? 1 - retreat * .96 : 1 - cover),
    '--actor-scale': String(still ? 1 : outcome === 'you' ? 1 - retreat * .18 : 1 + effects.opening * .035),
    '--actor-y': `${retreat * 7}vh`,
    '--room-brightness': String(still ? .55 : outcome === 'draw' ? .58 - dim * .4 : outcome === 'you' ? .55 + retreat * .16 : .58 - approach * .22),
    '--room-scale': String(still ? 1 : 1 + effects.opening * .025),
    '--lamp-opacity': String(still ? .22 : outcome === 'you' ? .14 + retreat * .78 : .22 - dim * .16),
    '--grab-shadow': String(still || outcome !== 'bot' ? 0 : grab.thrust ** 3 * .88),
    '--veil-opacity': String(cover),
    '--quote-opacity': String(quoteOpacity),
    '--cards-drift': `${retreat * 30}vh`,
    '--cards-opacity': String(still || outcome !== 'you' ? 0 : Math.sin(retreat * Math.PI) * .72),
  }
})

function focusSkip() { skipButton.value?.focus({ preventScroll: true }) }
function currentElapsed(now = performance.now()) {
  return elapsedBeforeSegment + (segmentStarted === null ? 0 : Math.max(0, now - segmentStarted))
}
function pauseClock() {
  if (segmentStarted !== null) elapsedBeforeSegment = currentElapsed()
  elapsed.value = elapsedBeforeSegment
  segmentStarted = null
  cancelAnimationFrame(raf)
  pauseSfx()
}
function finish() {
  if (completed || !mounted) return
  completed = true
  pauseClock()
  emit('complete')
}
function skip() {
  if (completed) return
  pauseClock()
  elapsedBeforeSegment = finaleAt(props.outcome, elapsed.value, { skipped: true, reducedMotion: effectiveReduced.value }).duration
  elapsed.value = elapsedBeforeSegment
  finish()
}
function tick(now) {
  if (!mounted || completed) return
  elapsed.value = currentElapsed(now)
  if (scene.value.complete) { finish(); return }
  if (previousStage !== scene.value.stage) {
    previousStage = scene.value.stage
    if (!effectiveReduced.value && (previousStage === 'reach' || previousStage === 'retreat')) playSfx('discard')
  }
  raf = requestAnimationFrame(tick)
}
function resumeClock() {
  if (!mounted || completed || !props.active || document.hidden || segmentStarted !== null || (scene.value.outcome === 'bot' && !lossRigReady.value)) return
  if (!openingCuePlayed) {
    openingCuePlayed = true
    if (!effectiveReduced.value) playSfx(scene.value.outcome === 'bot' ? 'grin' : 'joker')
  }
  segmentStarted = performance.now()
  raf = requestAnimationFrame(tick)
}
function visibilityChanged() { document.hidden ? pauseClock() : resumeClock() }
function rigReady({ animated = true } = {}) {
  lossArtUnavailable.value = !animated
  lossRigReady.value = true
  resumeClock()
}
function motionChanged(event) {
  pauseClock()
  reducedMotion.value = event.matches
  elapsedBeforeSegment = 0
  elapsed.value = 0
  previousStage = null
  openingCuePlayed = false
  resumeClock()
}
function reset() {
  pauseClock()
  completed = false
  elapsedBeforeSegment = 0
  elapsed.value = 0
  previousStage = null
  openingCuePlayed = false
  nextTick(focusSkip)
  resumeClock()
}
function keyboard(event) {
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); skip() }
  // The film has one control; keep focus on it until the parent shows results.
  if (event.key === 'Tab') { event.preventDefault(); focusSkip() }
}
watch(() => props.active, active => active ? resumeClock() : pauseClock())
watch(() => props.outcome, outcome => {
  if (outcome === 'bot') { lossRigReady.value = false; lossArtUnavailable.value = false }
  if (mounted) reset()
})
onMounted(() => {
  mounted = true
  mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reducedMotion.value = mediaQuery.matches
  mediaQuery.addEventListener('change', motionChanged)
  document.addEventListener('visibilitychange', visibilityChanged)
  reset()
})
onBeforeUnmount(() => {
  mounted = false
  cancelAnimationFrame(raf)
  segmentStarted = null
  mediaQuery?.removeEventListener('change', motionChanged)
  document.removeEventListener('visibilitychange', visibilityChanged)
  pauseSfx()
})
defineExpose({ focusSkip })
</script>

<template>
  <section class="duel-finale" :class="[`finale-${scene.outcome}`, `stage-${scene.stage}`, { 'motion-reduced': effectiveReduced }]" :style="sceneStyle" :data-stage="scene.stage" :data-outcome="scene.outcome" :data-elapsed="Math.round(scene.elapsed)" role="dialog" aria-modal="true" aria-labelledby="duel-finale-title" @keydown="keyboard">
    <h2 id="duel-finale-title" class="sr-only">{{scene.title}}</h2>
    <div class="finale-room" aria-hidden="true"></div>
    <div class="finale-lamp" aria-hidden="true"></div>
    <DuelGrabRig v-if="scene.outcome === 'bot'" :elapsed="scene.elapsed" :reduced-motion="effectiveReduced" @ready="rigReady" />
    <div v-else class="finale-actor" aria-hidden="true">
      <img v-if="!actorFailed" :src="asset('rival-closeup-v4.png')" alt="" @error="actorFailed = true" />
      <div v-else class="finale-actor-shadow"><i></i><b></b></div>
    </div>
    <div v-if="scene.outcome === 'you'" class="finale-loose-cards" aria-hidden="true"><i></i><i></i><i></i></div>
    <div v-if="scene.outcome === 'bot'" class="finale-grab-shadow" aria-hidden="true"></div>
    <div class="finale-eclipse" aria-hidden="true"></div>
    <div class="finale-grain" aria-hidden="true"></div>
    <div class="finale-dialogue">
      <span class="finale-speaker">{{scene.stage === 'dark' ? '灯灭之后' : '小丑'}}</span>
      <p :key="scene.line" aria-live="polite" aria-atomic="true">{{scene.line}}</p>
      <span v-if="effectiveReduced" class="finale-afterword">{{scene.closingLine}}</span>
      <span v-if="scene.stage === 'dark' || scene.stage === 'resolve' || scene.stage === 'restore'" class="finale-standing">你 {{wins[0] || 0}} <i>:</i> {{wins[1] || 0}} 小丑</span>
    </div>
    <span class="finale-marker" aria-hidden="true">THE LAST HAND</span>
    <button ref="skipButton" class="finale-skip" @click="skip">跳过演出 <span aria-hidden="true">↗</span></button>
    <progress class="finale-progress" :value="scene.elapsed" :max="scene.duration" aria-label="结局演出进度"></progress>
  </section>
</template>

<style scoped>
.duel-finale { position:fixed; inset:0; z-index:1100; isolation:isolate; overflow:hidden; color:#e4d4b3; background:#030604; color-scheme:dark; text-align:center; overscroll-behavior:contain; }
.finale-room { position:absolute; inset:-3%; background:linear-gradient(180deg,#02050335,#030a0650 60%,#000c),url('/duel/arena-dark-v3.png') center 43% / cover; filter:brightness(var(--room-brightness)); transform:scale(var(--room-scale)); }
.finale-room::after { content:''; position:absolute; inset:0; background:radial-gradient(ellipse at 50% 32%,transparent 12%,#0005 65%,#000c); }
.finale-lamp { position:absolute; inset:18% -15% -40%; background:radial-gradient(ellipse at 50% 90%,#d2b47e80,transparent 60%); opacity:var(--lamp-opacity); }
.finale-actor { position:absolute; width:min(88vw,850px); height:110dvh; bottom:-12dvh; left:50%; transform:translateX(-50%) translateY(var(--actor-y)) scale(var(--actor-scale)); transform-origin:50% 60%; opacity:var(--actor-opacity); }
.finale-actor > img { display:block; width:100%; height:100%; object-fit:contain; filter:drop-shadow(0 15px 30px #000b); }
.finale-actor::after { content:''; position:absolute; inset:0; background:linear-gradient(transparent 55%,#020604b8 78%,#020604); pointer-events:none; }
.finale-actor-shadow { width:60%; height:86%; margin:12% auto 0; border-radius:45% 45% 10% 10%; background:radial-gradient(ellipse at 50% 20%,#5e5544 8%,#171813 23%,#080c09 45%); box-shadow:0 0 60px #030604; }
.finale-actor-shadow i { position:absolute; top:31%; left:calc(50% - 35px); width:70px; height:4px; border-inline:13px solid #bea47b; border-radius:45%; }.finale-actor-shadow b { position:absolute; top:37%; left:calc(50% - 20px); width:40px; height:13px; border-bottom:2px solid #8f7a5c; border-radius:50%; }
.finale-grab-shadow { position:absolute; z-index:3; inset:0; opacity:var(--grab-shadow); background:radial-gradient(ellipse at 48% 50%,#0000 9%,#030403bb 72%,#020302 100%); pointer-events:none; }
.finale-eclipse { position:absolute; z-index:4; inset:-1px; background:#020302; opacity:var(--veil-opacity); pointer-events:none; }
.finale-grain { position:absolute; z-index:5; inset:0; pointer-events:none; opacity:.1; background-image:repeating-radial-gradient(circle at 20% 50%,#d8c9a655 0 .6px,transparent 1px 3.5px); background-size:7px 9px; mix-blend-mode:soft-light; }
.finale-dialogue { position:absolute; z-index:6; bottom:clamp(60px,9dvh,110px); left:50%; width:min(90%,880px); transform:translateX(-50%); opacity:var(--quote-opacity); text-shadow:0 2px 8px #000,0 0 30px #000; }
.finale-speaker { display:block; color:#b89c71; font:11px 'Songti SC','STSong',serif; letter-spacing:6px; margin-bottom:15px; }
.finale-dialogue > p { margin:0; color:#e7d5af; font:500 clamp(25px,3.4vw,43px)/1.7 'Songti SC','STSong',serif; letter-spacing:3px; }
.finale-afterword { display:block; margin-top:13px; color:#b6a58a; font:15px/1.6 'Songti SC',serif; letter-spacing:1px; }
.finale-standing { display:block; margin-top:18px; color:#a6987d; font:13px Georgia,'Songti SC',serif; letter-spacing:2px; }.finale-standing i { padding:0 10px; font-style:normal; color:#715c43; }
.stage-dark .finale-dialogue { top:43%; bottom:auto; transform:translate(-50%,-50%); }.stage-dark .finale-dialogue > p { color:#c3b397; }
.finale-marker { position:absolute; z-index:7; top:31px; left:32px; color:#bba27c91; font:9px Georgia,serif; letter-spacing:3px; }
.finale-skip { position:absolute; z-index:8; right:24px; top:20px; display:flex; align-items:center; justify-content:center; gap:20px; min-height:44px; padding:9px 15px; border:1px solid #9c825851; border-radius:2px; background:#050b08cc; color:#c9b998; cursor:pointer; font:11px system-ui; letter-spacing:1px; }.finale-skip:hover { background:#20271ae8; border-color:#bfa273; }.finale-skip:focus-visible { outline:2px solid #e5c995; outline-offset:4px; }
.finale-progress { position:absolute; z-index:8; left:0; bottom:0; width:100%; height:2px; appearance:none; border:0; background:#b69a6530; color:#b69a65; opacity:.65; }.finale-progress::-webkit-progress-bar { background:#b69a6530; }.finale-progress::-webkit-progress-value { background:#b69a65; }.finale-progress::-moz-progress-bar { background:#b69a65; }
.finale-loose-cards { position:absolute; z-index:2; inset:0; opacity:var(--cards-opacity); pointer-events:none; transform:translateY(var(--cards-drift)); }
.finale-loose-cards i { position:absolute; width:44px; height:65px; top:47%; left:39%; border:3px solid #9f8b63; border-radius:2px; background:repeating-linear-gradient(45deg,#34241c 0 3px,#59402a 3px 4px); transform:rotate(-28deg); box-shadow:0 6px 15px #0009; }.finale-loose-cards i:nth-child(2) { left:52%; top:43%; transform:rotate(18deg); }.finale-loose-cards i:nth-child(3) { left:62%; top:52%; transform:rotate(44deg); }
.motion-reduced .finale-dialogue { bottom:11dvh; }.motion-reduced .finale-loose-cards { display:none; }
@media(max-width:600px) { .finale-actor { width:125vw; max-width:none; height:101dvh; bottom:-3dvh; }.finale-dialogue { width:88%; bottom:11dvh; }.finale-dialogue > p { font-size:26px; letter-spacing:1px; line-height:1.75; }.finale-speaker { margin-bottom:11px; font-size:10px; }.finale-standing { margin-top:13px; font-size:12px; }.finale-marker { left:17px; top:31px; font-size:8px; letter-spacing:2px; }.finale-skip { top:16px; right:15px; padding:8px 12px; gap:12px; }.finale-loose-cards i { width:32px; height:48px; }.stage-dark .finale-dialogue { top:45%; } }
@media(max-height:500px) and (min-width:601px) { .finale-actor { height:135dvh; bottom:-27dvh; }.finale-dialogue { bottom:9dvh; }.finale-dialogue > p { font-size:28px; }.finale-speaker { margin-bottom:4px; }.finale-standing { margin-top:6px; }.finale-marker { top:25px; }.finale-skip { top:12px; } }
</style>
