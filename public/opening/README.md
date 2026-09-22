# 开场素材

从已确认的独立封面预览中原样提取，未重新生成或修改图像。

- `source.jpg`：原始牌桌与小丑。
- `closed.jpg`：眨眼参考帧。
- `grin.jpg`：嘴部邪笑过渡纹理。
- `plate.jpg`：飞近镜头的独立全脸小丑牌。

`src/composables/useOpening.js` 保留原预览的画布坐标和开场时序；`OpeningScreen.vue` 负责装载、跳过和进入正式对局。所有资源通过 Vite 的部署前缀读取。
