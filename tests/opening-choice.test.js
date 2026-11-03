import test from 'node:test'
import assert from 'node:assert/strict'
import { createOpeningChoice } from '../src/composables/openingChoice.js'

function fixture({ reduced = false } = {}) {
  let time = 0, frameId = 0
  const frames = new Map()
  const node = (extra = {}) => ({
    hidden: false, inert: false, disabled: false, dataset: {}, events: {}, attributes: {},
    style: { transform: '', transition: '', visibility: '', opacity: '', maskImage: '', setProperty(key, value) { this[key] = value } },
    addEventListener(event, callback, { signal } = {}) {
      this.events[event] = callback
      signal?.addEventListener('abort', () => { delete this.events[event] }, { once: true })
    },
    setAttribute(key, value) { this.attributes[key] = value },
    focus() { this.focused = true },
    getBoundingClientRect() { throw new Error('Dissolve positioning must use tabletop coordinates') },
    ...extra,
  })
  const plane = node({ clientWidth: 1600, clientHeight: 941 })
  const cards = ['classic', 'duel'].map((mode, index) => node({
    dataset: { modeCard: mode }, offsetLeft: 610 + index * 290, offsetTop: 360,
    offsetWidth: 180, offsetHeight: 270, offsetParent: plane,
  }))
  cards.forEach((card, index) => {
    card.style.transform = `translateZ(4px) rotate(${index ? 6 : -6}deg)`
    card.style.visibility = 'visible'
    card.style.maskImage = 'initial-card-mask'
  })
  const props = Array.from({ length: 7 }, (_, index) => node({ dataset: { physicalProp: String(index) } }))
  props.forEach((prop, index) => { prop.style.transform = `translate3d(${index * 110}px, 120px, 0)` })
  const table = node(), back = node(), status = node(), dust = node({ offsetParent: plane })
  const document = node({ hidden: false, defaultView: {
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId },
    cancelAnimationFrame(id) { frames.delete(id) },
    getComputedStyle() { return { transform: 'matrix(0.99, 0.1, -0.1, 0.99, 0, 0)' } },
  } })
  const elements = {
    '[data-mode-table]': table, '[data-choice-back]': back, '[data-choice-status]': status,
    '[data-choice-dust]': dust, '[data-choice-plane]': plane, '.start-game': node(),
  }
  const root = node({ ownerDocument: document, querySelector: key => elements[key],
    querySelectorAll: key => key === '[data-mode-card]' ? cards : key === '[data-physical-prop]' ? props : [],
  })
  const calls = [], effects = [], returnStates = [], cameraCalls = []
  const choice = createOpeningChoice(root, {
    reduced, onStart: () => calls.push('start'), onChoose: mode => calls.push(mode),
    onReturnToJoker: () => {
      calls.push('return')
      returnStates.push({ tableHidden: table.hidden, dustHidden: dust.hidden,
        effectsDisposed: effects.every(effect => effect.disposed), visibility: cards.map(card => card.style.visibility) })
    },
    onCancel: () => calls.push('cancel'), onCamera: value => cameraCalls.push(value),
    createDissolve(card, canvas, options) {
      const originalMask = card.style.maskImage
      const effect = {
        card, canvas, options, progress: [], disposed: false, disposeCount: 0,
        draw(progress) {
          assert.equal(this.disposed, false, 'A disposed dissolve cannot receive another frame')
          this.progress.push(progress)
          card.style.maskImage = `dissolved-at-${progress}`
          canvas.hidden = false
        },
        dispose() {
          if (this.disposed) return
          assert.equal(table.hidden, true, 'Hide the table before restoring the rejected card')
          this.disposed = true
          this.disposeCount++
          card.style.maskImage = originalMask
        },
      }
      effects.push(effect)
      return effect
    },
  })
  async function step(count) {
    for (let index = 0; index < count; index++) {
      time += 16
      const callbacks = [...frames.values()]
      frames.clear()
      callbacks.forEach(callback => callback(time))
      await Promise.resolve()
    }
  }
  async function open() { const opening = choice.open(); await step(100); return opening }
  return { choice, root, cards, props, table, back, dust, document, calls, effects, returnStates, cameraCalls, frames, step, open }
}

for (const chosenIndex of [0, 1]) {
  test(`choice ${chosenIndex}: dissolve only the rejected card in place before returning the camera`, async () => {
    const f = fixture()
    assert.equal(await f.open(), true)
    const chosen = f.cards[chosenIndex], rejected = f.cards[1 - chosenIndex]
    const chosenStyle = { ...chosen.style }, rejectedStyle = { ...rejected.style }
    const propStyles = f.props.map(prop => ({ ...prop.style }))
    chosen.events.click()
    rejected.events.click()
    f.back.events.click()
    assert.deepEqual(f.calls, ['start', chosen.dataset.modeCard])
    assert.equal(f.effects.length, 1, 'Ignore other choices while a card is dissolving')
    const effect = f.effects[0]
    assert.equal(effect.card, rejected)
    assert.equal(effect.canvas, f.dust)
    assert.deepEqual(effect.options, {
      box: { x: rejected.offsetLeft, y: 360, width: 180, height: 270 },
      direction: chosenIndex === 0 ? 1 : -1,
      transform: 'matrix(0.99, 0.1, -0.1, 0.99, 0, 0)',
    })
    assert.equal(f.table.inert, true)
    assert.equal(f.back.disabled, true)
    assert.equal(chosen.attributes['aria-pressed'], 'true')
    assert.equal(rejected.attributes['aria-pressed'], 'false')
    await f.step(35)
    assert.deepEqual(chosen.style, chosenStyle)
    assert.deepEqual(f.props.map(prop => ({ ...prop.style })), propStyles)
    assert.equal(rejected.style.transform, rejectedStyle.transform)
    assert.notEqual(rejected.style.maskImage, rejectedStyle.maskImage)
    assert.ok(effect.progress.at(-1) > 0 && effect.progress.at(-1) < 1)
    assert.equal(rejected.style.visibility, 'visible')
    const pausedProgress = [...effect.progress]
    f.document.hidden = true
    f.document.events.visibilitychange()
    await f.step(100)
    assert.deepEqual(effect.progress, pausedProgress)
    assert.equal(f.root.style['--table-progress'], '1')
    f.document.hidden = false
    f.document.events.visibilitychange()
    await f.step(50)
    assert.equal(f.root.dataset.choicePhase, 'picking')
    assert.equal(f.root.style['--table-progress'], '1', 'Do not move the camera before 1500 ms of visible dissolution')
    assert.ok(effect.progress.at(-1) < 1)
    await f.step(11)
    assert.equal(effect.progress.at(-1), 1)
    assert.equal(rejected.style.visibility, 'hidden')
    assert.equal(rejected.style.transform, rejectedStyle.transform)
    assert.equal(f.root.dataset.choicePhase, 'table-out')
    assert.equal(effect.disposed, false, 'Keep the rejected card dissolved during the return')
    assert.deepEqual(chosen.style, chosenStyle)
    assert.deepEqual(f.props.map(prop => ({ ...prop.style })), propStyles)
    await f.step(90)
    assert.equal(f.root.dataset.choicePhase, 'table-out')
    assert.equal(f.calls.includes('return'), false, 'Keep the full 1450 ms camera return')
    await f.step(4)
    assert.deepEqual(f.calls, ['start', chosen.dataset.modeCard, 'return'])
    assert.equal(f.root.dataset.choicePhase, 'idle')
    assert.equal(f.root.style['--table-progress'], '0')
    assert.deepEqual(rejected.style, rejectedStyle)
    assert.equal(effect.disposeCount, 1)
    assert.deepEqual(f.returnStates, [{ tableHidden: true, dustHidden: true, effectsDisposed: true, visibility: ['visible', 'visible'] }])
    assert.equal(f.frames.size, 0)
  })
}

test('cancel and disposal restore the table and prevent late camera or reveal callbacks', async () => {
  const f = fixture()
  await f.open()
  f.back.events.click()
  await f.step(70)
  assert.deepEqual(f.calls, ['start', 'cancel'])
  assert.equal(f.root.dataset.chosenMode, undefined)
  assert.equal(f.effects.length, 0)
  assert.equal(f.table.hidden, true)
  await f.open()
  const styles = f.cards.map(card => ({ ...card.style }))
  f.cards[0].events.click()
  await f.step(35)
  const effect = f.effects[0]
  assert.notEqual(f.cards[1].style.maskImage, styles[1].maskImage)
  f.choice.dispose()
  f.choice.dispose()
  const progressAfterDisposal = [...effect.progress]
  const cameraAfterDisposal = [...f.cameraCalls]
  await f.step(250)
  assert.equal(f.calls.includes('return'), false)
  assert.deepEqual(f.cards.map(card => ({ ...card.style })), styles)
  assert.deepEqual(effect.progress, progressAfterDisposal)
  assert.deepEqual(f.cameraCalls, cameraAfterDisposal)
  assert.equal(effect.disposeCount, 1)
  assert.equal(f.table.hidden, true)
  assert.equal(f.dust.hidden, true)
  assert.equal(f.root.style['--table-progress'], '0')
  assert.equal(f.frames.size, 0)
  assert.equal(f.cards[0].events.click, undefined)
  assert.equal(f.back.events.click, undefined)
  assert.equal(await f.choice.open(), false)
})

test('disposal during the camera return restores the hidden card without revealing the game', async () => {
  const f = fixture()
  await f.open()
  const rejectedStyle = { ...f.cards[0].style }
  f.cards[1].events.click()
  await f.step(110)
  assert.equal(f.root.dataset.choicePhase, 'table-out')
  assert.equal(f.cards[0].style.visibility, 'hidden')
  f.choice.dispose()
  const cameraAfterDisposal = [...f.cameraCalls]
  await f.step(200)
  assert.deepEqual(f.cards[0].style, rejectedStyle)
  assert.deepEqual(f.cameraCalls, cameraAfterDisposal)
  assert.equal(f.effects[0].disposeCount, 1)
  assert.equal(f.calls.includes('return'), false)
  assert.equal(f.frames.size, 0)
})

test('reduced motion preserves explicit choice and skips creating a dissolve', async () => {
  const f = fixture({ reduced: true })
  const styles = f.cards.map(card => ({ ...card.style }))
  await f.choice.open()
  assert.equal(f.root.dataset.choicePhase, 'choosing')
  assert.deepEqual(f.calls, ['start'])
  f.cards[0].events.click()
  assert.deepEqual(f.calls, ['start', 'classic', 'return'])
  assert.deepEqual(f.cards.map(card => ({ ...card.style })), styles)
  assert.equal(f.effects.length, 0)
  assert.equal(f.table.hidden, true)
  assert.equal(f.dust.hidden, true)
  assert.equal(f.frames.size, 0)
})

test('camera opening and cancellation ease gently over their full durations', async () => {
  const f = fixture()
  const quintic = value => 6 * value ** 5 - 15 * value ** 4 + 10 * value ** 3
  const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} differs from ${expected}`)
  const opening = f.choice.open()
  assert.equal(f.root.dataset.choicePhase, 'table-in')
  await f.step(1)
  await f.step(20)
  close(Number(f.root.style['--table-progress']), quintic(320 / 1450))
  await f.step(24)
  close(Number(f.root.style['--table-progress']), quintic(704 / 1450))
  assert.equal(f.table.inert, true)
  await f.step(50)
  assert.equal(await opening, true)
  assert.equal(f.root.dataset.choicePhase, 'choosing')
  assert.equal(f.table.inert, false)
  assert.equal(f.back.disabled, false)
  assert.ok(f.cards.every(card => !card.disabled))
  let prevented = false
  f.root.events.keydown({ key: 'Escape', preventDefault() { prevented = true } })
  assert.equal(prevented, true)
  await f.step(1)
  await f.step(20)
  close(Number(f.root.style['--table-progress']), 1 - quintic(320 / 1000))
  assert.equal(f.root.dataset.choicePhase, 'table-out')
  assert.equal(f.table.inert, true)
  await f.step(44)
  assert.deepEqual(f.calls, ['start', 'cancel'])
  assert.equal(f.root.dataset.choicePhase, 'idle')
  assert.equal(f.effects.length, 0)
})
