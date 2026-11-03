import { generateMap, getNode, rng, shuffled } from './map.js';
export const TYPES = {
  fight: { icon: '♠', name: '普通挑战', note: '累计计分 · 奖励 $8' },
  elite: { icon: '⚔', name: '精英挑战', note: '更高压力 · $14 + 自选小丑牌' },
  rest: { icon: '☾', name: '休息区', note: '恢复 20 生命 / 永久 +10 筹码' },
  shop: { icon: '◇', name: '商店', note: '补给 $8 · 小丑牌 $12–16' },
  event: { icon: '?', name: '未知房间', note: '进入后揭晓：事件、挑战或商店' },
  treasure: { icon: '▣', name: '补给宝箱', note: '选择一份补给 · 重新规划后半程' },
  boss: { icon: '♛', name: '章末 Boss', note: '必须击败 · 本章终点' },
};
export const BOSSES = {
  faded: { name: '守门人 · 褪色', rule: '红色牌不提供点数筹码，仍参与牌型判定。', tip: '保留黑色高点牌，或提高基础筹码与倍率。', target: 1100, maxCards: 5, discards: 3 },
  narrow: { name: '裁牌师 · 窄门', rule: '每次最多打出或弃掉 4 张牌。', tip: '对子、两对和三条仍然有效；五张牌型无法打出。', target: 950, maxCards: 4, discards: 3 },
  silence: { name: '封印者 · 禁换', rule: '每场仅有 1 次弃牌机会。', tip: '选择较稳定的牌型，留好弃牌机会。', target: 1000, maxCards: 5, discards: 1 },
};
export const JOKERS = {
  steady: { name: '稳手', detail: '每次出牌 +2 倍率', price: 14 },
  pair: { name: '成双', detail: '含对子时 +3 倍率', price: 16 },
  vampire: { name: '回春', detail: '成功通过挑战且存活后恢复 6 生命', price: 12 },
  risk: { name: '背水', detail: '生命 ≤30 时 +5 倍率', price: 14 },
};
export const EVENTS = {
  trader: { name: '路边旅人', text: '两份交易摆在面前，你也可以不付出任何代价，直接离开。', choices: [
    { id: 'blood', name: '鲜血换金币', text: '失去 12 生命，获得 $16。', hp: 12, money: 16 },
    { id: 'secret', name: '买下秘诀', text: '支付 $10，永久 +12 筹码。', cost: 10, bonus: 12 },
  ] },
  fountain: { name: '苔藓泉眼', text: '泉水可以疗伤，也可以带走一份，留到更需要的时候。', choices: [
    { id: 'drink', name: '就地饮用', text: '立即恢复最多 10 生命。', heal: 10 },
    { id: 'bottle', name: '装满药瓶', text: '支付 $6，获得一个急救包（恢复最多 15 生命）。', cost: 6, kits: 1 },
  ] },
  forge: { name: '旧牌工坊', text: '工匠愿意让你的牌更有力量，但需要你付出一点代价。', choices: [
    { id: 'temper', name: '以血淬牌', text: '失去 8 生命，永久 +8 筹码。', hp: 8, bonus: 8 },
    { id: 'commission', name: '委托打磨', text: '支付 $12，永久 +10 筹码。', cost: 12, bonus: 10 },
  ] },
};
export function newRun(seed = Math.random().toString(36).slice(2, 8).toUpperCase()) {
  const normalized = String(seed).trim().slice(0, 40) || 'ADVENTURE';
  return { seed: normalized, map: generateMap(normalized), hp: 60, maxHp: 60, money: 18, bonus: 0, kits: 1, jokers: [], visited: [], available: ['0-0'], current: null, phase: 'map', battle: null, result: null, log: [`地图 ${normalized}：带着 $18 和一份急救包出发。`], purchases: [], attempts: {}, revealed: {}, rewards: [], rewardTaken: false, eventId: null, shopStock: [], stats: { pressure: 0, deficit: 0, elites: 0 } };
}
export function deck(random = Math.random) {
  return shuffled(['♠', '♥', '♣', '♦'].flatMap(suit => Array.from({ length: 13 }, (_, i) => ({ id: `${suit}${i + 2}`, suit, rank: i + 2 }))), random);
}
export function score(cards, run, boss = false) {
  if (!cards.length || cards.length > 5) return { name: '选择手牌查看得分', chips: 0, mult: 0, total: 0 };
  const ranks = cards.map(c => c.rank).sort((a, b) => a - b);
  const groups = Object.values(ranks.reduce((a, r) => ({ ...a, [r]: (a[r] || 0) + 1 }), {})).sort((a, b) => b - a);
  const flush = cards.length === 5 && cards.every(c => c.suit === cards[0].suit);
  const straight = cards.length === 5 && new Set(ranks).size === 5 && (ranks[4] - ranks[0] === 4 || ranks.join(',') === '2,3,4,5,14');
  let hand = ['高牌', 5, 1];
  if (flush && straight) hand = ['同花顺', 100, 8];
  else if (groups[0] === 4) hand = ['四条', 60, 7];
  else if (groups[0] === 3 && groups[1] === 2) hand = ['葫芦', 40, 4];
  else if (flush) hand = ['同花', 35, 4];
  else if (straight) hand = ['顺子', 30, 4];
  else if (groups[0] === 3) hand = ['三条', 30, 3];
  else if (groups[0] === 2 && groups[1] === 2) hand = ['两对', 20, 2];
  else if (groups[0] === 2) hand = ['对子', 10, 2];
  const faded = boss && run.map.bossId === 'faded';
  const chips = hand[1] + run.bonus + cards.reduce((sum, c) => sum + (faded && ['♥', '♦'].includes(c.suit) ? 0 : c.rank === 14 ? 11 : Math.min(c.rank, 10)), 0);
  const mult = hand[2] + run.jokers.reduce((n, id) => n + (id === 'steady' ? 2 : id === 'pair' && groups[0] >= 2 ? 3 : id === 'risk' && run.hp <= 30 ? 5 : 0), 0);
  return { name: hand[0], chips, mult, total: chips * mult };
}
export function encounter(run, node = getNode(run)) {
  const type = run.revealed[node.id]?.type || node.type;
  const boss = BOSSES[run.map.bossId];
  return { type, target: type === 'boss' ? boss.target : type === 'elite' ? 320 + node.depth * 38 : 145 + node.depth * 32, pressure: type === 'boss' ? 4 : type === 'elite' ? 3 : node.depth === 0 ? 0 : 2, reward: type === 'boss' ? 20 : type === 'elite' ? 14 : 8, maxCards: type === 'boss' ? boss.maxCards : 5, discards: type === 'boss' ? boss.discards : 3 };
}
export function enter(run, id) {
  if (run.phase !== 'map' || !run.available.includes(id) || !getNode(run, id)) return false;
  run.current = id; run.purchases = []; run.result = null; run.rewardTaken = false; run.rewards = []; run.eventId = null;
  const node = getNode(run); let type = node.type;
  if (type === 'event') {
    const random = rng(`${run.seed}:unknown:${id}`), roll = random();
    type = roll < .7 ? 'event' : roll < .9 ? 'fight' : 'shop';
    run.eventId = shuffled(Object.keys(EVENTS), random)[0];
    run.revealed[id] = { type, eventId: type === 'event' ? run.eventId : null };
    run.log.unshift(`未知房间揭晓：${type === 'event' ? EVENTS[run.eventId].name : TYPES[type].name}。`);
  }
  run.phase = type;
  if (type === 'shop') run.shopStock = shuffled(Object.keys(JOKERS).filter(j => !run.jokers.includes(j)), rng(`${run.seed}:shop:${id}`)).slice(0, 3);
  if (['fight', 'elite', 'boss'].includes(type)) startBattle(run);
  return true;
}
export function startBattle(run) {
  const config = encounter(run), attempt = (run.attempts[run.current] || 0) + 1;
  run.attempts[run.current] = attempt;
  const pile = deck(rng(`${run.seed}:battle:${run.current}:${attempt}`));
  run.phase = config.type; run.result = null; run.rewardTaken = false;
  run.battle = { ...config, total: 0, hands: 4, discards: config.discards, hand: pile.splice(0, 8), pile, selected: [], history: [], pressureLost: 0 };
}
export function damage(total, target) {
  const ratio = total / target;
  return ratio >= 1 ? 0 : ratio >= .75 ? 8 : ratio >= .5 ? 16 : 24;
}
export function actCards(run, discard = false) {
  const b = run.battle;
  if (!['fight', 'elite', 'boss'].includes(run.phase) || !b || b.hands <= 0 || !b.selected.length || b.selected.length > b.maxCards || new Set(b.selected).size !== b.selected.length || b.selected.some(id => !b.hand.some(c => c.id === id)) || (discard && b.discards <= 0)) return false;
  const cards = b.hand.filter(c => b.selected.includes(c.id));
  if (discard) b.discards--;
  else {
    const value = score(cards, run, run.phase === 'boss');
    b.total += value.total; b.hands--;
    let suffix = '';
    // Pressure applies only to unfinished hands while another hand remains.
    // Final failures use deficit damage rather than stacking pressure again.
    if (b.total < b.target && b.hands > 0) {
      const loss = Math.min(run.hp, b.pressure); run.hp -= loss; b.pressureLost += loss; run.stats.pressure += loss;
      if (loss) suffix = ` · 未达标，压力 -${loss} 生命`;
    }
    b.history.unshift(`${value.name} · ${value.chips} × ${value.mult} = ${value.total}${suffix}`);
  }
  b.hand = b.hand.filter(c => !b.selected.includes(c.id));
  b.hand.push(...b.pile.splice(0, 8 - b.hand.length)); b.selected = [];
  if (run.hp === 0) {
    run.log.unshift(`倒在第 ${getNode(run).depth + 1} 层，生命被战斗压力耗尽。`); run.phase = 'dead';
  } else if (!discard && (b.total >= b.target || b.hands === 0)) finishBattle(run);
  return true;
}
function finishBattle(run) {
  const b = run.battle, win = b.total >= b.target, type = b.type;
  const loss = Math.min(run.hp, damage(b.total, b.target));
  run.hp -= loss; run.stats.deficit += loss;
  const reward = win ? b.reward : 0; run.money += reward;
  let extra = '';
  if (win && run.hp > 0 && run.jokers.includes('vampire')) { const heal = Math.min(6, run.maxHp - run.hp); run.hp += heal; extra += ` 回春恢复 ${heal} 生命。`; }
  if (win && type === 'elite') {
    run.stats.elites++;
    run.rewards = shuffled(Object.keys(JOKERS).filter(id => !run.jokers.includes(id)), rng(`${run.seed}:reward:${run.current}`)).slice(0, 2);
  }
  run.result = { win, loss, reward, extra, boss: type === 'boss', elite: type === 'elite', pressureLost: b.pressureLost };
  run.log.unshift(`${TYPES[type].name}：${win ? `胜利，+$${reward}` : `未达标，-${loss} 生命`}；本场压力消耗 ${b.pressureLost}。${extra}`);
  run.phase = run.hp <= 0 ? 'dead' : win && type === 'boss' ? 'won' : 'result';
  if (run.phase === 'won' && !run.visited.includes(run.current)) run.visited.push(run.current);
}
function completeNode(run) {
  const node = getNode(run);
  if (!run.visited.includes(node.id)) run.visited.push(node.id);
  run.available = node.next; run.phase = 'map'; run.current = null; return true;
}
export function leave(run) {
  if (!getNode(run) || !['shop', 'result'].includes(run.phase)) return false;
  if (run.phase === 'result' && run.result.win && run.result.elite && !run.rewardTaken) return false;
  if (run.phase === 'result' && run.result.boss && !run.result.win) { startBattle(run); return true; }
  return completeNode(run);
}
export function chooseReward(run, id) {
  if (run.phase !== 'result' || !run.result?.win || !run.result.elite || run.rewardTaken) return false;
  if (id === 'gold') { run.money += 6; run.log.unshift('放弃小丑牌奖励，改为获得 $6。'); }
  else if (run.rewards.includes(id) && !run.jokers.includes(id)) { run.jokers.push(id); run.log.unshift(`精英奖励：选择「${JOKERS[id].name}」。`); }
  else return false;
  run.rewardTaken = true; return true;
}
export function choice(run, action) {
  if (run.phase === 'rest') {
    if (!['heal', 'train'].includes(action)) return false;
    if (action === 'heal') { const amount = Math.min(20, run.maxHp - run.hp); run.hp += amount; run.log.unshift(`休息恢复 ${amount} 生命。`); }
    else { run.bonus += 10; run.log.unshift('整备强化：每次出牌永久 +10 筹码。'); }
  } else if (run.phase === 'event') {
    if (action === 'skip') run.log.unshift('离开事件，没有交易。');
    else {
      const option = EVENTS[run.eventId]?.choices.find(c => c.id === action);
      if (!option || run.money < (option.cost || 0) || run.hp <= (option.hp || 0)) return false;
      run.money += (option.money || 0) - (option.cost || 0); run.hp -= option.hp || 0;
      run.hp = Math.min(run.maxHp, run.hp + (option.heal || 0)); run.bonus += option.bonus || 0; run.kits += option.kits || 0;
      run.log.unshift(`${EVENTS[run.eventId].name}：${option.name}。${option.text}`);
    }
  } else if (run.phase === 'treasure') {
    if (action === 'kit') { run.kits++; run.log.unshift('宝箱：获得一个急救包。'); }
    else if (action === 'gold') { run.money += 10; run.log.unshift('宝箱：获得 $10。'); }
    else if (action === 'power') { run.bonus += 8; run.log.unshift('宝箱：每次出牌永久 +8 筹码。'); }
    else return false;
  } else return false;
  return completeNode(run);
}
export function buy(run, id) {
  if (run.phase !== 'shop' || run.purchases.includes(id) || (id !== 'kit' && !run.shopStock.includes(id))) return false;
  const cost = id === 'kit' ? 8 : JOKERS[id]?.price;
  if (!cost || run.money < cost || run.jokers.includes(id)) return false;
  run.money -= cost; run.purchases.push(id);
  if (id === 'kit') run.kits++; else run.jokers.push(id);
  run.log.unshift(`购买${id === 'kit' ? '急救包' : JOKERS[id].name}，-$${cost}。`); return true;
}
export function useKit(run) {
  if (run.kits <= 0 || run.hp >= run.maxHp || ['dead', 'won'].includes(run.phase)) return false;
  run.kits--; const amount = Math.min(15, run.maxHp - run.hp); run.hp += amount; run.log.unshift(`使用急救包，恢复 ${amount} 生命。`); return true;
}
