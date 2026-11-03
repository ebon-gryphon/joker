const SVG_NS = 'http://www.w3.org/2000/svg'
const COLUMNS = 48
const ROWS = 72
const clamp = value => Math.max(0, Math.min(1, value))
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t) }
let nextMask = 0

// A fixed field makes every fragment keep its place when a frame is skipped.
function noise(x, y, seed = 0) {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123
  return value - Math.floor(value)
}

function field(x, y) {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = smooth(x - ix)
  const fy = smooth(y - iy)
  const a = noise(ix, iy)
  const b = noise(ix + 1, iy)
  const c = noise(ix, iy + 1)
  const d = noise(ix + 1, iy + 1)
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
}

function saveStyles(element, names) {
  return names.map(name => [name, element.style[name] || ''])
}

function restoreStyles(element, saved) {
  saved.forEach(([name, value]) => { element.style[name] = value })
}

function cardPixels(card, width, height) {
  const image = card.querySelector('img')
  const imageWidth = image?.naturalWidth
  const imageHeight = image?.naturalHeight
  if (!imageWidth || !imageHeight) return undefined
  try {
    const sample = card.ownerDocument.createElement('canvas')
    sample.width = COLUMNS
    sample.height = ROWS
    const context = sample.getContext('2d', { willReadFrequently: true })
    if (!context) return undefined
    // The card art uses object-fit: cover. Sample that same crop, never the DOM.
    const scale = Math.max(width / imageWidth, height / imageHeight)
    const cropWidth = width / scale
    const cropHeight = height / scale
    context.drawImage(image, (imageWidth - cropWidth) / 2, (imageHeight - cropHeight) / 2,
      cropWidth, cropHeight, 0, 0, COLUMNS, ROWS)
    return context.getImageData(0, 0, COLUMNS, ROWS).data
  } catch {
    // A missing/tainted image must never block the opening sequence.
    return undefined
  }
}

function fragmentColor(pixels, index, x, y) {
  const base = index * 4
  const n = noise(x, y, 9)
  let red = pixels?.[base] ?? 118 + n * 42
  let green = pixels?.[base + 1] ?? 108 + n * 34
  let blue = pixels?.[base + 2] ?? 88 + n * 25
  // The actual caption is DOM above the image, with warm paper and dark ink.
  if (x > 0.08 && x < 0.92 && y > 0.69 && y < 0.94) {
    const ink = ((y > 0.75 && y < 0.82) || (y > 0.86 && y < 0.90)) && n < 0.22
    red = ink ? 48 : 193 + n * 25
    green = ink ? 40 : 169 + n * 23
    blue = ink ? 30 : 126 + n * 26
  }
  const gray = red * 0.29 + green * 0.55 + blue * 0.16
  // Keep the source reds/blues, with a restrained ash/paper cast.
  const ash = n < 0.08 ? 0.65 : 0.22
  return `rgb(${Math.round(red * (1 - ash) + gray * ash)}, ${Math.round(green * (1 - ash) + gray * ash)}, ${Math.round(blue * (1 - ash) + gray * ash)})`
}

/**
 * Disintegrate the real, unmoved DOM card through a local SVG mask. Dust is
 * drawn in the same table coordinates, independent of camera or viewport size.
 */
export function createCardDissolve(card, canvas, { box, direction = 1, transform = 'none' } = {}) {
  const document = card?.ownerDocument
  const window = document?.defaultView
  const width = Math.max(1, Number(box?.width) || card?.offsetWidth || 280)
  const height = Math.max(1, Number(box?.height) || card?.offsetHeight || 420)
  const sign = direction < 0 ? -1 : 1
  const padX = Math.ceil(width * 0.88 + 40)
  const padY = Math.ceil(height * 0.64 + 40)
  const canvasWidth = width + padX * 2
  const canvasHeight = height + padY * 2
  const savedCard = card?.style ? saveStyles(card, [
    'maskImage', 'webkitMaskImage', 'maskSize', 'webkitMaskSize',
    'maskRepeat', 'webkitMaskRepeat', 'maskPosition', 'webkitMaskPosition', 'visibility',
  ]) : []
  const savedCanvas = canvas?.style ? saveStyles(canvas, [
    'left', 'top', 'width', 'height', 'transform', 'transformOrigin', 'opacity',
  ]) : []
  let context
  let svg
  let disposed = false
  let maskReady = false
  const cells = []
  const particles = []

  try {
    if (canvas?.style) {
      canvas.style.left = `${(Number(box?.x) || 0) - padX}px`
      canvas.style.top = `${(Number(box?.y) || 0) - padY}px`
      canvas.style.width = `${canvasWidth}px`
      canvas.style.height = `${canvasHeight}px`
      canvas.style.transformOrigin = '50% 50%'
      canvas.style.transform = `translateZ(2px)${transform && transform !== 'none' ? ` ${transform}` : ''}`
      canvas.style.opacity = '1'
      // Limit the backing store: these are tiny dust motes, not a full-screen bitmap.
      const pixelRatio = Math.min(Number(window?.devicePixelRatio) || 1, 2,
        Math.max(1, Math.sqrt(3000000 / (canvasWidth * canvasHeight))))
      canvas.width = Math.ceil(canvasWidth * pixelRatio)
      canvas.height = Math.ceil(canvasHeight * pixelRatio)
      context = canvas.getContext('2d')
      context?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      canvas.hidden = false
    }
  } catch {
    context = undefined
  }

  const pixels = card && document ? cardPixels(card, width, height) : undefined
  let mask
  try {
    if (card?.style && document?.createElementNS) {
      const id = `opening-card-dissolve-${++nextMask}`
      svg = document.createElementNS(SVG_NS, 'svg')
      svg.setAttribute('width', '0')
      svg.setAttribute('height', '0')
      svg.setAttribute('aria-hidden', 'true')
      svg.style.position = 'absolute'
      svg.style.pointerEvents = 'none'
      const defs = document.createElementNS(SVG_NS, 'defs')
      mask = document.createElementNS(SVG_NS, 'mask')
      mask.setAttribute('id', id)
      mask.setAttribute('maskUnits', 'objectBoundingBox')
      mask.setAttribute('maskContentUnits', 'objectBoundingBox')
      mask.setAttribute('x', '0')
      mask.setAttribute('y', '0')
      mask.setAttribute('width', '1')
      mask.setAttribute('height', '1')
      mask.setAttribute('mask-type', 'luminance')
      defs.appendChild(mask)
      svg.appendChild(defs)
      ;(document.body || card.parentElement)?.appendChild(svg)
      card.style.maskImage = `url("#${id}")`
      card.style.webkitMaskImage = `url("#${id}")`
      card.style.maskSize = '100% 100%'
      card.style.webkitMaskSize = '100% 100%'
      card.style.maskRepeat = 'no-repeat'
      card.style.webkitMaskRepeat = 'no-repeat'
      card.style.maskPosition = '0 0'
      card.style.webkitMaskPosition = '0 0'
      maskReady = true
    }
  } catch {
    svg?.remove?.()
    svg = undefined
    restoreStyles(card, savedCard)
  }

  for (let row = 0; row < ROWS; row += 1) {
    for (let column = 0; column < COLUMNS; column += 1) {
      const x = (column + 0.5) / COLUMNS
      const y = (row + 0.5) / ROWS
      const edge = sign < 0 ? x : 1 - x
      const organic = field(column / 5.2, row / 6.7)
      const birth = 0.025 + clamp(edge * 0.75 + organic * 0.19 + y * 0.035 + noise(column, row, 1) * 0.06) * 0.66
      const fade = 0.055 + noise(column, row, 2) * 0.045
      let rect
      if (maskReady) {
        rect = document.createElementNS(SVG_NS, 'rect')
        // Slightly overlap neighbouring cells to prevent antialiased seams at t=0.
        rect.setAttribute('x', String(column / COLUMNS - 0.00014))
        rect.setAttribute('y', String(row / ROWS - 0.00014))
        rect.setAttribute('width', String(1 / COLUMNS + 0.00028))
        rect.setAttribute('height', String(1 / ROWS + 0.00028))
        rect.setAttribute('fill', 'white')
        mask.appendChild(rect)
      }
      cells.push({ rect, birth, fade, opacity: 1 })
      const index = row * COLUMNS + column
      const seed = noise(column, row, 3)
      const drift = 0.6 + noise(column, row, 4) * 0.4
      // One very small mote per consumed patch; no big flying card squares.
      particles.push({
        x: x * width + (noise(column, row, 5) - 0.5) * width / COLUMNS,
        y: y * height + (noise(column, row, 6) - 0.5) * height / ROWS,
        birth: birth + fade * 0.3,
        life: 0.19 + seed * 0.14,
        dx: sign * width * (0.28 + drift * 0.53),
        dy: -height * (0.17 + noise(column, row, 7) * 0.36),
        curl: (noise(column, row, 8) - 0.5) * width * 0.15,
        size: Math.min(width, height) * (0.0022 + seed * 0.0040),
        alpha: 0.55 + seed * 0.28,
        color: fragmentColor(pixels, index, x, y),
      })
    }
  }

  function draw(progress) {
    if (disposed) return
    const value = clamp(Number(progress) || 0)
    if (card?.style) card.style.visibility = value >= 1 ? 'hidden' : savedCard.find(([name]) => name === 'visibility')?.[1] || ''
    for (const cell of cells) {
      const opacity = 1 - smooth((value - cell.birth) / cell.fade)
      if (cell.rect && opacity !== cell.opacity) {
        cell.rect.setAttribute('opacity', String(opacity))
        cell.opacity = opacity
      }
    }
    if (!context) return
    context.clearRect(0, 0, canvasWidth, canvasHeight)
    if (value <= 0 || value >= 1) return
    for (const particle of particles) {
      const age = (value - particle.birth) / particle.life
      if (age <= 0 || age >= 1) continue
      const travel = age * (0.42 + age * 0.58)
      const flutter = Math.sin(age * Math.PI * 1.7) * particle.curl
      const px = padX + particle.x + particle.dx * travel + flutter * 0.45
      const py = padY + particle.y + particle.dy * travel + flutter * 0.25
      const radius = Math.max(0.18, particle.size * (1 - age * 0.82))
      context.globalAlpha = particle.alpha * smooth(age / 0.12) * (1 - smooth((age - 0.35) / 0.65))
      context.fillStyle = particle.color
      context.beginPath()
      context.ellipse(px, py, radius * 0.72, radius, -sign * 0.45, 0, Math.PI * 2)
      context.fill()
    }
    context.globalAlpha = 1
  }

  function dispose() {
    if (disposed) return
    disposed = true
    if (card?.style) restoreStyles(card, savedCard)
    svg?.remove?.()
    if (context) context.clearRect(0, 0, canvasWidth, canvasHeight)
    if (canvas) {
      canvas.hidden = true
      if (canvas.style) restoreStyles(canvas, savedCanvas)
    }
  }

  draw(0)
  return { draw, dispose }
}
