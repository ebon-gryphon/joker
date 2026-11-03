import test from 'node:test'
import assert from 'node:assert/strict'
import { readRun, writeRun } from '../src/composables/runStorage.js'

test('separate mode keys survive saving and malformed JSON is ignored', () => {
  const values = new Map()
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }
  assert.equal(writeRun('classic', { round: 2 }, storage), true)
  assert.equal(writeRun('duel', { round: 5 }, storage), true)
  assert.deepEqual(readRun('classic', storage), { round: 2 })
  assert.deepEqual(readRun('duel', storage), { round: 5 })
  values.set('classic', '{broken')
  assert.equal(readRun('classic', storage), null)
  assert.deepEqual(readRun('duel', storage), { round: 5 })
})

test('unavailable storage and quota errors never throw into gameplay', () => {
  const storage = { getItem() { throw Error('denied') }, setItem() { throw Error('quota') } }
  assert.equal(readRun('run', storage), null)
  assert.equal(writeRun('run', { round: 1 }, storage), false)
  assert.equal(writeRun('run', null, storage), false)
})
