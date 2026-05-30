import { ref } from 'vue'
import gsap from 'gsap'

// 全局动画速度倍率（1=普通, 1.5=慢, 0.6=快）
export const animSpeed = ref(1)

function dur(ms) {
  return (ms / 1000) * animSpeed.value
}

// 从一个元素飞到另一个元素
export function flyToElement(el, targetEl, color = '#4dd6ff', text = '', onComplete) {
  if (!el || !targetEl) {
    onComplete?.()
    return
  }

  const fromRect = el.getBoundingClientRect()
  const toRect = targetEl.getBoundingClientRect()

  const span = document.createElement('div')
  span.className = 'fly-text'
  span.textContent = text
  span.style.cssText = `
    position: fixed;
    left: ${fromRect.left + fromRect.width / 2}px;
    top: ${fromRect.top + fromRect.height / 2}px;
    color: ${color};
    font-family: 'Press Start 2P', monospace;
    font-size: 20px;
    font-weight: bold;
    pointer-events: none;
    z-index: 9999;
    transform: translate(-50%, -50%);
    text-shadow: 0 0 12px ${color};
  `
  document.body.appendChild(span)

  const destX = toRect.left + toRect.width / 2
  const destY = toRect.top + toRect.height / 2

  gsap.to(span, {
    left: destX,
    top: destY,
    duration: dur(400),
    ease: 'power2.in',
    opacity: 0,
    onComplete: () => {
      span.remove()
      onComplete?.()
    }
  })
}

// 牌飞向出牌区
export function flyCardToPlayArea(cardEl, targetEl, onComplete) {
  if (!cardEl || !targetEl) {
    onComplete?.()
    return
  }
  const fromRect = cardEl.getBoundingClientRect()
  const toRect = targetEl.getBoundingClientRect()

  const clone = cardEl.cloneNode(true)
  clone.style.cssText = `
    position: fixed;
    left: ${fromRect.left}px;
    top: ${fromRect.top}px;
    width: ${fromRect.width}px;
    height: ${fromRect.height}px;
    z-index: 9997;
    pointer-events: none;
    border-radius: 10px;
  `
  document.body.appendChild(clone)

  // 隐藏原始牌
  cardEl.style.opacity = '0'

  gsap.to(clone, {
    left: toRect.left + (toRect.width - fromRect.width) / 2,
    top: toRect.top + (toRect.height - fromRect.height) / 2,
    duration: dur(350),
    ease: 'power2.inOut',
    onComplete: () => {
      clone.remove()
      onComplete?.()
    }
  })
}

// 牌高亮（上移 + 蓝光）
export function highlightCard(cardEl, onComplete) {
  if (!cardEl) {
    onComplete?.()
    return
  }
  const tl = gsap.timeline({ onComplete })
  tl.to(cardEl, {
    y: -18,
    boxShadow: '0 0 20px #4dd6ff, 0 0 40px #4dd6ff',
    duration: dur(150),
    ease: 'power2.out',
  })
  tl.to(cardEl, {
    y: 0,
    boxShadow: 'none',
    duration: dur(150),
    ease: 'power2.in',
    delay: dur(100),
  })
}

// Joker 触发动画
export function triggerJoker(jokerEl, onComplete) {
  if (!jokerEl) {
    onComplete?.()
    return
  }
  const tl = gsap.timeline({ onComplete })
  tl.to(jokerEl, {
    y: -18,
    scale: 1.15,
    boxShadow: '0 0 16px #ffc857, 0 0 32px #ffc857',
    duration: dur(200),
    ease: 'back.out(2)',
  })
  tl.to(jokerEl, {
    y: 0,
    scale: 1,
    boxShadow: 'none',
    duration: dur(600),
    ease: 'elastic.out(1, 0.4)',
  })
}

// 中央弹出大字
export function showScorePopup(text, onComplete) {
  const el = document.createElement('div')
  el.className = 'score-popup'
  el.textContent = text
  el.style.opacity = '0'
  document.body.appendChild(el)

  const tl = gsap.timeline({ onComplete: () => { el.remove(); onComplete?.() } })
  tl.to(el, { opacity: 1, scale: 1.2, duration: dur(200), ease: 'back.out(2)' })
  tl.to(el, { opacity: 0, scale: 0.9, duration: dur(300), delay: dur(800) / 1000 * 1, ease: 'power2.in' })
}

// 数字插值
export function countUp(reactiveRef, targetVal, duration = 600, onComplete) {
  const start = reactiveRef.value || 0
  const obj = { val: start }
  gsap.to(obj, {
    val: targetVal,
    duration: dur(duration),
    ease: 'power1.out',
    onUpdate: () => {
      reactiveRef.value = Math.round(obj.val)
    },
    onComplete,
  })
}

// 牌从牌堆飞入手牌区
export function flyCardFromDeck(deckEl, targetSlotEl, cardData, onComplete) {
  if (!deckEl || !targetSlotEl) {
    onComplete?.()
    return
  }
  const fromRect = deckEl.getBoundingClientRect()
  const toRect = targetSlotEl.getBoundingClientRect()

  const cardClone = document.createElement('div')
  cardClone.style.cssText = `
    position: fixed;
    left: ${fromRect.left}px;
    top: ${fromRect.top}px;
    width: 100px;
    height: 145px;
    background: linear-gradient(135deg, #1a2858, #2d4080);
    border: 2px solid rgba(74, 107, 255, 0.5);
    border-radius: 10px;
    z-index: 9996;
    pointer-events: none;
  `
  document.body.appendChild(cardClone)

  gsap.to(cardClone, {
    left: toRect.left,
    top: toRect.top,
    duration: dur(400),
    ease: 'power2.out',
    onComplete: () => {
      cardClone.remove()
      onComplete?.()
    }
  })
}
