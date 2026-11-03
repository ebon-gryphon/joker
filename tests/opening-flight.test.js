import test from 'node:test'
import assert from 'node:assert/strict'
import {
  OPENING_CARD,
  createOpeningFlightLayout,
  openingFlightPose,
  openingRevealPose,
} from '../src/composables/openingFlight.js'

const viewports = [
  [320, 568], [375, 812], [390, 844], [430, 932], [768, 1024],
  [1024, 768], [1410, 1218], [1672, 941], [1920, 1080], [3440, 1440],
]

// Use the same translation/rotation/uniform scaling as canvas drawing, then
// inspect the resulting face rather than comparing layout implementation math.
function screenPoint(pose, x, y) {
  const cosine = Math.cos(pose.angle), sine = Math.sin(pose.angle)
  return {
    x: pose.x + (x * cosine - y * sine) * pose.scale,
    y: pose.y + (x * sine + y * cosine) * pose.scale,
  }
}

function faceCorners(pose) {
  const left = -OPENING_CARD.originX, top = -OPENING_CARD.originY
  return [
    [left, top], [left + OPENING_CARD.width, top],
    [left + OPENING_CARD.width, top + OPENING_CARD.height],
    [left, top + OPENING_CARD.height],
  ].map(([x, y]) => screenPoint(pose, x, y))
}

function insideOpaqueFace(pose, x, y) {
  const dx = (x - pose.x) / pose.scale, dy = (y - pose.y) / pose.scale
  const cosine = Math.cos(pose.angle), sine = Math.sin(pose.angle)
  const localX = dx * cosine + dy * sine
  const localY = -dx * sine + dy * cosine
  return localX > -OPENING_CARD.originX &&
    localX < OPENING_CARD.width - OPENING_CARD.originX &&
    localY > -OPENING_CARD.originY &&
    localY < OPENING_CARD.height - OPENING_CARD.originY
}

const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y)
const close = (a, b, message = `${a} differs from ${b}`) =>
  assert.ok(Math.abs(a - b) < 1e-8, message)

for (const [width, height] of viewports) {
  test(`${width}×${height}: flight fully covers the viewport and reveals without a frame jump`, () => {
    const layout = createOpeningFlightLayout(width, height)
    const lastFlight = openingFlightPose(layout, 1)
    const firstReveal = openingRevealPose(layout, 0)
    for (const key of ['x', 'y', 'scale', 'angle']) close(lastFlight[key], firstReveal[key])
    for (const pose of [lastFlight, firstReveal]) {
      for (const [x, y] of [[0, 0], [width, 0], [width, height], [0, height]]) {
        assert.ok(insideOpaqueFace(pose, x, y), `Opaque face must contain viewport corner (${x}, ${y})`)
      }
      const corners = faceCorners(pose)
      close((corners[0].x + corners[2].x) / 2, width / 2)
      close((corners[0].y + corners[2].y) / 2, height / 2)
    }
    const exit = faceCorners(openingRevealPose(layout, 1))
    assert.ok(Math.min(...exit.map(corner => corner.y)) >= height + 8 - 1e-8,
      'The complete card must clear the viewport before the opening layer disappears')
  })
}

test('flight retains the artwork proportions and rotates continuously until it settles upright', () => {
  const layout = createOpeningFlightLayout(375, 812)
  let previousScale = 0, previousAngle = -Infinity
  for (let step = 0; step <= 100; step++) {
    const pose = openingFlightPose(layout, step / 100)
    const corners = faceCorners(pose)
    close(distance(corners[0], corners[1]) / distance(corners[1], corners[2]), 2 / 3)
    assert.ok(pose.scale >= previousScale)
    assert.ok(pose.angle >= previousAngle)
    previousScale = pose.scale
    previousAngle = pose.angle
  }
  const settled = openingFlightPose(layout, 0.88)
  close(settled.angle, 0)
  close(openingFlightPose(layout, 0.99).angle, 0)
})

test('reveal slides the same opaque face down without shrinking or reintroducing rotation', () => {
  const layout = createOpeningFlightLayout(3440, 1440)
  const start = openingRevealPose(layout, 0)
  let previousTop = -Infinity
  for (let step = 0; step <= 100; step++) {
    const pose = openingRevealPose(layout, step / 100)
    const corners = faceCorners(pose)
    close(pose.scale, start.scale)
    close(pose.angle, 0)
    close(distance(corners[0], corners[1]) / distance(corners[1], corners[2]), 2 / 3)
    assert.ok(corners[0].y >= previousTop)
    previousTop = corners[0].y
  }
})

test('reduced motion preserves full coverage and reveal continuity, without spinning', () => {
  for (const [width, height] of viewports) {
    const layout = createOpeningFlightLayout(width, height)
    for (const progress of [0, 0.2, 0.5, 0.9, 1]) {
      close(openingFlightPose(layout, progress, true).angle, 0)
    }
    assert.deepEqual(openingFlightPose(layout, 1, true), openingRevealPose(layout, 0))
  }
})

test('out-of-range animation samples stay at their terminal poses', () => {
  const layout = createOpeningFlightLayout(1920, 1080)
  for (const pose of [openingFlightPose, openingRevealPose]) {
    assert.deepEqual(pose(layout, -0.5), pose(layout, 0))
    assert.deepEqual(pose(layout, 1.5), pose(layout, 1))
  }
})
