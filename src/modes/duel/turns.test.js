import test from 'node:test'
import assert from 'node:assert/strict'
import { makePlayer, act } from './engine.js'
import { nextDuelTurn, playDuelResponse } from './turns.js'
import { encodeDuelSnapshot, decodeDuelSnapshot } from './snapshot.js'

const player = () => makePlayer([], () => 0.3)
const run = () => ({
  you: player(), bot: player(), round: 1, phase: 'playing', results: [],
  claimedIds: new Set(), shop: null, pendingBotPlay: false, logs: [], status: '',
})

test('an empty-lineup round starts with the player and alternates exactly four responses', async () => {
  const state = run()
  assert.equal(nextDuelTurn(state.you, state.bot), 'you')
  act(state.you, [state.you.hand[0].id], 'discard')
  assert.equal(nextDuelTurn(state.you, state.bot), 'you', 'discarding does not pass the turn')
  assert.equal(state.bot.handsLeft, 4)
  for (let hand = 1; hand <= 4; hand++) {
    act(state.you, state.you.hand.slice(0, 5).map(card => card.id))
    assert.equal(nextDuelTurn(state.you, state.bot), 'bot')
    const before = state.bot.handsLeft
    await playDuelResponse({ player: state.bot })
    assert.equal(state.bot.handsLeft, before - 1, 'one response never plays multiple hands')
    assert.equal(nextDuelTurn(state.you, state.bot), hand === 4 ? 'complete' : 'you')
  }
  assert.equal(state.you.handsLeft, 0)
  assert.equal(state.bot.handsLeft, 0)
})

test('pause after a committed discard reloads the response and spends only one hand', async () => {
  const state = run()
  // Four ranks, each in a different suit: a legal public hand that wants a redraw.
  state.bot.hand = [0, 14, 28, 42, 5, 19, 33, 47].map(id => ({
    id, rank: ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][id % 13],
    suit: ['♠', '♥', '♦', '♣'][Math.floor(id / 13)],
  }))
  const held = new Set(state.bot.hand.map(card => card.id))
  state.bot.deck = [...state.you.hand, ...state.you.deck].filter(card => !held.has(card.id))
  act(state.you, [state.you.hand[0].id])
  let current = true, saved
  await playDuelResponse({
    player: state.bot, isCurrent: () => current,
    onDiscard() {
      state.pendingBotPlay = true
      saved = encodeDuelSnapshot(state)
      current = false
    },
  })
  assert.ok(saved, 'fixture reaches a committed redraw')
  assert.equal(state.bot.handsLeft, 4)
  const restored = decodeDuelSnapshot(saved)
  assert.ok(restored)
  assert.equal(restored.actionTurn, 'bot')
  assert.equal(restored.pendingBotPlay, true)
  const discards = restored.bot.discardsLeft
  await playDuelResponse({ player: restored.bot, pendingBotPlay: restored.pendingBotPlay })
  assert.equal(restored.bot.discardsLeft, discards, 'resume cannot discard twice')
  assert.equal(restored.bot.handsLeft, 3)
  assert.equal(nextDuelTurn(restored.you, restored.bot), 'you')
})

test('pausing before a response commits does not spend cards or resources', async () => {
  const bot = player(), before = JSON.stringify(bot)
  let current = true
  const result = await playDuelResponse({ player: bot, isCurrent: () => current, pause() { current = false } })
  assert.equal(result, null)
  assert.equal(JSON.stringify(bot), before)
  await playDuelResponse({ player: bot })
  assert.equal(bot.handsLeft, 3)
})

test('legacy independent play catches up only the side that still owes hands', async () => {
  const state = run()
  for (let i = 0; i < 3; i++) act(state.bot, [state.bot.hand[0].id])
  assert.equal(nextDuelTurn(state.you, state.bot), 'you')
  for (let i = 0; i < 3; i++) {
    act(state.you, [state.you.hand[0].id])
    assert.equal(nextDuelTurn(state.you, state.bot), 'you', 'player catches up without an extra response')
  }
  act(state.you, [state.you.hand[0].id])
  assert.equal(nextDuelTurn(state.you, state.bot), 'bot')
  await playDuelResponse({ player: state.bot })
  assert.equal(nextDuelTurn(state.you, state.bot), 'complete')

  const delayed = run()
  for (let i = 0; i < 2; i++) act(delayed.you, [delayed.you.hand[0].id])
  for (let i = 0; i < 2; i++) {
    assert.equal(nextDuelTurn(delayed.you, delayed.bot), 'bot')
    await playDuelResponse({ player: delayed.bot })
  }
  assert.equal(nextDuelTurn(delayed.you, delayed.bot), 'you')
})
