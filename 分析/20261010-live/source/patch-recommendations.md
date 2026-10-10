# 品牌化运行时补丁边界

基于 `reference/_astro/hoisted.CUO_IjfL.js` 原始发布包。只修改从它生成的品牌版，不覆盖 reference。

## Newsletter：切断原机构提交

原 `NewletterForm` 的 submit handler 会验证 EMAIL，然后把用户输入发送给 `MAILCHIMP_URL` 的 `/post-json?` JSONP 服务。两个实例位于 Header 与 Footer。品牌版不应仅删除 `<form action>`，因为 JS 仍会主动提交。

可复查的稳定替换边界：从 `class NewletterForm{` 到 `class FooterSection{` 之前。保留类名与 constructor `(form,button,message)` 合约，重写 `_onFormSubmit` 为确实存在的本地行为；例如本地收藏/订阅偏好，或者改输入为实验关键词过滤。文案明确实际行为，不能声称完成远程订阅。若改为 GitHub CTA，则保留外围 DOM 和尺寸槽位，取消表单监听。

还需删除 `MAILCHIMP_URL` 中的原服务地址字符串，以及 HTML 的 newsletter 原机构文案。当前 bundle 中 `jsonp$1`、`validateEmail`、`toQueryString` 等即使变成不可达代码，也不表示有联网；最终审计仍应检查是否残留 `list-manage.com`、`post-json`、Google tag 或原邮箱。

原 handler 的显式文字是 `The email is not valid!`、`Something went wrong, try again`、`Almost there! Check your email box!`。第三句具有真实发送含义，不能保留用于纯本地动作。

## VideoOverlay：保留界面和动效，替换外部播放器

Vimeo bundled library 从 `/*! @vimeo/player v2.30.4` 开始，至 `const VIDEO_LIST=` 之前结束，计 27,369 字符；其底部会调用自动 embed / metadata / DRM 初始化。独立移除该区块并注入本地 `Player` 兼容类可以彻底取消 Vimeo 服务依赖。静态检查显示区块后的独立 `Player` 仅在 VideoOverlay 构造处使用，`commonjsGlobal`、`screenfull`、`createCommonjsModule` 等 Vimeo 区块内 helpers 未再独立引用。注意同名带 `$1` 的 helpers 是另一作用域，不能误删。

`new Player("video-overlay__vimeo-video", options)` 的当前 options 有 `id: VIDEO_LIST.MAIN_VIDEO_REEL`，原值为数字 `761102167`。本地可以把它映射为明确的自有视频地址。兼容对象必须提供：

| API | 原调用方的依赖 |
| --- | --- |
| `element` | 有 `.style.pointerEvents` 的真实元素；可为 `<video>` |
| `loadVideo(id)` | Promise，在 metadata 已可读后 resolve；多次切换安全 |
| `setCurrentTime(seconds)` | Promise，可在 metadata 前调用；应 clamp 到 duration |
| `getVideoWidth()` / `getVideoHeight()` | Promise，返回实际媒体尺寸 |
| `getDuration()` | Promise，返回有限正数 |
| `on('ended', cb)` | ended 会关闭 overlay；需保留对象调用上下文或安全回调 |
| `on('timeupdate', cb)` | callback 参数含 `{percent, seconds, duration}` |
| `play()` / `pause()` | Promise 风格；处理 autoplay reject，避免 unhandled rejection |
| `setVolume(0或1)` | Promise；对应 Mute/Unmute |

VideoOverlay 中 first `on('ended', function(){this.close()})` 使用非箭头函数，兼容事件分发应绑定到 overlay 或忽略此重复回调，后面已有安全的 `()=>this.close()`。原播放器的播放按钮文字逻辑似乎反向：`isVideoPlaying ? "Play" : "Pause"`，基线保留；品牌版若修正，需作为明确功能修复记录。

保留 VideoOverlay 的 `open / close / resize / update`，可继续使用原遮罩、全屏比例、光标、进度条、暂停/音量控件和页面背景音渐变。增加 Escape 退出是合理本地可用性补充，但需独立记录。

RouteManager `_onRegularLinkClick` 原来仅识别 `https://player.vimeo.com/video/`。品牌链接可使用 `data-local-video`，在此处转调 `videoOverlay.initAndPlayVideo(path,true)`；保留 `data-link-type="regular"`，避免被内部 SPA 路由拦截。不要让本地播放器收到旧 Vimeo ID 后静默播放不相干的商业视频。

HomeReelSection 的 canvas 贴图视频与全屏播放器是两个独立承载层：前者 `<video muted loop playsinline>` + `VideoTexture`；初始化及 resize 两处都按 viewport `<=560` 选择 `reel/mobile.mp4`/`reel/desktop.mp4`。替换为既有自有网页录屏最省改动；使用静态图需要改为 Texture 并处理原 `.play/.pause` 调用，必须保留 32×32 UfxMesh 网格、ScreenPaint 材质和缩放动画。不得新录制尚未确认的本案例作为正式录屏。

## 容易漏掉的品牌/作品槽位

1. **所有 HTML 路由**：22 页包含相同 header/footer、meta/social、菜单、newsletter；项目页面会经 RouteManager XHR 重新拉取 HTML，再把 `.page` 插入当前界面。只改初始首页不够。完整文本、链接与媒体槽已保存 `content-slots.json`。
2. **项目图像路径**：ProjectItem 从元素 `data-id` 组合 `/assets/projects/<id>/home.webp` 和 `home_depth.webp`；标题来源原 DOM。ProjectDetailsData 从 DOM 读取 title/desc/CTA/services/links，媒体使用 `data-filename`、`data-type`、width/height/parallax/fullscreen；next 项目从 `data-next-id`、nextTitle 等取得。项目原始 ID 可作为内部兼容 key，但用户可见 URL、标题、媒体和外链需统筹适配。
3. **移动项目媒体**：运行时按 `browser.isMobile` 把 `/image` 改 `/mobile_image`、`/video` 改 `/mobile_video`，再加 `.webp/.mp4`。这是 UA 判断，不是项目的 1000px 竖向布局断点。品牌图像地址可避开 `/image`、`/video` 子串，或提供两套相应输出；当前镜像已按源码分支补采。
4. **About team JSON**：仅一个 `/assets/team/team.json`；原含 7 个 `id,name,role` 条目，role 允许 `<br>`。默认 faceId 写死 `edan`，preInit 立即读取该 `.buf`，onPageShow 读取其余点云。若换 ID，必须同步默认值；最稳保留内部 7 key，改 name/role 为真实实验项目并逐个替换点云。
5. **团队旋转罗盘**：`_createUIElements` 使用 `teamDataList.length-4` 构建刻度，改成只有 1 个条目会导致负循环与宽度异常。保留 7 个自有实验槽可以保留原结构，无需虚构团队成员。
6. **About 三维字标**：`about/logo_text.buf` 是真实几何，包含 position 与 char ID；`AboutWhoLogo` hardcode `u_aspect=1/.200957`，原标字形比例約 4.976。它会从 `#about-who-title-main-logo` morph 到 `#about-who-title-left-2` 的 DOM 锚点。仅换 SVG 会让 canvas 仍绘制 Lusion，需要新字形几何与同 char/坐标契约，或同步改 aspect。
7. **About font.png**：字母图集是单字母 A–Z 的视觉，不等于品牌名字；用于背景飘字和 team 首字母槽。首字母编号按 index/ASCII 推导，需检查替换后名字的首字符。
8. **宇航员纹理**：`face.png` 是 5×23 格 LED 面部图集；wearpack/helmet/glove_shoes base、arm、normal 属于模型贴图。服装原标识可能烘焙在纹理内，应实际放大检查，不能靠网页文字搜索证明已替换。只改这些图像可保留 53 骨和全部路径动画。
9. **白隧道贴纸**：`tunnels/stickers.png` / `stickers_low.png` 是图集，包含原机构视觉，需一并检查替换；保留尺寸、格子与 alpha 合约。
10. **隧道设备画面**：`tunnels/tablet.png` / `desktop.png` 是背景图框纹理；可换成既有真实自有 UI 截图，保留 alpha、宽高与透视承载层。Earth/white_block/greeble 是机制材质而非作品缩略图。
11. **原客户/奖项**：About HTML `assets/images/logo/@logo--*.svg` 为原真实客户或奖项标识；改为实验类别或自有图标，不能保留并声称用户获奖或交付。相关数字、标签、年份和正文同步改。
12. **自定义字体与资源名**：`LusionMono` 是原字体的内部 font-family，CSS 与 FontItem 等待检测依赖该名称；内部兼容名称可保留并在来源记录解释。改名必须同时更新 CSS font-face 和 FontItem，否则预载永久等待。
13. **manifest/meta/favicon**：site.webmanifest 的 name/short_name、两个 Android 图标，以及 light/dark favicon、apple icon、mask-icon、og/twitter 描述均为品牌槽；不能只改 `<title>`。
14. **Console credit**：App.init 原 `%c Created by Lusion: https://lusion.co/` 是 console 来源注记；不属于前台作品文案。品牌版可以改成明确 `Daily Design .Art adaptation / original runtime: Lusion`，同时保留源代码 license。

## 除商业文案以外的 hard-coded 前台文本

源码不包含各项目标题、作者名字与角色（均来自 HTML 或 JSON）。可见固定控制文字主要为 Play/Pause、Mute/Unmute、表单验证/成功消息，以及原“loading”和切换 UI。这些可保留正确英文功能含义。`VIDEO_LIST.MAIN_VIDEO_REEL=761102167`、`WhoSubsectionTeam.faceId="edan"`、`MAILCHIMP_URL` 是必须处理的内容常量。

完成补丁后应重新审计所有生成 HTML、CSS、JS、JSON 与字标/模型/纹理。原始 reference 保留原内容是有意的机制对照，不能与品牌入口混用。
