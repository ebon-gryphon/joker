import test from 'node:test'
import assert from 'node:assert/strict'
import { frameAt, resultMotion } from './resultMotion.js'

test('outcome moods select separate atlas rows and finite gesture timings', () => {
  const expected = [
    ['smug', 'laugh', 0, 1280],
    ['irked', 'shrug', 1, 1360],
    ['amused', 'beckon', 2, 1560],
  ]
  for (const [mood, name, row, duration] of expected) {
    const motion = resultMotion(mood)
    assert.equal(motion.name, name)
    assert.equal(motion.row, row)
    assert.equal(motion.duration, duration)
    assert.equal(motion.duration, motion.frames.length * motion.frameMs)
    assert.deepEqual([...new Set(motion.frames)].sort(), [0, 1, 2, 3], 'each gesture uses its four poses')
  }
})

test('a retort uses its own gesture regardless of the round outcome', () => {
  const retort = resultMotion('smug', 'retort')
  assert.deepEqual(retort, { name: 'retort', row: 3, frames: [0, 1, 2, 3], frameMs: 300, duration: 1200 })
  for (const mood of ['irked', 'amused', undefined]) assert.deepEqual(resultMotion(mood, 'retort'), retort)
})

test('an explicit beckon overrides the round outcome mood', () => {
  const beckon = resultMotion('amused')
  for (const mood of ['smug', 'irked', 'amused', undefined]) {
    assert.deepEqual(resultMotion(mood, 'beckon'), beckon)
  }
})

test('unknown moods and actions use a neutral outcome gesture', () => {
  const neutral = resultMotion('amused')
  for (const mood of ['missing', 'constructor', '__proto__', undefined, null]) {
    assert.deepEqual(resultMotion(mood), neutral)
  }
  assert.deepEqual(resultMotion('amused', 'missing'), neutral)
})

test('frame boundaries follow the gesture sequence and hold the last pose', () => {
  for (const mood of ['smug', 'irked', 'amused']) {
    for (const action of ['outcome', 'retort']) {
      const motion = resultMotion(mood, action)
      for (let index = 0; index < motion.frames.length; index++) {
        assert.equal(frameAt(motion, index * motion.frameMs), motion.frames[index])
        assert.equal(frameAt(motion, (index + 1) * motion.frameMs - 0.01), motion.frames[index])
      }
      const last = motion.frames.at(-1)
      assert.equal(frameAt(motion, motion.duration), last)
      assert.equal(frameAt(motion, motion.duration * 1000), last, 'completed motion never loops')
      assert.equal(frameAt(motion, Infinity), last)
    }
  }
})

test('negative and invalid elapsed times safely select the opening pose', () => {
  const motion = resultMotion('smug')
  for (const elapsed of [-1, -Infinity, NaN, 'bad', null, undefined]) {
    assert.equal(frameAt(motion, elapsed), motion.frames[0])
  }
})

test('frame selection leaves its input untouched and each motion owns its sequence', () => {
  const motion = resultMotion('irked')
  Object.freeze(motion.frames)
  Object.freeze(motion)
  const before = JSON.stringify(motion)
  frameAt(motion, 700)
  assert.equal(JSON.stringify(motion), before)

  const changed = resultMotion('irked')
  changed.frames[0] = 3
  assert.equal(resultMotion('irked').frames[0], 0, 'one animation cannot change another animation')
})
