<template>
  <aside class="sidebar">
    <header class="sb-logo"><span class="logo-ornament">― ♠ ―</span><h1>JOKER</h1><p>小 丑 牌</p></header>
    <section class="sb-panel sb-blind">
      <p class="sb-eyebrow">第 {{ currentBlind.act }} 幕 · 第 {{ roundIndex + 1 }} / {{ BLINDS.length }} 关</p>
      <h2>{{ currentBlind.name }}</h2>
      <p class="sb-target">目标 <strong>{{ currentBlind.target.toLocaleString() }}</strong></p>
    </section>
    <section class="sb-panel sb-score">
      <p class="sb-eyebrow">当前分数</p><strong class="sb-score-num">{{ blindScore.toLocaleString() }}</strong>
      <div class="sb-progress-bar" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100" aria-label="本关进度"><div :style="{ width: progress + '%' }"></div></div>
      <p class="sb-remaining">{{ blindScore >= currentBlind.target ? '已达成目标' : `还差 ${(currentBlind.target - blindScore).toLocaleString()} 分` }}</p>
    </section>
    <section class="sb-turns">
      <div class="sb-panel"><p class="sb-eyebrow">出牌</p><strong :class="{ danger: handsLeft <= 1 }">{{ handsLeft }}</strong></div>
      <div class="sb-panel"><p class="sb-eyebrow">弃牌</p><strong class="discard-count">{{ discardsLeft }}</strong></div>
    </section>
    <section class="sb-panel sb-money"><span class="coin-mark">＄</span><div><p class="sb-eyebrow">金币</p><strong>${{ money }}</strong></div></section>
    <nav class="sb-nav"><button @click="$emit('route')"><span>♧</span> 关卡路线 <b>›</b></button><button @click="$emit('settings')"><span>⚙</span> 设置 <b>›</b></button></nav>
    <footer>命运，藏在下一张牌里。<span>♠</span></footer>
  </aside>
</template>
<script setup>
import { BLINDS } from '../composables/useGameState.js'
defineProps({ currentBlind: Object, blindScore: Number, progress: Number, handsLeft: Number, discardsLeft: Number, money: Number, roundIndex: Number })
defineEmits(['route', 'settings'])
</script>
<style scoped>
.sidebar { width: clamp(190px, 20vw, 270px); flex-shrink: 0; padding: 18px 18px 12px; display: flex; flex-direction: column; gap: 12px; background: linear-gradient(90deg,#100f0c,#191b16 55%,#100f0c); border: 1px solid #7f6840; outline: 1px solid #655132; outline-offset: -7px; box-shadow: 10px 0 40px #0006; z-index: 2; overflow-y: auto; }
.sb-logo { text-align: center; padding: 0 0 10px; color: var(--gold); }
.logo-ornament { font: 16px Georgia,serif; color: #a98b58; }
h1 { font: clamp(32px,4vw,53px)/1 Georgia,serif; letter-spacing: 3px; text-shadow: 1px 2px #000; }
.sb-logo p { font-family: var(--font-display); letter-spacing: 5px; margin-top: 8px; font-size: 13px; }
.sb-panel { border: 1px solid #75603b80; background: linear-gradient(145deg,#ffffff03,#0003); padding: 14px 12px; text-align: center; position: relative; }
.sb-panel::before { content: '◆'; position: absolute; top: -6px; left: 50%; transform: translateX(-50%); font-size: 9px; color: #806b44; background: #171914; padding: 0 7px; }
.sb-eyebrow { font-size: 12px; color: #b7b29f; letter-spacing: 1px; }
h2 { font: 600 25px var(--font-display); color: var(--gold); margin: 8px 0; }
.sb-target { font-size: 13px; color: #d7cfb8; } .sb-target strong { font: 24px Georgia,serif; margin-left: 7px; }
.sb-score-num { display: block; font: 48px/1.2 Georgia,serif; color: #f0dfb5; margin: 3px 0 10px; }
.sb-progress-bar { border: 1px solid #a38b5b; padding: 2px; height: 12px; border-radius: 8px; background: #080c0b; overflow: hidden; }
.sb-progress-bar div { height: 100%; background: linear-gradient(90deg,#a88a4f,#ead2a0); border-radius: 5px; transition: width .4s; }
.sb-remaining { font-size: 12px; color: #d9c8a4; margin-top: 9px; }
.sb-turns { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; } .sb-turns strong { font: 36px Georgia,serif; display: block; margin-top: 3px; } .discard-count { color: #c98077; } .danger { color: #ef8a6e; }
.sb-money { display: flex; justify-content: center; align-items: center; gap: 20px; } .sb-money strong { font: 32px Georgia,serif; color: var(--gold); } .coin-mark { border: 3px double #9e8048; border-radius: 50%; width: 39px; height: 39px; display: grid; place-items: center; color: #bd9b58; font-size: 24px; }
.sb-nav { margin-top: auto; display: grid; gap: 7px; } .sb-nav button { padding: 11px 10px; text-align: left; background: #0002; color: #d7ccb3; border: 1px solid #665636; cursor: pointer; } .sb-nav span { margin-right: 10px; color: #b4a17a; } .sb-nav b { float: right; color: #998355; }
footer { color: #8b8069; font-size: 10px; text-align: center; padding-top: 3px; } footer span { display: block; font-size: 15px; margin-top: 5px; }
@media (max-height: 750px) { .sidebar { padding: 12px 14px; gap: 9px; } .sb-panel { padding: 10px; } h1 { font-size: 38px; } .sb-logo { padding-bottom: 3px; } .sb-score-num { font-size: 39px; } .sb-turns strong { font-size: 29px; } footer { display: none; } }
@media (max-width: 700px) { .sidebar { width: 150px; padding: 12px; } h1 { font-size: 28px; } .sb-eyebrow { font-size: 10px; } h2 { font-size: 20px; } .sb-money { gap: 8px; } .coin-mark { display: none; } }
@media(max-width:600px) {
.sidebar { width: 100%; overflow: visible; display: grid; grid-template-columns: .8fr 1.1fr 1fr; gap: 7px; padding: 12px; border-bottom: 1px solid #75603b; }
.sb-logo { align-self: center; padding: 0; }.logo-ornament { display: none; } h1 { font-size: 26px; letter-spacing: 1px; }.sb-logo p { font-size: 9px; margin-top: 5px; letter-spacing: 2px; }
.sb-panel { padding: 8px; }.sb-panel::before { display: none; }.sb-eyebrow { font-size: 9px; letter-spacing: 0; } h2 { font-size: 18px; margin: 5px 0; }.sb-target { font-size: 10px; }.sb-target strong { font-size: 18px; }.sb-score-num { font-size: 27px; margin: 3px 0 4px; }.sb-remaining { font-size: 9px; margin-top: 4px; }.sb-progress-bar { height: 8px; padding: 1px; }
.sb-turns { grid-column: 1; gap: 4px; }.sb-turns .sb-panel { padding: 5px; }.sb-turns strong { font-size: 19px; }.sb-money { grid-column: 2; padding: 5px; gap: 8px; }.sb-money strong { font-size: 22px; }.sb-nav { grid-column: 3; margin: 0; gap: 4px; }.sb-nav button { padding: 5px 7px; font-size: 10px; }.sb-nav span { margin-right: 3px; } footer { display: none; }
}
</style>
