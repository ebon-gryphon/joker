const MOTIONS = {
  laugh: { row: 0, frames: [0, 1, 2, 3], frameMs: 320 },
  shrug: { row: 1, frames: [0, 1, 2, 3], frameMs: 340 },
  beckon: { row: 2, frames: [0, 1, 2, 1, 2, 3], frameMs: 260 },
  retort: { row: 3, frames: [0, 1, 2, 3], frameMs: 300 },
}
const MOOD_MOTION = { smug: 'laugh', irked: 'shrug', amused: 'beckon' }

// Each atlas row is a separate gesture. Its last frame becomes the resting
// pose, so a result never loops or delays the player's next action.
export function resultMotion(mood, action = 'outcome') {
  const name = action === 'retort' || action === 'beckon'
    ? action
    : Object.hasOwn(MOOD_MOTION, mood) ? MOOD_MOTION[mood] : 'beckon'
  const { row, frames, frameMs } = MOTIONS[name]
  return { name, row, frames: [...frames], frameMs, duration: frames.length * frameMs }
}

export function frameAt(motion, elapsed = 0) {
  const time = typeof elapsed === 'number' && !Number.isNaN(elapsed) ? Math.max(0, elapsed) : 0
  const index = Math.min(motion.frames.length - 1, Math.floor(time / motion.frameMs))
  return motion.frames[index]
}
