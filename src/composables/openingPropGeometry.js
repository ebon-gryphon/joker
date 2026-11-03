const SOURCE_CENTER_X = 836
const SOURCE_CENTER_Y = 470.5
const SOURCE_FLOOR_Y = 778
const SOURCE_PERSPECTIVE = 700

/** Recover a contact point on the table from the unchanged cover artwork. */
export function sourcePointToTable(x, y) {
  const floorDistance = SOURCE_FLOOR_Y - SOURCE_CENTER_Y
  const imageDepth = y - SOURCE_FLOOR_Y
  const denominator = floorDistance + imageDepth
  return Object.freeze({
    x: (x * floorDistance + SOURCE_CENTER_X * imageDepth) / denominator,
    y: SOURCE_PERSPECTIVE * imageDepth / denominator,
    z: 0,
  })
}

export const OPENING_CHIP_SEGMENTS = 48

const chip = (id, sourceContact, radius, height, count, tone, texture) => Object.freeze({
  id,
  kind: 'chips',
  sourceContact: Object.freeze(sourceContact),
  anchor: sourcePointToTable(...sourceContact),
  radius,
  height,
  count,
  tone,
  texture: Object.freeze(texture),
})

/** Fixed furniture, expressed in tabletop XY coordinates with physical Z height. */
export const OPENING_PROP_MODELS = Object.freeze([
  chip('red-chip-stack', [150, 906], 40, 52, 5, 'red', [96, 818, 109, 26]),
  chip('green-chip-stack', [281, 907], 39, 20, 2, 'green', [226, 849, 110, 26]),
  chip('single-red-chip', [410, 938], 41, 7, 1, 'red', [351, 900, 118, 25]),
  Object.freeze({
    id: 'card-stack',
    kind: 'cards',
    sourceContact: Object.freeze([1300, 929]),
    anchor: sourcePointToTable(1300, 929),
    width: 135,
    length: 202.5,
    thickness: .8,
    rotation: 65,
    layers: Object.freeze([
      Object.freeze({ x: -4, y: -5, rotation: -.8 }),
      Object.freeze({ x: 0, y: 0, rotation: .4 }),
      Object.freeze({ x: 3, y: 2, rotation: -.5 }),
      Object.freeze({ x: 6, y: 4, rotation: 0 }),
    ]),
  }),
])

/** Additional furniture uses the same materials and table axes as the cover props. */
export const OPENING_EXTRA_PROP_MODELS = Object.freeze([
  Object.freeze({
    id: 'extra-red-chip', kind: 'chips', extra: true,
    anchor: Object.freeze({ x: 230, y: 665, z: 0 }),
    radius: 45, height: 7, count: 1, tone: 'red',
    texture: Object.freeze([351, 900, 118, 25]),
  }),
  Object.freeze({
    id: 'extra-green-chip', kind: 'chips', extra: true,
    anchor: Object.freeze({ x: 1495, y: 805, z: 0 }),
    radius: 45, height: 7, count: 1, tone: 'green',
    texture: Object.freeze([226, 849, 110, 26]),
  }),
  Object.freeze({
    id: 'extra-cardback', kind: 'cards', extra: true,
    anchor: Object.freeze({ x: 1370, y: 1170, z: 0 }),
    width: 160, length: 240, thickness: .8, rotation: 18,
    layers: Object.freeze([Object.freeze({ x: 0, y: 0, rotation: 0 })]),
  }),
])

/** Tangent quads close the cylinder; their short local Y axis becomes height. */
export function chipSidePanels(model) {
  const width = 2 * model.radius * Math.tan(Math.PI / OPENING_CHIP_SEGMENTS) + .06
  return Array.from({ length: OPENING_CHIP_SEGMENTS }, (_, index) => {
    const angle = 2 * Math.PI * index / OPENING_CHIP_SEGMENTS
    return Object.freeze({
      index,
      width,
      x: model.radius * Math.cos(angle),
      y: model.radius * Math.sin(angle),
      rotation: index * 360 / OPENING_CHIP_SEGMENTS + 90,
      ivory: index % 8 < 3,
      shade: .12 + .35 * (1 - Math.cos(angle + Math.PI / 4)) / 2,
    })
  })
}

export function cardSidePanels(model) {
  return [
    { id: 'far', x: 0, y: -model.length / 2, width: model.width, rotation: 0 },
    { id: 'near', x: 0, y: model.length / 2, width: model.width, rotation: 0 },
    { id: 'left', x: -model.width / 2, y: 0, width: model.length, rotation: 90 },
    { id: 'right', x: model.width / 2, y: 0, width: model.length, rotation: 90 },
  ]
}
