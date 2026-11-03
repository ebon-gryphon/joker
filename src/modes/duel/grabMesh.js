const EPSILON = 1e-7
const finite = (value, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const clamp = (value, low, high) => Math.max(low, Math.min(high, value))
const smooth = value => value * value * (3 - 2 * value)
const safePoint = (value, fallback = { x: 0, y: 0 }) => ({ x: finite(value?.x, fallback.x), y: finite(value?.y, fallback.y) })
const dot = (point, axis) => point.x * axis.x + point.y * axis.y
const distinct = values => [...new Set(values)].sort((a, b) => a - b).filter((value, index, array) => !index || value - array[index - 1] > EPSILON)

export function armTriangleMatrix(vertices) {
  if (!Array.isArray(vertices) || vertices.length !== 3) return null
  const [s0, s1, s2] = vertices.map(vertex => vertex.source)
  const [t0, t1, t2] = vertices.map(vertex => vertex.target)
  const sx1 = s1.x - s0.x; const sy1 = s1.y - s0.y
  const sx2 = s2.x - s0.x; const sy2 = s2.y - s0.y
  const tx1 = t1.x - t0.x; const ty1 = t1.y - t0.y
  const tx2 = t2.x - t0.x; const ty2 = t2.y - t0.y
  const determinant = sx1 * sy2 - sx2 * sy1
  if (Math.abs(determinant) < EPSILON) return null
  const a = (tx1 * sy2 - tx2 * sy1) / determinant
  const b = (ty1 * sy2 - ty2 * sy1) / determinant
  const c = (tx2 * sx1 - tx1 * sx2) / determinant
  const d = (ty2 * sx1 - ty1 * sx2) / determinant
  return [a, b, c, d, t0.x - a * s0.x - c * s0.y, t0.y - b * s0.x - d * s0.y]
}

function expandedTriangle(points, padding) {
  if (!padding) return points
  const center = { x: (points[0].x + points[1].x + points[2].x) / 3, y: (points[0].y + points[1].y + points[2].y) / 3 }
  return points.map(point => {
    const dx = point.x - center.x; const dy = point.y - center.y
    const length = Math.hypot(dx, dy)
    const gain = length ? (length + padding) / length : 1
    return { x: center.x + dx * gain, y: center.y + dy * gain }
  })
}

// ctx may already have a DPR transform. This function preserves it and does not
// clear the canvas. Clip expansion hides subpixel mesh cracks; opaque artwork is
// seamless, while a translucent silhouette can darken slightly at overlaps.
// Keep the canvas DPR <= 1.5 and draw once per animation frame; default geometry
// is about 100 triangles, and the rigid hand consumes only a few long strips.
export function drawArmMesh(ctx, image, mesh, { seamPadding = .4 } = {}) {
  let drawn = 0
  if (!ctx || !image || !mesh?.triangles?.length) return drawn
  const padding = clamp(finite(seamPadding, .4), 0, 2)
  for (const indices of mesh.triangles) {
    const vertices = indices.map(index => mesh.vertices[index])
    const matrix = armTriangleMatrix(vertices)
    if (!matrix || !matrix.every(Number.isFinite)) continue
    const clip = expandedTriangle(vertices.map(vertex => vertex.target), padding)
    ctx.save()
    try {
      ctx.beginPath()
      ctx.moveTo(clip[0].x, clip[0].y)
      ctx.lineTo(clip[1].x, clip[1].y)
      ctx.lineTo(clip[2].x, clip[2].y)
      ctx.closePath()
      ctx.clip()
      ctx.transform(...matrix)
      ctx.drawImage(image, 0, 0)
      drawn++
    } finally { ctx.restore() }
  }
  return drawn
}

function mapMatrix(matrix, point) {
  const [a, b, c, d, e, f] = matrix
  return { x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f }
}

function clipHalfPlane(points, origin, axis, sign = 1) {
  const result = []
  const side = point => sign * dot({ x: point.x - origin.x, y: point.y - origin.y }, axis)
  for (let index = 0; index < points.length; index++) {
    const current = points[index]
    const previous = points[(index + points.length - 1) % points.length]
    const currentSide = side(current)
    const previousSide = side(previous)
    if ((currentSide >= 0) !== (previousSide >= 0)) {
      const fraction = previousSide / (previousSide - currentSide)
      result.push({ x: previous.x + (current.x - previous.x) * fraction, y: previous.y + (current.y - previous.y) * fraction })
    }
    if (currentSide >= 0) result.push(current)
  }
  return result
}

// A wrist cut separates cloth from the entire glove. Nothing in front of that
// source-image line is deformed, including a thumb behind the palm center. At
// large foreground scales the cuff may travel behind the shoulder: cloth is
// allowed to fold behind the glove instead of distorting the hand to hide it.
export function buildAttachedArm({ sourceSize, shoulderAnchor = { x: .87, y: .835 }, palmAnchor = { x: .53, y: .43 }, wristAnchor = { x: .55, y: .56 }, shoulder, palm, rootScale = 1, palmScale = 1, rotation, axialSegments = 12, crossSegments = 2 } = {}) {
  const size = { width: Math.max(1, finite(sourceSize?.width, 1)), height: Math.max(1, finite(sourceSize?.height, 1)) }
  const inSource = (value, fallback) => { const point = safePoint(value, fallback); return { x: point.x * size.width, y: point.y * size.height } }
  const sourceShoulder = inSource(shoulderAnchor, { x: .87, y: .835 })
  const sourcePalm = inSource(palmAnchor, { x: .53, y: .43 })
  const sourceWrist = inSource(wristAnchor, { x: .55, y: .56 })
  const targetShoulder = safePoint(shoulder)
  const targetPalm = safePoint(palm, { x: 0, y: -1 })
  const sourceLength = Math.hypot(sourcePalm.x - sourceShoulder.x, sourcePalm.y - sourceShoulder.y)
  const targetLength = Math.hypot(targetPalm.x - targetShoulder.x, targetPalm.y - targetShoulder.y)
  if (sourceLength < EPSILON) return { degenerate: true, sleeveMesh: { vertices: [], triangles: [] }, glovePolygon: [], gloveMatrix: null }
  const attachmentAxis = { x: (sourcePalm.x - sourceShoulder.x) / sourceLength, y: (sourcePalm.y - sourceShoulder.y) / sourceLength }
  // Cut across the wrist, rather than perpendicular to the whole diagonal arm.
  // The left thumb extends behind the palm along the arm axis; an arm-axis cut
  // would put that thumb back into the cloth mesh and turn it into a wedge.
  const wristLength = Math.hypot(sourcePalm.x - sourceWrist.x, sourcePalm.y - sourceWrist.y)
  const sourceAxis = wristLength > EPSILON ? { x:(sourcePalm.x-sourceWrist.x)/wristLength, y:(sourcePalm.y-sourceWrist.y)/wristLength } : attachmentAxis
  const sourceCross = { x: -sourceAxis.y, y: sourceAxis.x }
  const rotationAngle = typeof rotation === 'number' && Number.isFinite(rotation)
    ? rotation * Math.PI / 180
    : (targetLength < EPSILON ? Math.atan2(attachmentAxis.y, attachmentAxis.x) : Math.atan2(targetPalm.y - targetShoulder.y, targetPalm.x - targetShoulder.x)) - Math.atan2(attachmentAxis.y, attachmentAxis.x)
  const cos = Math.cos(rotationAngle)
  const sin = Math.sin(rotationAngle)
  const root = clamp(finite(rootScale, 1), .0001, 64)
  const hand = clamp(finite(palmScale, 1), .0001, 64)
  const a = cos * hand; const b = sin * hand; const c = -sin * hand; const d = cos * hand
  const gloveMatrix = [a, b, c, d, targetPalm.x - a * sourcePalm.x - c * sourcePalm.y, targetPalm.y - b * sourcePalm.x - d * sourcePalm.y]
  const targetWrist = mapMatrix(gloveMatrix, sourceWrist)
  const targetAxis = { x: cos * sourceAxis.x - sin * sourceAxis.y, y: sin * sourceAxis.x + cos * sourceAxis.y }
  const targetCross = { x: -targetAxis.y, y: targetAxis.x }
  const wristT = dot({ x: sourceWrist.x - sourceShoulder.x, y: sourceWrist.y - sourceShoulder.y }, sourceAxis)
  if (wristT <= EPSILON) return { degenerate: true, sleeveMesh: { vertices: [], triangles: [] }, glovePolygon: [], gloveMatrix: null }
  const cutCenter = { x: sourceShoulder.x + wristT * sourceAxis.x, y: sourceShoulder.y + wristT * sourceAxis.y }
  const targetCutCenter = mapMatrix(gloveMatrix, cutCenter)
  const corners = [{ x: 0, y: 0 }, { x: size.width, y: 0 }, { x: size.width, y: size.height }, { x: 0, y: size.height }]
  const relativeCorners = corners.map(point => ({ x: point.x - sourceShoulder.x, y: point.y - sourceShoulder.y }))
  const minT = Math.min(...relativeCorners.map(point => dot(point, sourceAxis)))
  const minW = Math.min(...relativeCorners.map(point => dot(point, sourceCross)))
  const maxW = Math.max(...relativeCorners.map(point => dot(point, sourceCross)))
  const axialCount = clamp(Math.round(finite(axialSegments, 12)), 2, 48)
  const crossCount = clamp(Math.round(finite(crossSegments, 2)), 1, 12)
  const ts = distinct([minT, 0, ...Array.from({ length: axialCount }, (_, index) => wristT * (index + 1) / axialCount)])
  const wristW = dot({ x: sourceWrist.x - sourceShoulder.x, y: sourceWrist.y - sourceShoulder.y }, sourceCross)
  const ws = distinct([minW, 0, wristW, ...Array.from({ length: crossCount - 1 }, (_, index) => minW + (maxW - minW) * (index + 1) / crossCount), maxW])
  const vertices = []
  for (const t of ts) {
    const progress = clamp(t / wristT, 0, 1)
    const width = root + (hand - root) * smooth(progress)
    const center = t < 0
      ? { x: targetShoulder.x + t * root * targetAxis.x, y: targetShoulder.y + t * root * targetAxis.y }
      : { x: targetShoulder.x + (targetCutCenter.x - targetShoulder.x) * progress, y: targetShoulder.y + (targetCutCenter.y - targetShoulder.y) * progress }
    for (const w of ws) vertices.push({ source: { x: sourceShoulder.x + t * sourceAxis.x + w * sourceCross.x, y: sourceShoulder.y + t * sourceAxis.y + w * sourceCross.y }, target: { x: center.x + w * width * targetCross.x, y: center.y + w * width * targetCross.y } })
  }
  const triangles = []
  for (let row = 0; row < ts.length - 1; row++) for (let column = 0; column < ws.length - 1; column++) {
    const first = row * ws.length + column
    const next = first + ws.length
    triangles.push([first, next, next + 1], [first, next + 1, first + 1])
  }
  return { degenerate: false, sleeveMesh: { vertices, triangles }, gloveMatrix, glovePolygon: clipHalfPlane(corners, sourceWrist, sourceAxis), anchors: { sourceShoulder, sourcePalm, sourceWrist, shoulder: targetShoulder, palm: targetPalm, wrist: targetWrist }, sourceAxis, wristT, palmScale: hand, rootScale: root }
}

export function drawAttachedArm(ctx, image, options = {}) {
  const attached = buildAttachedArm(options)
  if (!ctx || !image || attached.degenerate) return { sleeve: 0, glove: 0, ...attached }
  const sleeve = drawArmMesh(ctx, image, attached.sleeveMesh, { seamPadding: options.seamPadding })
  // The clip is in source coordinates after applying the rigid glove matrix;
  // the current canvas DPR transform is retained by ctx.transform.
  ctx.save()
  try {
    ctx.transform(...attached.gloveMatrix)
    ctx.beginPath()
    attached.glovePolygon.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y))
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(image, 0, 0)
  } finally { ctx.restore() }
  return { sleeve, glove: 1, ...attached }
}
