import { BLINDS } from './useGameState.js'
import { decodeClassicSnapshot } from './classicSnapshot.js'
import { decodeDuelSnapshot } from '../modes/duel/snapshot.js'
import { DUEL_RULES } from '../modes/duel/config.js'

export const RUN_KEYS = Object.freeze({ classic: 'joker.classic.run.v1', duel: 'joker.duel.run.v1' })

// Validate before offering a continuation. An untouched empty first deal does
// not need an extra prompt; actual progress is never silently replaced.
export function describeSavedRun(mode, snapshot) {
  const saved = mode === 'classic' ? decodeClassicSnapshot(snapshot, BLINDS)
    : mode === 'duel' ? decodeDuelSnapshot(snapshot) : null
  if (!saved) return null
  if (mode === 'classic') {
    const progressed = saved.roundIndex > 0 || saved.phase !== 'playing' || saved.jokers.length > 0 || saved.handsLeft < 4 || saved.discardsLeft < 3
    return progressed ? { mode, name: '经典闯关', round: saved.roundIndex + 1, total: BLINDS.length, phase: saved.phase, jokers: saved.jokers.length, money: saved.money } : null
  }
  const progressed = saved.round > 1 || saved.phase !== 'playing' || [saved.you, saved.bot].some(p => p.jokers.length > 0 || p.handsLeft < DUEL_RULES.hands || p.discardsLeft < DUEL_RULES.discards)
  return progressed ? { mode, name: '明牌对决', round: saved.round, total: DUEL_RULES.rounds, phase: saved.phase, jokers: saved.you.jokers.length, money: saved.you.money } : null
}
