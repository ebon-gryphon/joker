export const GRAB_TIMING = Object.freeze({ prepare: 1400, reach: 1950, contact: 3100, dark: 3550, end: 5600 })
export const GRAB_ANCHORS = Object.freeze({
  shoulder: Object.freeze({ x: .86, y: .80 }),
  arm: Object.freeze({ x: .80, y: .85 }),
  palm: Object.freeze({ x: .60, y: .60 }),
})

const finite = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const clamp = value => Math.min(1, Math.max(0, value))
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t) }
const between = (time, start, end) => smooth((time - start) / (end - start))
const safeTime = value => value === Infinity ? GRAB_TIMING.end : Math.max(0, Math.min(GRAB_TIMING.end, finite(value)))
const point = (value, fallback) => ({ x: finite(value?.x, fallback.x), y: finite(value?.y, fallback.y) })

// Coordinates are relative to a square character image, not the viewport.
// The shoulder never travels with the palm: the same shoulder end stays attached
// while the forearm and glove grow toward the lens. Camera movement is separate.
export function grabPose(elapsed = 0, { reducedMotion = false, shoulder = GRAB_ANCHORS.shoulder } = {}) {
  const time = reducedMotion ? 0 : safeTime(elapsed)
  const preparation = between(time, GRAB_TIMING.prepare, GRAB_TIMING.reach)
  const thrust = between(time, GRAB_TIMING.reach, GRAB_TIMING.contact)
  const contact = between(time, GRAB_TIMING.contact, GRAB_TIMING.dark)
  const cover = between(time, GRAB_TIMING.contact + 90, GRAB_TIMING.dark)
  const scale = .62 - .06 * preparation + 1.79 * thrust + .5 * contact
  const rotation = 4 + 8 * preparation - 19 * thrust + 2 * contact
  const attachedShoulder = point(shoulder, GRAB_ANCHORS.shoulder)
  const radians = rotation * Math.PI / 180
  const palmX = (GRAB_ANCHORS.palm.x - GRAB_ANCHORS.arm.x) * scale
  const palmY = (GRAB_ANCHORS.palm.y - GRAB_ANCHORS.arm.y) * scale
  return {
    time,
    stage: reducedMotion ? 'still' : time < GRAB_TIMING.prepare ? 'rest' : time < GRAB_TIMING.reach ? 'prepare' : time < GRAB_TIMING.contact ? 'reach' : time < GRAB_TIMING.dark ? 'contact' : 'dark',
    shoulder: attachedShoulder,
    palm: { x: attachedShoulder.x + palmX * Math.cos(radians) - palmY * Math.sin(radians), y: attachedShoulder.y + palmX * Math.sin(radians) + palmY * Math.cos(radians) },
    scale,
    rotation,
    preparation,
    thrust,
    contact,
    cover,
    shadow: .12 * preparation + .55 * thrust + .33 * contact,
    // Body x/y use character-square units; camera x/y use viewport units.
    bodyLean: { x: -.008 * preparation + .022 * thrust, y: .008 * preparation - .014 * thrust, rotation: -1.2 * preparation + 2.2 * thrust },
    camera: { x: thrust ? -.006 * thrust : 0, y: .005 * thrust, scale: 1 + .025 * thrust + .015 * contact },
  }
}

// Return a CSS matrix for a positioned image whose untransformed top-left is
// (0,0). actorRect and handSize use CSS pixels; both anchors are normalized to
// their own image. Scale may be a number or {x,y} for perspective calibration.
// Applying matrix at origin 0 0 is essential: adding a separate centering
// translate or changing transform-origin would break the shoulder attachment.
export function projectArm({ actorRect, handSize, armAnchor = GRAB_ANCHORS.arm, palmAnchor = GRAB_ANCHORS.palm, shoulder = GRAB_ANCHORS.shoulder, scale = 1, rotation = 0 } = {}) {
  const actor = { left: finite(actorRect?.left), top: finite(actorRect?.top), width: Math.max(0, finite(actorRect?.width)), height: Math.max(0, finite(actorRect?.height)) }
  const size = { width: Math.max(0, finite(handSize?.width)), height: Math.max(0, finite(handSize?.height)) }
  const sourceAnchor = point(armAnchor, GRAB_ANCHORS.arm)
  const targetAnchor = point(shoulder, GRAB_ANCHORS.shoulder)
  const sourcePalm = point(palmAnchor, GRAB_ANCHORS.palm)
  const scaleX = Math.max(0, finite(typeof scale === 'object' ? scale?.x : scale, 1))
  const scaleY = Math.max(0, finite(typeof scale === 'object' ? scale?.y : scale, 1))
  const radians = finite(rotation) * Math.PI / 180
  const a = Math.cos(radians) * scaleX
  const b = Math.sin(radians) * scaleX
  const c = -Math.sin(radians) * scaleY
  const d = Math.cos(radians) * scaleY
  const anchorX = sourceAnchor.x * size.width
  const anchorY = sourceAnchor.y * size.height
  const shoulderX = actor.left + targetAnchor.x * actor.width
  const shoulderY = actor.top + targetAnchor.y * actor.height
  const e = shoulderX - a * anchorX - c * anchorY
  const f = shoulderY - b * anchorX - d * anchorY
  const matrix = [a, b, c, d, e, f]
  const transform = `matrix(${matrix.join(',')})`
  return {
    matrix,
    transform,
    shoulder: { x: shoulderX, y: shoulderY },
    palm: { x: a * sourcePalm.x * size.width + c * sourcePalm.y * size.height + e, y: b * sourcePalm.x * size.width + d * sourcePalm.y * size.height + f },
    css: { left: '0px', top: '0px', width: `${size.width}px`, height: `${size.height}px`, transformOrigin: '0 0', transform },
  }
}

// Author the entrance path on the opposite side, then expose screen points
// for the character's right shoulder (viewer left). Glove orientation is
// independent of this path reflection; its thumb faces viewer right.
export function rightGrabFrame(elapsed, { width, height, actorSize, sourceWidth = 1254, reducedMotion = false } = {}) {
  const p = grabPose(elapsed, { reducedMotion })
  const w = Math.max(0, finite(width)), h = Math.max(0, finite(height)), size = Math.max(0, finite(actorSize))
  const source = Math.max(1, finite(sourceWidth, 1254)), base = size / source
  const left = (w - size) / 2, top = h / 2 - size * .48
  const lerp = (a, b, t) => a + (b - a) * t
  const shoulder = { x:left + size * .84, y:top + size * .82 }
  const palm = { x:lerp(left + size * 1.10, left + size * .48, p.thrust), y:lerp(h + size * .32, top + size * .50, p.thrust) }
  return {
    visible: !reducedMotion && p.time >= GRAB_TIMING.reach && p.cover < 1,
    shoulder, palm,
    screenShoulder: { x:w - shoulder.x, y:shoulder.y },
    screenPalm: { x:w - palm.x, y:palm.y },
    rootScale:base * .66,
    palmScale:lerp(base * .25, Math.max(w,h) / source * 2.65, p.thrust ** 1.65) * (1 + p.contact * .09),
    rotation:lerp(-6,6,p.thrust),
    opacity:between(p.time,GRAB_TIMING.reach,GRAB_TIMING.reach + 150),
    closure:between(p.time,2920,3050),
  }
}
