import test from 'node:test'
import assert from 'node:assert/strict'
import { GRAB_ANCHORS, GRAB_TIMING, grabPose, projectArm, rightGrabFrame } from './grabMotion.js'

function numbers(value) {
  return Object.values(value).flatMap(item => typeof item === 'number' ? [item] : item && typeof item === 'object' ? numbers(item) : [])
}

test('the right arm stays offscreen during speech and enters from below every viewport', () => {
  for (const dimensions of [{width:1280,height:720,actorSize:720},{width:375,height:812,actorSize:468.75},{width:812,height:375,actorSize:375}]) {
    for (const time of [0,1400,1800,1949]) assert.equal(rightGrabFrame(time,dimensions).visible,false)
    const entry = rightGrabFrame(1950,dimensions)
    assert.ok(entry.screenPalm.y > dimensions.height + dimensions.actorSize * .3)
    assert.equal(entry.opacity,0)
    assert.ok(entry.screenShoulder.x < dimensions.width/2, 'character right shoulder appears on viewer left')
    assert.equal(rightGrabFrame(2100,dimensions).opacity,1)
    assert.equal(rightGrabFrame(3550,dimensions).visible,false)
  }
})

test('the approaching right palm fills the lens while its shoulder stays attached', () => {
  const dimensions={width:1280,height:720,actorSize:720}
  const initial=rightGrabFrame(1950,dimensions), contact=rightGrabFrame(3100,dimensions)
  assert.deepEqual(initial.screenShoulder,contact.screenShoulder)
  assert.deepEqual(initial.rootScale,contact.rootScale)
  assert.ok(contact.screenPalm.x > 640 && contact.screenPalm.x < 660)
  assert.ok(contact.screenPalm.y > 360 && contact.screenPalm.y < 380)
  assert.ok(contact.palmScale > initial.palmScale * 10)
  assert.equal(rightGrabFrame(2919,dimensions).closure,0)
  assert.equal(rightGrabFrame(3050,dimensions).closure,1)
  assert.equal(rightGrabFrame(2500,{...dimensions,reducedMotion:true}).visible,false)
})

test('the arm shoulder stays attached throughout the reach at desktop and phone sizes', () => {
  const displays = [
    { actorRect: { left: 290, top: -38, width: 700, height: 700 }, handSize: { width: 700, height: 700 } },
    { actorRect: { left: -56.5, top: 132, width: 488, height: 488 }, handSize: { width: 488, height: 488 } },
    { actorRect: { left: 107.24, top: 59.8, width: 333.33, height: 291.42 }, handSize: { width: 341.17, height: 402.81 } },
  ]
  for (const display of displays) {
    for (let time = 0; time <= GRAB_TIMING.end; time += 17) {
      const pose = grabPose(time)
      const projection = projectArm({ ...display, ...pose })
      const [a, b, c, d, e, f] = projection.matrix
      const x = GRAB_ANCHORS.arm.x * display.handSize.width
      const y = GRAB_ANCHORS.arm.y * display.handSize.height
      assert.ok(Math.abs(a * x + c * y + e - projection.shoulder.x) < .01)
      assert.ok(Math.abs(b * x + d * y + f - projection.shoulder.y) < .01)
      assert.deepEqual(projection.css.transformOrigin, '0 0')
    }
  }
})

test('custom art anchors, shoulder placement and perspective scales preserve the attachment', () => {
  const inputs = { actorRect: { left: -120, top: 30, width: 555, height: 555 }, handSize: { width: 623, height: 427 }, armAnchor: { x: .83, y: .91 }, palmAnchor: { x: .42, y: .37 }, shoulder: { x: .72, y: .81 }, scale: { x: 2.8, y: 1.6 }, rotation: -23 }
  const projection = projectArm(inputs)
  const [a, b, c, d, e, f] = projection.matrix
  assert.ok(Math.abs(a * inputs.armAnchor.x * 623 + c * inputs.armAnchor.y * 427 + e - (-120 + .72 * 555)) < .01)
  assert.ok(Math.abs(b * inputs.armAnchor.x * 623 + d * inputs.armAnchor.y * 427 + f - (30 + .81 * 555)) < .01)
  assert.ok(Math.abs(projection.palm.x - (a * .42 * 623 + c * .37 * 427 + e)) < .01)
  assert.ok(Math.abs(projection.palm.y - (b * .42 * 623 + d * .37 * 427 + f)) < .01)
})

test('every phase joins continuously without a pose or camera jump', () => {
  for (const boundary of Object.values(GRAB_TIMING)) {
    const before = grabPose(boundary - .001)
    const after = grabPose(boundary + .001)
    const beforeNumbers = numbers(before).slice(1)
    const afterNumbers = numbers(after).slice(1)
    assert.equal(beforeNumbers.length, afterNumbers.length)
    for (let i = 0; i < beforeNumbers.length; i++) assert.ok(Math.abs(beforeNumbers[i] - afterNumbers[i]) < .0001, `pose jumps at ${boundary}, component ${i}`)
  }
  assert.equal(grabPose(0).stage, 'rest')
  assert.equal(grabPose(1400).stage, 'prepare')
  assert.equal(grabPose(1950).stage, 'reach')
  assert.equal(grabPose(3100).stage, 'contact')
  assert.equal(grabPose(3550).stage, 'dark')
})

test('the shoulder stays fixed while the palm accelerates forward, then stops', () => {
  const first = grabPose(0)
  for (let time = 0; time <= GRAB_TIMING.end; time += 13) assert.deepEqual(grabPose(time).shoulder, first.shoulder)
  assert.ok(grabPose(1950).scale < first.scale, 'preparation draws the hand back')
  assert.ok(grabPose(3100).scale > first.scale * 3, 'the same attached hand grows toward the camera')
  assert.deepEqual(grabPose(3550).palm, grabPose(5600).palm)
  assert.deepEqual(grabPose(3550).camera, grabPose(5600).camera)
})

test('the veil only closes after palm contact and is completely closed before darkness', () => {
  for (let time = 0; time <= GRAB_TIMING.contact; time += 10) assert.equal(grabPose(time).cover, 0)
  let previous = 0
  for (let time = GRAB_TIMING.contact; time <= GRAB_TIMING.end; time += 1) {
    const pose = grabPose(time)
    assert.ok(pose.cover >= previous)
    assert.ok(pose.cover >= 0 && pose.cover <= 1)
    previous = pose.cover
  }
  assert.equal(grabPose(GRAB_TIMING.dark).cover, 1)
  assert.equal(grabPose(GRAB_TIMING.end).cover, 1)
})

test('invalid times clamp safely and reduced motion has a single still pose', () => {
  for (const time of [-100, -Infinity, NaN, null, undefined, '1200']) assert.deepEqual(grabPose(time), grabPose(0))
  for (const time of [5600, 100000, Infinity]) assert.deepEqual(grabPose(time), grabPose(5600))
  for (const time of [0, 1400, 2000, 3100, 5600, Infinity]) {
    const pose = grabPose(time, { reducedMotion: true })
    assert.deepEqual(pose, grabPose(0, { reducedMotion: true }))
    assert.equal(pose.stage, 'still')
    assert.equal(pose.cover, 0)
    assert.equal(pose.thrust, 0)
    assert.deepEqual(pose.camera, { x: 0, y: 0, scale: 1 })
  }
  for (const input of [{}, { actorRect: { left: NaN, top: Infinity }, handSize: { width: -1 }, scale: { x: Infinity, y: NaN }, rotation: Infinity }]) assert.ok(numbers(projectArm(input)).every(Number.isFinite))
})

test('callers cannot mutate later geometry or default anchors', () => {
  const pose = grabPose(2100)
  pose.shoulder.x = 100
  pose.camera.scale = 100
  assert.equal(grabPose(2100).shoulder.x, .86)
  assert.ok(grabPose(2100).camera.scale < 2)
  assert.equal(GRAB_ANCHORS.shoulder.x, .86)
  assert.ok(Object.isFrozen(GRAB_ANCHORS.shoulder))
})
