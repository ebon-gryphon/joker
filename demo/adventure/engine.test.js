import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMap, getNode, descendants, opportunities, FLOOR_COUNT } from './map.js';
import { BOSSES, EVENTS, newRun, deck, score, enter, encounter, damage, actCards, leave, choice, buy, useKit, chooseReward } from './engine.js';
const cards = ranks => ranks.map((rank, i) => ({ id: String(i), rank, suit: ['♠', '♥', '♣', '♦'][i % 4] }));
function jump(run, type) { const n = run.map.nodes.find(n => n.type === type); run.phase = 'map'; run.available = [n.id]; assert.equal(enter(run, n.id), true); return n; }
function finalHand(run, target) { run.battle.target = target; run.battle.hands = 1; run.battle.hand = cards([2]); run.battle.selected = ['0']; actCards(run); }
function paths(map, id = '0-0') { const n = map.nodes.find(n => n.id === id); return n.next.length ? n.next.flatMap(next => paths(map, next).map(p => [n, ...p])) : [[n]]; }

test('200 seeded maps preserve connectivity, length, pacing, noncrossing edges and elite bypass', () => {
  const fingerprints = new Set();
  for (let i = 0; i < 200; i++) {
    const map = generateMap(String(i)); fingerprints.add(JSON.stringify(map.nodes));
    assert.deepEqual(map, generateMap(String(i)));
    const allPaths = paths(map), reached = new Set(allPaths.flat().map(n => n.id));
    assert.equal(reached.size, map.nodes.length);
    assert.ok(allPaths.some(p => p.every(n => n.type !== 'elite')));
    assert.ok(allPaths.some(p => p.filter(n => n.type === 'elite').length === 2));
    for (const p of allPaths) {
      assert.equal(p.length, FLOOR_COUNT); assert.equal(p[0].type, 'fight');
      assert.equal(p[5].type, 'treasure'); assert.equal(p.at(-2).type, 'rest'); assert.equal(p.at(-1).type, 'boss');
      assert.ok(!p.some((n, j) => j && n.type === 'elite' && p[j - 1].type === 'elite'));
      assert.ok(!p.some((n, j) => j && ['shop', 'rest'].includes(n.type) && p[j - 1].type === n.type));
    }
    for (const n of map.nodes) {
      assert.equal(new Set(n.next).size, n.next.length);
      for (const id of n.next) assert.equal(map.nodes.find(v => v.id === id).depth, n.depth + 1);
      if (n.next.some(id => map.nodes.find(v => v.id === id).type === 'elite')) assert.ok(n.next.some(id => map.nodes.find(v => v.id === id).type !== 'elite'));
    }
    for (let d = 0; d < FLOOR_COUNT - 1; d++) {
      const edges = map.nodes.filter(n => n.depth === d).flatMap(n => n.next.map(id => [n.x, map.nodes.find(v => v.id === id).x]));
      for (const a of edges) for (const b of edges) assert.ok((a[0] - b[0]) * (a[1] - b[1]) >= 0);
    }
  }
  assert.ok(fingerprints.size > 150);
});
test('future preview never includes unreachable nodes and reports nearest opportunities', () => {
  const r = newRun('test'); const all = descendants(r, '0-0'); assert.equal(all.size, r.map.nodes.length);
  const beforeElite = getNode(r, '2-0'); assert.equal(opportunities(r, beforeElite.id).elite, 1);
  assert.equal(opportunities(r, '10-0').rest, undefined);
  assert.deepEqual([...descendants(r, '11-0')], ['11-0']);
});
test('seed repeats deck, unknown room resolution and shop inventory', () => {
  const a = newRun('same'), b = newRun('same'); enter(a, '0-0'); enter(b, '0-0');
  assert.deepEqual(a.battle.hand, b.battle.hand);
  jump(a, 'event'); jump(b, 'event'); assert.deepEqual(a.revealed, b.revealed);
  jump(a, 'shop'); jump(b, 'shop'); assert.deepEqual(a.shopStock, b.shopStock);
  assert.equal(new Set(deck().map(c => c.id)).size, 52);
});
test('hand recognition, synergies and faded boss use the actual boss rule', () => {
  const r = newRun('test'); assert.equal(score(cards([14, 2, 3, 4, 5]), r).name, '顺子');
  assert.equal(score(cards([2, 2, 2, 3, 3]), r).name, '葫芦');
  r.map.bossId = 'faded'; assert.equal(score([{ rank: 10, suit: '♥' }], r, true).total, 5);
  r.map.bossId = 'silence'; assert.equal(score([{ rank: 10, suit: '♥' }], r, true).total, 15);
  r.jokers = ['steady', 'pair', 'risk']; r.hp = 30; r.bonus = 10;
  assert.equal(score(cards([2, 2]), r).total, 288);
});
test('entry is one-way and unresolved nodes cannot be skipped', () => {
  const r = newRun(); assert.equal(enter(r, '11-0'), false); enter(r, '0-0');
  assert.equal(enter(r, '0-0'), false); assert.equal(leave(r), false);
  jump(r, 'rest'); assert.equal(leave(r), false); choice(r, 'train'); assert.equal(r.bonus, 10);
  assert.equal(choice(r, 'train'), false); assert.equal(r.bonus, 10);
  jump(r, 'treasure'); assert.equal(leave(r), false); choice(r, 'power'); assert.equal(r.bonus, 18);
  assert.equal(r.available.length, 3);
});
test('pressure hurts intermediate unfinished plays, but not discards, victories or final failures', () => {
  const r = newRun(); jump(r, 'elite'); r.battle.target = 10000;
  r.battle.hand = cards([2, 3]); r.battle.selected = ['0']; actCards(r, true);
  assert.equal(r.hp, 60); assert.equal(r.battle.hands, 4); assert.equal(r.battle.discards, 2);
  r.battle.selected = [r.battle.hand[0].id]; actCards(r); assert.equal(r.hp, 57); assert.equal(r.stats.pressure, 3);
  finalHand(r, 10000); assert.equal(r.hp, 33); assert.equal(r.result.loss, 24); assert.equal(r.result.pressureLost, 3);
  const win = newRun(); jump(win, 'elite'); finalHand(win, 1); assert.equal(win.hp, 60);
  const dead = newRun(); jump(dead, 'elite'); dead.hp = 3; dead.battle.target = 10000; dead.battle.selected = [dead.battle.hand[0].id]; actCards(dead); assert.equal(dead.phase, 'dead'); assert.equal(dead.hp, 0);
});
test('elite reward requires an explicit single choice and cannot be farmed', () => {
  const r = newRun(); jump(r, 'elite'); finalHand(r, 1);
  assert.equal(r.money, 32); assert.equal(r.rewards.length, 2); assert.equal(r.jokers.length, 0);
  assert.equal(leave(r), false); assert.equal(chooseReward(r, 'fake'), false);
  const id = r.rewards[0]; assert.equal(chooseReward(r, id), true); assert.equal(chooseReward(r, 'gold'), false);
  assert.deepEqual(r.jokers, [id]); assert.equal(leave(r), true); assert.equal(leave(r), false);
});
test('shop purchases and healing enforce ownership, inventory, affordability and caps', () => {
  const r = newRun(); jump(r, 'shop'); const id = r.shopStock[0];
  assert.equal(buy(r, id), true); assert.equal(buy(r, id), false);
  assert.equal(buy(r, Object.keys({ steady: 1, pair: 1, vampire: 1, risk: 1 }).find(v => !r.shopStock.includes(v))), false);
  assert.equal(buy(r, 'kit'), false); assert.equal(useKit(r), false);
  r.hp = 55; assert.equal(useKit(r), true); assert.equal(r.hp, 60); assert.equal(r.kits, 0);
  r.phase = 'dead'; r.hp = 0; r.kits = 1; assert.equal(useKit(r), false);
});
test('events reveal all supported outcomes and cannot spend lethal HP or unaffordable gold', () => {
  const observed = new Set();
  for (let i = 0; i < 100; i++) { const r = newRun(String(i)); const n = jump(r, 'event'); observed.add(r.phase); assert.ok(r.revealed[n.id]); }
  assert.deepEqual([...observed].sort(), ['event', 'fight', 'shop']);
  const r = newRun(); r.available = [r.map.nodes.find(n => n.type === 'event').id]; enter(r, r.available[0]);
  r.phase = 'event'; r.eventId = 'trader'; r.hp = 12;
  assert.equal(choice(r, 'blood'), false); r.money = 0; assert.equal(choice(r, 'secret'), false);
  r.hp = 13; assert.equal(choice(r, 'blood'), true); assert.equal(r.hp, 1); assert.equal(r.money, 16);
});
test('all bosses enforce their displayed rules, failure retries, and victory terminates', () => {
  for (const id of Object.keys(BOSSES)) {
    const r = newRun(); r.map.bossId = id; jump(r, 'boss');
    assert.equal(r.battle.maxCards, BOSSES[id].maxCards); assert.equal(r.battle.discards, BOSSES[id].discards);
    if (id === 'narrow') { r.battle.selected = r.battle.hand.slice(0, 5).map(c => c.id); assert.equal(actCards(r), false); }
    const firstDeck = r.battle.hand.map(c => c.id); finalHand(r, 10000); assert.equal(r.hp, 36);
    assert.equal(leave(r), true); assert.equal(r.phase, 'boss'); assert.notDeepEqual(firstDeck, r.battle.hand.map(c => c.id));
    finalHand(r, 1); assert.equal(r.phase, 'won'); assert.ok(r.visited.includes(r.current)); assert.equal(leave(r), false);
  }
});
test('final deficit tiers and death do not permit free continuation', () => {
  assert.deepEqual([0, 50, 75, 100].map(n => damage(n, 100)), [24, 16, 8, 0]);
  const r = newRun(); enter(r, '0-0'); r.hp = 10; finalHand(r, 10000);
  assert.equal(r.phase, 'dead'); assert.equal(r.hp, 0); assert.equal(leave(r), false);
});
test('invalid card selections cannot score or consume turns', () => {
  const r = newRun(); enter(r, '0-0'); r.battle.selected = ['not-a-card']; assert.equal(actCards(r), false);
  const id = r.battle.hand[0].id; r.battle.selected = [id, id]; assert.equal(actCards(r), false);
  assert.equal(r.battle.hands, 4); assert.equal(r.battle.total, 0);
});
