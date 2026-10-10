# 本地浏览器验证

`verify-browser.mjs` 仅访问本案例 `http://127.0.0.1:4207`。它以已安装的 Google Chrome 新建隔离 headless 进程、临时用户目录和测试 context，不连接 9222、不读取或操作用户现有 Chrome。脚本不会启动或停止服务器；完成或超时会关闭自己创建的浏览器。

从案例目录执行，先在另一终端启动对应模式（同一端口不能同时启动两种模式）：

```sh
node scripts/serve.mjs --mode=reference
node scripts/verify-browser.mjs --mode reference --quick
node scripts/verify-browser.mjs --mode reference
```

原版检查后停止该服务器，再启动已构建的品牌版本：

```sh
node scripts/serve.mjs --mode=brand
node scripts/verify-browser.mjs --mode brand --quick
node scripts/verify-browser.mjs --mode brand
```

脚本核对响应头 `X-Study-Mode`，避免把另一模式记成当前证据。依赖复用相邻 `Hashgraph-Daily-Design/node_modules/playwright/index.mjs`；Chrome 路径为 `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`。无需新增包。

`--quick` 检查桌面首页和 About 加载、截图与 RAF。完整模式还覆盖菜单重复开关、首页各段、黑白隧道与破窗正反滚动、按住/松开、About 横向介绍和 team 指针响应、页尾 FLIP 鼠标移动和按压、Projects 两个详情及站内/历史返回、390×844 手机与 768×1024 平板的触摸 UA、菜单和正反滑动。桌面长段滚动发送真实 wheel；原站隧道会自动推进，因此在目标附近使用原站支持的 ArrowUp/ArrowDown，每次约 100 px，停止自动推进并校准。允许 60 px 偏差，报告保留目标、实际位置、误差及所有输入，不声称纯滚轮或精确相同随机帧。触摸滑动只向本脚本新建页面发送浏览器输入，不修改 runtime 或内部场景对象。

默认保存在 `分析/20261010-live/`，每次运行以 `{mode}-{UTC时间}-{quick或full}-` 命名，包含逐状态 PNG、完整报告 JSON、网络/控制台错误 JSON 和 RAF 性能 JSON，不覆盖原站截图。可用 `--out 分析/另一个目录` 改变目录。默认 quick 预算 180 秒、完整预算 480 秒；可用 `--budget-ms 480000` 调整。默认不强制 GPU 后端；需要对照 Metal 时可显式追加 `--angle metal`，报告会记录启动参数和 Chrome GPU 信息。

390×844 手机分支还保存黑隧道、白隧道、破窗、首页尾段、About team 与 About 页尾 FLIP 的前后状态。长场景使用手机 UA/触摸 context 下的 wheel/方向键定位，报告明确标注这一输入方式；原有正反触摸滑动测试保留。About team 按手机分支的 `9.2 × viewportHeight` 定位，不使用桌面宽度跨度。FLIP 使用水平真实触摸输入，记录输入前后滚动位置。首页 runtime 的 `hasEndVisual=false`，所以首页尾段不标成流体，流体证据来自 About。768×1024 仍只做基本适配与触摸检查。包含手机长场景的最终完整轮可使用 `--budget-ms 600000`，不改变页面动画或物理参数。

退出码 0 表示本轮已执行步骤没有失败、页面异常、本地网络失败或意外外部请求，仍需实际打开截图核对材质、布局和内容。原版 Vimeo 请求作为已知边界单列，品牌版预期没有外部请求。按住测试只保存输入与时序截图，不能由 RAF 推算动画减速比例。RAF 是当前 headless 会话的回调节奏，不等同于 GPU 渲染时长、真机性能或逐像素一致。横向溢出写入报告供复核，不自动判断是故障，因为 About 含有意设计的横向场景。

所有非本地 HTTP(S) 请求被阻止并单独列出；Vimeo 播放、外站项目、表单发送和联系动作不在本地视觉验证范围。测试不录制正式视频，也不访问用户已有浏览器标签。

只检查脚本语法（不会启动 Chrome 或服务）：

```sh
node --check scripts/verify-browser.mjs
```

补充当前公网站点观察可执行 `node scripts/verify-live-public.mjs`。它另开隔离 Chrome，顶层页面仅允许 `https://lusion.co/about` 与 `https://lusion.co/`，资源仅允许 Lusion 自有域；不连接现有浏览器。遇登录或权限挑战立即记录并退出，不尝试绕过。该脚本会访问公网，默认总预算 120 秒，保存原始 HTML 指纹和五个状态截图，并自动关闭。Vimeo/统计资源被阻止，所以 `observationComplete` 与 `cleanRuntime` 分开报告；不能把观察完成说成外部播放器成功。

本次最终结果与所选有效报告见 [交付验收](../分析/20261010-live/交付验收.md)。早期失败报告保留用于追溯，不能与最终通过轮次混读。所有服务在交付时已停止。

## 本地视频与路由专项

品牌服务运行期间，串行执行：

```sh
node scripts/verify-media.mjs
node scripts/verify-media.mjs --routes
```

默认视频专项只针对品牌本地视频，验证实际 Reel 按钮打开、播放时间推进、暂停/继续、静音/取消静音、进度条跳转、Escape 退出、背景点击退出、重复开关、两次 500 ms 内快速关闭后的停止状态，以及 390×844 触摸模拟下的打开和关闭按钮。快速关闭阶段不截取打开状态，避免截图开销越过原本的延迟播放窗口；报告记录实际点击到 Escape 耗时，超过 500 ms 时标记为测试时序不合格，不能据此认定播放器回归。定位 Reel 使用真实滚轮和方向键，打开及控制只使用实际 locator 点击/触摸和键盘，不调用应用内部对象或直接写入 video 属性。

`--routes` 从当前模式页面目录发现并检查 22 条路由（包括 19 条详情），逐页等待加载器离场、截图并记录页面异常及本地 404/请求错误。可额外指定 `--mode reference` 检查原版路由，此时 Vimeo 依旧阻止并列为已知外部边界；原版不执行视频专项。

此脚本同样仅创建自己的隔离 Chrome、阻止全部外部请求、不操作已有浏览器与服务器。证据使用 `{mode}-{UTC时间}-media-*` 或 `routes-*` 前缀。支持 `--out`、`--angle metal` 和 `--budget-ms`；视频默认预算 180 秒，路由默认 300 秒。只检查语法可执行 `node --check scripts/verify-media.mjs`。

## 公开原站直接观察

```sh
node scripts/verify-live-public.mjs
```

此专项不依赖本地服务，新建临时配置的隔离 headless Chrome，只打开 `https://lusion.co/about` 的 1440×900 桌面状态和 `https://lusion.co/` 的 390×844 手机模拟状态。About 首屏加载完成后以真实滚轮观察点云/介绍阶段；手机首页加载完成后做两次真实触摸滑动。只允许 HTTPS 的 `lusion.co`、`lusion.dev` 及其子域资源和 data/blob，Vimeo、统计服务及其他域被阻止并记录。无需也不允许连接现有 Chrome、9222、读取用户当前标签或浏览器配置。

脚本发现主页面认证、权限、限流、登录或挑战时立即记录阻碍并关闭自己的浏览器，不点击挑战、不提供凭据、不重试绕行。默认与最高预算均为 120 秒，支持 `--out` 和不超过 120000 的 `--budget-ms`。保存 `public-{UTC时间}-*` 截图、原始导航 HTML 与指纹、URL/viewport/默认缩放/metadata/发布文件地址、输入轨迹、console 和网络证据；受限资源或加载缺口如实留在报告中。`observationComplete` 与 `cleanRuntime` 分别表示所要求的观察是否完成、当前受限资源环境是否未出现运行错误，不把原站被阻止的外部媒体称为验证通过。

只检查语法：`node --check scripts/verify-live-public.mjs`。
