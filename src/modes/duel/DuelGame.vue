<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted, onActivated, onDeactivated } from 'vue'
import CardView from './DuelCard.vue'
import DuelLineup from './DuelLineup.vue'
import DuelPlayedHand from './DuelPlayedHand.vue'
import DuelResultDialog from './DuelResultDialog.vue'
import ShopPanel from './ShopPanel.vue'
import ScoreBreakdown from './ScoreBreakdown.vue'
import { sortHand, matchStanding } from './player-tools.js'
import { calcScore } from '../../composables/useHandDetector.js'
import { makePlayer, act, context, createShop, buyFromShop, finishShopping, sellJoker, awardRound, resetRound, computerShopChoice, replaceFromShop, reorderJokers, computerJokerOrder } from './engine.js'
import { nextDuelTurn, playDuelResponse } from './turns.js'
import { DUEL_RULES, DUEL_SHOP_WEIGHTS } from './config.js'
import { encodeDuelSnapshot, decodeDuelSnapshot } from './snapshot.js'
import { readRun, writeRun } from '../../composables/runStorage.js'
import { useAudio } from '../../composables/useAudio.js'
import './style.css'
import './shop.css'
import './player-feedback.css'
import './arena.css'

const props = defineProps({ embedded: { type: Boolean, default: false }, ready: { type: Boolean, default: true }, storageKey: { type: String, default: '' } })
const emit = defineEmits(['exit', 'busy', 'progress'])
const active = ref(false)
const storageKey = props.storageKey || (props.embedded ? 'joker.duel.run.v1' : 'joker.duel.demo.v1')
const restored = decodeDuelSnapshot(readRun(storageKey))
// Existing runs may still contain the opponent's former display name.
const opponentCopy = text => text.replaceAll('荷官', '小丑')
const saveAvailable = ref(true)

const you = ref(restored?.you ?? makePlayer()), bot = ref(restored?.bot ?? makePlayer()), round = ref(restored?.round ?? 1)
const chosen = ref([]), botChosen = ref([]), busy = ref(false), botThinking = ref(false)
const tableEntry = ref(null), yourSeat = ref(null), resultDialog = ref(null), shopEntry = ref(null)
const restartRequested = ref(false), restartButton = ref(null), restartCancel = ref(null)
const handSort = ref(restored?.handSort ?? 'rank'), pace = ref(restored?.pace ?? 'normal')
const phase = ref(restored?.phase ?? 'playing'), results = ref(restored?.results ?? []), logs = ref((restored?.logs ?? []).map(opponentCopy)), rules = ref(false)
const resultOpen = computed(() => active.value && props.ready && (phase.value === 'roundEnd' || phase.value === 'finished'))
const status = ref(opponentCopy(restored?.status || '轮到你了。挑选 1—5 张牌出手，小丑随后回应。弃牌后仍由你出牌。'))
const botStatus = ref('等你出牌'), shop = ref(restored?.shop ?? null), shopStep = ref(0), shopError = ref('')
const claimedIds = restored?.claimedIds ?? new Set()
let generation = 0
// A committed discard is followed by a play even if the mode is paused midway.
const pendingBotPlay = ref(restored?.pendingBotPlay ?? false)
const actionTurn = computed(() => nextDuelTurn(you.value, bot.value, pendingBotPlay.value))
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
// A pace change affects the current animation without changing decisions/resources.
async function botPause(ms, token) {
  let remaining = ms
  while (remaining > 0 && token === generation) {
    const speed = pace.value === 'quick' ? 4 : 1
    const slice = Math.min(80, remaining / speed)
    await wait(slice)
    remaining -= slice * speed
  }
}
const visibleHand = player => sortHand(player.hand, handSort.value)
const roundOutcome = n => {
  const result = results.value[n - 1]
  return !result ? '' : result.you === result.bot ? 'draw' : result.you > result.bot ? 'won' : 'lost'
}
const roundLabel = n => `第 ${n} 轮${roundOutcome(n) === 'won' ? '：你胜' : roundOutcome(n) === 'lost' ? '：小丑胜' : roundOutcome(n) === 'draw' ? '：平局' : ''}`

const players = () => ({ you: you.value, bot: bot.value })
const sideName = side => side === 'you' ? '你' : '小丑'
const preview = computed(() => calcScore(you.value.hand.filter(c => chosen.value.includes(c.id)), you.value.jokers, context(you.value)))
const standing = computed(() => matchStanding(results.value, DUEL_RULES.rounds))
const wins = computed(() => standing.value.wins)
const liveStatus = computed(() => phase.value === 'finished'
  ? '本桌已结束。按赢下轮数决定胜负，可以再来一桌。'
  : phase.value === 'roundEnd' ? '本轮已结束，双方金币已到账。进入共享商店继续构筑。' : status.value)
const difference = computed(() => you.value.score - bot.value.score)
const portraitUrl = `${import.meta.env.BASE_URL}duel/rival-closeup-v4.png`
const { bgmMuted, bgmVolume, applyAudioSettings, playBgm, pauseBgm } = useAudio()
function finaleAudio(playing) {
  if (playing) pauseBgm()
  else if (active.value && props.ready) playBgm('duel')
}
const musicEnabled = computed(() => !bgmMuted.value && bgmVolume.value > 0)
function toggleMusic() {
  const audio = { bgmMuted: musicEnabled.value, ...(!musicEnabled.value && bgmVolume.value === 0 ? { bgmVolume: 45 } : {}) }
  applyAudioSettings(audio)
  if (!audio.bgmMuted) playBgm('duel')
  writeRun('balatro.settings', { ...(readRun('balatro.settings') || {}), ...audio })
}
const scoreShare = computed(() => {
  const total = you.value.score + bot.value.score
  return total ? Math.max(3, Math.min(97, you.value.score / total * 100)) : 50
})
const lead = computed(() => difference.value === 0 ? '比分持平' : difference.value > 0 ? `你领先 ${difference.value.toLocaleString()} 分` : `你落后 ${(-difference.value).toLocaleString()} 分`)
const isYourShopTurn = computed(() => active.value && phase.value === 'shop' && shop.value?.turn === 'you' && !shop.value.complete && !shop.value.finished.you)
const shopWeights = computed(() => DUEL_SHOP_WEIGHTS[round.value - 1])
function log(text) { logs.value.unshift(text); logs.value = logs.value.slice(0, 8) }
function canAct() { return active.value && props.ready && phase.value === 'playing' && !busy.value && !botThinking.value && actionTurn.value === 'you' }
function toggle(id) {
  if (!canAct()) return
  chosen.value = chosen.value.includes(id) ? chosen.value.filter(x => x !== id) : chosen.value.length < 5 ? [...chosen.value, id] : chosen.value
}
function discard() {
  if (!canAct() || !chosen.value.length || !you.value.discardsLeft) return
  const count = chosen.value.length
  act(you.value, chosen.value, 'discard'); chosen.value = []
  status.value = `你换掉了 ${count} 张牌。仍然轮到你，选好后出牌，小丑才会回应。`
  log(`你弃掉 ${count} 张牌，剩余 ${you.value.discardsLeft} 次弃牌。`)
}
async function play() {
  if (!canAct() || !chosen.value.length) return
  const token = generation
  busy.value = true
  const result = act(you.value, chosen.value); chosen.value = []
  log(`你 · ${result.hand.name} +${result.score}`)
  status.value = `你打出${result.hand.name}，+${result.score} 分。${actionTurn.value === 'bot' ? '现在由小丑回应。' : '轮到你继续出牌。'}`
  await wait(400)
  if (token !== generation) return
  busy.value = false
  continueTurn()
}
function finishRound() {
  if (phase.value !== 'playing' || you.value.handsLeft || bot.value.handsLeft || busy.value) return
  botThinking.value = false
  results.value.push({ you: you.value.score, bot: bot.value.score })
  const rewardYou = awardRound(you.value), rewardBot = awardRound(bot.value)
  log(`本轮金币结算：你 +$${rewardYou.total}，小丑 +$${rewardBot.total}。`)
  phase.value = round.value === DUEL_RULES.rounds ? 'finished' : 'roundEnd'
  status.value = `${lead.value}。本轮结束，双方已获得金币。`
}
function continueTurn() {
  if (!active.value || !props.ready || phase.value !== 'playing') return
  finishRound()
  if (phase.value !== 'playing') return
  if (actionTurn.value === 'bot') {
    if (!botThinking.value) void runComputer(generation)
  } else {
    botStatus.value = bot.value.handsLeft ? '等你出牌' : '已完成本轮'
    status.value = '轮到你了。选牌出手，小丑随后回应；弃牌不会交出出牌权。'
  }
}
async function runComputer(token) {
  if (botThinking.value || actionTurn.value !== 'bot') return
  const isCurrent = () => token === generation && active.value && props.ready && phase.value === 'playing'
  botThinking.value = true
  botStatus.value = '正在准备回应'
  status.value = '小丑正在回应，出牌后就轮到你。'
  await playDuelResponse({
    player: bot.value, pendingBotPlay: pendingBotPlay.value, isCurrent,
    pause: ms => botPause(ms, token),
    onSelect(move) {
      botChosen.value = move.ids
      botStatus.value = move.type === 'discard' ? `准备换掉 ${move.ids.length} 张牌` : '选好了，准备出牌'
    },
    onDiscard(move) {
      botChosen.value = []
      pendingBotPlay.value = true
      log(`小丑弃掉 ${move.ids.length} 张牌。${move.reason ? `${move.reason}。` : ''}`)
      status.value = '小丑换好了牌，正在准备这一手回应。'
    },
    onPlay(result) {
      botChosen.value = []
      pendingBotPlay.value = false
      botStatus.value = `${result.hand.name} +${result.score}`
      log(`小丑 · ${result.hand.name} +${result.score}`)
      status.value = `小丑打出${result.hand.name}，+${result.score} 分。${lead.value}。`
    },
  })
  if (!isCurrent()) return
  botThinking.value = false
  // Only legacy saves can owe several responses; fresh games owe exactly one.
  continueTurn()
}
function settleEarly() {
  if (phase.value !== 'roundEnd' || !standing.value.clinched) return
  generation++
  phase.value = 'finished'
  log(`胜负已定，双方完成第 ${round.value} 轮后提前结算。`)
}
function openShop() {
  if (phase.value !== 'roundEnd') return
  shop.value = createShop(players(), round.value, claimedIds)
  phase.value = 'shop'; shopError.value = ''; shopStep.value++
  log(`${sideName(shop.value.turn)}先选。每次买一张，随后换对方。`)
}
function purchase(id) {
  if (!isYourShopTurn.value) return
  try {
    const item = shop.value.items.find(j => j.id === id)
    if (!buyFromShop(shop.value, players(), 'you', id)) throw new Error('当前无法购买，请检查金币、卡槽和选牌顺序。')
    log(`你购买了${item.name}（$${item.price}）。本场归你独占。`)
    shopError.value = ''; shopStep.value++
  } catch (error) { shopError.value = error.message }
}
function endShopping() {
  if (!isYourShopTurn.value) return
  finishShopping(shop.value, 'you'); log('你结束购物，保留剩余金币。'); shopError.value = ''; shopStep.value++
}
function sell(id) {
  if (!isYourShopTurn.value) return
  try {
    const item = you.value.jokers.find(j => j.id === id)
    if (!sellJoker(shop.value, players(), 'you', id)) throw new Error('当前无法出售这张牌。')
    log(`你出售了${item.name}。它仍不会进入对手的牌池。`)
    shopError.value = ''
  } catch (error) { shopError.value = error.message }
}
function replacePurchase({sellId, buyId}) {
  if (!isYourShopTurn.value) return
  const sold = you.value.jokers.find(j => j.id === sellId)
  const item = shop.value.items.find(j => j.id === buyId)
  if (!replaceFromShop(shop.value, players(), 'you', sellId, buyId)) {
    shopError.value = '这次替换无法完成，请重新检查金币和商品。'
    return
  }
  log(`你出售了${sold.name}，换入${item.name}（$${item.price}）。`)
  shopError.value = ''; shopStep.value++
}
function reorder({id, direction}) {
  if (isYourShopTurn.value && reorderJokers(shop.value, players(), 'you', id, direction)) {
    shopError.value = ''
  }
}
watch(() => [active.value, phase.value, shop.value?.turn, shopStep.value], async () => {
  if (!active.value || phase.value !== 'shop' || shop.value?.complete || shop.value.turn !== 'bot') return
  const token = generation, step = shopStep.value, currentShop = shop.value
  await botPause(1600, token)
  if (token !== generation || phase.value !== 'shop' || shop.value !== currentShop || step !== shopStep.value || currentShop.turn !== 'bot' || currentShop.complete) return
  try {
    const ordered = computerJokerOrder(bot.value.jokers)
    if (ordered.some((j, i) => j.id !== bot.value.jokers[i].id)) {
      bot.value.jokers = ordered
      log('小丑调整了阵容顺序，加倍率牌放在乘倍率牌之前。')
    }
    const move = computerShopChoice(bot.value, currentShop.items, DUEL_RULES.rounds - round.value)
    if (move.type === 'buy') {
      const item = currentShop.items.find(j => j.id === move.id)
      if (!buyFromShop(currentShop, players(), 'bot', move.id)) { finishShopping(currentShop, 'bot'); log('小丑结束购物。'); shopStep.value++; return }
      log(`小丑购买了${item.name}（$${item.price}）。本场归小丑独占。`)
    } else if (move.type === 'replace') {
      const sold = bot.value.jokers.find(j => j.id === move.sellId)
      const item = currentShop.items.find(j => j.id === move.id)
      if (!replaceFromShop(currentShop, players(), 'bot', move.sellId, move.id)) { finishShopping(currentShop, 'bot'); log('小丑结束购物。'); shopStep.value++; return }
      log(`小丑出售了${sold.name}，换入${item.name}（$${item.price}）。`)
    } else { finishShopping(currentShop, 'bot'); log('小丑结束购物，保留剩余金币。') }
    shopStep.value++
  } catch (error) { shopError.value = error.message }
})
function nextRound() {
  if (phase.value !== 'shop' || !shop.value.complete) return
  generation++; you.value = resetRound(you.value); bot.value = resetRound(bot.value)
  pendingBotPlay.value = false
  round.value++; chosen.value = []; botChosen.value = []; shop.value = null; busy.value = false
  phase.value = 'playing'; status.value = '新一轮开始，由你先出牌。阵容与金币已保留。'
  botStatus.value = '等你出牌'; log(`第 ${round.value} 轮开始。`)
}
function restart() {
  restartRequested.value = false
  generation++; you.value = makePlayer(); bot.value = makePlayer(); round.value = 1
  pendingBotPlay.value = false
  results.value = []; logs.value = []; chosen.value = []; botChosen.value = []
  busy.value = false; botThinking.value = false; shop.value = null; shopError.value = ''
  claimedIds.clear()
  phase.value = 'playing'; status.value = '新的一桌。双方空阵容开局，由你先出牌。'; botStatus.value = '等你出牌'
  saveState(true)
}
async function requestRestart() {
  // A running table is also the saved table: an accidental footer click must
  // not silently erase the player's build and completed rounds.
  restartRequested.value = true
  await nextTick()
  restartCancel.value?.focus()
}
async function cancelRestart() {
  restartRequested.value = false
  await nextTick()
  restartButton.value?.focus()
}
function startNewRun() { restart() }
defineExpose({ startNewRun })
function saveState(force = false) {
  // Merely previewing an entry must not create or overwrite a saved run.
  if (!props.ready && force !== true) return
  try {
    saveAvailable.value = writeRun(storageKey, encodeDuelSnapshot({
      you: you.value, bot: bot.value, round: round.value, phase: phase.value,
      results: results.value, claimedIds, shop: shop.value, pendingBotPlay: pendingBotPlay.value,
      handSort: handSort.value, pace: pace.value, logs: logs.value, status: status.value,
    }))
  } catch {
    saveAvailable.value = false
  }
  emit('progress', { round: round.value, phase: phase.value, finished: phase.value === 'finished' })
}
function resume() {
  // KeepAlive activates once immediately after mount as well as on later visits.
  if (active.value || !props.ready) return
  active.value = true
  playBgm('duel')
  emit('busy', busy.value)
  generation++
  if (phase.value === 'playing') {
    continueTurn()
  } else if (phase.value === 'shop' && shop.value.turn === 'bot' && !shop.value.complete) {
    shopStep.value++
  }
  saveState()
}
function pause() {
  const wasActive = active.value
  if (active.value) pauseBgm()
  active.value = false
  generation++
  botChosen.value = []
  botThinking.value = false
  busy.value = false
  emit('busy', false)
  if (wasActive) saveState(true)
}
watch(() => props.ready, ready => { if (ready) resume(); else pause() }, { flush: 'sync' })
watch(() => [active.value, props.ready, phase.value, you.value], async ([isActive, isReady, currentPhase], previous) => {
  if (!isActive || !isReady) return
  restartRequested.value = false
  await nextTick()
  if (!active.value || !props.ready || phase.value !== currentPhase) return
  if (currentPhase === 'roundEnd' || currentPhase === 'finished') {
    resultDialog.value?.focusPrimary()
    return
  }
  const target = currentPhase === 'shop' ? shopEntry.value?.$el
    : tableEntry.value
  const focusTarget = currentPhase === 'playing' ? yourSeat.value : target
  focusTarget?.focus({ preventScroll: true })
  // The arena and shop have different heights. Carrying the previous scroll
  // offset hides either the round result or the next round's opening scores.
  target?.scrollIntoView({ behavior: previous?.[0] && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto', block: 'start' })
}, { flush: 'post' })
watch([you, bot, round, phase, results, shop, handSort, pace, logs, status, pendingBotPlay], () => saveState(), { deep: true, flush: 'post' })
watch([busy, botThinking], values => emit('busy', active.value && values.some(Boolean)), { immediate: true, flush: 'sync' })
onMounted(() => {
  // Load the portraits during play, before the result animation needs them.
  for (const file of ['rival-closeup-v4.png', 'result-actions-closeup-v3.png', 'finale-body-v2.png', 'finale-left-arm-v2.png', 'finale-left-close-v2.png']) {
    const reactionArt = new Image()
    reactionArt.src = `${import.meta.env.BASE_URL}duel/${file}`
  }
  resume()
})
onActivated(resume)
onDeactivated(pause)
onUnmounted(pause)
</script>

<template>
 <div class="duel-mode" :class="{'embedded-duel': embedded, 'result-open': resultOpen}"><main ref="tableEntry" class="duel-shell" :inert="resultOpen">
  <header class="masthead">
   <div class="duel-brand"><a v-if="!embedded" href="../../" class="wordmark" aria-label="返回小丑牌封面">JOKER</a><div class="duel-title"><span class="eyebrow">{{phase === 'shop' ? 'INTERMISSION' : 'MIDNIGHT DUEL'}}</span><h1>{{phase === 'shop' ? '共享商店' : '明牌对决'}}</h1></div></div>
   <ol v-if="phase !== 'shop'" class="round-track" aria-label="七轮对决进度"><li v-for="n in DUEL_RULES.rounds" :key="n" :aria-current="n === round ? 'step' : undefined" :class="[roundOutcome(n), {current: n === round}]" :title="roundLabel(n)" :aria-label="roundLabel(n)">{{roundOutcome(n) === 'won' ? '胜' : roundOutcome(n) === 'lost' ? '负' : roundOutcome(n) === 'draw' ? '平' : String(n).padStart(2, '0')}}</li></ol>
   <div class="duel-header-tools"><button class="music-toggle" :aria-pressed="musicEnabled" :aria-label="musicEnabled ? '关闭对战音乐' : '开启对战音乐'" @click="toggleMusic"><span aria-hidden="true">{{musicEnabled ? '♫' : '♪'}}</span><small>{{musicEnabled ? '音乐开' : '音乐关'}}</small></button><button class="quiet" :aria-expanded="rules" @click="rules = !rules">{{rules ? '收起规则' : '怎么玩'}}</button><small class="save-status">{{saveAvailable ? '已自动保存' : '当前仅保留本页'}}</small></div>
  </header>
  <section v-if="rules" class="rules">共 {{DUEL_RULES.rounds}} 轮，每轮由你先出一手，小丑回应一手，再轮到你。每轮各出 {{DUEL_RULES.hands}} 手、可弃牌 {{DUEL_RULES.discards}} 次，每手选 1—5 张；弃牌后仍由自己出牌，思考不限时。双方开局都没有小丑牌。每轮高分方赢一轮，并在共享商店先购买；平分时先手权交替。每次购买 1 张后换对方，也可结束自己本轮的购物。双方都结束后进入下一轮。双方开局各 ${{DUEL_RULES.startingMoney}}，每轮结束各获得 ${{DUEL_RULES.roundReward}}，黄金小丑额外 +$2。小丑卡槽最多 {{DUEL_RULES.maxJokers}} 张，已购买的牌本场独占。前 {{DUEL_RULES.rounds - 1}} 轮结束各有一次商店，随机展示 3 张，稀有与传说概率逐轮提高；最后一轮打完直接结算。胜负提前确定时，可选择结算，也可继续打满七轮。共享商店不提供刷新。</section>

  <template v-if="phase !== 'shop'">
   <section class="duel-arena" aria-label="明牌对决牌桌">
    <div class="duel-stage">
     <div class="stage-copy"><span class="stage-kicker">ACROSS THE TABLE</span><div class="stage-title"><h2>灯下，只论输赢。</h2><span class="duel-round">第 <b>{{String(round).padStart(2, '0')}}</b> / {{DUEL_RULES.rounds}} 轮</span></div>
      <div class="arena-scoreboard">
       <div class="contender-score your-score"><span class="contender-name"><i aria-hidden="true">♠</i>你 <small>挑战者</small></span><strong :key="you.score" :class="{'long-score': you.score >= 100000}">{{you.score.toLocaleString()}}</strong><span class="round-wins">已赢 <b>{{wins[0]}}</b> 轮</span></div>
       <span class="versus" aria-hidden="true">VS</span>
       <div class="contender-score rival-score"><span class="contender-name"><i aria-hidden="true">♦</i>小丑 <small>你的对手</small></span><strong :key="bot.score" :class="{'long-score': bot.score >= 100000}">{{bot.score.toLocaleString()}}</strong><span class="round-wins">已赢 <b>{{wins[1]}}</b> 轮</span></div>
      </div>
      <div class="score-contest"><div class="score-contest-line" :style="{'--score-share': `${scoreShare}%`}" aria-hidden="true"></div><span>{{lead}}</span><small>本轮得分 · 双方完成后结算</small></div>
     </div>
     <div class="rival-presence"><span class="rival-halo" aria-hidden="true"></span><img class="rival-portrait" :src="portraitUrl" alt="暗红旧戏服的小丑对手，半张旧白妆面孔藏在阴影中"/><span class="rival-signature">THE JESTER<span>他在等你，先眨眼。</span></span></div>
    </div>

    <section class="arena-seat rival-seat" aria-label="小丑的公开手牌与阵容">
     <div class="seat-heading"><h2><span class="seat-symbol" aria-hidden="true">♦</span>对手明牌</h2><span class="seat-state"><i class="pulse" :class="{thinking: botThinking}" aria-hidden="true"></i>{{bot.handsLeft === 0 ? '已完成本轮' : botStatus}}</span><div class="seat-resources"><span>出牌 <b>{{bot.handsLeft}}</b><small>/{{DUEL_RULES.hands}}</small></span><span>弃牌 <b>{{bot.discardsLeft}}</b></span><span class="wallet">${{bot.money}}</span></div></div>
     <div class="seat-content"><DuelLineup :jokers="bot.jokers" label="对手阵容"/><div class="rival-hand-wrap"><div class="hand arena-hand rival-hand"><CardView v-for="c in visibleHand(bot)" :key="c.id" :card="c" :is-selected="botChosen.includes(c.id)"/></div><span class="deck-count">牌堆 {{bot.deck.length}} 张 · 手牌全公开</span></div></div>
    </section>

    <div class="clash-zone" aria-label="双方最近一次出牌"><DuelPlayedHand :result="you.last" label="你 · 最新出牌"/><div class="clash-divider" aria-hidden="true"><span>♠</span><i></i><span>♦</span></div><DuelPlayedHand :result="bot.last" label="小丑 · 最新出牌"/></div>

    <section ref="yourSeat" tabindex="-1" class="arena-seat your-seat" aria-label="你的手牌与操作">
     <div class="seat-heading"><h2><span class="seat-symbol" aria-hidden="true">♠</span>你的手牌</h2><span class="seat-state">{{actionTurn === 'bot' || botThinking ? '小丑回应中' : you.handsLeft === 0 ? '已完成本轮' : '轮到你 · 思考不限时'}}</span><div class="hand-tools"><button :aria-pressed="handSort === 'rank'" @click="handSort = 'rank'">按点数</button><button :aria-pressed="handSort === 'suit'" @click="handSort = 'suit'">按花色</button><button :disabled="!chosen.length || !canAct()" @click="chosen = []">清空</button><span>牌堆 {{you.deck.length}} 张</span></div><div class="seat-resources"><span>出牌 <b>{{you.handsLeft}}</b><small>/{{DUEL_RULES.hands}}</small></span><span>弃牌 <b>{{you.discardsLeft}}</b></span><span class="wallet">${{you.money}}</span></div></div>
     <div class="seat-content"><DuelLineup :jokers="you.jokers" label="你的阵容"/><div class="your-hand-wrap"><div class="hand arena-hand your-hand"><CardView v-for="c in visibleHand(you)" :key="c.id" :card="c" selectable :disabled="!canAct()" :is-selected="chosen.includes(c.id)" @click="toggle(c.id)"/></div></div></div>
     <div class="actions"><div class="selection"><strong>{{actionTurn === 'bot' || botThinking ? '小丑正在回应' : you.handsLeft === 0 ? `已出完 ${DUEL_RULES.hands} 手` : preview.hand?.name || '选出你的下一手'}}</strong><span>{{actionTurn === 'bot' || botThinking ? '对手只回应这一手，随后轮到你' : you.handsLeft === 0 ? '双方完成后结算本轮' : chosen.length ? `预计 ${preview.score.toLocaleString()} 分 · 已选 ${chosen.length} 张` : '点击手牌，最多选择 5 张；弃牌后仍由你出牌'}}</span></div><button class="secondary" :disabled="!canAct() || !chosen.length || !you.discardsLeft" @click="discard">弃牌</button><button class="primary play-button" :disabled="!canAct() || !chosen.length" @click="play">出牌 <span aria-hidden="true">↗</span></button></div>
     <ScoreBreakdown v-if="chosen.length" :result="preview" :cards="you.hand.filter(c => chosen.includes(c.id))" title="查看预计分数怎么算"/>
    </section>
   </section>
   <div class="live-status" role="status" aria-live="polite"><span>交锋动态</span>{{liveStatus}}</div>
  </template>

  <ShopPanel v-else ref="shopEntry" :shop="shop" :you="you" :bot="bot" :round="round" :weights="shopWeights" :error="shopError" :logs="logs" @buy="purchase" @replace="replacePurchase" @finish="endShopping" @next="nextRound" @sell="sell" @reorder="reorder"/>
  <div class="table-extras"><p>你出一手 · 小丑回应一手 · 每轮各 {{DUEL_RULES.hands}} 手</p><div class="tempo-controls" role="group" aria-label="小丑行动速度"><span>回应速度</span><button :aria-pressed="pace === 'normal'" @click="pace = 'normal'">正常</button><button :aria-pressed="pace === 'quick'" @click="pace = 'quick'">快速 ×4</button></div></div>
  <details class="history"><summary>牌桌记录 <span>{{logs.length}} 条最近动态</span></summary><p v-for="(entry, i) in logs" :key="i">{{entry}}</p></details>
  <footer><span>明牌对决 · 本地电脑对手</span><div v-if="restartRequested" class="restart-confirmation" role="group" aria-label="确认重新开一桌" @keydown.esc="cancelRestart"><span>重新开始会清除本桌进度与阵容。</span><button ref="restartCancel" class="quiet" @click="cancelRestart">保留当前牌局</button><button class="quiet" @click="restart">确认重新开始</button></div><button v-else ref="restartButton" class="quiet" @click="requestRestart">重新开一桌</button></footer>
 </main>
 <Transition name="duel-result"><DuelResultDialog v-if="resultOpen" ref="resultDialog" :round="round" :you-score="you.score" :bot-score="bot.score" :wins="wins" :results="results" :finished="phase === 'finished'" :clinched="standing.clinched" @shop="openShop" @settle="settleEarly" @restart="restart" @cinematic="finaleAudio" /></Transition>
 </div>
</template>

<style scoped>
.duel-mode .save-status { display: block; margin-top: 2px; color: #9c9ba9; font-size: 10px; }
.duel-mode.embedded-duel { height: 100dvh; min-height: 100dvh; overflow: auto; }
.duel-mode.result-open { height:100dvh; overflow:hidden; }
.restart-confirmation { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
.restart-confirmation > span { color: #c6b4a6; font-size: 11px; }
</style>
