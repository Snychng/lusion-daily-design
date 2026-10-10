# Lusion → Daily Design .Art

按 2026-10-10 [Lusion 当前原站](https://lusion.co/)的公开发布版建立独立本地对照，并在内容适配层替换为 **Daily Design .Art**。保留原 Astro 页面、Three.js r158 运行时、自有滚动引擎、Shader、镜头轨迹与场景顺序。此仓库包含独立案例的代码与运行素材，没有迁入正式项目或部署网站。来源及第三方材料说明见 [NOTICE.md](NOTICE.md)。

本轮已完成 48 项品牌场景检查、13 项播放器检查及全部 22 条路由巡检，静态检查 2772 项通过。原版及当前公网站点观察、截图、性能和差异详见 [交付验收](分析/20261010-live/交付验收.md)。**任务结束时服务已停止，4207 已释放**；下面地址在重新启动后才可访问。正式录屏仍待用户确认效果。

当前首页先展示可点击变色的 3D 构件，再经过标题、媒体、作品与宇航员叙事。[推荐介绍](https://www.commarts.com/project/36283/lusion)中的穿越传送门、撞破玻璃、按住减速与反向滚动仍有对应运行时；About 的 GPU 粒子与结束区 FLIP 流体是两套不同机制。

## 运行

Node.js 22 或更新版本。已生成资源的构建与本地服务只使用 Node 内置模块，无需安装 npm 包：

```sh
git clone https://github.com/Snychng/lusion-daily-design.git
cd lusion-daily-design
npm run build
npm run check
npm run dev
```

品牌版入口：<http://127.0.0.1:4207/>；About：<http://127.0.0.1:4207/about>；作品：<http://127.0.0.1:4207/projects>。

仓库保留运行所需的原版资源、品牌素材和最终验收记录；`dist/`、缓存和早期调试产物不提交。普通构建使用已保存素材，不需要访问相邻项目。完整素材重新生成及浏览器验证的额外本地依赖见后文。

原版与品牌版串行共用 **4207**。先停止品牌服务，再运行 `npm run reference`，同一地址显示原版对照。服务器只绑定本机，日志明确列出模式、目录和 PID；地址不是持续在线承诺。启动/停止只处理本案例进程，不启动 Aten7 或 Messenger。

## 文件

- `reference/`：公开发布文件原始字节；URL、版本与 SHA-256 在 `分析/20261010-live/asset-manifest.json`。
- `dist/`：可重建品牌版。不要在此手工编辑。
- `brand-content/`：22 页内容、19 个作品槽位映射、自有媒体映射、品牌样式与审计。
- `brand-assets/`、`src/models/`：真实 D 几何、实验点云、品牌字标、图集、自有作品图片与既有录屏。
- `scripts/`：公开资源下载、模型/媒体生成、内容转换、构建、静态检查、本地验证及服务。
- `分析/20261010-live/`：原站实测、完整源码拆解、资源及内容来源、检查结果与截图。

`build.mjs` 先复制未修改的参考文件，再覆盖内容与品牌资源。保留 Shader/动画引擎的原始副本；品牌专用补丁以原字符串契约校验，缺失时构建报错。原版服务在响应时剔除分析脚本，磁盘 HTML 不变。原版 Vimeo 完整播放依赖第三方服务，不等同于本地私有后端。

## 品牌与内容

使用现有 `Daily Design .Art`、`Explore the art of UI, one day at a time.` 与 <https://github.com/Snychng/daily-design>。首页、About、项目列表及 19 项详情保留原槽位，以个人 UI、UX、动效、交互、光学材质实验或明确的概念研究填充。原客户、奖项、团队履历与商业联系不作为自己的履历。

首屏使用自建花体 D，保留原构件位置、旋转、物理交互与材质渲染链。About 字标采用原 WebGL 字标契约，团队人物点云替换为 7 个自建 UI 实验形体。匿名宇航员的 53 骨动画、头盔、服装与碎玻璃 946 片动画保留，用于原叙事机制对照；相关材质图已检查，未见 Lusion 字标。

自有媒体来自工作区已有作品截图、既有概念封面与先前录屏。本次没有生图或正式录屏，旧素材不作为本次网页验收证据。17 条源图路径对应 13 种内容指纹，其中 8 种为网页截图或录屏帧、5 种为历史概念封面系列，填充 19 个主题，不能据此声称有 19 个独立可运行作品。历史封面的生成渠道与记录保留在 [媒体审计](brand-assets/media/media-audit.json)，不改称本次原生生成。

47 个项目视频槽位及 2 个 reel 使用 4 份既有实录：Gallery、Orbit、建筑切片与黑胶唱片。没有对应录像的研究主题使用详情中注明的既有 motion reference；原视频与替换视频的画幅、时长和内容可不同。379 个图片/深度目标按原槽位尺寸输出；19 张深度图由新图的相对亮度生成，保留纹理采样契约，并非恢复原三维深度。完整来源、指纹和复用关系见 [media-map.json](brand-content/media-map.json) 与 [素材审计](brand-assets/media/media-audit.json)。未选用仍含旧 AI 卡文案的 Dispersion 截图或具有另行照片授权边界的 Star Ring 截图。

原 Vimeo 播放器替换为本地 HTML5 媒体适配器，保留原全屏容器、入退场、播放/暂停、进度及声音交互。订阅槽位改为 GitHub 导航，停止邮件收集和 Mailchimp 提交。

## 自有路由与资产别名

19 个详情页使用自有英文 slug；首页、索引、详情与下一作品的 `href`、`data-id`、`data-next-id`、canonical、`og:url` 和 sitemap 同步生成。完整原名到自有名称映射在 [routes.json](brand-content/routes.json)：

| 作品 | `/projects/` 后的 slug |
| --- | --- |
| Gallery | `gallery` |
| Orbit | `orbit` |
| Interactive Narrative | `interactive-narrative` |
| Spatial Layers | `spatial-layers` |
| Ocean Interface | `ocean-interface` |
| Light Studies | `light-studies` |
| Optic Type | `optic-type` |
| Gesture Studies | `gesture-studies` |
| Focus Field | `focus-field` |
| Glass Slingshot | `glass-slingshot` |
| Material Lab | `material-lab` |
| Spatial Notes | `spatial-notes` |
| Motion Loop | `motion-loop` |
| Interface Studies | `interface-studies` |
| Paper Narrative | `paper-narrative` |
| Liquid Feedback | `liquid-feedback` |
| Afterimage | `afterimage` |
| Sound Forms | `sound-forms` |
| Color Studies | `color-studies` |

原路由引擎接受非斜线 slug，并从路径与 DOM 建立详情缓存，无需改写。`ProjectItem` 仍按 `data-id` 拼接 `/assets/projects/<id>/home.webp` 和 `home_depth.webp`，所以构建先用自有媒体覆盖原资产路径，再按 `routes.json.assetAliases` 复制 **19 × 2 = 38** 个缩略图/深度别名。别名的键是新资源路径，值是已被品牌媒体覆盖的旧资源路径。207 个详情 `data-filename` 和 `media-map.json` 原键保留，以兼容移动视频、媒体序列与原 Shader；旧名字仅作为资源契约标识。

`build.mjs` 会移除复制进来的 19 个原详情 HTML，再写入自有详情，最终仍是 22 页。`reference/` 的原路由与文件原样保留，仅供独立原版模式。`npm run check` 检查新旧页面、路由引用及 38 个别名与其来源的字节一致性。

## 重建素材与验证

正常 `npm run build` / `npm run check` / 本地服务只读取已保存产物，使用 Node.js 22+ 内置模块，不会自动执行素材生成，也不需要 `npm install`。以下命令用于修改源内容后重新生成全部品牌产物；在案例目录执行：

```sh
node scripts/build-brand-media.mjs
python3 scripts/brand-content.py
node scripts/build-brand-models.mjs
node scripts/verify-brand-models.mjs
node scripts/build-brand-stickers.mjs
npm run build
npm run check
python3 scripts/download.py --audit
```

媒体脚本先复制品牌字体、处理既有图片和录屏。内容脚本随后自动运行 `scripts/build-brand-lettering.mjs`，将字体轮廓转为真实 SVG path，再生成 22 页、路由和内容审计；无需另跑 lettering。About 奖项标题仅由一个复合 path 承载，`#about-who-title-main-logo` 则保留原空 SVG 定位槽，字标由 WebGL 模型绘制，避免重复渲染。

模型部分必须按 **models → verify → stickers** 执行：模型生成器重写 `brand-assets/models/runtime-map.json`，最后的贴纸脚本把两条隧道图集映射追加回该文件。只重跑模型而不重跑贴纸，会丢失贴纸映射。几何来源、属性与光学近似见 [模型说明](src/models/README.md)。生成脚本不启动网页、不录屏，也不修改 `reference/`；`build` 会重建 `dist/`。

完整素材重建需要以下现有依赖与源文件：

| 依赖 | 当前解析位置或用途 |
| --- | --- |
| Python 3 | 内容与下载脚本仅用标准库 |
| `three`、`sharp` | 模型/贴纸脚本优先本案例，再查 `../Daily-Design-ActiveTheory/node_modules`；模型校验使用同处 `sharp` |
| OpenType parser | 使用现有 Three.js 的 `examples/jsm/libs/opentype.module.js`，不需独立安装 `opentype.js`；lettering 依次查本案例、`../建筑切片`、`../../../daily-design` 的 Three.js |
| 媒体处理 `sharp` | 依次查 `SHARP_MODULE`、本地 `sharp`、`../Daily-Design-ActiveTheory/node_modules/sharp`；只有该媒体脚本支持 `SHARP_MODULE` |
| FFmpeg / ffprobe | 两个命令须在 PATH；读取视频元数据并完整解码检查 4 份既有录屏，不生成新录屏 |
| 字体与素材 | 媒体脚本读取相邻正式项目及工作区既有素材，绝对来源见媒体审计；lettering 另读取本机 `/System/Library/Fonts/Supplemental/Times New Roman.ttf`、复制后的 Bodoni Moda 和 `reference/assets/fonts/Aeonik-Regular.woff`，不分发系统字体文件 |

这些生成依赖复用本工作区已有安装，不依赖相邻案例的运行服务。迁移到另一台机器时，普通构建可继续使用保存的产物；若要完整重新生成，必须提供上表依赖、字体与审计中记录的源素材，不能将缺失源静默替换。

公开原版资源重取使用 `python3 scripts/download.py`，需要网络，只下载公开引用资源；完整 Vimeo 流没有抓取。`python3 scripts/download.py --audit` 离线核对原文件指纹，不访问网络。

浏览器检查命令、隔离 Chrome 依赖、模式顺序及证据含义见 [scripts/VERIFY.md](scripts/VERIFY.md)。运行品牌服务后可串行执行 `node scripts/verify-browser.mjs --mode brand`、`node scripts/verify-media.mjs` 和 `node scripts/verify-media.mjs --routes`；这些脚本不负责启动/停止服务。静态与几何检查通过不代表最终浏览器视觉、交互或性能验收完成。

用户确认网页效果后，才录制本次网页的实际运行与主要交互。当前截图与自动化动作检查不替代用户视觉验收、正式录屏或真机性能测试。
