import { TYPES, BOSSES, EVENTS, JOKERS, newRun, score, enter, encounter, actCards, leave, choice, buy, useKit, chooseReward } from './engine.js';
import { FLOOR_COUNT, getNode, descendants, opportunities } from './map.js';
const app = document.querySelector('#app');
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let run = newRun('SPIRE-DEMO');
let inspected = run.available[0], pendingReset = null, seedInput = run.seed, showMap = false;
const button = (label, action, disabled = false, cls = '') => `<button class="${cls}" data-action="${esc(action)}" ${disabled ? 'disabled' : ''}>${label}</button>`;
const rank = r => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' })[r] || r;
const boss = () => BOSSES[run.map.bossId];
const point = n => ({ x: 66 + n.x * 114, y: 30 + (FLOOR_COUNT - 1 - n.depth) * 64 });
const typeOf = n => run.revealed[n.id]?.type || n.type;
function map() {
  const accessible = new Set((run.current ? [run.current] : run.available).flatMap(id => [...descendants(run, id)]));
  const preview = inspected && accessible.has(inspected) ? descendants(run, inspected) : new Set();
  const lines = run.map.nodes.flatMap(n => n.next.map(id => {
    const a = point(n), b = point(getNode(run, id));
    const taken = run.visited.includes(n.id) && (run.visited.includes(id) || run.current === id);
    const planned = preview.has(n.id) && preview.has(id);
    return `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${taken ? 'taken' : planned ? 'planned' : ''}"/>`;
  })).join('');
  return `<div class="map"><svg viewBox="0 0 360 768" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>${run.map.nodes.map(n => {
    const p = point(n), available = run.phase === 'map' && run.available.includes(n.id), visited = run.visited.includes(n.id), current = run.current === n.id;
    const unreachable = !visited && !current && !accessible.has(n.id);
    const type = typeOf(n);
    return `<button class="node ${available ? 'available' : ''} ${visited ? 'visited' : ''} ${current ? 'current' : ''} ${n.id === inspected ? 'inspected' : ''} ${unreachable ? 'unreachable' : ''}" style="left:${p.x / 3.6}%;top:${p.y / 7.68}%" data-action="inspect:${n.id}" aria-label="第${n.depth + 1}层 ${TYPES[type].name}${available ? ' 可进入' : visited ? ' 已完成' : ''}" title="${esc(TYPES[type].note)}"><span>${visited ? '✓' : TYPES[type].icon}</span><small>${TYPES[type].name}</small></button>`;
  }).join('')}<div class="floor-labels">${Array.from({ length: FLOOR_COUNT }, (_, d) => `<small style="top:${point({ depth: d, x: 0 }).y / 7.68}%">${d + 1}</small>`).join('')}</div></div><div class="legend"><span>● 绿色可进入</span><span>金框 · 正在查看</span><span>金线 · 此后可达分支</span><span>✓ 已完成</span></div>`;
}
function option(title, text, action, disabled = false, label = '选择') {
  return `<article class="option"><h3>${title}</h3><p>${text}</p>${button(label, action, disabled)}</article>`;
}
function plan() {
  const n = getNode(run, inspected) || getNode(run, run.available[0]);
  const type = typeOf(n), reachable = run.available.includes(n.id), future = run.available.some(id => descendants(run, id).has(n.id));
  const e = encounter(run, n), found = opportunities(run, n.id);
  const combat = ['fight', 'elite', 'boss'].includes(type);
  return `<div class="eyebrow">先查看路线，再决定下一站</div><h2>为下一场，也为终点做准备。</h2><p>金线标出查看节点之后的可达分支，代表选择空间；只有绿色节点现在能进入。途中可以继续改道。</p>
    <div class="route-options">${run.available.map(id => { const node = getNode(run, id); return button(`${TYPES[typeOf(node)].icon} ${TYPES[typeOf(node)].name}`, `inspect:${id}`, false, inspected === id ? 'selected-route' : ''); }).join('')}</div>
    <div class="route-detail" id="route-detail"><div class="eyebrow">第 ${n.depth + 1} / ${FLOOR_COUNT} 层 · ${reachable ? '现在可进入' : future ? '后续可达，尚未到达' : '已走过或已错过'}</div><h3>${TYPES[type].icon} ${TYPES[type].name}</h3><p>${TYPES[type].note}</p>
    ${combat ? `<div class="route-metrics"><span>目标 <b>${e.target} 分</b></span><span>压力 <b>${e.pressure} 生命 / 手</b></span><span>成功 <b>+$${e.reward}</b></span></div><p class="hint">${n.depth === 0 ? '首战教学，无逐手压力。' : '每次出牌后仍未达标且还有出牌次数时承受压力，提前达标可少受伤。'} 最终未达标再按缺口扣 8 / 16 / 24 生命。</p>${type === 'elite' ? '<p>胜利后额外从最多两张未拥有的小丑牌中选择一张，也可换成 $6。</p>' : ''}` : ''}
    ${type === 'event' ? '<p>70% 为三类事件之一，20% 为普通挑战，10% 为商店。内容在进入时揭晓，当前不能保证有恢复或奖励。</p>' : ''}
    ${type === 'shop' ? `<p>当前 $${run.money}。${run.money < 8 ? '连急救包也买不起，除非只是路过，否则可以考虑先赚取金币。' : run.money < 12 ? '可以买急救包；小丑牌至少需要 $12。' : '可以买补给，或寻找适合已有构筑的小丑牌。'} 店内提供最多 3 张未拥有的小丑牌。</p>` : ''}
    ${type === 'rest' ? `<p>现在休息最多恢复 ${Math.min(20, 60 - run.hp)} 生命；也可放弃恢复，永久增加 10 筹码。</p>` : ''}
    ${type === 'treasure' ? '<p>从急救包、$10、永久 +8 筹码中选择一项。所有路线在此合流，然后重新选择后半程路线。</p>' : ''}
    ${type === 'boss' ? `<p>${boss().rule} ${boss().tip}</p>` : ''}
    <div class="future"><b>从这里继续，最近可到达</b><div>${Object.entries(found).map(([t, d]) => `<span>${TYPES[t].icon} ${TYPES[t].name} · ${d} 步</span>`).join('') || '<span>本章终点</span>'}</div><small>需沿相应分支选择，无法一次拿到所有资源。</small></div>
    ${button(reachable ? `进入${TYPES[type].name}` : '仅查看 · 目前不可进入', `enter:${n.id}`, !reachable, 'primary')}
    </div><p class="hint">建议先看下一个精英之前有没有整备机会，再决定是否挑战。低生命时也可以走中间的普通挑战绕开精英。</p>`;
}
function battle() {
  const b = run.battle, isBoss = b.type === 'boss', selected = b.hand.filter(c => b.selected.includes(c.id));
  const preview = score(selected, run, isBoss), incoming = preview.total + b.total < b.target && b.hands > 1 ? b.pressure : 0;
  return `<div class="eyebrow">第 ${getNode(run).depth + 1} 层 · ${TYPES[b.type].name}</div><h2>${isBoss ? boss().name : b.type === 'elite' ? '高风险，也有更好的奖励。' : '在压力到来之前达标。'}</h2><p>${isBoss ? boss().rule : '4 次出牌内累计达到目标。未达标的中间手会消耗生命；弃牌不承受压力。'}</p>
    <div class="pressure-rule">${b.pressure ? `压力 ${b.pressure} / 手 · 本场已消耗 ${b.pressureLost} 生命` : '首战教学 · 无逐手压力'} <span>最后一手未达标扣 8 / 16 / 24 生命</span></div>
    <div class="scoreboard"><div><small>累计得分</small><strong>${b.total}<i> / ${b.target}</i></strong></div><div><small>剩余出牌</small><strong>${b.hands}</strong></div><div><small>剩余弃牌</small><strong>${b.discards}</strong></div></div><div class="progress"><div style="width:${Math.min(100, b.total / b.target * 100)}%"></div></div>
    <div class="preview"><span>${preview.name}</span><strong>${preview.chips} 筹码 × ${preview.mult} 倍率 <b>= ${preview.total}</b></strong></div>
    <div class="cards">${b.hand.map(c => `<button aria-label="${c.suit}${rank(c.rank)}" aria-pressed="${b.selected.includes(c.id)}" class="card ${['♥', '♦'].includes(c.suit) ? 'red' : ''} ${b.selected.includes(c.id) ? 'selected' : ''}" data-action="card:${c.id}" ${selected.length === b.maxCards && !b.selected.includes(c.id) ? 'disabled' : ''}><b>${rank(c.rank)}</b><span>${c.suit}</span><small>${isBoss && run.map.bossId === 'faded' && ['♥', '♦'].includes(c.suit) ? '0 筹码' : (c.rank === 14 ? 11 : Math.min(c.rank, 10)) + ' 筹码'}</small></button>`).join('')}</div>
    <div class="actions">${button('打出选中牌', 'play', !selected.length, 'primary')}${button('弃牌并补齐', 'discard', !selected.length || !b.discards)}${button('按点数排序', 'sort')}<small>已选 ${selected.length}/${b.maxCards} 张</small></div>
    ${selected.length ? `<p class="hint">${preview.total + b.total >= b.target ? '这手可以达标，不承受本手压力。' : b.hands === 1 ? '最后一次出牌。未达标将按最终分数缺口扣血。' : `预计本手压力：-${incoming} 生命。${incoming >= run.hp ? '当前生命不足以承受，请先使用补给或改善组合。' : ''}`}</p>` : ''}
    <div class="battle-log" aria-live="polite">${b.history.length ? b.history.map(t => `<div>${t}</div>`).join('') : `选择 1–${b.maxCards} 张牌。未使用的牌保留，出牌或弃牌后补至 8 张。`}</div>`;
}
function screen() {
  if (['fight', 'elite', 'boss'].includes(run.phase)) return battle();
  if (run.phase === 'map') return plan();
  if (run.phase === 'rest') return `<div class="eyebrow">☾ 休息区</div><h2>恢复与变强，只能选一个。</h2><p>恢复能让下一场更稳妥；永久筹码让后续更容易提前达标，减少战斗压力。</p><div class="options">${option('休息片刻', `最多恢复 20 生命。当前 ${run.hp}/60，实际恢复 ${Math.min(20, 60 - run.hp)}。`, 'choice:heal')}${option('磨练技艺', '本次冒险每次出牌永久 +10 筹码，可以叠加。', 'choice:train')}</div>`;
  if (run.phase === 'event') { const ev = EVENTS[run.eventId]; return `<div class="eyebrow">? 未知房间已揭晓</div><h2>${ev.name}</h2><p>${ev.text}</p><div class="options">${ev.choices.map(c => option(c.name, c.text, `choice:${c.id}`, run.money < (c.cost || 0) || run.hp <= (c.hp || 0))).join('')}</div>${button('不做交易，离开', 'choice:skip')}`; }
  if (run.phase === 'treasure') return `<div class="eyebrow">▣ 中途补给 · 重新规划</div><h2>在这里，重新决定后半程。</h2><p>选择一份补给。离开后会出现三个新的出发方向，前半程的路线不会锁死后半程。</p><div class="options">${option('随身药箱', '获得 1 个急救包，需要时恢复最多 15 生命。', 'choice:kit')}${option('金币袋', '获得 $10，留给下一间商店。', 'choice:gold')}${option('磨亮牌面', '每次出牌永久 +8 筹码。', 'choice:power')}</div>`;
  if (run.phase === 'shop') return `<div class="eyebrow">◇ 旅途商店</div><h2>把金币变成下一场的胜算。</h2><p>每件本站限购一次，已拥有的小丑牌不会再次出售。未知房间揭晓的商店也遵守此规则。</p><div class="shop-grid">${[{ id: 'kit', name: '急救包', detail: '需要时恢复最多 15 生命', price: 8 }, ...run.shopStock.map(id => ({ id, ...JOKERS[id] }))].map(j => `<article class="option"><h3>${j.name}</h3><p>${j.detail}</p>${button(run.purchases.includes(j.id) ? '已售出' : `购买 · $${j.price}`, `buy:${j.id}`, run.purchases.includes(j.id) || run.money < j.price)}</article>`).join('')}</div>${button('离开商店', 'leave', false, 'primary')}`;
  if (run.phase === 'result') {
    const r = run.result, selecting = r.win && r.elite && !run.rewardTaken;
    return `<div class="eyebrow">挑战结算</div><h2>${r.win ? '成功通过。' : '需要重新评估路线了。'}</h2><div class="result-number">${run.battle.total} <small>/ ${run.battle.target} 分</small></div><p>${r.win ? `获得 $${r.reward}。` : `最终缺口扣除 ${r.loss} 生命，没有奖励。`} 本场压力消耗 ${r.pressureLost} 生命。${r.extra}</p>
      ${selecting ? `<h3>精英奖励 · 选择一张适合构筑的小丑牌</h3><div class="options">${run.rewards.map(id => option(JOKERS[id].name, JOKERS[id].detail, `reward:${id}`)).join('')}</div>${button('改为获得 $6', 'reward:gold')}` : ''}
      ${r.boss && !r.win ? '<p>Boss 必须击败。可以先使用急救包，再重新洗牌挑战。</p>' : ''}${button(r.boss && !r.win ? '重新挑战 Boss' : '返回地图选路', 'leave', selecting, 'primary')}`;
  }
  return `<div class="eyebrow">本次冒险结束 · 地图 ${esc(run.seed)}</div><h2>${run.phase === 'won' ? '这条路，走通了。' : '这条路，暂时走到了这里。'}</h2><p>${run.phase === 'won' ? '你已击败本章 Boss。重玩同一种子可以比较不同选路，也可以换一张地图。' : '生命已耗尽。可以回看旅途记录，检查精英前的准备、补给使用和休息选择。'}</p><div class="scoreboard"><div><small>压力消耗</small><strong>${run.stats.pressure}</strong></div><div><small>失利扣血</small><strong>${run.stats.deficit}</strong></div><div><small>击败精英</small><strong>${run.stats.elites}</strong></div></div><div class="actions">${button('同一种子再试一次', 'reset:same', false, 'primary')}${button('换一张地图', 'reset:new')}</div>`;
}
function render() {
  const stage = run.current ? getNode(run).depth + 1 : run.visited.length + 1;
  app.innerHTML = `<header><div><span class="brand">♠ 岔路</span><span class="badge">路线实验 V2 · 独立 DEMO</span></div><div class="header-actions">${button('重开 / 换地图', 'reset:choose')}<a href="./route-design.html" target="_blank" rel="noopener">设计拆解 ↗</a></div></header>
    <div class="stats"><div><small>生命</small><b class="${run.hp <= 24 ? 'danger' : ''}">${run.hp} <span>/ ${run.maxHp}</span></b><meter min="0" max="60" value="${run.hp}"></meter></div><div><small>金币</small><b>$${run.money}</b></div><div><small>永久筹码</small><b>+${run.bonus}</b></div><div><small>补给</small>${button(`急救包 ×${run.kits} · +15 生命`, 'kit', run.kits <= 0 || run.hp === run.maxHp || ['dead', 'won'].includes(run.phase))}</div></div>
    ${pendingReset ? `<div class="confirm"><div><b>重开会清除本次进度</b><p>同一种子会复现地图、Boss、事件与同次挑战的洗牌。不同选择仍会产生不同结果。</p><label>种子 <input id="seed" maxlength="40" value="${esc(seedInput)}" aria-label="地图种子"></label></div><div class="actions">${button('按此种子重开', 'restart:seed')}${button('随机新地图', 'restart:new')}${button('取消', 'cancel')}</div></div>` : ''}
    <div class="boss-banner"><span>♛</span><div><b>本章终点 · ${boss().name} · ${boss().target} 分</b><p>${boss().rule} ${boss().tip}</p></div></div>
    ${run.phase === 'map' ? `<div class="next-stop"><b>选择下一站</b>${run.available.map(id => button(`${TYPES[typeOf(getNode(run, id))].icon} ${TYPES[typeOf(getNode(run, id))].name} · 查看`, `inspect:${id}`)).join('')}<small>地图从底部向上推进</small></div>` : ''}
    <main class="${run.phase === 'map' ? 'phase-map' : 'phase-play'} ${showMap ? 'show-map' : ''}"><aside><div class="map-title"><b>第 ${Math.min(stage, FLOOR_COUNT)} / ${FLOOR_COUNT} 层 · 林间岔路</b><small>${esc(run.seed)}</small></div>${map()}</aside><section class="workspace"><div class="mobile-map-toggle">${button(showMap ? '收起地图' : '查看完整路线', 'toggle-map')}</div><div class="content">${screen()}</div><div class="inventory"><h3>你的构筑</h3><div class="joker-list">${run.jokers.length ? run.jokers.map(id => `<div class="joker"><b>✦ ${JOKERS[id].name}</b><small>${JOKERS[id].detail}</small></div>`).join('') : '<span class="hint">从商店购买，或挑战精英自选奖励。生命、金币、补给和强化跨节点保留。</span>'}</div></div><details><summary>旅途记录 · ${run.log.length} 条</summary>${run.log.map(l => `<p>${esc(l)}</p>`).join('')}</details></section></main>
    <footer><details><summary>Demo 规则与简化说明</summary><p>这是受路线规划玩法启发的独立原型，未接入经典模式、JEV 或对战。12 层地图按种子生成，包含固定的节奏约束；没有复刻《杀戮尖塔》的原始地图算法。刷新回到默认种子，当前进度不保存。</p><p>战斗：4 次出牌，通常 3 次弃牌，手牌 8 张。所有选中牌贡献点数筹码，牌型筹码与永久加成之和乘以倍率。高牌 5×1、对子 10×2、两对 20×2、三条 30×3、顺子 30×4、同花 35×4、葫芦 40×4、四条 60×7、同花顺 100×8。</p><p>出牌后未达目标且还有次数时，普通挑战承受 2 点压力、精英 3 点、Boss 4 点，首战为 0；达标或弃牌均不承受压力。最后一手不重复叠加压力，按目标完成率扣血：≥75% 扣 8，≥50% 扣 16，低于 50% 扣 24。归零立即结束。普通与精英最终失利可以继续，Boss 必须击败；这两点是本原型自定义规则。</p><p>未知房间按种子揭晓：70% 事件（旅人 / 泉眼 / 工坊），20% 普通挑战，10% 商店。地图只提示潜在机会，选定一支会放弃部分其他机会。中途宝箱和 Boss 前休息区是固定节奏点。</p></details></footer>`;
}
app.addEventListener('input', e => { if (e.target.id === 'seed') seedInput = e.target.value; });
app.addEventListener('click', e => {
  const target = e.target.closest('button[data-action]'); if (!target || target.disabled) return;
  const [action, id] = target.dataset.action.split(':');
  if (action === 'inspect') inspected = id;
  else if (action === 'enter') { enter(run, id); showMap = false; }
  else if (action === 'card') { const b = run.battle, s = b.selected; b.selected = s.includes(id) ? s.filter(v => v !== id) : s.length < b.maxCards ? [...s, id] : s; }
  else if (action === 'play') actCards(run);
  else if (action === 'discard') actCards(run, true);
  else if (action === 'sort') run.battle.hand.sort((a, b) => a.rank - b.rank || a.suit.localeCompare(b.suit));
  else if (action === 'leave') { leave(run); inspected = run.available[0]; }
  else if (action === 'choice') { choice(run, id); inspected = run.available[0]; }
  else if (action === 'reward') chooseReward(run, id);
  else if (action === 'buy') buy(run, id);
  else if (action === 'kit') useKit(run);
  else if (action === 'toggle-map') showMap = !showMap;
  else if (action === 'reset') {
    if (['dead', 'won'].includes(run.phase) && id !== 'choose') { run = newRun(id === 'same' ? run.seed : undefined); inspected = run.available[0]; seedInput = run.seed; }
    else { pendingReset = true; seedInput = run.seed; }
  } else if (action === 'cancel') pendingReset = null;
  else if (action === 'restart') { run = newRun(id === 'seed' ? seedInput : undefined); inspected = run.available[0]; seedInput = run.seed; pendingReset = null; showMap = false; }
  render();
  const mobile = window.matchMedia('(max-width:900px)').matches;
  if (mobile && action === 'inspect' && run.phase === 'map') document.querySelector('#route-detail')?.scrollIntoView({ block: 'center' });
  else if (mobile && ['enter', 'leave', 'choice', 'restart', 'reset'].includes(action)) window.scrollTo({ top: 0 });
  const replacement = Array.from(app.querySelectorAll('button[data-action]')).find(b => b.dataset.action === target.dataset.action && !b.disabled);
  replacement?.focus({ preventScroll: true });
});
render();
