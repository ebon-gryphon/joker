# 小丑牌

Balatro 风格的网页卡牌游戏，用 Vue 3 + Vite + GSAP 构建。玩家在 3 关盲注关卡中出牌组成牌型，触发 Joker 加成，得分超过目标后进入商店购买 Joker，最终通关。

## 特性

- 完整 52 张牌组，每手摸 8 张，每次出 1–5 张
- 9 种牌型识别（同花顺 / 四条 / 葫芦 / 同花 / 顺子 / 三条 / 两对 / 对子 / 高牌）
- 6 种 Joker，最多持有 5 张，效果按顺序叠加
- 全套 GSAP 动效：飞牌 → 逐张高亮 → 分值飞字 → 公式爆出
- AI 出牌：枚举 218 种组合取最优
- 设置面板：动画速度、BGM/SFX 音量（localStorage 持久化）

## 安装

> 需要 [Bun](https://bun.sh) 运行时。

```bash
bun install
```

## 使用

**开发模式（热重载）：**

```bash
bun run dev
```

浏览器打开 [http://localhost:5173](http://localhost:5173)

**生产构建：**

```bash
bun run build      # 产物在 dist/
bun run preview    # 本地预览 dist/
```

## 技术栈

| 层次 | 技术 |
|------|------|
| 框架 | Vue 3 Composition API |
| 构建 | Vite 5 |
| 动效 | GSAP 3 |
| 运行时 | Bun |
| 字体 | Press Start 2P · VT323 · Inter |
