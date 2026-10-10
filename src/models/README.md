# 品牌几何与贴图契约

在案例根目录执行：

```sh
node scripts/build-brand-models.mjs
node scripts/verify-brand-models.mjs
node scripts/build-brand-stickers.mjs
```

生成器优先使用本案例安装的 `three`、`sharp`；当前也支持工作区已有 `../Daily-Design-ActiveTheory/node_modules`。轮廓源已复制到本案例，可重复生成。没有使用生图服务。

- `models/home/cross.buf`、`cross_ld.buf`：沿用原资产位置，由 Daily Design Bodoni Moda 斜体 D 轮廓挤出、倒角、焊接和封闭修复形成真实三维单孔实体。局部三轴范围均为 `[-1,1]`；外部位置、缩放、四元数、物理运动和原材质由运行时保留。高模 1404 顶点 / 2808 三角面，低模 408 顶点 / 816 三角面。
- `normal`、`SN`、`uv`、`ao`、`thickness`、`daoN`、`daoP` 保持原 Shader 属性契约。AO 为每顶点 20 条确定性半球射线；厚度从法线向内求交；方向遮蔽使用六个轴向射线。它们是当前 D 的烘焙近似，不能称为原站离线烘焙完全等价。
- `daily-neighbour-shadow.glsl` 替换原来写死三轴十字的解析邻居函数。保留 AO / 柔影 / 反射距离三分量协议，使用七笔画 D 代理；仍是解析近似，字形细节与真实网格并非逐面一致。原 matcap、IOR、模糊折射、薄厚色散着色链路不由本脚本重写。实际 GPU 性能由主任务浏览器测试。
- `models/about/logo_text.buf`：原站此资源的 `position.z` 是边缘覆盖值，顶点着色器把几何 z 强制为 0；因此保留原 WebGL 矢量字标机制，替换为完整 `Daily Design .Art`。字形等比适配原 `1 × 0.200956762` 槽位，主动文字差异使实际字高低于原 LUSION。`char` 归一化至原 `0..5` 范围保留缩入侧栏的偏移幅度。
- `team/{daily,interface,motion,refraction,particle,spatial,prototype}.buf`：每个 8192 点，`position Float32×3` 与 `nShade Uint8×4`。取自自建网格表面，替换真实团队人像；角色统一为概念研究，不虚构人员。原 GPU 光标照明、散开、景深、扫描线、glitch、轮播和滑动由运行时保留。
- `textures/flip_texture.png`：自行编写 D、U、I、界面、指针等 SVG 遮罩，栅格成 8 个横向单元格 × RGB 三个独立轮廓，沿用原 23 图形槽位和 FLIP 模拟。
- `textures/tunnels/stickers.png`、`stickers_low.png`：完整重作 26 枚 Daily Design / UI / UX / 动效 / 光学 / 几何贴纸，包含原右下 L 台球槽位的新 D 徽章。高档 `1465×1024`、低档 `733×512`，均 RGBA；图集位置来自原 `goalWhiteTunnelStickerData`，UV 矩形、26实例、旋转、轨迹、缩放、混合、淡出与交互均保留。自有 SVG 源与逐槽位/透明通道检查见 `src/textures/tunnel-stickers.svg`、`tunnel-stickers-manifest.json`。字体转成真实 OpenType path，无图片生成、系统字体替代或原图像素复用。重建时按上面顺序最后执行贴纸脚本，以把两条纹理映射加入模型生成器的映射文件。
- 宇航员的衣物与头盔 base 贴图、像素表情贴图已实际打开检查，没有观察到 Lusion 字标。保留公开原织物、法线、粗糙度和像素表情资源，以及 53 骨骼动画。此项是保留原场景模型机制，不宣称该宇航员由本项目新建。

`brand-assets/models/runtime-map.json` 列出构建映射，`runtime-patches.json` 仅包含默认粒子 id 与邻居光学函数两条明确替换。`model-manifest.json` 记录生成文件指纹与属性。

离线检查结果和几何诊断图位于 `分析/lusion-2026-10-10/models/`。它们验证数据、闭合性、法线和字形，不是网页截图，不能代替主任务的浏览器视觉与动态验收。
