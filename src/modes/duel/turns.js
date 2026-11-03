import { act, computerChoice } from './engine.js'

// Remaining hands also recover the turn from older, independently played saves.
// A committed discard must finish its response; otherwise the player leads.
export function nextDuelTurn(you, bot, pendingBotPlay = false) {
  if (bot.handsLeft > 0 && (pendingBotPlay || bot.handsLeft > you.handsLeft)) return 'bot'
  return you.handsLeft > 0 ? 'you' : 'complete'
}

// Exactly one response. Every resource-changing action is preceded by the same
// cancellation check, so resuming a paused response cannot replay its discard.
export async function playDuelResponse({
  player, pendingBotPlay = false, isCurrent = () => true, pause = async () => {},
  onSelect = () => {}, onDiscard = () => {}, onPlay = () => {},
}) {
  if (!isCurrent() || player.handsLeft === 0) return null
  await pause(900)
  if (!isCurrent()) return null
  let move = computerChoice(player, !pendingBotPlay)
  if (move.type === 'discard') {
    onSelect(move)
    await pause(700)
    if (!isCurrent()) return null
    act(player, move.ids, 'discard')
    onDiscard(move)
    await pause(450)
    if (!isCurrent()) return null
    move = computerChoice(player, false)
  }
  onSelect(move)
  await pause(900)
  if (!isCurrent()) return null
  const result = act(player, move.ids)
  onPlay(result)
  return result
}
