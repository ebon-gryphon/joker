import test from 'node:test'
import assert from 'node:assert/strict'
import { chooseResultBanter, resultEmotion } from './resultBanter.js'

const round = overrides => ({
  round: 1, youScore: 800, botScore: 500, wins: [1, 0],
  results: [{ you: 800, bot: 500 }], finished: false, ...overrides,
})

const contexts = [
  ['round.you', round()],
  ['round.bot', round({ youScore: 500, botScore: 800 })],
  ['round.draw', round({ youScore: 500, botScore: 500 })],
  ['close.you', round({ youScore: 100, botScore: 91 })],
  ['close.bot', round({ youScore: 91, botScore: 100 })],
  ['comeback.you', round({ round: 2, results: [{ you: 100, bot: 200 }, { you: 800, bot: 500 }] })],
  ['comeback.bot', round({ round: 2, youScore: 500, botScore: 800, results: [{ you: 200, bot: 100 }, { you: 500, bot: 800 }] })],
  ['streak.you', round({ round: 3, results: [{ you: 900, bot: 100 }, { you: 700, bot: 300 }, { you: 800, bot: 500 }] })],
  ['streak.bot', round({ round: 3, youScore: 500, botScore: 800, results: [{ you: 100, bot: 900 }, { you: 300, bot: 700 }, { you: 500, bot: 800 }] })],
  ['match.you', round({ round: 7, wins: [4, 3], finished: true, youScore: 1, botScore: 900 })],
  ['match.bot', round({ round: 7, wins: [3, 4], finished: true })],
  ['match.draw', round({ round: 7, wins: [3, 3], finished: true, youScore: 0, botScore: 900 })],
]

for (const [context, input] of contexts) {
  test(`${context} provides three distinct, paired exchanges and repeats the same pair on replay`, () => {
    const exchanges = [0, 1, 2].map(variant => chooseResultBanter(input, variant))
    for (const field of ['line', 'response', 'retort', 'replyKey']) {
      assert.equal(new Set(exchanges.map(exchange => exchange[field])).size, 3, `${field} must vary with the exchange`)
    }
    assert.ok(exchanges.every(exchange => exchange.replyKey.startsWith(`${context}.`)))
    const expectedMood = context.endsWith('you') ? 'irked' : context.endsWith('bot') ? 'smug' : 'amused'
    assert.ok(exchanges.every(exchange => exchange.mood === expectedMood))
    for (const variant of [-100, -4, -1, 0, 1, 2, 3, 100]) {
      const selected = chooseResultBanter(input, variant)
      const original = exchanges.find(exchange => exchange.response === selected.response)
      assert.deepEqual(selected, original, 'a rotating player reply must keep its matching jester answer')
      assert.deepEqual(selected, chooseResultBanter(input, variant + 3), 'rotation wraps in both directions')
    }
  })
}

test('all contexts contain 36 unique player replies and paired jester responses', () => {
  const exchanges = contexts.flatMap(([, input]) => [0, 1, 2].map(variant => chooseResultBanter(input, variant)))
  assert.equal(exchanges.length, 36)
  assert.equal(new Set(exchanges.map(exchange => exchange.response)).size, 36)
  assert.equal(new Set(exchanges.map(exchange => exchange.retort)).size, 36)
})

test('final exchanges follow won rounds instead of the final score and never promise another round', () => {
  const input = round({ round: 7, wins: [3, 4], finished: true })
  assert.equal(chooseResultBanter({ ...input, finished: false }).mood, 'irked')
  assert.equal(chooseResultBanter(input).mood, 'smug')
  assert.equal(resultEmotion(input), 'smug')
  for (const [, final] of contexts.filter(([context]) => context.startsWith('match.'))) {
    for (let variant = 0; variant < 3; variant += 1) {
      const exchange = chooseResultBanter(final, variant)
      assert.doesNotMatch(`${exchange.line}${exchange.response}${exchange.retort}`, /下一轮|下一手|还没结束|还没定/)
    }
  }
})

test('current result is not counted as history, and ties interrupt a streak', () => {
  const [, streak] = contexts.find(([context]) => context === 'streak.you')
  assert.match(chooseResultBanter(streak).replyKey, /^streak\.you\./)
  const interrupted = { ...streak, results: [{ you: 900, bot: 100 }, { you: 200, bot: 200 }, { you: 800, bot: 500 }] }
  assert.match(chooseResultBanter(interrupted).replyKey, /^round\.you\./)
  const secondWin = round({ round: 2, results: [{ you: 900, bot: 100 }, { you: 800, bot: 500 }] })
  assert.match(chooseResultBanter(secondWin).replyKey, /^round\.you\./, 'two wins are not yet a three-win streak')
  const [, comeback] = contexts.find(([context]) => context === 'comeback.you')
  assert.match(chooseResultBanter(comeback).replyKey, /^comeback\.you\./)
})

test('comebacks and streaks take precedence over a narrow current score', () => {
  const [, comeback] = contexts.find(([context]) => context === 'comeback.you')
  assert.match(chooseResultBanter({ ...comeback, youScore: 100, botScore: 99 }).replyKey, /^comeback\.you\./)
  const [, streak] = contexts.find(([context]) => context === 'streak.bot')
  assert.match(chooseResultBanter({ ...streak, youScore: 99, botScore: 100 }).replyKey, /^streak\.bot\./)
  assert.match(chooseResultBanter(round({ youScore: 100, botScore: 90 })).replyKey, /^close\.you\./)
  assert.match(chooseResultBanter(round({ youScore: 100, botScore: 89 })).replyKey, /^round\.you\./)
  assert.equal(resultEmotion(round({ youScore: 0, botScore: 0 })), 'amused')
})

test('later rounds rotate ordinary replies without reloading or randomly splitting a pair', () => {
  const first = chooseResultBanter(round())
  const second = chooseResultBanter(round({ round: 2, results: [{ you: 200, bot: 200 }, { you: 800, bot: 500 }] }))
  assert.notEqual(first.response, second.response)
  assert.notEqual(first.retort, second.retort)
  assert.equal(first.replyKey.split('.').slice(0, 2).join('.'), second.replyKey.split('.').slice(0, 2).join('.'))
  assert.deepEqual(first, chooseResultBanter(round()), 'opening selection is deterministic')
})

test('non-finite variants safely use the default and fractions truncate toward zero', () => {
  const input = round()
  for (const variant of [NaN, Infinity, -Infinity, undefined]) {
    assert.deepEqual(chooseResultBanter(input, variant), chooseResultBanter(input, 0))
  }
  assert.deepEqual(chooseResultBanter(input, -1.8), chooseResultBanter(input, -1))
  assert.deepEqual(chooseResultBanter(input, 1.8), chooseResultBanter(input, 1))
})

test('selection never reads the deck and leaves scores, history, wins and future output untouched', () => {
  const input = round({
    round: 2, wins: Object.freeze([1, 1]),
    results: Object.freeze([Object.freeze({ you: 100, bot: 200 }), Object.freeze({ you: 800, bot: 500 })]),
  })
  Object.defineProperty(input, 'deck', { get() { throw new Error('private deck must not be read') } })
  Object.freeze(input)
  const before = JSON.stringify(input)
  const result = chooseResultBanter(input)
  const expected = { ...result }
  result.response = 'caller changed this result'
  result.retort = 'caller changed this result too'
  assert.equal(JSON.stringify(input), before)
  assert.deepEqual(chooseResultBanter(input), expected, 'each returned exchange is independent of earlier callers')
})
