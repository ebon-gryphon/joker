import { ref } from 'vue'

// 单例：所有组件共享同一份音频状态
const sfxVolume = ref(80)
const bgmVolume = ref(60)
const sfxMuted = ref(false)
const bgmMuted = ref(false)

let audioCtx = null
let sfxGainNode = null
const sfxCache = new Map()
let aiLoopSrc = null
let bgmAudio = null
let currentBgmKey = null
let bgmFadeFrame = 0
let bgmFade = 1

// 启动时从 localStorage 读取设置
;(function loadFromStorage() {
  try {
    const s = JSON.parse(localStorage.getItem('balatro.settings') || '{}')
    if (s.sfxVolume != null) sfxVolume.value = s.sfxVolume
    if (s.bgmVolume != null) bgmVolume.value = s.bgmVolume
    if (s.sfxMuted != null) sfxMuted.value = s.sfxMuted
    if (s.bgmMuted != null) bgmMuted.value = s.bgmMuted
  } catch {}
})()

// 必须在用户首次交互后调用（浏览器自动播放策略限制）
export function initAudio() {
  if (audioCtx) return
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    sfxGainNode = audioCtx.createGain()
    sfxGainNode.gain.value = sfxMuted.value ? 0 : sfxVolume.value / 100
    sfxGainNode.connect(audioCtx.destination)
  } catch {}
}

async function loadSfxBuffer(name) {
  if (sfxCache.has(name)) return sfxCache.get(name)
  if (!audioCtx) return null
  try {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '')
    const res = await fetch(`${base}/audio/sfx/${name}.wav`)
    if (!res.ok) return null
    const buf = await audioCtx.decodeAudioData(await res.arrayBuffer())
    sfxCache.set(name, buf)
    return buf
  } catch {
    return null
  }
}

export function playSfx(name) {
  if (!audioCtx || !sfxGainNode) return
  loadSfxBuffer(name).then(buf => {
    if (!buf) return
    const src = audioCtx.createBufferSource()
    src.buffer = buf
    src.connect(sfxGainNode)
    src.start()
  })
}

export function startAiLoop() {
  if (!audioCtx || !sfxGainNode) return
  loadSfxBuffer('ai-loop').then(buf => {
    if (!buf) return
    stopAiLoop()
    const src = audioCtx.createBufferSource()
    src.buffer = buf
    src.loop = true
    src.connect(sfxGainNode)
    src.start()
    aiLoopSrc = src
  })
}

export function stopAiLoop() {
  if (!aiLoopSrc) return
  try { aiLoopSrc.stop() } catch {}
  aiLoopSrc = null
}

export function playBgm(key, { fadeIn = 0 } = {}) {
  if (currentBgmKey === key) return
  cancelAnimationFrame(bgmFadeFrame)
  bgmFade = fadeIn ? 0 : 1
  if (bgmAudio) {
    bgmAudio.pause()
    bgmAudio.src = ''
    bgmAudio = null
  }
  currentBgmKey = key
  const base = import.meta.env.BASE_URL.replace(/\/$/, '')
  // Bust the previous main-track cache after the approved music replacement.
  const revision = key === 'main' ? '?v=electronic-v1' : ''
  const audio = new Audio(`${base}/audio/bgm/${key}.wav${revision}`)
  audio.loop = key !== 'win' && key !== 'lose'
  audio.volume = bgmMuted.value ? 0 : bgmVolume.value / 100 * bgmFade
  bgmAudio = audio
  audio.play().then(() => {
    if (!fadeIn || bgmAudio !== audio) return
    const started = performance.now()
    function fade(now) {
      if (bgmAudio !== audio) return
      bgmFade = Math.min(1, (now - started) / fadeIn)
      audio.volume = bgmMuted.value ? 0 : bgmVolume.value / 100 * bgmFade
      if (bgmFade < 1) bgmFadeFrame = requestAnimationFrame(fade)
    }
    bgmFadeFrame = requestAnimationFrame(fade)
  }).catch(() => { if (bgmAudio === audio) currentBgmKey = null })
}

export function applyAudioSettings(s) {
  if (s.sfxVolume != null) sfxVolume.value = s.sfxVolume
  if (s.bgmVolume != null) bgmVolume.value = s.bgmVolume
  if (s.sfxMuted != null) sfxMuted.value = s.sfxMuted
  if (s.bgmMuted != null) bgmMuted.value = s.bgmMuted
  if (sfxGainNode) sfxGainNode.gain.value = sfxMuted.value ? 0 : sfxVolume.value / 100
  if (bgmAudio) bgmAudio.volume = bgmMuted.value ? 0 : bgmVolume.value / 100 * bgmFade
}

export function useAudio() {
  return { sfxVolume, bgmVolume, sfxMuted, bgmMuted, initAudio, playSfx, startAiLoop, stopAiLoop, playBgm, applyAudioSettings }
}
