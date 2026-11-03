<template>
  <section ref="root" class="opening-screen" data-scene-mode="cover" aria-label="小丑牌开场" :style="{ '--table-felt': `url(${base}felt.svg)`, '--table-source': `url(${base}opening/source.jpg)` }">
    <div class="scene-clip">
      <div class="scene-rig">
        <div class="scene-camera">
          <div class="scene-world">
            <div data-choice-plane class="scene-table">
              <svg class="table-felt" width="1672" height="4000" aria-hidden="true">
                <defs>
                  <pattern id="opening-felt-texture" patternUnits="userSpaceOnUse" width="400" height="70">
                    <image :href="`${base}opening/source.jpg`" x="-600" y="-850" width="1672" height="941" />
                  </pattern>
                  <radialGradient id="opening-table-shade"><stop offset="0" stop-color="#10221d" stop-opacity="0" /><stop offset="1" stop-color="#010806" stop-opacity=".55" /></radialGradient>
                </defs>
                <rect width="1672" height="100%" fill="url(#opening-felt-texture)" />
                <rect width="1672" height="100%" fill="url(#opening-table-shade)" />
              </svg>
              <OpeningTableProps />
              <section data-mode-table class="mode-table" hidden inert aria-label="选择游戏模式">
                <button data-mode-card="classic" class="mode-card classic-card" aria-label="选择经典闯关，12 关逐步构筑">
                  <div class="mode-card-face">
                    <img :src="`${base}jokers/jester.png`" alt="" draggable="false" />
                    <div class="mode-card-caption"><strong>经典闯关</strong><span>12 关 · 逐步构筑</span></div>
                  </div>
                </button>
                <button data-mode-card="duel" class="mode-card duel-card" aria-label="选择明牌对决，7 轮共享商店">
                  <div class="mode-card-face">
                    <img :src="`${base}jokers/dynasty.png`" alt="" draggable="false" />
                    <div class="mode-card-caption"><strong>明牌对决</strong><span>7 轮 · 共享商店</span></div>
                  </div>
                </button>
              </section>
              <canvas data-choice-dust class="choice-dust" hidden aria-hidden="true"></canvas>
            </div>
            <div class="original-table-rail" aria-hidden="true"></div>
          </div>
        </div>
        <div class="scene-portrait">
          <canvas data-cover-canvas width="1672" height="941" role="img" aria-label="黑暗中的小丑与牌桌，点击开始游戏揭开牌局"></canvas>
        </div>
        <OpeningCoverProps class="cover-props-layer" />
      </div>
    </div>
    <canvas data-flight-canvas class="flight-canvas" hidden aria-hidden="true"></canvas>
    <div class="choice-invitation" aria-hidden="true"><span>小丑的牌桌</span><h1>选一张，开一局</h1></div>
    <p data-choice-status class="choice-status" aria-live="polite">小丑在等你选牌</p>
    <button data-choice-back class="choice-back" disabled>↖ 返回封面</button>
    <div class="opening-brand"><span>JOKER</span><small>小 丑 牌</small></div>
    <button class="start-game" disabled>载入中</button>
    <div class="opening-controls">
      <button data-pause disabled>暂停呼吸</button>
      <button data-sound aria-pressed="true">声音：开</button>
      <button data-skip hidden>跳过开场 ↗</button>
    </div>
    <span data-status class="sr-only" aria-live="polite">等待开场</span>
    <img v-for="name in ['source', 'closed', 'plate', 'grin']" :key="name" :src="`${base}opening/${name}.jpg`" v-bind="{ [`data-${name}`]: '' }" hidden alt="" />
  </section>
</template>
<script setup>
import { ref, onMounted, onActivated, onDeactivated, onBeforeUnmount } from 'vue'
import { mountOpening } from '../composables/useOpening.js'
import OpeningTableProps from './OpeningTableProps.vue'
import OpeningCoverProps from './OpeningCoverProps.vue'
const props = defineProps({ soundEnabled: { type: Boolean, default: true }, prepareReveal: { type: Function, default: () => {} } })
const emit = defineEmits(['start', 'complete', 'sound', 'choose', 'reveal'])
const root = ref(null), base = import.meta.env.BASE_URL
let dispose
function resume() {
  if (!dispose) dispose = mountOpening(root.value, { onStart: () => emit('start'), onComplete: () => emit('complete'), initialSound: props.soundEnabled, onSoundChange: value => emit('sound', value), onModeSelect: mode => emit('choose', mode), onReveal: () => { emit('reveal'); return props.prepareReveal?.() } })
}
function pause() { dispose?.(); dispose = null }
onMounted(resume)
onActivated(resume)
onDeactivated(pause)
onBeforeUnmount(pause)
</script>
<style scoped>
.opening-screen { --table-progress: 0; position: fixed; inset: 0; width: 100vw; z-index: 500; overflow: clip; isolation: isolate; background: #000; color: #e7d5ad; }
.opening-screen.revealing { background: transparent; }
.scene-clip { position: absolute; inset: 0; }
.scene-rig { position: absolute; left: 50%; top: 50%; width: 1672px; height: 941px; isolation: isolate; pointer-events: none; }
.scene-camera, .scene-world { position: absolute; inset: 0; width: 1672px; height: 941px; transform-style: preserve-3d; pointer-events: none; }
.scene-camera { z-index: 0; }
.scene-world { will-change: transform; }
.scene-portrait { position: absolute; inset: 0; z-index: 1; width: 1672px; height: 941px; transform-origin: 836px 778px; clip-path: inset(0 0 163px 0); mask-image: linear-gradient(to bottom, #000 0, #000 893px, transparent 941px), linear-gradient(to right, transparent, #000 64px, #000 1608px, transparent); mask-composite: intersect; pointer-events: none; will-change: transform; }
canvas { position: absolute; inset: 0; width: 1672px; height: 941px; pointer-events: none; }
.flight-canvas { z-index: 5; width: 100%; height: 100%; }
.flight-canvas[hidden] { display: none; }
.cover-props-layer { z-index: 2; }
.opening-screen[data-choice-phase='idle'] .scene-portrait { clip-path: none; }
.opening-screen.revealing .scene-clip { visibility: hidden; }
.scene-table { position: absolute; left: 0; top: 778px; width: 1672px; height: var(--table-depth, 4000px); background: #091a17; transform-origin: 0 0; transform: rotateX(90deg); transform-style: preserve-3d; }
.table-felt { position: absolute; inset: 0; height: 100%; pointer-events: none; }
/* The rail and physical props share the table plane. Only the joker remains
   screen-facing; the cover's prop cutouts bridge its initial painted viewpoint. */
.original-table-rail { position: absolute; top: 778px; left: 0; width: 1672px; height: 53px; background: var(--table-source) 0 -778px / 1672px 941px no-repeat; clip-path: polygon(0 0,100% 0,100% 50%,84% 78%,66% 95%,50% 100%,30% 94%,12% 76%,0 48%); transform-origin: 0 0; transform: matrix3d(1,0,0,0, 2.718699187,0,2.276422764,.003252033, 0,-1,0,0, 0,0,0,1); pointer-events: none; }
.opening-screen[data-scene-mode='original-transition'] .scene-portrait { clip-path: none; }
.opening-screen[data-scene-mode='original-transition'] .original-table-rail { display: none; }
.mode-table { display: contents; }
.mode-table[hidden], .choice-dust[hidden] { display: none; }
.mode-card { --card-rotation: -6deg; position: absolute; left: 490px; top: var(--mode-card-depth, 300px); width: 280px; height: 420px; padding: 0; border: 0; border-radius: 14px; background: transparent; color: inherit; cursor: pointer; pointer-events: auto; transform: translateZ(4px) rotate(var(--card-rotation)); transform-origin: 50% 50%; -webkit-tap-highlight-color: transparent; }
.duel-card { --card-rotation: 6deg; left: 890px; }
.mode-card-face { position: relative; overflow: hidden; width: 100%; height: 100%; border-radius: 14px; background: #bba375; outline: 2px solid #d7c28c77; box-shadow: 3px 12px 18px #0009, 0 2px 3px #0009; }
.mode-card-face img { display: block; width: 100%; height: 100%; object-fit: cover; user-select: none; }
.mode-card-caption { position: absolute; left: 8%; right: 8%; bottom: 6%; min-height: 23%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: 10px 4px; background: linear-gradient(135deg, #e5d0a9, #bfa578); border: 2px solid #4b3828; outline: 2px solid #d8c299; box-shadow: 0 0 0 4px #493824, 0 3px 9px #0008; color: #211d18; }
.mode-card-caption strong { font-size: 34px; letter-spacing: 2px; font-family: var(--font-display, Georgia, serif); }
.mode-card-caption span { font-size: 18px; letter-spacing: 1px; white-space: nowrap; }
.mode-card:focus-visible { outline: none; }
.mode-card:hover .mode-card-face, .mode-card:focus-visible .mode-card-face { outline: 4px solid #f2d18b; box-shadow: 0 0 24px #d5b46645, 3px 12px 18px #0009; }
.mode-card:disabled { cursor: default; }
.choice-invitation { position: absolute; z-index: 6; left: 50%; top: 7%; transform: translateX(-50%); text-align: center; white-space: nowrap; pointer-events: none; text-shadow: 0 2px 15px #000; transition: opacity .18s; }
.choice-invitation span { color: #ab976e; font-size: 11px; letter-spacing: 6px; }
.choice-invitation h1 { margin: 10px 0 0; font-size: clamp(21px, 3vw, 29px); font-weight: 400; letter-spacing: 4px; color: #ead6ac; }
.choice-status { position: absolute; z-index: 6; bottom: 5%; left: 50%; transform: translateX(-50%); width: 70%; pointer-events: none; color: #b3a17d; font-size: 12px; letter-spacing: 3px; margin: 0; text-align: center; text-shadow: 0 2px 8px #000; }
.choice-back { position: absolute; z-index: 7; left: 30px; bottom: 30px; padding: 9px 13px; color: #c5b18b; background: #0a100bd9; border: 1px solid #8d795044; border-radius: 3px; font-size: 12px; cursor: pointer; }
.choice-invitation, .choice-status, .choice-back { visibility: hidden; }
.opening-screen:is([data-choice-phase='choosing'], [data-choice-phase='picking']) :is(.choice-invitation, .choice-status, .choice-back) { visibility: visible; }
.opening-screen[data-choice-phase='picking'] .choice-invitation { opacity: 0; }
.choice-back:hover { border-color: #b69a66; color: #eed8ab; }
.choice-back:focus-visible, .opening-controls button:focus-visible, .start-game:focus-visible { outline: 2px solid #d9b56f; outline-offset: 4px; }
.choice-dust { inset: auto; transform-origin: 50% 50%; pointer-events: none; }
.opening-brand { position: absolute; z-index: 6; top: 7%; left: 6%; display: grid; text-align: center; gap: 7px; transition: opacity .25s; }
.opening-screen:is([data-choice-phase='table-in'], [data-choice-phase='choosing'], [data-choice-phase='picking'], [data-choice-phase='table-out']) .opening-brand { opacity: 0; pointer-events: none; }
.opening-brand span { font: 48px Georgia, serif; letter-spacing: 9px; }
.opening-brand small { font-size: 12px; color: #aa926c; letter-spacing: 6px; }
.start-game { position: absolute; z-index: 6; left: 50%; bottom: 16%; transform: translateX(-50%); min-width: 190px; padding: 15px 34px; background: #170b09e8; border: 1px solid #a8834c; outline: 1px solid #624c2d; outline-offset: 4px; color: #edd4a4; letter-spacing: 5px; font-size: 17px; cursor: pointer; }
.start-game:hover { background: #471712; border-color: #d6ac65; }
.start-game:disabled { opacity: .5; cursor: wait; }
.opening-controls { position: absolute; z-index: 7; bottom: 25px; right: 30px; display: flex; gap: 18px; }
.opening-screen:is([data-choice-phase='table-in'], [data-choice-phase='choosing'], [data-choice-phase='picking'], [data-choice-phase='table-out']) [data-pause] { display: none; }
.opening-controls button { color: #bba780; background: #080807aa; border: 0; padding: 8px; cursor: pointer; font-size: 12px; }
.opening-screen:is([data-opening-phase='covered'], [data-opening-phase='reveal']) .opening-controls { visibility: hidden; }
.opening-screen:has(canvas[data-phase="retreat"]) .opening-brand,
.opening-screen:has(canvas[data-phase="dark-pause"]) .opening-brand,
.opening-screen:has(canvas[data-phase="spin"]) .opening-brand,
.revealing .opening-brand { opacity: 0; transition: opacity .3s; }
@media (max-width: 600px) {
  .opening-brand span { font-size: 30px; }
  .opening-controls { right: 12px; gap: 5px; }
  .mode-card { left: 310px; width: 450px; height: 675px; }
  .duel-card { left: 920px; }
  .mode-card-caption strong { font-size: 46px; }
  .mode-card-caption span { font-size: 25px; }
  .choice-back { left: 12px; bottom: 26px; }
  .choice-invitation { top: 12%; }
  .choice-invitation h1 { font-size: 22px; }
  .choice-status { bottom: 18%; letter-spacing: 1px; }
}
@media (max-height: 580px) { .choice-invitation { top: 4%; } .choice-invitation span { display: none; } .choice-invitation h1 { font-size: 21px; } .choice-status { bottom: 2%; } }
@media (prefers-reduced-motion: reduce) { .opening-brand { transition: none; } }
</style>
