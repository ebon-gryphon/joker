// 本作十二关流程的原创调优数值；所有条件均检查打出的牌（非留在手中的牌）。
const pair = h => ['对子', '两对', '三条', '葫芦', '四条'].includes(h.name)
const straight = h => ['顺子', '同花顺'].includes(h.name)
const flush = h => ['同花', '同花顺'].includes(h.name)
const count = (cards, ranks) => cards.filter(c => ranks.includes(c.rank)).length
const suitCount = (cards, suit) => cards.filter(c => c.suit === suit).length
const entry = (id, name, rarity, price, art, category, desc, effect) => ({ id, name, rarity, price, art, category, desc, effect })

export const JOKER_POOL = [
  entry('jester', '小丑', 'common', 3, '🃏', '倍率', '每手 +3 倍率', () => ({ mult: 3 })),
  entry('scholar', '学者', 'common', 3, '📖', '点数', '每张 A +2 倍率', c => ({ mult: count(c, ['A']) * 2 })),
  entry('half_joker', '半张小丑', 'common', 4, '🌓', '牌型', '出牌不超过 3 张时 +5 倍率', c => ({ mult: c.length <= 3 ? 5 : 0 })),
  entry('even_steven', '偶数史蒂文', 'common', 4, '✌️', '点数', '每张 2/4/6/8/10 +1 倍率', c => ({ mult: count(c, ['2','4','6','8','10']) * 1 })),
  entry('odd_todd', '奇数托德', 'common', 4, '🎲', '点数', '每张 A/3/5/7/9 +1 倍率', c => ({ mult: count(c, ['A','3','5','7','9']) * 1 })),
  entry('smiley_face', '笑脸', 'common', 4, '🙂', '点数', '每张 J/Q/K +2 倍率', c => ({ mult: count(c, ['J','Q','K']) * 2 })),
  entry('heart_collector', '红心收藏家', 'rare', 5, '❤️', '花色', '打出至少 3 张 ♥ 时，倍率 ×2', c => ({ times: suitCount(c, '♥') >= 3 ? 2 : 1 })),
  entry('club_lover', '梅花爱好者', 'rare', 5, '♣️', '花色', '打出至少 3 张 ♣ 时，倍率 ×2', c => ({ times: suitCount(c, '♣') >= 3 ? 2 : 1 })),
  entry('royal_face', '皇家头牌', 'rare', 6, '👑', '点数', '打出至少 3 张 J/Q/K 时，倍率 ×2', c => ({ times: count(c, ['J','Q','K']) >= 3 ? 2 : 1 })),
  entry('pair_engine', '对子引擎', 'rare', 5, '⚙️', '牌型', '含至少一组对子时 +30 筹码', (c,h) => ({ chips: pair(h) ? 30 : 0 })),
  entry('flush_flag', '同花旗手', 'rare', 6, '🚩', '牌型', '同花或同花顺 +40 筹码', (c,h) => ({ chips: flush(h) ? 40 : 0 })),
  entry('straight_flush_master', '同花顺大师', 'legendary', 10, '🔥', '牌型', '顺子或同花 +6 倍率；同花顺 +20 倍率', (c,h) => ({ mult: h.name === '同花顺' ? 20 : straight(h) || flush(h) ? 6 : 0 })),
  entry('blue_joker', '蓝色小丑', 'common', 3, '🔵', '筹码', '每手 +20 筹码', () => ({ chips: 20 })),
  entry('diamond_miner', '方片矿工', 'common', 4, '💎', '花色', '每张 ♦ +8 筹码', c => ({ chips: suitCount(c, '♦') * 8 })),
  entry('spade_guard', '黑桃卫士', 'common', 4, '♠️', '花色', '每张 ♠ +2 倍率', c => ({ mult: suitCount(c, '♠') * 2 })),
  entry('jolly_joker', '开心小丑', 'common', 4, '😄', '牌型', '含至少一组对子时 +4 倍率', (c,h) => ({ mult: pair(h) ? 4 : 0 })),
  entry('trio', '三人行', 'rare', 6, '🎭', '牌型', '三条、葫芦或四条时，倍率 ×2', (c,h) => ({ times: ['三条','葫芦','四条'].includes(h.name) ? 2 : 1 })),
  entry('double_act', '双人喜剧', 'common', 4, '👯', '牌型', '两对或葫芦时 +5 倍率', (c,h) => ({ mult: ['两对','葫芦'].includes(h.name) ? 5 : 0 })),
  entry('straight_rail', '顺子铁轨', 'common', 4, '🚂', '牌型', '顺子或同花顺 +35 筹码', (c,h) => ({ chips: straight(h) ? 35 : 0 })),
  entry('crazy_joker', '杂技小丑', 'common', 4, '🤹', '牌型', '顺子或同花顺 +6 倍率', (c,h) => ({ mult: straight(h) ? 6 : 0 })),
  entry('droll_joker', '同花剧团', 'common', 4, '🎪', '牌型', '同花或同花顺 +5 倍率', (c,h) => ({ mult: flush(h) ? 5 : 0 })),
  entry('banner', '节制旗帜', 'common', 4, '🎏', '筹码', '每剩余一次弃牌机会 +8 筹码', (c,h,x) => ({ chips: x.discardsLeft * 8 })),
  entry('bull', '金牛', 'rare', 5, '🐂', '经济', '每持有 $1 +1 筹码（最多 +40）', (c,h,x) => ({ chips: Math.min(40, x.money) })),
  entry('empty_pockets', '孤注一掷', 'rare', 5, '🕳️', '条件', '弃牌机会耗尽时，倍率 ×2', (c,h,x) => ({ times: x.discardsLeft === 0 ? 2 : 1 })),
  entry('last_hand', '压轴演员', 'rare', 5, '⏳', '条件', '本关最后一次出牌时，倍率 ×2', (c,h,x) => ({ times: x.handsLeft === 1 ? 2 : 1 })),
  entry('fibonacci', '斐波那契', 'rare', 5, '🌀', '点数', '每张 A/2/3/5/8 +2 倍率', c => ({ mult: count(c, ['A','2','3','5','8']) * 2 })),
  entry('walkie_talkie', '对讲机', 'rare', 5, '📻', '点数', '每张 4 或 10：+6 筹码、+1 倍率', c => ({ chips: count(c, ['4','10']) * 6, mult: count(c, ['4','10']) * 1 })),
  entry('runner', '长跑选手', 'common', 4, '🏃', '成长', '每打出顺子或同花顺，永久 +8 筹码（本手生效，上限 +80）', (c,h,x,j) => ({ chips: Math.min(80, (j.progress || 0) + (straight(h) ? 8 : 0)) })),
  entry('square_joker', '方块小丑', 'common', 4, '🟦', '成长', '每打出恰好 4 张牌，永久 +4 筹码（本手生效，上限 +60）', (c,h,x,j) => ({ chips: Math.min(60, (j.progress || 0) + (c.length === 4 ? 4 : 0)) })),
  entry('green_joker', '绿色小丑', 'common', 4, '🌱', '成长', '每次出牌永久 +1 倍率；每次弃牌 -1，范围 0～12', (c,h,x,j) => ({ mult: Math.min(12, (j.progress || 0) + 1) })),
  entry('golden_joker', '黄金小丑', 'common', 5, '💰', '经济', '每次过关额外获得 $2', () => ({})),
  entry('rebate', '回收员', 'common', 4, '♻️', '经济', '每次使用弃牌获得 $1', () => ({})),
  entry('constellation', '群星绘卷', 'legendary', 10, '🌌', '点数', '打出 5 张不同点数的牌时 +10 倍率', c => ({ mult: c.length === 5 && new Set(c.map(x => x.rank)).size === 5 ? 10 : 0 })),
  entry('four_seasons', '四季王冠', 'legendary', 10, '🍀', '花色', '打出的牌集齐四种花色时 +60 筹码', c => ({ chips: new Set(c.map(x => x.suit)).size === 4 ? 60 : 0 })),
  entry('dynasty', '王朝', 'legendary', 12, '🏰', '牌型', '葫芦或四条时，倍率 ×3', (c,h) => ({ times: ['葫芦','四条'].includes(h.name) ? 3 : 1 })),
  entry('hermit', '隐者', 'legendary', 10, '🧙', '牌型', '仅打出 1 张牌时 +40 筹码、+6 倍率', c => ({ chips: c.length === 1 ? 40 : 0, mult: c.length === 1 ? 6 : 0 })),
  entry('phoenix', '不死鸟', 'legendary', 11, '🐦‍🔥', '条件', '最后一次出牌且弃牌耗尽时，倍率 ×3', (c,h,x) => ({ times: x.handsLeft === 1 && x.discardsLeft === 0 ? 3 : 1 })),
]

export const SCORE_DEFAULTS = { money: 0, handsLeft: 4, discardsLeft: 3 }

export function advanceJokers(jokers, event, cards = [], hand = null) {
  return jokers.map(j => {
    let progress = j.progress || 0
    if (j.id === 'green_joker') progress = Math.min(12, Math.max(0, progress + (event === 'play' ? 1 : -1)))
    if (event === 'play' && j.id === 'runner' && straight(hand)) progress = Math.min(80, progress + 8)
    if (event === 'play' && j.id === 'square_joker' && cards.length === 4) progress = Math.min(60, progress + 4)
    return { ...j, progress }
  })
}

export function jokerStatus(joker) {
  if (joker.category !== '成长') return ''
  return `已积累 +${joker.progress || 0} ${joker.id === 'green_joker' ? '倍率' : '筹码'}`
}
