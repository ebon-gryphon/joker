<template>
  <section ref="root" class="opening-screen" aria-label="小丑牌开场">
    <canvas width="1672" height="941" role="img" aria-label="黑暗中的小丑与牌桌，点击开始游戏揭开牌局"></canvas>
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
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { mountOpening } from '../composables/useOpening.js'
const props = defineProps({ soundEnabled: { type: Boolean, default: true } })
const emit = defineEmits(['start', 'complete', 'sound'])
const root = ref(null), base = import.meta.env.BASE_URL
let dispose
onMounted(() => { dispose = mountOpening(root.value, { onStart: () => emit('start'), onComplete: () => emit('complete'), initialSound: props.soundEnabled, onSoundChange: value => emit('sound', value) }) })
onBeforeUnmount(() => dispose?.())
</script>
<style scoped>
.opening-screen { position: fixed; inset: 0; z-index: 500; background: #000; color: #e7d5ad; }
.opening-screen.revealing { background: transparent; }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
.opening-brand { position: absolute; top: 7%; left: 6%; display: grid; text-align: center; gap: 7px; }
.opening-brand span { font: 48px Georgia, serif; letter-spacing: 9px; }
.opening-brand small { font-size: 12px; color: #aa926c; letter-spacing: 6px; }
.start-game { position: absolute; left: 50%; bottom: 16%; transform: translateX(-50%); min-width: 190px; padding: 15px 34px; background: #170b09e8; border: 1px solid #a8834c; outline: 1px solid #624c2d; outline-offset: 4px; color: #edd4a4; letter-spacing: 5px; font-size: 17px; cursor: pointer; }
.start-game:hover { background: #471712; border-color: #d6ac65; }
.start-game:disabled { opacity: .5; cursor: wait; }
.opening-controls { position: absolute; bottom: 25px; right: 30px; display: flex; gap: 18px; }
.opening-controls button { color: #bba780; background: #080807aa; border: 0; padding: 8px; cursor: pointer; font-size: 12px; }
.opening-screen:has(canvas[data-phase="retreat"]) .opening-brand,
.opening-screen:has(canvas[data-phase="dark-pause"]) .opening-brand,
.opening-screen:has(canvas[data-phase="spin"]) .opening-brand,
.revealing .opening-brand { opacity: 0; transition: opacity .3s; }
@media (max-width: 600px) { .opening-brand span { font-size: 30px; } .opening-controls { right: 12px; gap: 5px; } }
</style>
