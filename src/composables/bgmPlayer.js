// Preload during the cover and unlock the same media element on the start click.
export function createBgmPlayer(base, getVolume, AudioClass = globalThis.Audio) {
  const tracks = new Map()
  let active = null, activeKey = null, request = 0
  function prepare(key) {
    if (!tracks.has(key)) {
      const source = key === 'duel' ? 'duel.mp3?v=night-waltz-v1'
        : key === 'main' ? 'main.wav?v=electronic-v1' : `${key}.wav`
      const audio = new AudioClass(`${base}audio/bgm/${source}`)
      audio.preload = 'auto'
      audio.loop = key !== 'win' && key !== 'lose'
      audio.volume = 0
      audio.load()
      tracks.set(key, audio)
    }
    return tracks.get(key)
  }
  return {
    prepare,
    unlock(key) {
      const audio = prepare(key)
      if (audio === active) return
      audio.volume = 0
      // Keep it playing silently through the transition. No delayed pause can
      // race with skip/reveal, and playback permission belongs to this element.
      audio.play().catch(() => {})
    },
    play(key) {
      if (key === activeKey && active && !active.paused) return
      const audio = prepare(key)
      for (const other of tracks.values()) if (other !== audio) other.pause()
      active = audio
      activeKey = key
      const id = ++request
      audio.currentTime = 0
      audio.volume = getVolume()
      audio.play().catch(() => { if (request === id) activeKey = null })
    },
    applyVolume() { if (active) active.volume = getVolume() },
    pause() {
      ++request
      for (const audio of tracks.values()) audio.pause()
    },
  }
}
