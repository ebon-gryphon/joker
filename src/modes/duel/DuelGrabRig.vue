<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { grabPose, projectArm, rightGrabFrame } from './grabMotion.js'
import { drawAttachedArm } from './grabMesh.js'

const props = defineProps({ elapsed: { type: Number, default: 0 }, reducedMotion: Boolean })
const emit = defineEmits(['ready'])
const stage = ref(null), puppet = ref(null), canvas = ref(null)
const ready = ref(false), bodyFailed = ref(false), canvasFailed = ref(false), size = ref(0)
const viewport = ref({ width: 0, height: 0 })
const asset = name => `${import.meta.env.BASE_URL}duel/${name}`
const images = {}, anchors = {
  // Split at the dark sleeve below the entire lace cuff, so a foreground
  // white cuff never ends at a straight clipped edge across the screen.
  reach: { shoulder: { x: .87, y: .835 }, palm: { x: .53, y: .43 }, wrist: { x: .60, y: .72 } },
  close: { shoulder: { x: .87, y: .835 }, palm: { x: .53, y: .43 }, wrist: { x: .60, y: .72 } },
}
let observer, disposed = false, paintKey = ''
const pose = computed(() => grabPose(props.elapsed, { reducedMotion: props.reducedMotion }))
const mix = (a, b, n) => a + (b - a) * n
const fingerClosure = computed(() => props.elapsed >= 2920)
const fallbackStyle = computed(() => projectArm({ actorRect: { left:(viewport.value.width-size.value)/2, top:viewport.value.height/2-size.value*.48, width:size.value,height:size.value }, handSize:{width:size.value,height:size.value}, shoulder:{x:.16,y:.82}, armAnchor:anchors.reach.shoulder, palmAnchor:anchors.reach.palm, scale:.25+pose.value.thrust*2.2, rotation:mix(-6,6,pose.value.thrust) }).css)
const style = computed(() => {
  const p = pose.value, impact = Math.sin(Math.min(1, Math.max(0, (p.time - 3100) / 105)) * Math.PI)
  return {
    '--rig-x': `${-p.bodyLean.x * size.value + p.camera.x * viewport.value.width + impact * 3}px`,
    '--rig-y': `${p.bodyLean.y * size.value + p.camera.y * viewport.value.height + impact * 5}px`,
    '--rig-rotation': `${-p.bodyLean.rotation}deg`,
    '--rig-scale': String(p.camera.scale),
    '--body-light': String(1 - .16 * p.thrust),
  }
})

function measure() {
  if (!stage.value || !puppet.value) return
  viewport.value = { width: stage.value.clientWidth, height: stage.value.clientHeight }
  size.value = puppet.value.clientWidth
  paint()
}
function paint() {
  const surface = canvas.value, { width, height } = viewport.value
  if (!surface || !width || !size.value || canvasFailed.value) return
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  const p = pose.value
  const key = p.cover === 1 || p.time < 1950 ? `empty:${width}:${height}:${ready.value}` : [width,height,size.value,dpr,ready.value,p.thrust,p.contact].join(':')
  if (key === paintKey) return
  paintKey = key
  if (surface.width !== Math.round(width * dpr) || surface.height !== Math.round(height * dpr)) {
    surface.width = Math.round(width * dpr)
    surface.height = Math.round(height * dpr)
  }
  const ctx = surface.getContext('2d', { alpha: true })
  if (!ctx) { canvasFailed.value = true; return }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  if (!ready.value || props.reducedMotion || pose.value.cover === 1 || p.time < 1950) return
  // Keep the existing shoulder and entrance path in screen coordinates.
  // Draw the glove in its source orientation, with the thumb on viewer right.
  const frame = rightGrabFrame(p.time, {width,height,actorSize:size.value})
  const closing = frame.closure
  const poses = images.close && closing > 0 ? [['reach', 1 - closing], ['close', closing]] : [['reach', 1]]
  for (const [name, opacity] of poses) {
    const image = images[name] || images.reach, source = anchors[images[name] ? name : 'reach']
    if (!image || opacity <= 0) continue
    ctx.globalAlpha = opacity * frame.opacity
    drawAttachedArm(ctx, image, {
      sourceSize: { width: image.naturalWidth, height: image.naturalHeight },
      shoulderAnchor: source.shoulder, palmAnchor: source.palm, wristAnchor: source.wrist,
      shoulder:frame.screenShoulder, palm:frame.screenPalm,
      rootScale:frame.rootScale, palmScale:frame.palmScale, rotation:frame.rotation,
    })
  }
  ctx.globalAlpha = 1
}
async function load(name, file) {
  const image = new Image()
  image.src = asset(file)
  let timer
  try {
    await Promise.race([image.decode(), new Promise((_, reject) => { timer=setTimeout(() => reject(Error('image unavailable')), 2200) })])
    if (!disposed) images[name] = image
  } catch { /* A missing optional pose uses the loaded reaching arm. */ }
  finally { clearTimeout(timer) }
}
watch(() => [props.elapsed, props.reducedMotion], paint, { flush: 'post' })
onMounted(async () => {
  observer = new ResizeObserver(measure)
  observer.observe(stage.value)
  observer.observe(puppet.value)
  measure()
  await Promise.all([load('body', 'finale-body-v2.png'), load('reach', 'finale-left-arm-v2.png'), load('close', 'finale-left-close-v2.png')])
  if (!disposed) {
    // Select available poses before the clock starts, never midway through a reach.
    if (!images.reach && images.close) images.reach = images.close
    ready.value = !!images.reach
    paint()
    emit('ready', { animated: ready.value })
  }
})
onBeforeUnmount(() => { disposed = true; observer?.disconnect() })
</script>

<template>
  <div ref="stage" class="finale-loss-rig" :style="style" :data-motion="pose.stage" :data-side="'right'" :data-limb="pose.time < 1950 ? 'offscreen' : fingerClosure ? 'close' : 'reach'" :data-ready="ready" aria-hidden="true">
    <div class="rig-motion">
      <div ref="puppet" class="rig-puppet">
        <img v-if="!bodyFailed" :src="asset('finale-body-v2.png')" alt="" @error="bodyFailed = true" />
        <div v-else class="rig-shadow"></div>
      </div>
      <canvas ref="canvas" class="rig-right-arm"></canvas>
      <div v-if="canvasFailed && ready && !reducedMotion && pose.time >= 1950" class="rig-fallback-arm"><img class="rig-arm-fallback" :src="images.reach.src" :style="fallbackStyle" alt="" /></div>
    </div>
  </div>
</template>

<style scoped>
.finale-loss-rig { position:absolute; inset:0; pointer-events:none; }
.rig-motion { position:absolute; inset:0; transform:translate(var(--rig-x),var(--rig-y)) rotate(var(--rig-rotation)) scale(var(--rig-scale)); transform-origin:50% 50%; }
.rig-puppet { position:absolute; left:50%; top:50%; width:min(118vw,100dvh,850px); aspect-ratio:1; transform:translate(-50%,-48%); }
.rig-puppet > img { display:block; width:100%; height:100%; filter:brightness(var(--body-light)) drop-shadow(0 16px 24px #0008); }
.rig-puppet::after { content:''; position:absolute; inset:0; background:linear-gradient(transparent 74%,#02060499 90%,#020604); }
.rig-right-arm { position:absolute; inset:0; width:100%; height:100%; }
.rig-fallback-arm { position:absolute; inset:0; }
.rig-arm-fallback { position:absolute; max-width:none; }
.rig-shadow { position:absolute; inset:10% 15% 0; border-radius:45% 45% 0 0; background:radial-gradient(ellipse at 50% 35%,#564a39,#11150d 60%); }
@media(max-width:600px) { .rig-puppet { width:min(125vw,90dvh); } }
</style>
