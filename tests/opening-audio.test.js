import test from 'node:test'
import assert from 'node:assert/strict'
import { createOpeningAudio } from '../src/composables/openingAudio.js'

function setup() {
  const instances = []
  class Audio {
    constructor(src) { this.src = src; this.paused = true; this.calls = 0; instances.push(this) }
    play() { this.calls++; if (this.reject) return Promise.reject(Error('autoplay')); this.paused = false; return Promise.resolve() }
    pause() { this.paused = true }
    removeAttribute() { this.src = '' }
    load() {}
  }
  const controller = createOpeningAudio('/joker/', () => {}, Audio)
  return { controller, cover: instances[0], grin: instances[1] }
}
const settle = () => new Promise(resolve => setImmediate(resolve))

test('cover ambience loops while waiting, then cuts without reaching the end', async () => {
  const {controller, cover} = setup()
  controller.resume()
  await settle()
  assert.equal(cover.loop, true)
  assert.equal(cover.paused, false)
  cover.currentTime = 2
  controller.start()
  await new Promise(resolve => setTimeout(resolve, 15))
  assert.equal(cover.paused, true)
  controller.dispose()
})

test('blocked cover playback can retry, but cannot restart after beginning', async () => {
  const {controller, cover} = setup()
  cover.reject = true
  controller.resume()
  await settle()
  assert.equal(controller.blocked, true)
  cover.reject = false
  controller.resume()
  await settle()
  assert.equal(controller.blocked, false)
  controller.start()
  controller.resume()
  await new Promise(resolve => setTimeout(resolve, 15))
  assert.equal(cover.calls, 2)
  assert.equal(cover.paused, true)
  controller.dispose()
})

test('muting suppresses the grin and cleanup stops both sounds', async () => {
  const {controller, cover, grin} = setup()
  controller.setEnabled(false)
  controller.grin()
  assert.equal(grin.calls, 0)
  controller.setEnabled(true)
  await settle()
  controller.start()
  controller.grin()
  assert.equal(grin.calls, 1)
  controller.dispose()
  assert.equal(cover.paused, true)
  assert.equal(grin.paused, true)
  assert.equal(cover.src, '')
  controller.resume()
  controller.grin()
  assert.equal(grin.calls, 1)
})

test('pending cover playback cannot survive skipping or disposal', async () => {
  const {controller, cover} = setup()
  controller.resume()
  controller.start()
  controller.dispose()
  await settle()
  assert.equal(cover.paused, true)
})
