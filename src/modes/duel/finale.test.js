import test from 'node:test'
import assert from 'node:assert/strict'
import { finaleAt, finaleDuration } from './finale.js'

test('each outcome owns a finite ending and a distinct opening line', () => {
  const expected = [
    ['bot', 5600, '永远留在这吧。'],
    ['you', 4600, '这一桌，你赢了。'],
    ['draw', 2800, '谁都没能带走这张牌桌。'],
  ]
  for (const [outcome, duration, line] of expected) {
    assert.equal(finaleDuration(outcome), duration)
    const scene = finaleAt(outcome)
    assert.equal(scene.outcome, outcome)
    assert.equal(scene.line, line)
    assert.equal(scene.complete, false)
    assert.equal(scene.progress, 0)
    assert.equal(finaleAt(outcome, duration).complete, true)
  }
})

test('the losing ending speaks first, reaches once, covers the screen, then speaks in darkness', () => {
  for (const [time, stage, progress] of [[0, 'stare', 0], [1399, 'stare', 1399 / 1400], [1400, 'prepare', 0], [1675, 'prepare', .5], [1950, 'reach', 0], [2525, 'reach', .5], [3100, 'seal', 0], [3325, 'seal', .5], [3550, 'dark', 0], [4575, 'dark', .5]]) {
    const scene = finaleAt('bot', time)
    assert.equal(scene.stage, stage)
    assert.equal(scene.stageProgress, progress)
  }
  assert.equal(finaleAt('bot', 3549).line, '永远留在这吧。')
  assert.equal(finaleAt('bot', 3550).line, '牌桌还在等你。')
  assert.equal(finaleAt('bot', 1950).effects.approach, 0)
  assert.equal(finaleAt('bot', 3100).effects.approach, 1)
  assert.equal(finaleAt('bot', 3550).effects.cover, 1, 'the independent full-screen veil is closed before the dark scene')
})

test('winning and tied endings never enter a reaching or cover stage', () => {
  for (const outcome of ['you', 'draw']) {
    for (let elapsed = 0; elapsed <= finaleDuration(outcome); elapsed += 10) {
      assert.ok(!['reach', 'seal', 'dark'].includes(finaleAt(outcome, elapsed).stage))
      assert.equal(finaleAt(outcome, elapsed).effects.approach, 0)
      assert.equal(finaleAt(outcome, elapsed).effects.cover, 0)
    }
  }
  assert.equal(finaleAt('you', 1500).stage, 'retreat')
  assert.equal(finaleAt('you', 3100).stage, 'resolve')
  assert.equal(finaleAt('you', 3100).line, '记住这次。下一次，我还在。')
  assert.equal(finaleAt('draw', 1350).stage, 'restore')
})

test('invalid and negative elapsed times start safely, completed endings cannot loop', () => {
  for (const time of [-1, -Infinity, NaN, 'wrong', undefined, null]) assert.equal(finaleAt('bot', time).elapsed, 0)
  for (const time of [5600, 999999, Infinity]) {
    const scene = finaleAt('bot', time)
    assert.equal(scene.elapsed, 5600)
    assert.equal(scene.stage, 'dark')
    assert.equal(scene.stageProgress, 1)
    assert.equal(scene.complete, true)
  }
})

test('skip immediately completes every ending at any stage without changing the outcome', () => {
  for (const outcome of ['you', 'bot', 'draw']) {
    for (const elapsed of [0, 1500, 3000]) {
      const scene = finaleAt(outcome, elapsed, { skipped: true })
      assert.equal(scene.outcome, outcome)
      assert.equal(scene.elapsed, finaleDuration(outcome))
      assert.equal(scene.complete, true)
    }
  }
})

test('reduced motion uses one short static scene and retains both complete lines', () => {
  for (const outcome of ['you', 'bot', 'draw']) {
    const scene = finaleAt(outcome, 100, { reducedMotion: true })
    assert.equal(finaleDuration(outcome, { reducedMotion: true }), 500)
    assert.equal(scene.stage, 'still')
    assert.equal(scene.line, scene.openingLine)
    assert.ok(scene.closingLine)
    assert.equal(scene.complete, false)
    assert.deepEqual(scene.effects, { opening: 0, approach: 0, cover: 0, retreat: 0, dim: 0 })
    assert.equal(finaleAt(outcome, 500, { reducedMotion: true }).complete, true)
  }
})

test('unknown outcomes use the neutral ending and calls cannot affect other scenes', () => {
  for (const outcome of ['missing', 'constructor', '__proto__', undefined, null]) {
    assert.deepEqual(finaleAt(outcome), finaleAt('draw'))
    assert.equal(finaleDuration(outcome), finaleDuration('draw'))
  }
  const modified = finaleAt('you', 4000)
  modified.line = 'changed'
  modified.duration = 1
  assert.equal(finaleAt('you', 4000).line, '记住这次。下一次，我还在。')
  assert.equal(finaleDuration('you'), 4600)
})
