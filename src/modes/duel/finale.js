const ENDINGS = Object.freeze({
  bot: Object.freeze({
    duration: 5600,
    title: '小丑赢下了这一桌',
    quote: '永远留在这吧。',
    closing: '牌桌还在等你。',
    stages: Object.freeze([
      Object.freeze({ name: 'stare', start: 0, end: 1400 }),
      Object.freeze({ name: 'prepare', start: 1400, end: 1950 }),
      Object.freeze({ name: 'reach', start: 1950, end: 3100 }),
      Object.freeze({ name: 'seal', start: 3100, end: 3550 }),
      Object.freeze({ name: 'dark', start: 3550, end: 5600 }),
    ]),
  }),
  you: Object.freeze({
    duration: 4600,
    title: '你赢下了这一桌',
    quote: '这一桌，你赢了。',
    closing: '记住这次。下一次，我还在。',
    stages: Object.freeze([
      Object.freeze({ name: 'release', start: 0, end: 1500 }),
      Object.freeze({ name: 'retreat', start: 1500, end: 3100 }),
      Object.freeze({ name: 'resolve', start: 3100, end: 4600 }),
    ]),
  }),
  draw: Object.freeze({
    duration: 2800,
    title: '这一桌平分秋色',
    quote: '谁都没能带走这张牌桌。',
    closing: '灯还亮着，再来一桌。',
    stages: Object.freeze([
      Object.freeze({ name: 'dim', start: 0, end: 1350 }),
      Object.freeze({ name: 'restore', start: 1350, end: 2800 }),
    ]),
  }),
})

function endingFor(outcome) { return ENDINGS[Object.hasOwn(ENDINGS, outcome) ? outcome : 'draw'] }
function safeElapsed(value) { return typeof value === 'number' && !Number.isNaN(value) ? Math.max(0, value) : 0 }
function progressBetween(time, start, end) { return Math.min(1, Math.max(0, (time - start) / (end - start))) }
export function finaleDuration(outcome, { reducedMotion = false } = {}) {
  return reducedMotion ? 500 : endingFor(outcome).duration
}

// The component supplies elapsed active time. A background tab can pause this
// single clock without queuing out-of-order scene timers or replaying cues.
export function finaleAt(outcome, elapsed = 0, { skipped = false, reducedMotion = false } = {}) {
  const ending = endingFor(outcome)
  const normalizedOutcome = Object.hasOwn(ENDINGS, outcome) ? outcome : 'draw'
  const duration = finaleDuration(normalizedOutcome, { reducedMotion })
  const time = skipped ? duration : Math.min(safeElapsed(elapsed), duration)
  const stage = reducedMotion
    ? { name: 'still', start: 0, end: duration }
    : ending.stages.find(scene => time < scene.end) || ending.stages.at(-1)
  const closing = !reducedMotion && (stage.name === 'dark' || stage.name === 'resolve' || stage.name === 'restore')
  return {
    outcome: normalizedOutcome,
    duration,
    elapsed: time,
    stage: stage.name,
    stageProgress: Math.min(1, Math.max(0, (time - stage.start) / (stage.end - stage.start))),
    progress: time / duration,
    complete: time >= duration,
    title: ending.title,
    line: closing ? ending.closing : ending.quote,
    openingLine: ending.quote,
    closingLine: ending.closing,
    reducedMotion,
    effects: {
      opening: reducedMotion ? 0 : progressBetween(time, 0, 1800),
      approach: reducedMotion || normalizedOutcome !== 'bot' ? 0 : progressBetween(time, 1950, 3100),
      cover: reducedMotion || normalizedOutcome !== 'bot' ? 0 : progressBetween(time, 3190, 3550),
      retreat: reducedMotion || normalizedOutcome !== 'you' ? 0 : progressBetween(time, 1500, 3100),
      dim: reducedMotion || normalizedOutcome !== 'draw' ? 0 : time < 1350 ? progressBetween(time, 0, 1350) : 1 - progressBetween(time, 1350, 2800),
    },
  }
}
