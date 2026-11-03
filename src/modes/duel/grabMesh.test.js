import test from 'node:test'
import assert from 'node:assert/strict'
import { armTriangleMatrix, drawArmMesh, buildAttachedArm, drawAttachedArm } from './grabMesh.js'

const base = { sourceSize: { width: 1254, height: 1254 }, shoulderAnchor: { x: .88, y: .82 }, palmAnchor: { x: .53, y: .43 }, shoulder: { x: 820, y: 590 }, palm: { x: 640, y: 360 }, rootScale: .45, palmScale: 2.8 }
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const dot = (point, axis) => point.x * axis.x + point.y * axis.y
const relative = (a, b) => ({ x: a.x - b.x, y: a.y - b.y })

test('the sleeve root keeps its width when the foreground glove grows', () => {
  for (const palmScale of [.3,1,3,6]) {
    const attached=buildAttachedArm({...base,palmScale})
    const roots=attached.sleeveMesh.vertices.filter(v=>Math.abs(dot(relative(v.source,attached.anchors.sourceShoulder),attached.sourceAxis))<.00001)
    for (let n=1;n<roots.length;n++) assert.ok(Math.abs(distance(roots[0].target,roots[n].target)/distance(roots[0].source,roots[n].source)-base.rootScale)<.00001)
  }
})

test('the actual lace cuff and thumb stay ahead of the dark sleeve cut', () => {
  const attached=buildAttachedArm({...base,wristAnchor:{x:.60,y:.72}})
  for (const point of [{x:.80,y:.45},{x:.38,y:.70},{x:.66,y:.64}]) {
    assert.ok(dot(relative({x:point.x*1254,y:point.y*1254},attached.anchors.sourceWrist),attached.sourceAxis)>0)
  }
})

test('every cloth triangle matrix maps its texture vertices exactly', () => {
  for (const palmScale of [.3,2.8,6]) {
    const mesh=buildAttachedArm({...base,palmScale}).sleeveMesh
    for (const indices of mesh.triangles) {
      const vertices=indices.map(index=>mesh.vertices[index])
      const [a,b,c,d,e,f]=armTriangleMatrix(vertices)
      for(const vertex of vertices) assert.ok(distance({x:a*vertex.source.x+c*vertex.source.y+e,y:b*vertex.source.x+d*vertex.source.y+f},vertex.target)<.00001)
    }
  }
})

test('texture rendering preserves the caller transform and restores it on failure', () => {
  let restored=0
  const ctx=Object.fromEntries(['save','beginPath','moveTo','lineTo','closePath','clip','transform'].map(name=>[name,()=>{}]))
  ctx.restore=()=>restored++
  ctx.drawImage=()=>{throw Error('image unavailable')}
  assert.throws(()=>drawArmMesh(ctx,{},buildAttachedArm(base).sleeveMesh),/image unavailable/)
  assert.equal(restored,1)
  assert.equal(armTriangleMatrix([]),null)
})

test('the full glove including the rear thumb has one rigid transform at every size', () => {
  for (const palmScale of [.3, 1, 2.8, 6]) {
    const attached = buildAttachedArm({ ...base, shoulderAnchor: { x: .87, y: .835 }, wristAnchor: { x: .55, y: .56 }, palmScale })
    const [a, b, c, d, e, f] = attached.gloveMatrix
    const map = point => ({ x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f })
    const glovePoints = [{ x: .53 * 1254, y: .43 * 1254 }, { x: .80 * 1254, y: .45 * 1254 }, { x: .32 * 1254, y: .22 * 1254 }, { x: .55 * 1254, y: .56 * 1254 }]
    for (let i = 0; i < glovePoints.length; i++) for (let j = i + 1; j < glovePoints.length; j++) assert.ok(Math.abs(distance(map(glovePoints[i]), map(glovePoints[j])) / distance(glovePoints[i], glovePoints[j]) - palmScale) < .00001)
    assert.ok(distance(map(attached.anchors.sourcePalm), base.palm) < .00001)
    assert.ok(distance(map(attached.anchors.sourceWrist), attached.anchors.wrist) < .00001)
  }
})

test('the sleeve shoulder is fixed and its entire wrist edge exactly joins the rigid glove', () => {
  for (const palmScale of [.3, 1, 2.8, 6]) {
    const attached = buildAttachedArm({ ...base, wristAnchor: { x: .55, y: .56 }, palmScale })
    const [a, b, c, d, e, f] = attached.gloveMatrix
    for (const vertex of attached.sleeveMesh.vertices) {
      const t = dot(relative(vertex.source, attached.anchors.sourceShoulder), attached.sourceAxis)
      if (Math.abs(t - attached.wristT) < .00001) assert.ok(distance(vertex.target, { x: a * vertex.source.x + c * vertex.source.y + e, y: b * vertex.source.x + d * vertex.source.y + f }) < .00001)
    }
    const shoulder = attached.sleeveMesh.vertices.find(vertex => distance(vertex.source, attached.anchors.sourceShoulder) < .00001)
    assert.ok(distance(shoulder.target, base.shoulder) < .00001)
    assert.ok(attached.sleeveMesh.vertices.every(vertex => Object.values(vertex.target).every(Number.isFinite)))
  }
})

test('the wrist clip includes the rear thumb but excludes the shoulder cloth', () => {
  const attached = buildAttachedArm(base)
  const thumb = { x: .80 * 1254, y: .45 * 1254 }
  const wristRelative = point => dot(relative(point, attached.anchors.sourceWrist), attached.sourceAxis)
  assert.ok(wristRelative(thumb) > 0)
  assert.ok(wristRelative(attached.anchors.sourcePalm) > 0)
  assert.ok(wristRelative(attached.anchors.sourceShoulder) < 0)
  for (const point of attached.glovePolygon) assert.ok(wristRelative(point) >= -.00001)
})

test('attached rendering draws cloth first then one undistorted glove', () => {
  const calls = []
  const ctx = Object.fromEntries(['save', 'restore', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'clip', 'transform', 'drawImage'].map(name => [name, (...args) => calls.push({ name, args })]))
  const attached = drawAttachedArm(ctx, {}, base)
  assert.equal(attached.glove, 1)
  assert.equal(calls.filter(call => call.name === 'drawImage').length, attached.sleeve + 1)
  assert.deepEqual(calls.filter(call => call.name === 'transform').at(-1).args, attached.gloveMatrix)
  assert.equal(calls.filter(call => call.name === 'restore').length, attached.sleeve + 1)
})
