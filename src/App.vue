<script setup>
import { ref, computed, defineAsyncComponent, nextTick, onMounted, onBeforeUnmount } from 'vue'
import ClassicGame from './modes/classic/ClassicGame.vue'
import OpeningScreen from './components/OpeningScreen.vue'
import RunEntryChoice from './components/RunEntryChoice.vue'
import { describeSavedRun, RUN_KEYS } from './composables/runEntry.js'
import { initAudio, prepareBgm, unlockBgm, playBgm, pauseBgm, applyAudioSettings } from './composables/useAudio.js'
import { readRun, writeRun } from './composables/runStorage.js'

const loadDuel = () => import('./modes/duel/DuelGame.vue')
const DuelGame = defineAsyncComponent(loadDuel)
const readMode = () => ['classic', 'duel'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'menu'
const mode = ref(readMode())
const hasEntered = ref(false)
const gameReady = ref(false)
const audioSettings = ref(readRun('balatro.settings') || {})
const content = ref(null), gameRef = ref(null), entryChoice = ref(null)
const currentGame = computed(() => mode.value === 'classic' ? ClassicGame : DuelGame)
function setOpeningSound(enabled) {
  audioSettings.value = { ...audioSettings.value, sfxMuted: !enabled, bgmMuted: !enabled }
  applyAudioSettings(audioSettings.value)
  writeRun('balatro.settings', audioSettings.value)
}
function startOpening() {
  initAudio()
  unlockBgm('main')
  unlockBgm('duel')
}
function chooseOpeningMode(chosen) {
  if (!['classic', 'duel'].includes(chosen)) return
  mode.value = chosen
  entryChoice.value = describeSavedRun(chosen, readRun(RUN_KEYS[chosen]))
  history.replaceState(null, '', `${location.pathname}${location.search}#${chosen}`)
  if (chosen === 'duel') loadDuel().catch(() => {})
}
async function prepareOpeningReveal() {
  if (mode.value === 'duel') await loadDuel()
  gameReady.value = true
  await nextTick()
  // Allow the async component and its layout to paint beneath the full card.
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}
function completeOpening() {
  gameReady.value = true
  hasEntered.value = true
  initAudio()
  if (mode.value === 'duel') playBgm('duel')
  if (!entryChoice.value) focusHand()
}
function focusHand() {
  nextTick(() => content.value?.querySelector('.hand-cards button, .hand button')?.focus({ preventScroll: true }))
}
function enterRun(fresh) {
  if (fresh) {
    const startNewRun = gameRef.value?.startNewRun
    if (!startNewRun || startNewRun() === false) return
  }
  entryChoice.value = null
  focusHand()
}
function onHashChange() {
  const next = readMode()
  // A mode belongs to the current run. URL changes cannot swap it mid-game.
  if (hasEntered.value) {
    history.replaceState(null, '', `${location.pathname}${location.search}#${mode.value}`)
    return
  }
  mode.value = next
}
addEventListener('hashchange', onHashChange)
onMounted(() => { prepareBgm('main'); prepareBgm('duel') })
onBeforeUnmount(() => { removeEventListener('hashchange', onHashChange); pauseBgm() })
</script>

<template>
  <OpeningScreen v-if="!hasEntered" :soundEnabled="!audioSettings.sfxMuted" :prepare-reveal="prepareOpeningReveal" @sound="setOpeningSound" @start="startOpening" @choose="chooseOpeningMode" @complete="completeOpening" />
  <div ref="content" class="game-shell" :inert="!hasEntered || !!entryChoice">
    <KeepAlive>
      <component v-if="gameReady && mode !== 'menu'" ref="gameRef" :is="currentGame" :key="mode" embedded :ready="hasEntered && !entryChoice" />
    </KeepAlive>
  </div>
  <RunEntryChoice v-if="hasEntered && entryChoice" :run="entryChoice" @continue="enterRun(false)" @new="enterRun(true)" />
</template>

<style scoped>
.game-shell { position: relative; z-index: 0; isolation: isolate; min-height: 100dvh; }
</style>
