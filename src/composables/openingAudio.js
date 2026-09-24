// Separate opening ambience from transition effects so starting cuts only music.
export function createOpeningAudio(base, onBlocked = () => {}, AudioClass = globalThis.Audio) {
  const cover = new AudioClass(`${base}audio/bgm/opening.wav`)
  const grin = new AudioClass(`${base}audio/sfx/grin.wav`)
  cover.loop = true
  cover.volume = 0.8
  grin.volume = 1
  let idle = true, enabled = true, disposed = false, blocked = false, timer
  function playCover() {
    if (!idle || !enabled || disposed) return
    cover.volume = 0.8
    cover.play().then(() => {
      if (!idle || !enabled || disposed) cover.pause()
      blocked = false
      onBlocked(false)
    }).catch(() => { if (idle && !disposed) { blocked = true; onBlocked(true) } })
  }
  return {
    get blocked() { return blocked },
    resume: playCover,
    setEnabled(value) {
      enabled = value
      grin.muted = !value
      if (value) playCover()
      else cover.pause()
    },
    start() {
      idle = false
      cover.volume = 0.08
      timer = setTimeout(() => { cover.pause(); cover.volume = 0 }, 6)
    },
    grin() {
      if (!enabled || disposed) return
      grin.currentTime = 0
      grin.play().catch(() => {})
    },
    suspend() { cover.pause(); grin.pause() },
    dispose() {
      if (disposed) return
      disposed = true
      clearTimeout(timer)
      for (const audio of [cover, grin]) { audio.pause(); audio.removeAttribute('src'); audio.load() }
    },
  }
}
