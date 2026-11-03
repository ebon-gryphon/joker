import test from 'node:test'
import assert from 'node:assert/strict'
import { matchStanding, sortHand } from './player-tools.js'

test('hand sorting preserves identity, selected ids, resources and scoring inputs', () => {
  const hand = [{ id: 8, rank: '3', suit: '♥' }, { id: 2, rank: 'A', suit: '♣' }, { id: 6, rank: '3', suit: '♠' }]
  const original = JSON.stringify(hand), selected = new Set([8, 2])
  for (const mode of ['rank', 'suit']) {
    const displayed = sortHand(hand, mode)
    assert.equal(JSON.stringify(hand), original)
    assert.deepEqual(displayed.filter(c => selected.has(c.id)).map(c => c.id).sort(), [2, 8])
    assert.ok(displayed.every(c => hand.includes(c)))
  }
})

test('a match is clinched only when all remaining wins cannot catch the leader', () => {
  const win = { you: 2, bot: 1 }, loss = { you: 1, bot: 2 }
  assert.equal(matchStanding([win, win, win], 7).clinched, null)
  assert.equal(matchStanding([win, win, win, win], 7).clinched, 'you')
  assert.equal(matchStanding([loss, loss, loss, loss], 7).clinched, 'bot')
  assert.equal(matchStanding([win, win, win, loss, loss], 7).clinched, null)
})

test('tied rounds never create a false early winner or hide a possible final tie', () => {
  const win = { you: 2, bot: 1 }, draw = { you: 2, bot: 2 }, loss = { you: 1, bot: 2 }
  assert.equal(matchStanding([win, win, win, draw], 7).clinched, null)
  assert.equal(matchStanding([win, win, win, draw, draw], 7).clinched, 'you')
  assert.deepEqual(matchStanding([win, loss, draw, draw, draw, draw, draw], 7), { wins: [1, 1], remaining: 0, clinched: null })
})
