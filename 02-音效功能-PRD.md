# PRD — 小丑牌音效系统

**版本**：v1.0  
**日期**：2026-05-31  
**作者**：产品经理（AI 辅助）  
**项目**：小丑牌（Balatro 风格网页卡牌游戏）

---

## 1. 一句话定位

为"小丑牌"网页游戏补全 SFX + BGM 音频层，让玩家在选牌、计分、过关等关键时刻获得即时、有层次的听觉反馈，提升游戏爽感与沉浸感。

---

## 2. 目标用户与场景

**目标用户**：在浏览器中独自玩小丑牌的休闲玩家（PC/手机均有）。

**使用场景**：
- 玩家在无声页面上操作，缺乏反馈感，选牌、得分动画显得单薄。
- 玩家长时间游玩，需要背景音乐维持代入感。
- 玩家在公共场合或深夜游玩，需要独立控制 SFX 与 BGM 音量，甚至完全静音。

**当前现状**：项目无任何音频实现，所有交互均为纯视觉反馈。

---

## 3. 核心价值主张

- **即时反馈**：每个操作（选牌、出牌、得分）配专属音效，让玩家"听到"自己的决策。
- **层次感**：UI 音效轻盈短促，计分爆字厚重有力，两套风格不割裂但有明显区分。
- **轻量可控**：全部资源 2–5 MB，纯前端加载，无服务端依赖；玩家可独立控制 SFX/BGM。

---

## 4. 功能清单（MVP）

### P0 — 核心 SFX（必须上线）

| # | 用户故事 | 触发时机 | 说明 |
|---|----------|----------|------|
| S01 | 作为玩家，当我点击手牌时，我想听到轻巧的"选中"音效，以便确认牌已被选中 | `CardView` 选中态切换（选中） | 轻盈短促，类木块敲击 |
| S02 | 作为玩家，当我取消选中一张牌时，我想听到略低沉的"取消"音效，以便区分两个状态 | `CardView` 选中态切换（取消） | S01 的降调版或反向短音 |
| S03 | 作为玩家，当我点击"出牌"时，我想听到决断感的音效，以便感受出招瞬间 | `HandArea` 出牌按钮点击 | 中等厚重，类纸牌甩出 |
| S04 | 作为玩家，当我点击"弃牌"时，我想听到轻柔的丢弃音效，以便与出牌区分 | `HandArea` 弃牌按钮点击 | 轻，类翻页/抽走 |
| S05 | 作为玩家，当我点击"按点排序"或"按花排序"时，我想听到快速的排列音效 | `HandArea` 两个排序按钮 | 快速短促，类卡片洗牌 |
| S06 | 作为玩家，当我点击"AI 出牌"时，我想听到启动提示音，以便知道 AI 已介入 | `HandArea` AI 出牌按钮 | 电子感短音 |
| S07 | 作为玩家，当 AI 正在思考时，我想听到持续的"思考中"循环音，以便感受等待过程 | AI 思考期间（循环播放，思考结束后停止） | 轻微机械循环，约 1–2 秒一个周期 |
| S08 | 作为玩家，当牌飞入出牌区时，我想听到轻快的飞牌音，以便感受动画节奏 | `useAnimations` 飞牌阶段 | 每张牌触发一次，短促，可快速连打 |
| S09 | 作为玩家，当每张牌逐个高亮计分时，我想听到递进的"叮"声配合 chips 飞字 | 逐张高亮 + chips 飞字阶段 | 音调可略微递增，营造累加感 |
| S10 | 作为玩家，当 Joker 触发金光时，我想听到明显的"魔法激活"音效配合 mult 飞字 | Joker 金光 + mult 飞字阶段 | 厚重、带金属共鸣感，区别于普通计分 |
| S11 | 作为玩家，当中央公式大字爆出时，我想听到最厚重的冲击音，以便感受高潮时刻 | 中央公式爆出（`useAnimations` 最后阶段） | 低频爆破感，可叠加混响 |
| S12 | 作为玩家，当盲注分数数字滚动累加时，我想听到快速的计数音，以便感受分数在涨 | blindScore 数字累加动画期间 | 快速连续短音，类老虎机滚轮 |
| S13 | 作为玩家，当盲注达标过关时，我想听到胜利感音效，以便感受成就感 | 过关结算触发瞬间 | 上扬，欢快，1–2 秒 |
| S14 | 作为玩家，当手数用尽失败时，我想听到失落感音效，以便收到明确结局反馈 | 失败结算触发瞬间 | 下沉，沉重，1–2 秒 |
| S15 | 作为玩家，当我进入商店时，我想听到"进店"音效，以便感知场景切换 | `ShopScreen` 进入时 | 轻快铃声，类开门声 |
| S16 | 作为玩家，当我成功购买 Joker 时，我想听到"购买成功"音效 | 商店购买成功 | 硬币/金币音，短促满足感 |
| S17 | 作为玩家，当我点击"跳过"继续下一关时，我想听到轻盈的确认音 | 商店跳过按钮 | 简短正向确认音 |

### P0 — BGM（必须上线）

| # | 用户故事 | 场景 | 说明 |
|---|----------|------|------|
| B01 | 作为玩家，当我在游戏主界面时，我想听到循环 BGM，以便维持游戏代入感 | 游戏主界面（`playing` 状态）循环 | 轻快、带节奏感，Balatro 风格电子/爵士融合 |
| B02 | 作为玩家，当我在商店界面时，我想听到不同的商店 BGM，以便感知场景切换 | `ShopScreen`（`shop` 状态）循环 | 轻松休闲，节奏略慢于主界面 BGM |
| B03 | 作为玩家，当通关或失败时，我想听到对应 jingle，以便强化结局情绪 | `EndScreen` 展示时 | 胜利 jingle 欢快上扬，失败 jingle 短促低沉；不循环，播完即止 |

### P1 — 设置控制（必须上线，与 P0 同批）

| # | 用户故事 | 说明 |
|---|----------|------|
| C01 | 作为玩家，我想在设置弹窗中独立调节「SFX 音量」（0–100 滑杆），以便控制音效大小 | 存入 `localStorage`，key: `balatro.settings` |
| C02 | 作为玩家，我想在设置弹窗中独立调节「BGM 音量」（0–100 滑杆），以便控制背景音乐大小 | 同上 |
| C03 | 作为玩家，我想对 SFX 和 BGM 分别有一键静音开关，以便快速关闭某一类声音 | 静音开关与音量滑杆联动，静音时滑杆灰显但不重置数值 |
| C04 | 作为玩家，我想在刷新/下次打开游戏时保持上次音量设置，以便不用每次重新调整 | 读取 `localStorage` 中已保存的设置 |

### P2 — 后续优化（不在本期范围内）

- 音效变调（同一音效随机 pitch ±5%，避免重复感）
- 每种 Joker 触发专属音效
- 手牌张数不同时飞牌音有细微差异
- 移动端振动反馈（Vibration API）

---

## 5. 推荐音效资源清单

以下所有资源均为免费开源，可商用（注意逐一核对具体文件的 License）。

### 5.1 SFX 推荐来源

**Kenny.nl（首选，License: CC0）**

Kenny 资源包结构清晰、文件命名规范，适合快速对号入座。

| 需求 | 推荐包 | 具体文件建议 |
|------|--------|-------------|
| 选牌选中 (S01) | Kenny Interface Sounds | `click_001.ogg` / `click_002.ogg` |
| 取消选中 (S02) | Kenny Interface Sounds | `click_004.ogg`（音调更低） |
| 出牌 (S03) | Kenny Card Sounds | `cardPlace1.ogg` |
| 弃牌 (S04) | Kenny Card Sounds | `cardSlide1.ogg` |
| 排序按钮 (S05) | Kenny Card Sounds | `cardShove1.ogg` / `cardFan1.ogg` |
| AI 启动 (S06) | Kenny Sci-Fi Sounds | `confirmation_002.ogg` |
| AI 思考循环 (S07) | Kenny Sci-Fi Sounds | `processing_loop.ogg`（截取 1–2s 做循环点） |
| 飞牌 (S08) | Kenny Card Sounds | `cardPlace2.ogg`（短促版） |
| 逐张高亮计分 (S09) | Kenny Interface Sounds | `impactSoft_medium_001.ogg` |
| Joker 金光 (S10) | Kenny RPG Sounds | `magic_004.ogg` |
| 中央公式爆出 (S11) | Kenny Impact Sounds | `impactGlass_heavy_003.ogg` |
| 计数滚动 (S12) | Kenny Interface Sounds | `tick_001.ogg`（连打） |
| 过关 (S13) | Kenny Interface Sounds | `confirmation_001.ogg` |
| 失败 (S14) | Kenny Interface Sounds | `error_005.ogg` |
| 进店 (S15) | Kenny Interface Sounds | `openFullscreen_001.ogg` |
| 购买成功 (S16) | Kenny Interface Sounds | `coin_001.ogg` / `coin_002.ogg` |
| 跳过 (S17) | Kenny Interface Sounds | `minimize_001.ogg` |

下载地址：https://kenney.nl/assets（搜索对应包名，全部 CC0）

**freesound.org（补充，License 各异，注意过滤 CC0/CC-BY）**

当 Kenny 包缺某个质感时，在 freesound.org 搜索以下关键词：

| 需求 | 搜索关键词 | 过滤条件 |
|------|-----------|---------|
| Joker 金光厚重版 (S10) | `magic spell impact` | CC0，时长 < 2s |
| 中央爆字低频版 (S11) | `bass impact boom` | CC0，时长 < 1.5s |
| 计数滚动 (S12) | `slot machine ticking` | CC0 |
| 失败下沉 (S14) | `fail descend` | CC0 |

**OpenGameArt.org（BGM 首选，License: CC0 / CC-BY）**

| 需求 | 搜索关键词 / 推荐作品 |
|------|----------------------|
| 主界面 BGM (B01) | 搜索 `chiptune jazz loop`；推荐：Juhani Junkala 系列（CC0） |
| 商店 BGM (B02) | 搜索 `casual shop loop`；推荐：Matthew Pablo 轻音乐系列（CC-BY） |
| 胜利 jingle (B03) | 搜索 `victory fanfare short`；推荐 Juhani Junkala `5 Chiptunes (Action)` 中的 win stinger |
| 失败 jingle (B03) | 搜索 `game over jingle`；推荐 OpenGameArt 用户 `SubspaceAudio` 的 `Game Over Pack` |

下载地址：https://opengameart.org

### 5.2 文件规格要求

| 项目 | 要求 |
|------|------|
| 格式 | `.ogg`（主）+ `.mp3`（iOS/Safari 兼容备用） |
| SFX 时长 | 0.1s – 2s，超出须剪辑 |
| BGM 时长 | 30s – 120s 循环段，需做无缝循环点 |
| 采样率 | 44100 Hz |
| 总体积预算 | SFX ≤ 1.5 MB，BGM ≤ 3 MB，合计 ≤ 4.5 MB |

---

## 6. 核心流程

### 6.1 音频初始化流程

```
用户首次交互（任意点击）
  → 创建 AudioContext（解决浏览器自动播放策略限制）
  → 读取 localStorage 中 balatro.settings 的音量配置
  → 预加载全部 SFX（使用 AudioBuffer 缓存）
  → 启动主界面 BGM（loop = true）
```

> 说明：浏览器要求必须在用户手势后才能播放音频。第一次点击任意按钮即触发初始化，此后正常播放。

### 6.2 状态切换时 BGM 交叉淡出

```
playing 状态 BGM 播放中
  → 触发过关/进商店
  → 主界面 BGM 在 0.5s 内淡出
  → 商店 BGM 在 0.3s 内淡入（loop = true）
  → 返回游戏
  → 商店 BGM 淡出 → 主界面 BGM 淡入
```

### 6.3 计分动画音效时序（对应 App.vue handlePlay() 7 步）

```
步骤1：飞牌 → 每张牌落位时播放 S08（飞牌音）
步骤2：逐张高亮 → 每张高亮 + chips 飞字时播放 S09（叮声，可递增音调）
步骤3：Joker 金光 → 每个 Joker 触发时播放 S10（魔法激活音）
步骤4：mult 飞字 → 与 S10 共用或用 S09 变调
步骤5：中央公式爆出 → 播放 S11（低频爆破）
步骤6：blindScore 累加 → 持续播放 S12（计数音）直到累加结束
步骤7：完成 → 判断过关/失败 → 播放 S13 或 S14，同时触发对应 BGM 切换
```

### 6.4 设置弹窗控制流程

```
打开 SettingsModal
  → 显示 SFX 音量滑杆（0–100）+ SFX 静音开关
  → 显示 BGM 音量滑杆（0–100）+ BGM 静音开关
  → 用户调整任意控件
  → 实时生效（SFX 调 GainNode，BGM 调 gainNode.gain.value）
  → 自动保存到 localStorage（balatro.settings）
```

---

## 7. 数据与状态

### 7.1 需存储的设置（合并入现有 `balatro.settings` localStorage key）

```json
{
  "sfxVolume": 80,
  "sfxMuted": false,
  "bgmVolume": 60,
  "bgmMuted": false
}
```

### 7.2 运行时音频状态（不持久化）

- `AudioContext` 实例（单例）
- `sfxGainNode`：所有 SFX 共享的增益节点
- `bgmGainNode`：BGM 专用增益节点
- `currentBgmSource`：当前播放的 BGM `AudioBufferSourceNode`（切换时 stop 旧的，start 新的）
- `sfxBufferMap`：Map，key = 音效名称，value = `AudioBuffer`（预加载缓存）
- `isAudioInitialized`：Boolean，防止重复初始化

### 7.3 技术方案建议

使用 **Web Audio API**（原生，无需额外依赖），在 Vue 3 中封装为 `composables/useAudio.js`。不引入 Howler.js 等第三方库，保持依赖纯净、体积小。

---

## 8. 不做什么

| 不做的事 | 原因 |
|---------|------|
| 每种 Joker 专属音效 | 当前 Joker 数量少，专属音效性价比低，放二期 |
| 音效变调（random pitch）| 技术细节，MVP 验证核心价值后再做 |
| 移动端振动反馈 | 需测试兼容性，不是核心用户诉求 |
| 引入 Howler.js / Tone.js | 增加包体积，Web Audio API 已足够覆盖需求 |
| 音频云端托管/CDN 分发 | 项目部署在 GitHub Pages，静态资源直接随包走 |
| 用户自定义音效上传 | 超出独立游戏范围 |
| 3D 空间音效 | 与游戏类型不匹配 |
| 语音旁白 | 成本高，与风格不符 |

---

## 9. 成功标准

上线后 2 周内，通过玩家反馈（评论/留言）和以下指标判断：

| 指标 | 目标 |
|------|------|
| 无音频 Bug 报告 | 0 个"没有声音"或"声音错乱"的反馈 | 
| 设置持久化成功率 | 刷新后音量设置保持不变（手动验证 + 玩家反馈） |
| 玩家正向音频反馈 | 至少 3 条主动提及"音效不错"的评价 |
| 音频不干扰游玩 | 无玩家投诉"声音太烦"或要求默认静音 |
| 资源加载不影响首屏 | 游戏主界面 TTI 增加 < 500ms（SFX 可懒加载，BGM 流式加载） |

---

## 10. 开放问题

| # | 问题 | 需要决策的点 |
|---|------|-------------|
| Q1 | 首次进入游戏时是否默认播放 BGM？ | 部分玩家在安静环境中不希望自动播放；建议默认开启但音量 60%，可在设置中关闭 |
| Q2 | BGM 是否做无缝循环？ | 需要音频编辑工具（Audacity/Adobe Audition）对选定素材做循环点对齐；如素材本身已是循环素材则跳过此步 |
| Q3 | iOS Safari 自动播放限制如何处理？ | iOS 要求必须在 touch 事件中启动 AudioContext；需确认"首次交互"的定义是 touch start 还是 touch end |
| Q4 | Joker 触发音效是否叠加出牌音效，还是互斥？ | 计分动画期间 SFX 会密集触发，需确认是否允许同一时间多个 AudioBuffer 同时播放（Web Audio API 天然支持多实例，建议允许叠加） |
| Q5 | `public/audio/` 目录结构如何组织？ | 建议 `public/audio/sfx/` 放 SFX、`public/audio/bgm/` 放 BGM；Vite 构建时原样复制到 dist |
| Q6 | Kenny 包中是否有所有需要的音效？ | 下载后需逐一试听对照，部分音效可能需要从 freesound.org 补充或用 Audacity 剪辑调整 |
