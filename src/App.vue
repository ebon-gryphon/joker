<template>
  <OpeningScreen v-if="!hasEntered" :soundEnabled="!settings.sfxMuted" @sound="setOpeningSound" @start="initAudio" @complete="enterGame" />
  <div class="app-layout" :inert="!hasEntered || showSettings || showCatalog || showRoute">
    <!-- 游戏进行中 -->
    <template v-if="phase === 'playing'">
      <!-- 左侧 Sidebar -->
      <SideBar
        :currentBlind="currentBlind"
        :blindScore="displayBlindScore"
        :progress="Math.min(100, Math.round((displayBlindScore / currentBlind.target) * 100))"
        :handsLeft="handsLeft"
        :discardsLeft="discardsLeft"
        :money="money"
        :roundIndex="roundIndex"
        @route="showRoute = true"
        @settings="showSettings = true"
      />

      <!-- 右侧主区域 -->
      <div class="main-area">
        <!-- 小丑牌组合 -->
        <JokerArea
          :jokers="jokers"
          :disabled="isScoring || aiThinking"
          @move="moveJoker"
          @catalog="showCatalog = true"
          ref="jokerAreaRef"
        />

        <!-- 出牌结算 -->
        <PlayArea
          :playedCards="playedCards"
          :deckCount="deckCount"
          :isScoring="isScoring"
          :scoringState="scoringState"
          ref="playAreaRef"
        />

        <!-- 手牌、预览和操作 -->
        <HandArea
          :hand="hand"
          :selectedCards="selectedCards"
          :selectedCount="selectedCount"
          :discardsLeft="discardsLeft"
          :isScoring="isScoring"
          :aiThinking="aiThinking"
          :previewScore="previewScore"
          :remainingScore="Math.max(0, currentBlind.target - blindScore)"
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
      :jokers="jokers"
      :lastReward="lastReward"
      @sell="sellJoker"
      @move="moveJoker"
      @catalog="showCatalog = true"
      :nextBlind="BLINDS[roundIndex + 1] || BLINDS[roundIndex]"
      :rerollCost="SHOP_REROLL_COST"
      @buy="handleBuy"
      @reroll="handleReroll"
      @skip="handleSkip"
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

  </div>

    <RouteModal v-if="showRoute" :roundIndex="roundIndex" @close="showRoute = false" />
    <JokerCatalog v-if="showCatalog" :jokers="jokers" @close="showCatalog = false" />

    <!-- 设置弹窗 -->
    <SettingsModal
      v-if="showSettings"
      :settings="settings"
      @close="showSettings = false"
      @save="onSaveSettings"
    />
</template>

<script setup>
import { ref, reactive, nextTick, watch } from 'vue'
import gsap from 'gsap'
import { initAudio, playSfx, startAiLoop, stopAiLoop, playBgm, applyAudioSettings } from './composables/useAudio.js'

import OpeningScreen from './components/OpeningScreen.vue'
import RouteModal from './components/RouteModal.vue'
import SideBar from './components/SideBar.vue'
import JokerCatalog from './components/JokerCatalog.vue'
import JokerArea from './components/JokerArea.vue'
import PlayArea from './components/PlayArea.vue'
import HandArea from './components/HandArea.vue'
import ShopScreen from './components/ShopScreen.vue'
import EndScreen from './components/EndScreen.vue'
import SettingsModal from './components/SettingsModal.vue'

import { useGameState, BLINDS, SHOP_REROLL_COST } from './composables/useGameState.js'
import { animSpeed } from './composables/useAnimations.js'
import { findBestPlay } from './composables/useAI.js'

// ─── 游戏状态 ───
const {
  scoreContext, lastReward, moveJoker, sellJoker,
  phase, roundIndex, blindScore, money, handsLeft, discardsLeft,
  deckCount, hand, selectedCards, playedCards, jokers,
  isScoring, shopItems, soldItems,
  currentBlind, selectedCount, previewScore,
  toggleCard, sortByRank, sortBySuit,
  playHand, finishScoring, discardCards,
  buyJoker, rerollShop, skipShop, restart,
} = useGameState()

// ─── UI 状态 ───
const hasEntered = ref(false)
const showRoute = ref(false)
const showSettings = ref(false)
const showCatalog = ref(false)
const aiThinking = ref(false)
const displayBlindScore = ref(0) // 动画中的显示值

// 计分动画状态（传给 PlayArea 显示）
const scoringState = reactive({
  handType: null,
  chips: 0,
  mult: 0,
})

// ─── 设置 ───
const DEFAULT_SETTINGS = { bgmVolume: 60, sfxVolume: 80, bgmMuted: false, sfxMuted: false, animSpeed: 1.0, showFormula: true }
const SETTINGS_KEY = 'balatro.settings'

let savedSettings = {}
try { savedSettings = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {} } catch {}
const settings = ref({ ...DEFAULT_SETTINGS, ...savedSettings })
animSpeed.value = settings.value.animSpeed

function onSaveSettings(newSettings) {
  settings.value = newSettings
  animSpeed.value = newSettings.animSpeed
  applyAudioSettings(newSettings)
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings)) } catch {}
}

function setOpeningSound(enabled) {
  onSaveSettings({ ...settings.value, sfxMuted: !enabled, bgmMuted: !enabled })
}

function enterGame() {
  hasEntered.value = true
  nextTick(() => document.querySelector('.hand-cards button')?.focus({ preventScroll: true }))
  initAudio()
  playBgm('main')
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
  if (!hasEntered.value || isScoring.value || aiThinking.value || selectedCards.value.length === 0) return

  playSfx('play')
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
    const cardEls = Array.from(document.querySelectorAll('.played-cards .card-view'))
    const chipsBlockEl = document.querySelector('.scoring-chips-block')
    const multBlockEl = document.querySelector('.scoring-mult-block')

    let runningChips = handType ? handType.chips : 0
    let runningMult = handType ? handType.mult : 1

    playSfx('fly')

    // 逐张高亮（每张 150ms 间隔）
    for (let i = 0; i < pCards.length; i++) {
      const cardVal = cardValue(pCards[i].rank)
      runningChips += cardVal
      const displayedChips = runningChips

      await delay(150)
      playSfx('chip')

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
          font-family: Georgia, serif;
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
          onComplete: () => { span.remove(); scoringState.chips = displayedChips }
        })
      }
    }

    await delay(pCards.length * 150 + 200)

    // Joker 效果依次触发
    const jokerEls = Array.from(document.querySelectorAll('.joker-card'))

    for (let j = 0; j < jokers.value.length; j++) {
      const joker = jokers.value[j]
      const jokerEl = jokerEls[j]?.$el || jokerEls[j]

      // 检查该 Joker 是否对这手牌有效
      const { mult: newMult, chips: newChips } = result.steps[j]
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
      playSfx('joker')

      // 飞字
      const isChipEffect = chipsDiff > 0 && multDiff === 0
      const targetBlockEl = isChipEffect ? chipsBlockEl : multBlockEl

      if (targetBlockEl && jokerEl) {
        const jokerRect = jokerEl.getBoundingClientRect()
        const targetRect = targetBlockEl.getBoundingClientRect()

        const span = document.createElement('div')
        span.textContent = result.steps[j].label
        const effectColor = isChipEffect ? '#4dd6ff' : '#ff8844'
        span.style.cssText = `
          position: fixed;
          color: ${effectColor};
          font-family: Georgia, serif;
          font-size: 16px;
          font-weight: bold;
          pointer-events: none;
          z-index: 9999;
          text-shadow: 0 0 10px ${effectColor};
          left: ${jokerRect.left + jokerRect.width / 2}px;
          top: ${jokerRect.top}px;
          transform: translate(-50%, 0);
        `
        document.body.appendChild(span)

        gsap.to(span, {
          left: targetRect.left + targetRect.width / 2,
          top: targetRect.top + targetRect.height / 2,
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
    playSfx('score')
    if (settings.value.showFormula) {
      showScorePopupFn(`${runningChips} × ${runningMult} = ${score}`)
    }

    await delay(600)

    // blindScore 数字累加
    playSfx('count')
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

    // Keep the table locked until every visual has finished.
    await delay(300)
  } catch (e) {
    console.error('handlePlay error:', e)
  } finally {
    scoringState.handType = null
    scoringState.chips = 0
    scoringState.mult = 0
    // 清空出牌区，避免打出的牌卡在中央不消失
    playedCards.value = []
    // Cleanup precedes the state transition so the next hand cannot be cleared by this animation.
    finishScoring(score)
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
    font-family: Georgia, serif;
    font-size: 24px;
    color: #fff;
    text-align: center;
    text-shadow: 0 0 20px #4dd6ff, 0 0 40px #4dd6ff;
    pointer-events: none;
    white-space: nowrap;
    opacity: 0;
    background: rgba(11, 26, 19, 0.95);
    padding: 16px 24px;
    border-radius: 3px;
    border: 1px solid #c5a565;
  `
  el.textContent = text
  document.body.appendChild(el)

  gsap.timeline({ onComplete: () => el.remove() })
    .to(el, { opacity: 1, scale: 1.05, duration: dur(200), ease: 'back.out(2)', transformOrigin: 'center center' })
    .to(el, { opacity: 0, scale: 0.9, duration: dur(300), delay: dur(800), ease: 'power2.in' })
}

// ─── 弃牌处理 ───
async function handleDiscard() {
  if (!hasEntered.value || aiThinking.value || isScoring.value || discardsLeft.value <= 0 || selectedCards.value.length === 0) return
  playSfx('discard')
  discardCards()
}

// ─── AI 出牌 ───
async function handleAIPlay() {
  if (!hasEntered.value || aiThinking.value || isScoring.value) return

  aiThinking.value = true
  playSfx('ai-start')
  startAiLoop()
  await delay(800)
  stopAiLoop()

  const bestCombo = findBestPlay(hand.value, jokers.value, scoreContext.value)
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

function handleReroll() {
  if (rerollShop()) playSfx('sort')
}

// ─── 商店跳过 ───
function handleSkip() {
  skipShop()
}

// ─── 工具函数 ───
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms * animSpeed.value))
}

// 同步 displayBlindScore 与 blindScore（初始和重置时）
watch(blindScore, (newVal) => {
  if (newVal === 0) displayBlindScore.value = 0
}, { immediate: true })

// phase 变化时切换 BGM 和播放对应音效
watch(phase, (newPhase) => {
  if (newPhase === 'playing') {
    playBgm('main')
  } else if (newPhase === 'shop') {
    playSfx('shop-enter')
    playBgm('shop')
  } else if (newPhase === 'won') {
    playSfx('win')
    playBgm('win')
  } else if (newPhase === 'lost') {
    playSfx('lose')
    playBgm('lose')
  }
})
</script>

<style scoped>
.app-layout { display: flex; width: 100%; min-width: 320px; height: 100dvh; min-height: 650px; position: relative; background: var(--bg-deep); }
.main-area { flex: 1; min-width: 0; display: grid; grid-template-rows: auto minmax(145px,1fr) auto; position: relative; isolation: isolate; background: radial-gradient(ellipse at 48% 35%,#173c2710,#04180ba8),url('/felt.svg'); border: 1px solid #82693688; margin: 7px 7px 7px 0; box-shadow: inset 0 0 90px #0008; }
.main-area::before { content: ''; position: absolute; inset: 13px; border: 1px solid #b2944933; border-radius: 35% / 12%; pointer-events: none; z-index: -1; }
.main-area::after { content: '♠  ♦  ♣  ♥'; position: absolute; left: 50%; bottom: 6px; transform: translateX(-50%); font: 9px Georgia,serif; letter-spacing: 12px; color: #b5985050; pointer-events: none; }
@media(max-width:700px) { .app-layout { min-height: 780px; } }
@media(max-width:600px) { .app-layout { flex-direction: column; height: auto; min-height: 100dvh; } .main-area { flex: none; min-height: 690px; margin: 5px; grid-template-rows: auto minmax(170px,1fr) auto; } }
</style>
