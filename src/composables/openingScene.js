const SOURCE_WIDTH = 1672
const SOURCE_HEIGHT = 941
const CENTER_X = SOURCE_WIDTH / 2
const CENTER_Y = SOURCE_HEIGHT / 2
const INITIAL_PERSPECTIVE = 700
const FINAL_TABLE_DISTANCE = 6000
const FINAL_PERSPECTIVE = 7000
const PHONE_BREAKPOINT = 600
const PHONE_PERSPECTIVE = 3500
const PHONE_TABLE_WIDTH = 1140
const TABLE_Y = 778
const TABLE_VIEW_NEAR_DEPTH = 104

const clamp = value => Math.max(0, Math.min(1, Number(value) || 0))
const mix = (from, to, progress) => from + (to - from) * progress

/** Move one camera through the cover scene without animating its furniture. */
export function createOpeningScene(root) {
  const clip = root.querySelector('.scene-clip')
  const rig = root.querySelector('.scene-rig')
  const camera = root.querySelector('.scene-camera')
  const world = root.querySelector('.scene-world')
  const portrait = root.querySelector('.scene-portrait')
  if (!clip || !rig || !camera || !world || !portrait) {
    throw new Error('Opening scene requires its clip, rig, camera, world and portrait elements')
  }
  const coverProps = [...root.querySelectorAll('[data-cover-prop]')].map(element => {
    const x = Number(element.dataset.sourceX), y = Number(element.dataset.sourceY)
    const width = Number(element.dataset.sourceWidth), height = Number(element.dataset.sourceHeight)
    const sourceX = x + width / 2, sourceY = y + height / 2
    const h = TABLE_Y - CENTER_Y, v = sourceY - TABLE_Y
    // Recover a fixed anchor on the table from its original cover pixel.
    const depth = INITIAL_PERSPECTIVE * v / (h + v)
    const worldX = (sourceX * h + CENTER_X * v) / (h + v)
    return { element, width, height, worldX, depth, sourceScale: 1 - depth / INITIAL_PERSPECTIVE }
  })

  const view = root.ownerDocument?.defaultView ?? globalThis
  let progress = 0
  let disposed = false
  let width = 0
  let height = 0

  function render() {
    if (disposed || width <= 0 || height <= 0) return

    const phone = width <= PHONE_BREAKPOINT
    const containedScale = Math.min(width / SOURCE_WIDTH, height / SOURCE_HEIGHT)
    const offsetY = Math.max(0, (height - SOURCE_HEIGHT * containedScale) / 2)
    const finalPerspective = phone ? PHONE_PERSPECTIVE : FINAL_PERSPECTIVE
    const phoneProjectedWidth = PHONE_TABLE_WIDTH * PHONE_PERSPECTIVE / FINAL_TABLE_DISTANCE
    const finalScale = phone
      ? Math.max(containedScale, Math.min(.72, (width - 24) / phoneProjectedWidth))
      : Math.max(containedScale, width * FINAL_TABLE_DISTANCE / (SOURCE_WIDTH * finalPerspective))
    const finalGroundScale = finalScale * finalPerspective / FINAL_TABLE_DISTANCE
    // Frame the table itself. Its far rail and upright cover are beyond the top
    // of the viewport at every aspect ratio, without a mask or a black band.
    const finalEyeZ = TABLE_VIEW_NEAR_DEPTH + height / (2 * finalGroundScale)
    const perspective = mix(INITIAL_PERSPECTIVE, finalPerspective, progress)
    const pitch = progress * 90
    const angle = pitch * Math.PI / 180
    // Orbit while preserving the rail's smooth screen path. A long lens at the
    // final overhead view avoids exaggerated parallax on the far chip stacks.
    const groundZoom = mix(1, finalPerspective / FINAL_TABLE_DISTANCE, progress)
    const orbitDepth = perspective / groundZoom
    const railOffset = mix(TABLE_Y - CENTER_Y, -finalEyeZ * finalPerspective / FINAL_TABLE_DISTANCE, progress)
    const orbitVertical = railOffset / groundZoom
    const eyeY = TABLE_Y - (orbitDepth * Math.sin(angle) + orbitVertical * Math.cos(angle))
    const eyeZ = orbitDepth * Math.cos(angle) - orbitVertical * Math.sin(angle)
    const scale = mix(containedScale, finalScale, progress)
    // The cover is a painted low-angle view. Once the camera begins to lean,
    // hand it over to rigid tabletop geometry rather than retaining that view.
    const blend = clamp((progress - .04) / .2)
    const physicalOpacity = blend * blend * (3 - 2 * blend)
    root.style.setProperty('--cover-prop-opacity', String(1 - physicalOpacity))
    root.style.setProperty('--physical-prop-opacity', String(physicalOpacity))
    root.style.setProperty('--mode-card-depth', `${finalEyeZ - (phone ? 675 : 420) / 2 + (phone ? 30 / finalGroundScale : 0)}px`)
    root.style.setProperty('--table-depth', `${Math.max(4000, Math.ceil(finalEyeZ + height / (2 * finalGroundScale) + 256))}px`)

    function project(x, y, z) {
      const dy = y - eyeY, dz = z - eyeZ
      const depth = dy * Math.sin(angle) - dz * Math.cos(angle)
      const factor = perspective / depth
      return {
        x: CENTER_X + (x - CENTER_X) * factor,
        y: CENTER_Y + (dy * Math.cos(angle) + dz * Math.sin(angle)) * factor,
        scale: factor,
      }
    }

    rig.style.transformOrigin = '50% 50%'
    rig.style.transform = `translate(-50%, -50%) scale(${scale})`
    camera.style.perspective = `${perspective}px`
    camera.style.perspectiveOrigin = `${CENTER_X}px ${CENTER_Y}px`
    world.style.transformOrigin = '0 0 0'
    // CSS applies these from right to left: subtract the eye position, rotate
    // the view, then place it at the perspective element's projection origin.
    // With progress 0 the two translations cancel exactly.
    world.style.transform = `translate3d(${CENTER_X}px, ${CENTER_Y}px, ${perspective}px) rotateX(${-pitch}deg) translate3d(${-CENTER_X}px, ${-eyeY}px, ${-eyeZ}px)`

    // The joker and short-lived cover cutouts retain the original art ratio.
    // Real props are children of the table and are never reprojected separately.
    const joker = project(CENTER_X, TABLE_Y, 0)
    portrait.style.transform = `translate3d(${joker.x - CENTER_X}px, ${joker.y - TABLE_Y}px, 0) scale(${joker.scale})`
    for (const prop of coverProps) {
      const point = project(prop.worldX, TABLE_Y, prop.depth)
      prop.element.style.transform = `translate3d(${point.x - prop.width / 2}px, ${point.y - prop.height / 2}px, 0) scale(${point.scale * prop.sourceScale})`
    }

    const insetY = offsetY * (1 - progress)
    // Let the same physical tabletop continue below the source artwork. The
    // portrait still uses contain framing; the lower viewport is not a black bar.
    clip.style.clipPath = `inset(${insetY}px 0px 0px 0px)`
    root.dataset.viewPitch = String(pitch)
  }

  function resize() {
    if (disposed) return
    const bounds = root.getBoundingClientRect()
    width = bounds.width
    height = bounds.height
    render()
  }

  resize()
  const Observer = view.ResizeObserver ?? globalThis.ResizeObserver
  const observer = Observer ? new Observer(resize) : null
  observer?.observe(root)
  view.addEventListener?.('resize', resize)
  view.addEventListener?.('orientationchange', resize)

  return {
    setProgress(value) {
      if (disposed) return
      progress = clamp(value)
      render()
    },
    dispose() {
      if (disposed) return
      disposed = true
      observer?.disconnect()
      view.removeEventListener?.('resize', resize)
      view.removeEventListener?.('orientationchange', resize)
    },
  }
}
