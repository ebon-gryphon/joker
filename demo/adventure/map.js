// Our constrained route generator, inspired by route-planning games.
// This is not a reproduction of Slay the Spire's generator.
export const FLOOR_COUNT = 12;
export function rng(seed) {
  let state = 2166136261;
  for (const c of String(seed)) state = Math.imul(state ^ c.charCodeAt(0), 16777619);
  return () => {
    state |= 0; state = state + 0x6D2B79F5 | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
export function shuffled(items, random) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function generateMap(seed) {
  const random = rng(`map:${seed}`);
  const support = () => random() < .5 ? ['rest', 'fight', 'shop'] : ['shop', 'fight', 'rest'];
  const rows = [
    ['fight'], shuffled(['fight', 'event', 'fight'], random), support(),
    ['elite', 'fight', 'elite'], support().map((t, i) => i === 1 ? 'event' : t),
    ['treasure'], shuffled(['fight', 'event', 'fight'], random), support(),
    ['elite', 'fight', 'elite'], shuffled(['fight', 'event', 'fight'], random),
    ['rest'], ['boss'],
  ];
  const nodes = rows.flatMap((row, depth) => row.map((type, lane) => ({
    id: `${depth}-${lane}`, type, depth, lane, x: row.length === 1 ? 1 : lane, next: [],
  })));
  for (let depth = 0; depth < rows.length - 1; depth++) {
    const from = nodes.filter(n => n.depth === depth), to = nodes.filter(n => n.depth === depth + 1);
    if (from.length === 1 || to.length === 1) {
      for (const n of from) n.next = to.map(t => t.id);
      continue;
    }
    for (const n of from) n.next.push(to[n.lane].id);
    // Adjacent diagonals are one-way per lane boundary, so paths never cross.
    // Before elite floors, both outside routes can opt into the middle fight.
    if ([2, 7].includes(depth)) {
      from[0].next.push(to[1].id); from[2].next.push(to[1].id);
    } else {
      for (let lane = 0; lane < 2; lane++) {
        const roll = random();
        if (roll < .4) from[lane].next.push(to[lane + 1].id);
        else if (roll < .8) from[lane + 1].next.push(to[lane].id);
      }
    }
  }
  return { seed: String(seed), nodes, bossId: shuffled(['faded', 'narrow', 'silence'], random)[0] };
}
export function getNode(run, id = run.current) { return run.map.nodes.find(n => n.id === id); }
export function descendants(run, id) {
  const seen = new Set(); const todo = [id];
  while (todo.length) {
    const item = todo.shift(); if (seen.has(item)) continue;
    seen.add(item); todo.push(...getNode(run, item).next);
  }
  return seen;
}
export function opportunities(run, id) {
  const found = {}; const seen = new Set([id]); const todo = getNode(run, id).next.map(next => [next, 1]);
  while (todo.length) {
    const [next, distance] = todo.shift(); if (seen.has(next)) continue;
    seen.add(next); const node = getNode(run, next);
    if (['rest', 'shop', 'elite', 'treasure'].includes(node.type) && !found[node.type]) found[node.type] = distance;
    todo.push(...node.next.map(n => [n, distance + 1]));
  }
  return found;
}
