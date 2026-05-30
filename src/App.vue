<template>
  <div class="app-layout">
    <!-- 游戏进行中 -->
    <template v-if="phase === 'playing'">
      <!-- 设置按钮 -->
      <button class="px-btn btn-settings settings-btn" @click="showSettings = true">
        ⚙️
      </button>

      <!-- 左侧 Sidebar -->
      <SideBar
        :currentBlind="currentBlind"
        :blindScore="displayBlindScore"
        :progress="Math.min(100, Math.round((displayBlindScore / currentBlind.target) * 100))"
        :handsLeft="handsLeft"
        :discardsLeft="discardsLeft"
        :money="money"
        :previewScore="previewScore"
        :roundIndex="roundIndex"
      />

      <!-- 右侧主区域 -->
      <div class="main-area">
        <!-- 第1段: Joker区 (230px) -->
        <JokerArea
          :jokers="jokers"
          ref="jokerAreaRef"
        />

        <!-- 第2段: 出牌区 (1fr) -->
        <PlayArea
          :playedCards="playedCards"
          :deckCount="deckCount"
          :isScoring="isScoring"
          :scoringState="scoringState"
          ref="playAreaRef"
        />

        <!-- 第3段: 手牌+操作 (280px) -->
        <HandArea
          :hand="hand"
          :selectedCards="selectedCards"
          :selectedCount="selectedCount"
          :discardsLeft="discardsLeft"
          :isScoring="isScoring"
          :aiThinking="aiThinking"
          ref="handAreaRef"
          @selectCard="toggleCard"
          @play="handlePlay"
          @discard="handleDiscard"
          @sortByRank="sortByRank"
          @sortBySuit="sortBySuit"
          @aiPlay="handleAIPlay"
        />
      </div>
    </template>

    <!-- 商店 -->
    <ShopScreen
      v-if="phase === 'shop'"
      :shopItems="shopItems"
      :soldItems="soldItems"
      :money="money"
      :jokerCount="jokers.length"
      :nextBlind="BLINDS[roundIndex + 1] || BLINDS[roundIndex]"
      @buy="handleBuy"
      @skip="skipShop"
    />

    <!-- 通关 / 失败 -->
    <EndScreen
      v-if="phase === 'won' || phase === 'lost'"
      :isWon="phase === 'won'"
      :blindScore="displayBlindScore"
      :currentBlind="currentBlind"
      :money="money"
      :jokerCount="jokers.length"
      @restart="restart"
    />

    <!-- 设置弹窗 -->
    <SettingsModal
      v-if="showSettings"
      :settings="settings"
      @close="showSettings = false"
      @save="onSaveSettings"
    />
  </div>
</template>

<script setup>
import { ref, reactive, nextTick, watch } from 'vue'
import gsap from 'gsap'

import SideBar from './components/SideBar.vue'
import JokerArea from './components/JokerArea.vue'
import PlayArea from './components/PlayArea.vue'
import HandArea from './components/HandArea.vue'
import ShopScreen from './components/ShopScreen.vue'
import EndScreen from './components/EndScreen.vue'
import SettingsModal from './components/SettingsModal.vue'

import { useGameState, BLINDS } from './composables/useGameState.js'
import { animSpeed, flyToElement, triggerJoker, showScorePopup, countUp } from './composables/useAnimations.js'
import { findBestPlay } from './composables/useAI.js'

// ─── 游戏状态 ───
const {
  phase, roundIndex, blindScore, money, handsLeft, discardsLeft,
  deck, deckCount, hand, selectedCards, playedCards, jokers,
  currentHandType, isScoring, shopItems, soldItems,
  currentBlind, progress, selectedCount, previewScore,
  toggleCard, sortByRank, sortBySuit,
  playHand, finishScoring, discardCards,
  buyJoker, skipShop, restart,
} = useGameState()

// ─── UI 状态 ───
const showSettings = ref(false)
const aiThinking = ref(false)
const displayBlindScore = ref(0) // 动画中的显示值

// 计分动画状态（传给 PlayArea 显示）
const scoringState = reactive({
  handType: null,
  chips: 0,
  mult: 0,
})

// ─── 设置 ───
const DEFAULT_SETTINGS = { bgmVolume: 60, sfxVolume: 80, animSpeed: 1.0, showFormula: true }
const SETTINGS_KEY = 'balatro.settings'

const settings = ref({
  ...DEFAULT_SETTINGS,
  ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
})
animSpeed.value = settings.value.animSpeed

function onSaveSettings(newSettings) {
  settings.value = newSettings
  animSpeed.value = newSettings.animSpeed
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings))
}

// ─── 组件 ref ───
const jokerAreaRef = ref(null)
const playAreaRef = ref(null)
const handAreaRef = ref(null)

// ─── 动画速度辅助 ───
function dur(ms) {
  return (ms / 1000) * animSpeed.value
}

// ─── 出牌处理（含完整动画时序） ───
async function handlePlay() {
  if (isScoring.value || selectedCards.value.length === 0) return

  const result = playHand()
  if (!result) return

  const { chips, mult, score, hand: handType, playedCards: pCards } = result

  // 设置计分状态
  scoringState.handType = handType
  scoringState.chips = handType ? handType.chips : 0
  scoringState.mult = handType ? handType.mult : 0

  try {
    // 等待 DOM 更新，让 PlayArea 渲染出牌
    await nextTick()

    // 延迟让 DOM 确实渲染
    await delay(100)

    // 逐张高亮 + 飞字
    const cardEls = playAreaRef.value?.cardRefs?.value || []
    const chipsBlockEl = playAreaRef.value?.chipsBlockRef?.value
    const multBlockEl = playAreaRef.value?.multBlockRef?.value

    let runningChips = handType ? handType.chips : 0
    let runningMult = handType ? handType.mult : 1

    // 逐张高亮（每张 150ms 间隔）
    for (let i = 0; i < pCards.length; i++) {
      const cardVal = cardValue(pCards[i].rank)
      runningChips += cardVal

      await delay(150)

      // 高亮牌
      const cardEl = cardEls[i]?.$el || cardEls[i]
      if (cardEl) {
        gsap.to(cardEl, {
          y: -18,
          boxShadow: '0 0 20px #4dd6ff, 0 0 40px #4dd6ff',
          duration: dur(150),
          ease: 'power2.out',
          yoyo: true,
          repeat: 1,
        })
      }

      // 飞字 +N chips
      if (chipsBlockEl) {
        const span = document.createElement('div')
        span.textContent = `+${cardVal}`
        span.style.cssText = `
          position: fixed;
          color: #4dd6ff;
          font-family: 'Press Start 2P', monospace;
          font-size: 18px;
          font-weight: bold;
          pointer-events: none;
          z-index: 9999;
          text-shadow: 0 0 10px #4dd6ff;
          left: ${cardEl ? cardEl.getBoundingClientRect().left + cardEl.getBoundingClientRect().width / 2 : '50%'}px;
          top: ${cardEl ? cardEl.getBoundingClientRect().top : '50%'}px;
          transform: translate(-50%, 0);
        `
        document.body.appendChild(span)

        const chipsRect = chipsBlockEl.getBoundingClientRect()
        gsap.to(span, {
          left: chipsRect.left + chipsRect.width / 2,
          top: chipsRect.top + chipsRect.height / 2,
          duration: dur(400),
          ease: 'power2.in',
          opacity: 0,
          onComplete: () => { span.remove(); scoringState.chips = runningChips }
        })
      }
    }

    await delay(pCards.length * 150 + 200)

    // Joker 效果依次触发
    const jokerEls = jokerAreaRef.value?.jokerRefs?.value || []

    for (let j = 0; j < jokers.value.length; j++) {
      const joker = jokers.value[j]
      const jokerEl = jokerEls[j]?.$el || jokerEls[j]

      // 检查该 Joker 是否对这手牌有效
      const { mult: newMult, chips: newChips } = applyJokerPreview(joker, pCards, handType, runningChips, runningMult)
      const multDiff = newMult - runningMult
      const chipsDiff = newChips - runningChips

      if (multDiff === 0 && chipsDiff === 0) continue

      // Joker 触发动画
      if (jokerEl) {
        gsap.timeline()
          .to(jokerEl, { y: -18, scale: 1.15, boxShadow: '0 0 16px #ffc857, 0 0 32px #ffc857', duration: dur(200), ease: 'back.out(2)' })
          .to(jokerEl, { y: 0, scale: 1, boxShadow: 'none', duration: dur(600), ease: 'elastic.out(1, 0.4)' })
      }

      await delay(200)

      // 飞字
      if (multBlockEl && jokerEl) {
        const jokerRect = jokerEl.getBoundingClientRect()
        const multRect = multBlockEl.getBoundingClientRect()

        const span = document.createElement('div')
        if (multDiff > 0) {
          span.textContent = joker.id === 'heart_collector' || joker.id === 'club_lover' || joker.id === 'royal_face'
            ? `×${newMult / runningMult}`
            : `+${multDiff} Mult`
        }
        span.style.cssText = `
          position: fixed;
          color: #ff8844;
          font-family: 'Press Start 2P', monospace;
          font-size: 16px;
          font-weight: bold;
          pointer-events: none;
          z-index: 9999;
          text-shadow: 0 0 10px #ff8844;
          left: ${jokerRect.left + jokerRect.width / 2}px;
          top: ${jokerRect.top}px;
          transform: translate(-50%, 0);
        `
        document.body.appendChild(span)

        gsap.to(span, {
          left: multRect.left + multRect.width / 2,
          top: multRect.top + multRect.height / 2,
          duration: dur(400),
          ease: 'power2.in',
          opacity: 0,
          onComplete: () => {
            span.remove()
            runningMult = newMult
            runningChips = newChips
            scoringState.mult = runningMult
            scoringState.chips = runningChips
          }
        })
      } else {
        runningMult = newMult
        runningChips = newChips
        scoringState.mult = runningMult
        scoringState.chips = runningChips
      }

      await delay(800)
    }

    await delay(200)

    // 中央弹出大字
    showScorePopupFn(`${runningChips} × ${runningMult} = ${score}`)

    await delay(600)

    // blindScore 数字累加
    const startScore = displayBlindScore.value
    const targetScore = startScore + score
    const scoreObj = { val: startScore }
    gsap.to(scoreObj, {
      val: targetScore,
      duration: dur(600),
      ease: 'power1.out',
      onUpdate: () => { displayBlindScore.value = Math.round(scoreObj.val) }
    })

    await delay(700)

    // 完成计分
    finishScoring(score)

    // 重置计分显示（延迟清除，让玩家看到）
    await delay(800)
  } catch (e) {
    console.error('handlePlay error:', e)
    finishScoring(score)
  } finally {
    scoringState.handType = null
    scoringState.chips = 0
    scoringState.mult = 0
    // 确保 isScoring 不会永久卡住
    if (isScoring.value) isScoring.value = false
  }
}

// 应用 Joker 效果（用于动画预览）
function applyJokerPreview(joker, cards, hand, chips, mult) {
  switch (joker.id) {
    case 'jester': return { chips, mult: mult + 4 }
    case 'scholar': {
      let m = mult
      for (const c of cards) if (c.rank === 'A') m += 4
      return { chips, mult: m }
    }
    case 'heart_collector':
      return cards.some(c => c.suit === '♥') ? { chips, mult: mult * 4 } : { chips, mult }
    case 'club_lover':
      return cards.some(c => c.suit === '♣') ? { chips, mult: mult * 4 } : { chips, mult }
    case 'royal_face':
      return cards.some(c => ['J','Q','K'].includes(c.rank)) ? { chips, mult: mult * 10 } : { chips, mult }
    case 'straight_flush_master':
      return hand.name === '同花顺' ? { chips, mult: mult + 50 } : { chips, mult }
    default:
      return { chips, mult }
  }
}

function cardValue(rank) {
  if (rank === 'A') return 11
  if (['J','Q','K'].includes(rank)) return 10
  return parseInt(rank) || 0
}

function showScorePopupFn(text) {
  const el = document.createElement('div')
  el.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) scale(0.8);
    z-index: 9998;
    font-family: 'Press Start 2P', monospace;
    font-size: 24px;
    color: #fff;
    text-align: center;
    text-shadow: 0 0 20px #4dd6ff, 0 0 40px #4dd6ff;
    pointer-events: none;
    white-space: nowrap;
    opacity: 0;
    background: rgba(10, 20, 56, 0.85);
    padding: 16px 24px;
    border-radius: 12px;
    border: 2px solid rgba(77, 214, 255, 0.4);
  `
  el.textContent = text
  document.body.appendChild(el)

  gsap.timeline({ onComplete: () => el.remove() })
    .to(el, { opacity: 1, scale: 1.05, duration: dur(200), ease: 'back.out(2)', transformOrigin: 'center center' })
    .to(el, { opacity: 0, scale: 0.9, duration: dur(300), delay: dur(800) / 1000, ease: 'power2.in' })
}

// ─── 弃牌处理 ───
async function handleDiscard() {
  if (isScoring.value || discardsLeft.value <= 0 || selectedCards.value.length === 0) return
  discardCards()
}

// ─── AI 出牌 ───
async function handleAIPlay() {
  if (aiThinking.value || isScoring.value) return

  aiThinking.value = true
  await delay(800)

  const bestCombo = findBestPlay(hand.value, jokers.value)
  if (bestCombo.length > 0) {
    // 清除当前选中（通过逐个取消选择）
    const currentSelected = [...selectedCards.value]
    for (const id of currentSelected) {
      toggleCard(id)
    }

    // 选中最佳组合
    for (const card of bestCombo) {
      toggleCard(card.id)
    }

    await delay(200)
    aiThinking.value = false
    await handlePlay()
  } else {
    aiThinking.value = false
  }
}

// ─── 商店购买 ───
function handleBuy(jokerId) {
  buyJoker(jokerId)
}

// ─── 工具函数 ───
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// 同步 displayBlindScore 与 blindScore（初始和重置时）
watch(blindScore, (newVal, oldVal) => {
  // 只在重置为0时同步（finishScoring 中会手动更新）
  if (newVal === 0) displayBlindScore.value = 0
}, { immediate: true })
</script>

<style scoped>
.app-layout {
  display: flex;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  position: relative;
  background: var(--bg-deep);
}

/* 右侧主区域 */
.main-area {
  flex: 1;
  display: grid;
  grid-template-rows: 230px 1fr 320px;
  overflow: hidden;
  min-width: 0;
}

/* 设置按钮（右上角） */
.settings-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 100;
  min-height: 44px;
  padding: 10px 14px;
  font-size: 18px;
}
</style>
