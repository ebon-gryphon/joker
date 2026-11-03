// The flying card is drawn on the viewport canvas, independent of the
// contained cover image. These dimensions retain the original card artwork.
export const OPENING_CARD = Object.freeze({
  width: 248,
  height: 372,
  originX: 124,
  originY: 180,
})

const clamp = value => Math.max(0, Math.min(1, value))
const smooth = value => {
  const progress = clamp(value)
  return progress * progress * (3 - 2 * progress)
}

export function createOpeningFlightLayout(width, height) {
  const sourceScale = Math.min(width / 1672, height / 941)
  // Overscan puts every viewport corner inside the opaque card face, including
  // tall phones and wide displays, without changing the artwork's proportions.
  const coverScale = Math.max(
    6.9 * sourceScale,
    (width + 8) / OPENING_CARD.width,
    (height + 8) / OPENING_CARD.height,
  ) * 1.02
  return {
    width,
    height,
    sourceScale,
    startY: (height - 941 * sourceScale) / 2 + 350 * sourceScale,
    coverScale,
    coveredY: height / 2 - (OPENING_CARD.height / 2 - OPENING_CARD.originY) * coverScale,
    exitY: height + OPENING_CARD.originY * coverScale + 8,
  }
}

export function openingFlightPose(layout, progress, reduced = false) {
  const position = clamp(progress)
  const startScale = 0.12 * layout.sourceScale
  return {
    x: layout.width / 2,
    y: layout.startY + (layout.coveredY - layout.startY) * smooth(position),
    scale: startScale + (layout.coverScale - startScale) * position * position,
    angle: reduced ? 0 : -Math.PI * 4 * (1 - smooth(position / 0.88)),
  }
}

export function openingRevealPose(layout, progress) {
  const position = clamp(progress)
  return {
    x: layout.width / 2,
    y: layout.coveredY + (layout.exitY - layout.coveredY) * smooth(position),
    scale: layout.coverScale,
    angle: 0,
  }
}
