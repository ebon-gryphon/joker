import { createCardDissolve } from './cardDissolve.js'

const clamp = value => Math.max(0, Math.min(1, value))
const cameraEase = value => { const t = clamp(value); return t * t * t * (t * (6 * t - 15) + 10) }

/** The mode choice is part of the cover's camera movement, before its reveal. */
export function createOpeningChoice(root, {
  reduced = false,
  onStart = () => {},
  onChoose = () => {},
  onReturnToJoker = () => {},
  onCancel = () => {},
  onCamera = () => {},
  createDissolve = createCardDissolve,
} = {}) {
  const table = root.querySelector('[data-mode-table]')
  const cards = [...root.querySelectorAll('[data-mode-card]')]
  const back = root.querySelector('[data-choice-back]')
  const status = root.querySelector('[data-choice-status]')
  const dust = root.querySelector('[data-choice-dust]')
  const document = root.ownerDocument
  const window = document.defaultView
  const listeners = new AbortController()
  let disposed = false
  let phase = 'idle'
  let cancelAnimation
  let previousFrame = 0
  let dissolveEffect
  let rejectedCard
  let rejectedVisibility

  function setPhase(value) {
    phase = value
    root.dataset.choicePhase = value
  }

  function camera(progress) {
    const value = clamp(progress)
    root.style.setProperty('--table-progress', String(value))
    onCamera(value)
  }

  function controls(enabled) {
    cards.forEach(card => { card.disabled = !enabled })
    back.disabled = !enabled
    table.inert = !enabled
    table.setAttribute('aria-busy', String(!enabled))
  }

  // Hidden tabs retain their place in the movement instead of jumping to its end.
  function animate(duration, draw) {
    if (disposed) return Promise.resolve(false)
    if (reduced || duration === 0) {
      draw(1)
      return Promise.resolve(true)
    }
    return new Promise(resolve => {
      let elapsed = 0
      let frame
      let finished = false
      previousFrame = 0
      function complete(result) {
        if (finished) return
        finished = true
        window.cancelAnimationFrame(frame)
        cancelAnimation = undefined
        resolve(result)
      }
      cancelAnimation = () => complete(false)
      function tick(now) {
        if (disposed) return complete(false)
        if (document.hidden) previousFrame = 0
        else {
          if (previousFrame) elapsed += Math.min(80, now - previousFrame)
          previousFrame = now
          draw(clamp(elapsed / duration))
          if (elapsed >= duration) return complete(true)
        }
        frame = window.requestAnimationFrame(tick)
      }
      draw(0)
      frame = window.requestAnimationFrame(tick)
    })
  }

  function reset() {
    setPhase('idle')
    camera(0)
    delete root.dataset.chosenMode
    controls(false)
    cards.forEach(card => card.setAttribute('aria-pressed', 'false'))
    table.hidden = true
    dissolveEffect?.dispose()
    dissolveEffect = undefined
    dust.hidden = true
    if (rejectedCard) {
      rejectedCard.style.visibility = rejectedVisibility
      rejectedCard = undefined
      rejectedVisibility = undefined
    }
  }

  async function open() {
    if (disposed || phase !== 'idle') return false
    onStart()
    delete root.dataset.chosenMode
    setPhase('table-in')
    table.hidden = false
    controls(false)
    status.textContent = '低头看看桌上的两张牌'
    if (!await animate(1450, value => camera(cameraEase(value)))) return false
    setPhase('choosing')
    controls(true)
    status.textContent = '选一张，小丑会为你开局'
    cards[0]?.focus({ preventScroll: true })
    return true
  }

  async function cancel() {
    if (disposed || phase !== 'choosing') return
    controls(false)
    setPhase('table-out')
    status.textContent = '回到小丑面前'
    if (!await animate(1000, value => camera(1 - cameraEase(value)))) return
    reset()
    onCancel()
    root.querySelector('.start-game')?.focus({ preventScroll: true })
  }

  function localBox(element, plane) {
    let x = 0
    let y = 0
    let current = element
    while (current && current !== plane) {
      x += current.offsetLeft
      y += current.offsetTop
      current = current.offsetParent
    }
    return { x, y, width: element.offsetWidth, height: element.offsetHeight }
  }

  async function choose(card) {
    if (disposed || phase !== 'choosing') return
    const mode = card.dataset.modeCard
    if (mode !== 'classic' && mode !== 'duel') return
    const rejected = cards.find(button => button !== card)
    const plane = root.querySelector('[data-choice-plane]') || rejected.offsetParent || rejected.parentElement
    const box = localBox(rejected, plane)
    const planeWidth = plane.clientWidth || plane.offsetWidth
    const baseTransform = window.getComputedStyle(rejected).transform
    rejectedCard = rejected
    rejectedVisibility = rejected.style.visibility
    controls(false)
    root.dataset.chosenMode = mode
    cards.forEach(button => button.setAttribute('aria-pressed', String(button === card)))
    setPhase('picking')
    status.textContent = mode === 'classic' ? '经典闯关，就由这张牌开始' : '明牌对决，小丑接受你的挑战'
    onChoose(mode)
    if (reduced) {
      rejected.style.visibility = 'hidden'
      camera(0)
      reset()
      onReturnToJoker()
      return
    }

    // Dissolve the real card in place, then let its own colored dust drift out.
    // The chosen card and all furniture keep their original tabletop anchors.
    const direction = box.x <= planeWidth - box.x - box.width ? -1 : 1
    dissolveEffect = createDissolve(rejected, dust, { box, direction, transform: baseTransform })
    if (!await animate(1500, value => dissolveEffect.draw(value))) return
    rejected.style.visibility = 'hidden'
    setPhase('table-out')
    status.textContent = '这张牌留给你，抬头看向小丑'
    if (!await animate(1450, value => camera(1 - cameraEase(value)))) return
    reset()
    onReturnToJoker()
  }

  cards.forEach(card => card.addEventListener('click', () => { void choose(card) }, { signal: listeners.signal }))
  back.addEventListener('click', () => { void cancel() }, { signal: listeners.signal })
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && phase === 'choosing') {
      event.preventDefault()
      void cancel()
    }
  }, { signal: listeners.signal })
  document.addEventListener('visibilitychange', () => { previousFrame = 0 }, { signal: listeners.signal })
  reset()

  function dispose() {
    if (disposed) return
    disposed = true
    cancelAnimation?.()
    listeners.abort()
    reset()
  }
  return { open, dispose }
}
