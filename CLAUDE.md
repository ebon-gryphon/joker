# CLAUDE.md — 小丑牌

Balatro 风格网页卡牌游戏，Vue 3 + Vite + GSAP + Bun。

## 常用命令

```bash
~/.bun/bin/bun run dev      # 开发服务器，默认 http://localhost:5173
~/.bun/bin/bun run build    # 生产构建，产物在 dist/
~/.bun/bin/bun install      # 安装依赖
```

> 系统无全局 npm，统一用 `~/.bun/bin/bun`。

## 目录约定

```
src/
  App.vue                  # 根组件：布局 + 出牌动画时序（7 步）+ 设置状态
  main.js                  # Vue 挂载入口
  style.css                # 全局 CSS 变量（颜色 token）+ .px-btn 基础样式
  components/
    SideBar.vue            # 左侧栏（28vw）：盲注 / 进度 / chips×mult / 手数 / 金币
    JokerArea.vue          # 顶部 Joker 槽（5 个 140×200px 卡片）
    PlayArea.vue           # 出牌区（position: relative）+ 牌堆（absolute 右下角）
    HandArea.vue           # 手牌区 + 操作按钮行
    CardView.vue           # 单张牌渲染（100×145px）
    ShopScreen.vue         # 商店界面（3 张随机 Joker）
    EndScreen.vue          # 通关 / 失败结算页
    SettingsModal.vue      # 设置弹窗（localStorage key: balatro.settings）
  composables/
    useGameState.js        # 状态机（playing→shop→won/lost）+ 52 张牌组 + 商店逻辑
    useHandDetector.js     # 9 种牌型识别 + calcScore（含 Joker 效果）
    useAnimations.js       # GSAP 工具函数（飞牌 / 高亮 / 飞字 / 中央爆字）
    useAI.js               # AI 出牌：枚举 C(8,1)–C(8,5)=218 种组合取最优
```

## 架构关键点

- **布局**：`App.vue` 左右分栏；右侧 `main-area` = `grid-template-rows: 230px 1fr 280px`
- **计分公式**：`score = (baseChips + Σcard值) × baseMult`，再按顺序乘 Joker 效果
- **动画时序**（App.vue `handlePlay()`）：飞牌 → 逐张高亮 + chips 飞字 → Joker 触发金光 + mult 飞字 → 中央公式爆出 → blindScore 数字累加
- **状态隔离**：`isScoring` 为 `true` 时所有按钮禁用；`finishScoring()` 重置为 `false`
- **牌值**：A=11，J/Q/K=10，其余按面值

## 关卡配置（BLINDS）

| 关卡 | 目标分 |
|------|--------|
| 小盲注 | 300 |
| 中盲注 | 500 |
| 大盲注 | 800 |

过关奖励：`$5 + 剩余手数 × $1`
