<template>
  <div data-physical-props class="physical-table-props" aria-hidden="true">
    <svg class="prop-definitions" width="0" height="0">
      <defs>
        <pattern id="opening-card-back-weave" patternUnits="userSpaceOnUse" width="9" height="9" patternTransform="rotate(45)">
          <rect width="9" height="9" fill="#3c1411" />
          <path d="M0 0H9M0 4.5H9" stroke="#855233" stroke-width=".6" />
          <path d="M0 0V9M4.5 0V9" stroke="#1b0d0b" stroke-width=".7" />
          <rect x="3.5" y="3.5" width="2" height="2" fill="#a47b40" opacity=".5" />
        </pattern>
      </defs>
    </svg>
    <div
      v-for="prop in props"
      :key="prop.id"
      :data-physical-prop="prop.id"
      :data-extra-prop="prop.extra ? '' : undefined"
      :data-prop-kind="prop.kind"
      :data-anchor-x="prop.anchor.x"
      :data-anchor-y="prop.anchor.y"
      data-anchor-z="0"
      class="physical-prop"
      :class="`prop-${prop.kind}`"
      :style="{ transform: `translate3d(${prop.anchor.x}px, ${prop.anchor.y}px, 0)` }"
    >
      <template v-if="prop.kind === 'chips'">
        <div class="prop-shadow chip-shadow" :style="chipShadowStyle(prop)"></div>
        <div v-for="layer in prop.count" :key="layer" class="chip-layer" :class="`chip-${prop.tone}`">
          <div
            v-for="panel in prop.panels"
            :key="panel.index"
            data-prop-side
            class="chip-wall"
            :class="{ 'ivory-segment': panel.ivory }"
            :style="chipWallStyle(prop, layer, panel)"
          ></div>
          <svg
            data-prop-top
            :data-height="layer * prop.height / prop.count"
            :data-diameter="prop.radius * 2"
            :data-layer="layer"
            class="chip-top"
            :width="prop.radius * 2"
            :height="prop.radius * 2"
            :viewBox="prop.texture.join(' ')"
            preserveAspectRatio="none"
            :style="{ left: `${-prop.radius}px`, top: `${-prop.radius}px`, transform: `translateZ(${layer * prop.height / prop.count}px)` }"
          >
            <image :href="`${base}opening/source.jpg`" width="1672" height="941" />
          </svg>
        </div>
      </template>
      <template v-else>
        <div class="prop-shadow card-shadow" :style="cardShadowStyle(prop)"></div>
        <div class="physical-card-stack" :style="{ transform: `rotateZ(${prop.rotation}deg)` }">
          <div
            v-for="(layer, index) in prop.layers"
            :key="index"
            class="physical-card"
            :style="{ transform: `translate3d(${layer.x}px, ${layer.y}px, ${index * prop.thickness}px) rotateZ(${layer.rotation}deg)` }"
          >
            <div
              v-for="panel in prop.panels"
              :key="panel.id"
              data-prop-side
              class="card-edge"
              :style="cardWallStyle(prop, panel)"
            ></div>
            <svg
              data-prop-top
              :data-height="(index + 1) * prop.thickness"
              :data-width="prop.width"
              :data-length="prop.length"
              :data-layer="index + 1"
              class="physical-card-back"
              :width="prop.width"
              :height="prop.length"
              viewBox="0 0 135 202.5"
              :style="{ left: `${-prop.width / 2}px`, top: `${-prop.length / 2}px`, transform: `translateZ(${prop.thickness}px)` }"
            >
              <rect x=".4" y=".4" width="134.2" height="201.7" rx="4.5" fill="#b99a64" stroke="#362015" stroke-width=".8" />
              <rect x="3" y="3" width="129" height="196.5" rx="2.5" fill="#682b1e" stroke="#ead09a" stroke-width="1.2" />
              <rect x="6" y="6" width="123" height="190.5" fill="url(#opening-card-back-weave)" stroke="#bc9047" stroke-width="1.2" />
              <rect x="10" y="10" width="115" height="182.5" fill="none" stroke="#a57435" stroke-width=".65" />
              <path d="M14 14H121V188.5H14Z M18 18H117V184.5H18Z" fill="none" stroke="#d0a45c" stroke-width=".6" />
              <path d="M67.5 39L103 101.25 67.5 163.5 32 101.25Z M67.5 48L96 101.25 67.5 154.5 39 101.25Z" fill="#4b1913" stroke="#b98a40" stroke-width="1.5" />
              <path d="M67.5 62L90 101.25 67.5 140.5 45 101.25Z M51 101.25H84 M67.5 74V128.5" fill="none" stroke="#cfaa64" stroke-width="1" />
              <path d="M67.5 86L78 101.25 67.5 116.5 57 101.25Z" fill="#bd9149" stroke="#34100b" stroke-width="1.2" />
              <g v-for="corner in cardCorners" :key="`${corner.x}-${corner.y}`" :transform="`translate(${corner.x} ${corner.y}) rotate(${corner.rotation})`" fill="none" stroke="#d4b171">
                <path d="M0 0H18M0 0V18 M4 13Q4 4 13 4 M8 17Q8 8 17 8" stroke-width="1" />
                <rect x="2.5" y="2.5" width="5" height="5" transform="rotate(45 5 5)" fill="#a26f32" stroke-width=".7" />
              </g>
            </svg>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { OPENING_PROP_MODELS, OPENING_EXTRA_PROP_MODELS, chipSidePanels, cardSidePanels } from '../composables/openingPropGeometry.js'

const base = import.meta.env.BASE_URL
const props = [...OPENING_PROP_MODELS, ...OPENING_EXTRA_PROP_MODELS].map(model => ({
  ...model,
  panels: model.kind === 'chips' ? chipSidePanels(model) : cardSidePanels(model),
}))
const cardCorners = [
  { x: 12, y: 12, rotation: 0 },
  { x: 123, y: 12, rotation: 90 },
  { x: 123, y: 190.5, rotation: 180 },
  { x: 12, y: 190.5, rotation: 270 },
]

function chipWallStyle(prop, layer, panel) {
  const layerHeight = prop.height / prop.count
  return {
    left: `${-panel.width / 2}px`, width: `${panel.width}px`, height: `${layerHeight}px`,
    transform: `translate3d(${panel.x}px, ${panel.y}px, ${(layer - 1) * layerHeight}px) rotateZ(${panel.rotation}deg) rotateX(90deg)`,
    '--wall-shade': panel.shade,
  }
}

function chipShadowStyle(prop) {
  return {
    left: `${-prop.radius * 1.3}px`, top: `${-prop.radius * 1.18}px`,
    width: `${prop.radius * 2.6}px`, height: `${prop.radius * 2.36}px`,
    transform: 'translate3d(10px, 12px, .15px)',
  }
}

function cardShadowStyle(prop) {
  return {
    left: `${-prop.width * .57}px`, top: `${-prop.length * .54}px`,
    width: `${prop.width * 1.14}px`, height: `${prop.length * 1.08}px`,
    transform: `translate3d(10px, 12px, .15px) rotateZ(${prop.rotation}deg)`,
  }
}

function cardWallStyle(prop, panel) {
  return {
    left: `${-panel.width / 2}px`, width: `${panel.width}px`, height: `${prop.thickness}px`,
    transform: `translate3d(${panel.x}px, ${panel.y}px, 0) rotateZ(${panel.rotation}deg) rotateX(90deg)`,
  }
}
</script>

<style scoped>
.physical-table-props { position: absolute; inset: 0; pointer-events: none; transform-style: preserve-3d; }
.prop-definitions { position: absolute; pointer-events: none; }
.physical-prop, .chip-layer, .physical-card-stack, .physical-card { position: absolute; left: 0; top: 0; width: 0; height: 0; transform-style: preserve-3d; pointer-events: none; }
.prop-shadow, .chip-top, .chip-wall, .physical-card-back, .card-edge { position: absolute; opacity: var(--physical-prop-opacity, 1); pointer-events: none; }
.prop-shadow { background: radial-gradient(ellipse at center, #000b 0%, #0008 40%, #0003 61%, transparent 73%); }
.chip-shadow { border-radius: 50%; }
.chip-top { overflow: hidden; border-radius: 50%; backface-visibility: hidden; outline: .35px solid #b0945c55; }
.chip-wall { top: 0; transform-origin: 50% 0; backface-visibility: hidden; background: linear-gradient(#0005 0%, transparent 19%, transparent 70%, #0009 100%), linear-gradient(90deg, #0002, transparent 55%, #0003), #43110e; box-shadow: inset 0 .65px #b8713f88, inset 0 -.65px #100706; }
.chip-green .chip-wall { background-color: #122921; }
.chip-wall.ivory-segment { background-color: #b3915e; }
.chip-wall::after { content: ''; position: absolute; inset: 0; background: #000; opacity: var(--wall-shade); }
.physical-card-back { overflow: visible; backface-visibility: hidden; }
.card-edge { top: 0; transform-origin: 50% 0; background: #b29463; box-shadow: inset 0 -.3px #372116; }
</style>
