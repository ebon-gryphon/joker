import test from 'node:test'
import assert from 'node:assert/strict'
import { createBgmPlayer } from '../src/composables/bgmPlayer.js'

function setup() {
  const tracks = []
  let volume = .6
  class Audio {
    constructor(src) { this.src = src; this.paused = true; this.currentTime = 0; tracks.push(this) }
    load() { this.loaded = true }
    play() { this.paused = false; return this.pending ?? Promise.resolve() }
    pause() { this.paused = true }
  }
  const player = createBgmPlayer('/joker/', () => volume, Audio)
  return {player, tracks, volume: v => { volume = v; player.applyVolume() }}
}

test('preloads without playing, unlocks silently, and starts on reveal without waiting for ended', () => {
  const {player, tracks} = setup()
  player.prepare('main')
  const main = tracks[0]
  assert.equal(main.loaded, true)
  assert.equal(main.paused, true)
  player.unlock('main')
  assert.equal(main.volume, 0)
  main.currentTime = 4.75
  player.play('main')
  assert.equal(tracks.length, 1)
  assert.equal(main.currentTime, 0)
  assert.equal(main.paused, false)
  assert.equal(main.volume, .6)
  assert.equal(main.loop, true)
})

test('immediate skip survives pending unlock and mute changes', async () => {
  const {player, tracks, volume} = setup()
  const main = player.prepare('main')
  let resolve
  main.pending = new Promise(r => { resolve = r })
  player.unlock('main')
  volume(0)
  player.play('main')
  resolve()
  await Promise.resolve()
  assert.equal(main.paused, false)
  assert.equal(main.volume, 0)
  volume(.35)
  assert.equal(main.volume, .35)
  assert.equal(tracks.length, 1)
})

test('switching phase stops prior music and only ambient tracks loop', () => {
  const {player, tracks} = setup()
  player.play('main')
  player.play('shop')
  assert.equal(tracks[0].paused, true)
  assert.equal(tracks[1].loop, true)
  player.play('win')
  assert.equal(tracks[1].paused, true)
  assert.equal(tracks[2].loop, false)
})
