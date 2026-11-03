const MOODS = { you: 'irked', bot: 'smug', draw: 'amused' }

// Exchanges stay together so the jester answers the player's actual line.
// Selection uses public results only, never the deck, and never changes a match.
const EXCHANGES = {
  round: {
    you: [
      { line: '这一轮算你的。别急着把手从牌上拿开。', response: '分数已经落下了，你还想赖？', retort: '分数归你。这张桌，可还归我。' },
      { line: '居然让你赢了。看来灯还得再暗一点。', response: '灯再暗，我也认得赢你的牌。', retort: '那就认仔细了。下一轮可别摸错。' },
      { line: '牌出得不错。你最好一直这么稳。', response: '你先把笑收好，别影响看分。', retort: '笑可以收。输给你的账，我会留着。' },
    ],
    bot: [
      { line: '这一轮归我。你的牌，还没我的笑有用。', response: '先笑着，待会儿别收得太急。', retort: '那你得快一点。我笑累了，可不会等。' },
      { line: '又添了一笔。你想什么时候还？', response: '账先记着，我会一笔一笔赢回来。', retort: '好，我给你留着。可别只会念账。' },
      { line: '看清楚了？这才叫把牌打在该打的地方。', response: '看清了，也看见你还没赢完整桌。', retort: '那就继续看。我没打算让你漏掉结尾。' },
    ],
    draw: [
      { line: '一分都不肯让。你也挺舍不得这张桌。', response: '我留下，是等你输。', retort: '巧了。我也是这么等着你的。' },
      { line: '分数一样。你是在照着我出牌？', response: '再出一轮，看谁跟不上谁。', retort: '行。下一张牌，手可别抖。' },
      { line: '谁都没赢。这阵安静，倒挺合我的胃口。', response: '安静点好，省得听你嘴硬。', retort: '等我赢了，你可就得听全了。' },
    ],
  },
  close: {
    you: [
      { line: '就差这么一点。你这口气憋得够久。', response: '赢你，多这一点就够。', retort: '这一点我看见了。下一轮，我会贴得更近。' },
      { line: '险些就轮到我笑了。你倒挺会挑时候。', response: '你的险些，我的胜局。', retort: '说得好。等位置换过来，我原话还你。' },
      { line: '只多这几分，也值得你看这么久？', response: '看仔细，免得你又说没输。', retort: '我认这几分。余下的，咱们慢慢算。' },
    ],
    bot: [
      { line: '差一点。可惜这张桌不收差一点。', response: '差距这么小，你也笑得出来。', retort: '笑得出来。赢一分，也够我慢慢笑。' },
      { line: '就隔这几分。是不是很想把最后那张重出？', response: '不用重出，下一手补回来。', retort: '有这股劲就好。别把它全花在嘴上。' },
      { line: '手都伸到胜局边上了，还是被我拿走。', response: '你拿稳了，我马上来取。', retort: '尽管来取。先让你的分数够得着。' },
    ],
  },
  comeback: {
    you: [
      { line: '上一轮还低着头，这一轮就敢盯着我了？', response: '盯清楚，轮到你输给我了。', retort: '一轮而已。别把翻身当成散场。' },
      { line: '扳回来一轮。你总算不只会攥着牌了。', response: '刚才那轮，现在还给你。', retort: '还得挺快。可桌上还有下一笔。' },
      { line: '刚压下去的分数，又让你拽上来了。', response: '你压不住，就换我来。', retort: '那就试试。这把椅子可没那么好坐。' },
    ],
    bot: [
      { line: '上一轮让你拿着的，现在该还了。', response: '扳回一轮，就急着当赢家了？', retort: '不急。我会让你看着它一轮轮变多。' },
      { line: '刚才笑得那么早，现在怎么停了？', response: '喘口气而已，你别当真。', retort: '那就喘匀。下一轮，我可不会跟着停。' },
      { line: '你的胜局到头了。这一轮，该听我的。', response: '这一轮给你，整桌还没定。', retort: '我知道。所以你的牌，最好还够用。' },
    ],
  },
  streak: {
    you: [
      { line: '又是你。这几轮，你倒把路走顺了。', response: '你还站在原地，我当然接着赢。', retort: '路顺的时候，更该看看前面是谁在等。' },
      { line: '连着拿走我的胜局，你不觉得手烫？', response: '不烫，还能再拿几轮。', retort: '胃口倒不小。下一轮，先别急着伸手。' },
      { line: '又添一胜。你是打算让我一直看下去？', response: '看着吧，这还没到最后一笔。', retort: '我看着。也替你记着，每一笔。' },
    ],
    bot: [
      { line: '一轮接一轮。你还没找到打断我的牌？', response: '连胜记清楚，省得断了不认。', retort: '记着呢。就看你打算拿什么来断。' },
      { line: '又是我的分数更高。你是不是看腻了？', response: '看够了，该让你换个表情。', retort: '我的表情，可不会听一句话就换。' },
      { line: '这张桌，快只剩我的胜局了。', response: '只要还没结束，我就能往回打。', retort: '好。那剩下的牌，你可别浪费了。' },
    ],
  },
  match: {
    you: [
      { line: '行，这一桌归你。门开着，别回头。', response: '牌桌留好，我还会回来赢你。', retort: '桌子会留着。下次的胜局，可不会替你留。' },
      { line: '最后让你赢了。你倒真把这局打完了。', response: '输赢已经定了，你可以收牌了。', retort: '收牌容易。想让我服气，再赢一桌。' },
      { line: '带着你的胜局走吧。这盏灯，我还会点。', response: '灯亮着也好，免得下次认不出败局。', retort: '那就记清这张脸。下次未必还让你笑。' },
    ],
    bot: [
      { line: '你输了。这张牌桌，还没准你散场。', response: '这一桌算你赢，下一桌就未必了。', retort: '下一桌？我已经替你把椅子留好了。' },
      { line: '最后一张也落下了。你还想从哪里翻回来？', response: '输一桌而已，我还敢再坐下来。', retort: '那就坐。敢回来的人，我从不嫌多。' },
      { line: '整桌都归我。你的不服气，也想一起留下？', response: '不服气我带走，胜局下次来拿。', retort: '带好它。下次别只带这一样来。' },
    ],
    draw: [
      { line: '打完整桌，还是没分开。你倒挺能耗。', response: '再开一桌，总有一人先服。', retort: '正合我意。我不急着把灯熄掉。' },
      { line: '谁也没赢。这扇门，看来还得多等一会儿。', response: '门等着吧，我先把你赢了。', retort: '先别替门做主。你的牌，还得重新发。' },
      { line: '平手收场。你愿意就这么把牌放下？', response: '当然不愿意，重新发牌。', retort: '牌在这儿。看这回是谁先把话咽回去。' },
    ],
  },
}

function scoreWinner(you, bot) {
  return you === bot ? 'draw' : you > bot ? 'you' : 'bot'
}

function resultWinner(input) {
  return input.finished
    ? scoreWinner(input.wins[0], input.wins[1])
    : scoreWinner(input.youScore, input.botScore)
}

export function resultEmotion(input) {
  return MOODS[resultWinner(input)]
}

function contextFor(input, winner) {
  if (input.finished) return 'match'
  if (winner === 'draw') return 'round'
  // `results` contains this completed round; ignore it when checking history.
  const previous = input.results.slice(0, Math.max(0, input.round - 1))
  const lastTwo = previous.slice(-2)
  if (lastTwo.length === 2 && lastTwo.every(result => scoreWinner(result.you, result.bot) === winner)) return 'streak'
  const last = previous.at(-1)
  if (last && scoreWinner(last.you, last.bot) === (winner === 'you' ? 'bot' : 'you')) return 'comeback'
  const highest = Math.max(input.youScore, input.botScore)
  if (highest > 0 && Math.abs(input.youScore - input.botScore) / highest <= 0.1) return 'close'
  return 'round'
}

export function chooseResultBanter(input, variant = 0) {
  const winner = resultWinner(input)
  const context = contextFor(input, winner)
  const exchanges = EXCHANGES[context][winner]
  const alternate = Number.isFinite(variant) ? Math.trunc(variant) : 0
  const index = ((input.round - 1 + alternate) % exchanges.length + exchanges.length) % exchanges.length
  return {
    ...exchanges[index],
    mood: MOODS[winner],
    replyKey: `${context}.${winner}.${index}`,
  }
}
