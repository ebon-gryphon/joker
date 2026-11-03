import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createOpeningScene } from '../src/composables/openingScene.js'
import { OPENING_PROP_MODELS, OPENING_EXTRA_PROP_MODELS, OPENING_CHIP_SEGMENTS } from '../src/composables/openingPropGeometry.js'

const physicalModels = [...OPENING_PROP_MODELS, ...OPENING_EXTRA_PROP_MODELS]

const sourceProps = [...readFileSync(new URL('../src/components/OpeningCoverProps.vue', import.meta.url), 'utf8').matchAll(
  /id: '([^']+)', x: (\d+), y: (\d+), width: (\d+), height: (\d+)/g,
)].map(([, id, x, y, width, height]) => ({ id, x: +x, y: +y, width: +width, height: +height }))
const viewports = [[1280, 720], [1280, 800], [1920, 1080], [3440, 1440], [1024, 768], [600, 1024], [375, 812], [390, 844], [320, 1024], [375, 1366]]

function fixture(width = 1280, height = 720) {
  const events = new Map()
  let observer
  const style = () => ({ setProperty(key, value) { this[key] = value } })
  const elements = Object.fromEntries(['clip', 'rig', 'camera', 'world', 'portrait'].map(name => [`.scene-${name}`, { style: style() }]))
  const props = sourceProps.map(prop => ({
    source: prop, style: style(),
    dataset: { sourceX: String(prop.x), sourceY: String(prop.y), sourceWidth: String(prop.width), sourceHeight: String(prop.height) },
  }))
  // Furniture is placed once in tabletop coordinates by OpeningTableProps.
  // The camera must never compensate for pitch by turning it toward the screen.
  const physicalProps = physicalModels.map(model => ({
    dataset: { physicalProp: model.id },
    style: {
      get transform() { return `translate3d(${model.anchor.x}px, ${model.anchor.y}px, 0)` },
      set transform(value) { throw new Error(`Camera moved physical ${model.id}: ${value}`) },
      setProperty(key) { throw new Error(`Camera wrote physical ${model.id}: ${key}`) },
    },
  }))
  const view = {
    addEventListener: (event, callback) => events.set(event, callback),
    removeEventListener: event => events.delete(event),
    ResizeObserver: class {
      constructor(callback) { this.callback = callback; observer = this }
      observe(root) { this.root = root }
      disconnect() { this.disconnected = true }
    },
  }
  const root = {
    dataset: {}, style: style(), ownerDocument: { defaultView: view },
    querySelector: selector => elements[selector],
    querySelectorAll: selector => selector === '[data-cover-prop]' ? props : selector === '[data-physical-prop]' ? physicalProps : [],
    getBoundingClientRect: () => ({ width, height }),
  }
  const scene = createOpeningScene(root)
  return {
    root, scene, events, elements, props, physicalProps,
    observer: () => observer,
    bounds: () => ({ width, height }),
    resize(w, h) { width = w; height = h; observer.callback() },
  }
}

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < .0001, `${actual} differs from ${expected}`)

// Independently project a world point through the emitted view matrix.
function project(f, [x, y, z]) {
  const transform = f.elements['.scene-world'].style.transform
  const pattern = /^translate3d\(([^,]+)px, ([^,]+)px, ([^)]+)px\) rotateX\(([^)]+)deg\) translate3d\(([^,]+)px, ([^,]+)px, ([^)]+)px\)$/
  const [, ...numbers] = transform.match(pattern)
  const [tx, ty, tz, angle, dx, dy, dz] = numbers.map(Number)
  const radians = angle * Math.PI / 180
  const vx = x + dx
  const vy = (y + dy) * Math.cos(radians) - (z + dz) * Math.sin(radians)
  const vz = (y + dy) * Math.sin(radians) + (z + dz) * Math.cos(radians)
  const p = parseFloat(f.elements['.scene-camera'].style.perspective)
  const scale = p / (p - (vz + tz))
  return [836 + (vx + tx - 836) * scale, 470.5 + (vy + ty - 470.5) * scale]
}

function billboard(style, [x, y], [originX, originY]) {
  // A scalar scale rules out skew, perspective and separate x/y scale factors.
  const match = style.transform.match(/^translate3d\(([^,]+)px, ([^,]+)px, 0\) scale\(([^,)]+)\)$/)
  assert.ok(match, `artwork must face the screen and scale uniformly: ${style.transform}`)
  const [tx, ty, scale] = match.slice(1).map(Number)
  assert.ok([tx, ty, scale].every(Number.isFinite))
  assert.ok(scale > 0)
  return [originX + (x - originX) * scale + tx, originY + (y - originY) * scale + ty]
}

function screen(f, [x, y]) {
  const { width, height } = f.bounds()
  const scale = Number(f.elements['.scene-rig'].style.transform.match(/scale\(([^)]+)\)/)[1])
  return [width / 2 + (x - 836) * scale, height / 2 + (y - 470.5) * scale]
}

// The table is rotated 90 degrees about X: tabletop Y becomes world depth,
// and positive object height goes upward, toward decreasing world Y.
function tabletop(f, [x, y, height = 0]) {
  return screen(f, project(f, [x, 778 - height, y]))
}

const difference = (a, b) => a.map((value, index) => value - b[index])
const length = vector => Math.hypot(...vector)
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0)

// These bounds come from the rendered layers, rather than reproducing the
// composable's eye-position interpolation or its inverse source projection.
test('initial camera restores the cover and all four original prop rectangles pixel for pixel', () => {
  assert.deepEqual(sourceProps.map(prop => prop.id), ['red-chip-stack', 'green-chip-stack', 'single-red-chip', 'card-stack'])
  for (const [width, height] of viewports) {
    const f = fixture(width, height)
    const contain = Math.min(width / 1672, height / 941)
    const offsetX = (width - 1672 * contain) / 2
    const offsetY = (height - 941 * contain) / 2
    for (const point of [[0, 0], [836, 470.5], [1672, 941]]) {
      const actual = screen(f, billboard(f.elements['.scene-portrait'].style, point, [836, 778]))
      close(actual[0], offsetX + point[0] * contain)
      close(actual[1], offsetY + point[1] * contain)
      const world = project(f, [...point, 0])
      close(world[0], point[0]); close(world[1], point[1])
    }
    for (const { source: prop, style } of f.props) {
      for (const [x, y] of [[0, 0], [prop.width, 0], [0, prop.height], [prop.width, prop.height]]) {
        const actual = screen(f, billboard(style, [x, y], [prop.width / 2, prop.height / 2]))
        close(actual[0], offsetX + (prop.x + x) * contain)
        close(actual[1], offsetY + (prop.y + y) * contain)
      }
    }
    f.scene.dispose()
  }
})

test('the cover tabletop continues to the viewport bottom beyond the source image', () => {
  for (const [width, height] of viewports) {
    const f = fixture(width, height)
    const insets = f.elements['.scene-clip'].style.clipPath.match(/[\d.]+/g).map(Number)
    assert.deepEqual(insets.slice(1), [0, 0, 0], 'The felt must not be clipped at the source image sides or bottom')
    // Stop just before the perspective near plane, where the floor expands
    // past the viewport. Its projected surface must contain both lower corners.
    const floor = [[0, 0], [1672, 0], [1672, 699], [0, 699]].map(point => tabletop(f, point))
    for (const point of [[.5, height - .5], [width - .5, height - .5]]) {
      for (let i = 0; i < floor.length; i++) {
        const a = floor[i], b = floor[(i + 1) % floor.length]
        const cross = (b[0] - a[0]) * (point[1] - a[1]) - (b[1] - a[1]) * (point[0] - a[0])
        assert.ok(cross >= 0, `${width}×${height}: lower corner ${point} lies outside the tabletop`)
      }
    }
    f.scene.dispose()
  }
})

test('portrait keeps its aspect ratio throughout both camera directions', () => {
  for (const [width, height] of [[1280, 800], [375, 812]]) {
    const f = fixture(width, height)
    const snapshots = []
    for (let step = 0; step <= 100; step++) {
      f.scene.setProgress(step / 100)
      const artwork = [{ style: f.elements['.scene-portrait'].style, width: 1672, height: 778, origin: [836, 778] }]
      for (const item of artwork) {
        const a = billboard(item.style, [0, 0], item.origin)
        const b = billboard(item.style, [item.width, 0], item.origin)
        const c = billboard(item.style, [0, item.height], item.origin)
        close(a[1], b[1]); close(a[0], c[0])
        close((b[0] - a[0]) / (c[1] - a[1]), item.width / item.height)
      }
      snapshots.push(artwork.map(item => item.style.transform))
    }
    for (let step = 100; step >= 0; step--) {
      f.scene.setProgress(step / 100)
      assert.deepEqual([f.elements['.scene-portrait'].style.transform], snapshots[step])
    }
    f.scene.dispose()
  }
})

test('old cover sprites disappear early and physical furniture remains fixed through both camera directions', () => {
  for (const [width, height] of [[1280, 800], [375, 812]]) {
    const f = fixture(width, height)
    const transforms = f.physicalProps.map(prop => prop.style.transform)
    assert.equal(Number(f.root.style['--cover-prop-opacity']), 1)
    assert.equal(Number(f.root.style['--physical-prop-opacity']), 0)
    for (const progress of [.12, .24, .5, 1, .75, .24]) {
      f.scene.setProgress(progress)
      if (progress >= .24) {
        assert.equal(Number(f.root.style['--cover-prop-opacity']), 0)
        assert.equal(Number(f.root.style['--physical-prop-opacity']), 1)
      }
      assert.deepEqual(f.physicalProps.map(prop => prop.style.transform), transforms)
    }
    f.scene.setProgress(0)
    assert.equal(Number(f.root.style['--cover-prop-opacity']), 1)
    assert.equal(Number(f.root.style['--physical-prop-opacity']), 0)
    assert.deepEqual(f.physicalProps.map(prop => prop.style.transform), transforms)
    f.scene.dispose()
  }
})

test('top-down physical chips have circular tops and card backs share the mode cards plane', () => {
  assert.equal(OPENING_CHIP_SEGMENTS, 48)
  assert.deepEqual(OPENING_PROP_MODELS.map(model => model.id), sourceProps.map(prop => prop.id))
  assert.deepEqual(OPENING_EXTRA_PROP_MODELS.map(model => model.id), ['extra-red-chip', 'extra-green-chip', 'extra-cardback'])
  assert.equal(physicalModels.length, 7)
  for (const [width, height] of viewports) {
    const f = fixture(width, height)
    // Every furniture contact is recovered from the original cover, preserving
    // the position of each object rather than moving it into a new arrangement.
    for (const model of OPENING_PROP_MODELS) {
      assert.equal(model.anchor.z, 0)
      const contact = project(f, [model.anchor.x, 778, model.anchor.y])
      close(contact[0], model.sourceContact[0])
      close(contact[1], model.sourceContact[1])
    }
    f.scene.setProgress(1)
    const modeDepth = parseFloat(f.root.style['--mode-card-depth'])
    for (const model of physicalModels) {
      assert.equal(model.anchor.z, 0)
      assert.ok(Number.isFinite(model.anchor.x) && Number.isFinite(model.anchor.y))
      const topHeight = model.kind === 'chips' ? model.height : model.layers.length * model.thickness
      const center = [model.anchor.x, model.anchor.y, topHeight]
      const origin = tabletop(f, center)
      const horizontalUnit = difference(tabletop(f, [center[0] + 1, center[1], topHeight]), origin)
      const depthUnit = difference(tabletop(f, [center[0], center[1] + 1, topHeight]), origin)
      close(length(horizontalUnit), length(depthUnit))
      close(dot(horizontalUnit, depthUnit), 0)

      // A virtual mode-card point at the same height must use precisely the
      // same scale as these distant original props in both table directions.
      const modeOrigin = tabletop(f, [836, modeDepth, topHeight])
      close(length(horizontalUnit), length(difference(tabletop(f, [837, modeDepth, topHeight]), modeOrigin)))
      close(length(depthUnit), length(difference(tabletop(f, [836, modeDepth + 1, topHeight]), modeOrigin)))

      if (model.kind === 'chips') {
        const horizontalDiameter = difference(
          tabletop(f, [center[0] + model.radius, center[1], topHeight]),
          tabletop(f, [center[0] - model.radius, center[1], topHeight]),
        )
        const depthDiameter = difference(
          tabletop(f, [center[0], center[1] + model.radius, topHeight]),
          tabletop(f, [center[0], center[1] - model.radius, topHeight]),
        )
        close(length(horizontalDiameter), length(depthDiameter))
        close(dot(horizontalDiameter, depthDiameter), 0)
      } else {
        const angle = model.rotation * Math.PI / 180
        const corner = (x, y) => tabletop(f, [
          center[0] + x * Math.cos(angle) - y * Math.sin(angle),
          center[1] + x * Math.sin(angle) + y * Math.cos(angle), topHeight,
        ])
        const a = corner(-model.width / 2, -model.length / 2)
        const across = difference(corner(model.width / 2, -model.length / 2), a)
        const along = difference(corner(-model.width / 2, model.length / 2), a)
        close(dot(across, along), 0)
        close(length(across) / length(along), 2 / 3)
      }
    }
    f.scene.dispose()
  }
})

test('top-down framing leaves only a full-viewport table at every supported aspect ratio', () => {
  for (const [width, height] of viewports) {
    const f = fixture(width, height)
    f.scene.setProgress(1)
    assert.equal(f.root.dataset.viewPitch, '90')
    for (const x of [0, 836, 1672]) {
      const portraitBottom = screen(f, billboard(f.elements['.scene-portrait'].style, [x, 778], [836, 778]))
      assert.ok(portraitBottom[1] < 0, `${width}×${height}: portrait bottom remains in view at ${portraitBottom[1]}`)
    }
    const a = screen(f, project(f, [0, 778, 0]))
    const b = screen(f, project(f, [1672, 778, 0]))
    const tableDepth = parseFloat(f.root.style['--table-depth'])
    assert.ok(Number.isFinite(tableDepth) && tableDepth >= 4000)
    const c = screen(f, project(f, [0, 778, tableDepth]))
    const d = screen(f, project(f, [1672, 778, tableDepth]))
    close(a[1], b[1]); close(c[1], d[1]); close(a[0], c[0]); close(b[0], d[0])
    close(b[0] - a[0], d[0] - c[0])
    assert.ok(a[0] <= .0001 && b[0] >= width - .0001, `${width}×${height}: table does not cover viewport width`)
    assert.ok(a[1] < 0 && c[1] >= height, `${width}×${height}: table ends at ${c[1]}, before viewport bottom ${height}`)
    assert.equal(f.elements['.scene-clip'].style.clipPath, 'inset(0px 0px 0px 0px)')
    f.scene.dispose()
  }
})

test('resizing keeps the current angle and cancel restores original contain framing', () => {
  const f = fixture()
  f.scene.setProgress(.5)
  assert.equal(f.root.dataset.viewPitch, '45')
  f.resize(375, 812)
  assert.equal(f.root.dataset.viewPitch, '45')
  f.scene.setProgress(-1)
  assert.equal(f.root.dataset.viewPitch, '0')
  close(parseFloat(f.elements['.scene-camera'].style.perspective), 700)
  close(project(f, [836, 470.5, 0])[1], 470.5)
  close(parseFloat(f.elements['.scene-clip'].style.clipPath.slice(6)), (812 - 941 * 375 / 1672) / 2)
  for (const { source: prop, style } of f.props) {
    const corner = billboard(style, [0, 0], [prop.width / 2, prop.height / 2])
    close(corner[0], prop.x); close(corner[1], prop.y)
  }
  f.scene.setProgress(2)
  assert.equal(f.root.dataset.viewPitch, '90')
  f.events.get('orientationchange')()
  assert.equal(f.root.dataset.viewPitch, '90')
  f.scene.dispose()
})

test('dispose removes resize listeners and prevents late camera or prop changes', () => {
  const f = fixture()
  f.scene.setProgress(.4)
  const transforms = Object.values(f.elements).map(element => element.style.transform)
  const props = f.props.map(prop => prop.style.transform)
  const depth = f.root.style['--mode-card-depth']
  const tableDepth = f.root.style['--table-depth']
  const coverOpacity = f.root.style['--cover-prop-opacity']
  const physicalOpacity = f.root.style['--physical-prop-opacity']
  f.scene.dispose()
  assert.equal(f.observer().disconnected, true)
  assert.equal(f.events.size, 0)
  f.scene.setProgress(1)
  f.resize(390, 844)
  assert.deepEqual(Object.values(f.elements).map(element => element.style.transform), transforms)
  assert.deepEqual(f.props.map(prop => prop.style.transform), props)
  assert.equal(f.root.style['--mode-card-depth'], depth)
  assert.equal(f.root.style['--table-depth'], tableDepth)
  assert.equal(f.root.style['--cover-prop-opacity'], coverOpacity)
  assert.equal(f.root.style['--physical-prop-opacity'], physicalOpacity)
  f.scene.dispose()
})
