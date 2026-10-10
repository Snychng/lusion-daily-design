import { chromium } from '../../Hashgraph-Daily-Design/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

// This file launches only its own isolated Chrome process. It never connects to
// the user's browser, reads a persistent profile, or accesses application objects.
const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
function option(name, fallback) {
  const item = args.find(x => x.startsWith(`${name}=`));
  if (item) return item.slice(name.length + 1);
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
}
if (args.includes('--help')) {
  console.log('node scripts/verify-media.mjs [--routes] [--mode brand|reference] [--out PATH] [--budget-ms 300000] [--angle metal]');
  process.exit(0);
}
const routesMode = args.includes('--routes');
const mode = option('--mode', 'brand');
if (!['brand', 'reference'].includes(mode)) throw new Error('--mode must be brand or reference');
if (!routesMode && mode !== 'brand') throw new Error('Local video overlay tests require --mode brand; reference Vimeo is outside this test');
const origin = 'http://127.0.0.1:4207';
const out = path.resolve(root, option('--out', '分析/20261010-live'));
const budgetMs = Number(option('--budget-ms', routesMode ? '300000' : '180000'));
if (!Number.isFinite(budgetMs) || budgetMs < 30000) throw new Error('--budget-ms must be at least 30000');
const angle = option('--angle', '');
if (angle && !['metal', 'default'].includes(angle)) throw new Error('--angle must be metal or default');
const runId = new Date().toISOString().replace(/[-:.]/g, '');
const prefix = `${mode}-${runId}-${routesMode ? 'routes' : 'media'}`;
const started = Date.now();
const elapsed = () => Date.now() - started;
const stamp = () => ({ at: new Date().toISOString(), elapsedMs: elapsed() });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const report = {
  mode, routesMode, runId, origin, startedAt: new Date(started).toISOString(),
  policy: 'New isolated headless Chrome and contexts. Only localhost:4207 is allowed. No application-object access, forced overlay opening, runtime edits, existing-browser connection, formal recording, external navigation or form submission.',
  inputPolicy: 'Video controls use real locator clicks/taps and Escape. Reel positioning uses wheel and supported arrow keys. Only DOM/video properties and browser diagnostics are read.',
  limitations: ['Screenshots require visual review.', 'Mobile uses Chrome touch/UA emulation, not a real phone or Safari.', 'A fast-close trial is valid only when the measured click-to-Escape interval is below 500 ms.'],
  steps: [], screenshots: [], videoSamples: [], routes: [], requests: [], pageErrors: [], console: [], blockedExternal: [], scrollInputs: [], cleanup: {},
};
let browser, activePage, currentStep = '', deadline, timedOut = false;
const reportFile = path.join(out, `${prefix}-report.json`);
function assert(value, message) { if (!value) throw new Error(message); }
function local(url) { try { return new URL(url).origin === origin; } catch { return false; } }
function checkBudget() { if (timedOut || elapsed() > budgetMs) throw new Error(`Verification exceeded ${budgetMs} ms budget`); }
async function save() { await fs.mkdir(out, { recursive: true }); await fs.writeFile(reportFile, JSON.stringify(report, null, 2)); }
async function step(name, action) {
  checkBudget(); currentStep = name;
  const item = { name, status: 'running', ...stamp() }; report.steps.push(item);
  console.log(`[${mode}/${routesMode ? 'routes' : 'media'}] ${name}`);
  try { item.result = await action(); item.status = 'passed'; }
  catch (error) {
    item.status = 'failed'; item.error = error.stack || String(error); console.error(`${name}: ${error.message}`);
    if (activePage && !activePage.isClosed()) { try { await capture(activePage, `${name}-failure`); } catch { /* Preserve original error. */ } }
  }
  item.durationMs = elapsed() - item.elapsedMs; await save(); return item.status === 'passed';
}
async function contextPage(label, mobile = false) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile,
    ...(mobile ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' } : {}),
  });
  await context.route('**/*', async route => {
    const request = route.request();
    if (local(request.url()) || /^(data|blob):/.test(request.url())) return route.continue();
    report.blockedExternal.push({ context: label, step: currentStep, url: request.url(), type: request.resourceType(), ...stamp() });
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage(); activePage = page;
  page.setDefaultTimeout(12000); page.setDefaultNavigationTimeout(45000);
  page.on('pageerror', e => report.pageErrors.push({ context: label, step: currentStep, message: e.message, stack: e.stack, ...stamp() }));
  page.on('crash', () => report.pageErrors.push({ context: label, step: currentStep, message: 'Page crashed', ...stamp() }));
  page.on('console', msg => { if (['warning', 'error'].includes(msg.type())) report.console.push({ context: label, step: currentStep, type: msg.type(), text: msg.text(), location: msg.location(), ...stamp() }); });
  page.on('response', response => report.requests.push({ context: label, step: currentStep, event: 'response', url: response.url(), status: response.status(), type: response.request().resourceType(), local: local(response.url()), ...stamp() }));
  page.on('requestfailed', request => report.requests.push({ context: label, step: currentStep, event: 'failed', url: request.url(), type: request.resourceType(), error: request.failure()?.errorText, local: local(request.url()), ...stamp() }));
  page.on('popup', async popup => { report.blockedExternal.push({ context: label, step: currentStep, event: 'popup-closed', url: popup.url(), ...stamp() }); await popup.close().catch(() => {}); });
  return { context, page };
}
async function ready(page, marker) {
  await page.waitForFunction(marker => {
    const loader = document.querySelector('#preloader'), canvas = document.querySelector('#canvas'), content = document.querySelector(marker);
    return content && getComputedStyle(content).display !== 'none' && document.documentElement.classList.contains('is-ready') && canvas?.width > 1 && canvas?.height > 1 && (!loader || getComputedStyle(loader).display === 'none');
  }, marker, { timeout: 60000 });
  await pause(550);
}
async function load(page, route = '/') {
  checkBudget(); assert(route.startsWith('/') && !route.startsWith('//'), 'Only local routes are permitted');
  const response = await page.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' });
  assert(response?.ok(), `${route} returned ${response?.status()}`);
  assert(response.headers()['x-study-mode'] === mode, `Expected server mode ${mode}; got ${response.headers()['x-study-mode']}`);
  const marker = route === '/' ? '#home' : route === '/about' ? '#about' : route === '/projects' ? '#projects' : '#project';
  await ready(page, marker); return marker;
}
async function domState(page) {
  return page.evaluate(() => {
    const element = document.querySelector('#video-overlay');
    const video = element?.querySelector('video');
    const bounds = e => { if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    return {
      url: location.href, title: document.title, viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, touchPoints: navigator.maxTouchPoints },
      overlay: element ? { display: getComputedStyle(element).display, opacity: Number(getComputedStyle(element).opacity), ...bounds(element) } : null,
      video: video ? { src: video.currentSrc || video.src, paused: video.paused, ended: video.ended, seeking: video.seeking, currentTime: video.currentTime, duration: Number.isFinite(video.duration) ? video.duration : null, readyState: video.readyState, muted: video.muted, volume: video.volume, videoWidth: video.videoWidth, videoHeight: video.videoHeight, error: video.error ? { code: video.error.code, message: video.error.message } : null } : null,
      controls: { play: document.querySelector('#video-overlay__play-btn')?.textContent.trim(), mute: document.querySelector('#video-overlay__mute-btn')?.textContent.trim(), progress: bounds(document.querySelector('#video-overlay__progress-container')), mobileClose: bounds(document.querySelector('#video-overlay__mobile-close-btn')) },
      loaderDisplay: document.querySelector('#preloader') ? getComputedStyle(document.querySelector('#preloader')).display : null,
      canvases: [...document.querySelectorAll('canvas')].map(c => ({ id: c.id, width: c.width, height: c.height })),
      headings: [...document.querySelectorAll('h1,h2')].map(e => e.textContent.trim()).slice(0, 10),
      text: document.body.innerText.slice(0, 2200),
    };
  });
}
async function sample(page, name) {
  const data = await domState(page); report.videoSamples.push({ name, ...stamp(), ...data }); return data;
}
async function capture(page, name) {
  checkBudget(); assert(local(page.url()), 'Refusing screenshot outside localhost project');
  const file = `${prefix}-${name.replace(/[^a-zA-Z0-9_-]/g, '-')}.png`;
  const png = await page.screenshot({ path: path.join(out, file), animations: 'allow', fullPage: false, timeout: 15000 });
  const state = await domState(page);
  report.screenshots.push({ name, file: path.relative(root, path.join(out, file)), sha256: createHash('sha256').update(png).digest('hex'), ...stamp(), ...state });
  return { file, video: state.video, overlay: state.overlay };
}
async function scrollPosition(page) {
  return page.evaluate(() => {
    const container = document.querySelector('#page-container'); const transform = getComputedStyle(container).transform;
    const offset = transform === 'none' ? 0 : -new DOMMatrixReadOnly(transform).m42;
    const reel = document.querySelector('#home-reel-container').getBoundingClientRect();
    return { offset, target: reel.top + offset - (innerHeight - reel.height) / 2 + 120, viewport: innerHeight };
  });
}
async function positionReel(page, name) {
  let current = await scrollPosition(page); const target = current.target; let keys = false;
  const record = { name, target, ...stamp(), inputs: [] }; report.scrollInputs.push(record);
  await page.mouse.move(20, current.viewport * 0.6);
  for (let i = 0; i < 55; i++) {
    checkBudget(); current = await scrollPosition(page); const remaining = target - current.offset;
    if (!keys && Math.abs(remaining) <= current.viewport) keys = true;
    if (keys && Math.abs(remaining) <= 60 && record.inputs.some(x => x.key)) {
      await pause(500); record.finalOffset = (await scrollPosition(page)).offset; break;
    }
    if (keys) {
      const key = remaining < 0 ? 'ArrowUp' : 'ArrowDown'; await page.keyboard.press(key); record.inputs.push({ key, offset: current.offset }); await pause(240);
    } else { const deltaY = Math.sign(remaining) * Math.min(Math.abs(remaining), current.viewport * 2.8); await page.mouse.wheel(0, deltaY); record.inputs.push({ deltaY, offset: current.offset }); await pause(210); }
  }
  const button = page.locator('#home-reel-video-watch-btn');
  await button.waitFor({ state: 'visible' });
  const bounds = await button.boundingBox(); const viewport = page.viewportSize();
  assert(bounds && bounds.y >= 0 && bounds.y + bounds.height <= viewport.height + 2, `Reel button not fully on screen: ${JSON.stringify(bounds)}`);
  await capture(page, `${name}-reel-ready`);
}
async function openOverlay(page, mobile = false, waitForPlayback = true) {
  const button = page.locator('#home-reel-video-watch-btn');
  if (mobile) await button.tap(); else await button.click({ noWaitAfter: true });
  await page.waitForFunction(() => { const e = document.querySelector('#video-overlay'); return e && getComputedStyle(e).display !== 'none'; }, null, { timeout: 10000 });
  if (waitForPlayback) {
    await page.waitForFunction(() => { const v = document.querySelector('#video-overlay video'); return v && !v.paused && v.readyState >= 2 && v.currentTime > 0.05; }, null, { timeout: 10000 });
    const state = await sample(page, mobile ? 'mobile-opened' : 'desktop-opened');
    assert(local(state.video.src), `Overlay uses non-local media: ${state.video.src}`);
    assert(state.video.duration > 1 && state.video.videoWidth > 0 && !state.video.error, 'Overlay video did not decode');
  }
}
async function assertClosed(page, name, durationMs = 1200) {
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#video-overlay')).display === 'none', null, { timeout: 5000 });
  const first = await sample(page, `${name}-closed-initial`);
  await pause(durationMs);
  const second = await sample(page, `${name}-closed-delayed`);
  assert(first.video?.paused && second.video?.paused, 'Hidden overlay video is still playing');
  assert(Math.abs(second.video.currentTime - first.video.currentTime) <= 0.12, 'Hidden overlay video continued advancing');
  assert(second.video.currentTime <= 0.15, `Closed overlay did not reset to its start (${second.video.currentTime})`);
  return { initialTime: first.video.currentTime, delayedTime: second.video.currentTime, paused: second.video.paused };
}
async function desktopMedia(page) {
  if (!await step('desktop-reel-position', async () => { await load(page); await positionReel(page, 'desktop'); })) return;
  const opened = await step('desktop-reel-open-play', async () => { await openOverlay(page); const a = await sample(page, 'desktop-playing-a'); await pause(650); const b = await sample(page, 'desktop-playing-b'); assert(b.video.currentTime > a.video.currentTime + 0.2, 'Playing video did not advance'); return capture(page, 'desktop-overlay-playing'); });
  if (!opened) return;
  await step('desktop-play-pause-resume', async () => {
    await page.locator('#video-overlay__play-btn').click();
    await page.waitForFunction(() => document.querySelector('#video-overlay video')?.paused);
    const a = await sample(page, 'desktop-paused-a'); await pause(650); const b = await sample(page, 'desktop-paused-b');
    assert(Math.abs(a.video.currentTime - b.video.currentTime) < 0.12, 'Paused video advanced');
    assert(/^play$/i.test(b.controls.play), `Paused button label is ${b.controls.play}`); await capture(page, 'desktop-overlay-paused');
    await page.locator('#video-overlay__play-btn').click(); await pause(500); const resumed = await sample(page, 'desktop-resumed');
    assert(!resumed.video.paused && resumed.video.currentTime > b.video.currentTime + 0.1, 'Play did not resume');
    assert(/^pause$/i.test(resumed.controls.play), `Playing button label is ${resumed.controls.play}`);
  });
  await step('desktop-mute-unmute', async () => {
    await page.locator('#video-overlay__mute-btn').click(); const muted = await sample(page, 'desktop-muted');
    assert(muted.video.muted || muted.video.volume === 0, 'Mute did not silence the video'); assert(/^unmute$/i.test(muted.controls.mute), 'Mute button label is incorrect');
    await capture(page, 'desktop-overlay-muted'); await page.locator('#video-overlay__mute-btn').click();
    const unmuted = await sample(page, 'desktop-unmuted'); assert(!unmuted.video.muted && unmuted.video.volume > 0, 'Unmute did not restore volume'); assert(/^mute$/i.test(unmuted.controls.mute), 'Unmute button label is incorrect');
  });
  await step('desktop-seek', async () => {
    const before = await sample(page, 'desktop-before-seek'); const bar = page.locator('#video-overlay__progress-container'); const bounds = await bar.boundingBox();
    assert(bounds?.width > 50, 'Progress bar has no clickable width'); await bar.click({ position: { x: bounds.width * 0.42, y: bounds.height / 2 } }); await pause(650);
    const after = await sample(page, 'desktop-after-seek'); const expected = before.video.duration * 0.42;
    assert(Math.abs(after.video.currentTime - expected) < Math.max(1.5, before.video.duration * 0.04), `Seek expected ${expected}s, got ${after.video.currentTime}s`);
    assert(!after.video.paused, 'Seek did not resume playback'); return capture(page, 'desktop-overlay-seeked');
  });
  await step('desktop-escape-close', async () => { await page.keyboard.press('Escape'); const result = await assertClosed(page, 'desktop-escape'); await capture(page, 'desktop-after-escape'); return result; });
  await step('desktop-repeat-open-backdrop-close', async () => { await openOverlay(page); await capture(page, 'desktop-overlay-reopened'); await page.locator('#video-overlay').click({ position: { x: 20, y: 20 } }); return assertClosed(page, 'desktop-backdrop'); });
  for (let i = 1; i <= 2; i++) await step(`desktop-fast-close-${i}`, async () => {
    // Do not take a screenshot or wait for playback between open and Escape:
    // both would consume the 500 ms deferred-playback race window.
    const before = elapsed(); await openOverlay(page, false, false); await page.keyboard.press('Escape'); const intervalMs = elapsed() - before;
    const stopped = await assertClosed(page, `desktop-fast-${i}`, 1500);
    await capture(page, `desktop-fast-close-${i}-stopped`);
    assert(intervalMs < 500, `Fast-close trial missed the race window (${intervalMs} ms); this is not evidence of a player regression`);
    return { clickToEscapeMs: intervalMs, timingValid: true, ...stopped };
  });
}
async function mobileMedia() {
  const { context, page } = await contextPage('mobile', true);
  try {
    if (!await step('mobile-reel-position', async () => { await load(page); await positionReel(page, 'mobile'); })) return;
    const opened = await step('mobile-reel-tap-open', async () => { await openOverlay(page, true); return capture(page, 'mobile-overlay-playing'); });
    if (!opened) return;
    await step('mobile-close-button', async () => { await page.locator('#video-overlay__mobile-close-btn').tap(); const result = await assertClosed(page, 'mobile-close'); await capture(page, 'mobile-after-close'); return result; });
    await step('mobile-repeat-open-close', async () => { await openOverlay(page, true); await page.locator('#video-overlay__mobile-close-btn').tap(); return assertClosed(page, 'mobile-repeat-close'); });
  } finally { await context.close(); }
}
async function routeList() {
  const directory = path.join(root, mode === 'brand' ? 'dist' : 'reference');
  const files = await fs.readdir(directory, { recursive: true });
  const routes = files.filter(x => /^(?:index\.html|about\/index\.html|projects\/index\.html|projects\/[^/]+\/index\.html)$/.test(x.replaceAll(path.sep, '/')))
    .map(x => `/${x.replaceAll(path.sep, '/').replace(/index\.html$/, '').replace(/\/$/, '')}`).sort((a, b) => a.localeCompare(b));
  routes.sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
  assert(routes.length === 22, `Expected 22 routes, discovered ${routes.length}`);
  assert(routes.filter(x => x.startsWith('/projects/')).length === 19, 'Expected 19 project-detail routes');
  return routes;
}
async function routesFlow(page) {
  const routes = await routeList(); report.expectedRoutes = routes;
  for (const route of routes) await step(`route-${route === '/' ? 'home' : route.slice(1).replaceAll('/', '-')}`, async () => {
    const before = elapsed(), errorStart = report.pageErrors.length, requestStart = report.requests.length;
    const marker = await load(page, route); await pause(300);
    const state = await domState(page);
    const errors = report.pageErrors.slice(errorStart);
    const failures = report.requests.slice(requestStart).filter(x => x.local && (x.status >= 400 || (x.event === 'failed' && !x.error?.includes('ERR_ABORTED'))));
    const entry = { route, marker, title: state.title, headings: state.headings, durationMs: elapsed() - before, loaderDisplay: state.loaderDisplay, pageErrors: errors, localFailures: failures, ...stamp() };
    report.routes.push(entry);
    await capture(page, `route-${route === '/' ? 'home' : route.slice(1).replaceAll('/', '-')}`);
    assert(errors.length === 0, `${route}: ${errors.length} page error(s)`);
    assert(failures.length === 0, `${route}: ${failures.length} local failed request(s)`);
    return entry;
  });
}
try {
  await fs.mkdir(out, { recursive: true });
  const probe = await fetch(`${origin}/`, { signal: AbortSignal.timeout(10000) });
  assert(probe.ok && probe.headers.get('x-study-mode') === mode, `Start the ${mode} server on 4207 before running this script`);
  const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'; await fs.access(executablePath);
  const launchArgs = ['--enable-webgl']; if (angle && angle !== 'default') launchArgs.push(`--use-angle=${angle}`);
  browser = await chromium.launch({ executablePath, headless: true, args: launchArgs, timeout: 45000 });
  report.browser = { version: browser.version(), executablePath, headless: true, isolated: true, launchArgs };
  deadline = setTimeout(() => { timedOut = true; browser?.close().catch(() => {}); }, Math.max(1000, budgetMs - elapsed()));
  const desktop = await contextPage('desktop');
  try { if (routesMode) await routesFlow(desktop.page); else await desktopMedia(desktop.page); } finally { await desktop.context.close(); }
  if (!routesMode) await mobileMedia();
} catch (error) { report.fatalError = error.stack || String(error); console.error(error.message); }
finally {
  clearTimeout(deadline);
  if (browser) { try { await browser.close(); report.cleanup.ownedBrowserClosed = true; } catch (error) { report.cleanup.error = error.message; } }
  report.cleanup.existingBrowserTouched = false; report.cleanup.serverTouched = false;
  report.finishedAt = new Date().toISOString(); report.durationMs = elapsed();
  report.summary = {
    stepsPassed: report.steps.filter(x => x.status === 'passed').length, stepsFailed: report.steps.filter(x => x.status === 'failed').length,
    routesLoaded: report.routes.length, detailsLoaded: report.routes.filter(x => x.route.startsWith('/projects/')).length,
    screenshots: report.screenshots.length, pageErrors: report.pageErrors.length,
    localHTTPFailures: report.requests.filter(x => x.local && x.status >= 400).length,
    localRequestFailures: report.requests.filter(x => x.local && x.event === 'failed' && !x.error?.includes('ERR_ABORTED')).length,
    blockedExternalRequests: report.blockedExternal.length,
    unexpectedExternalRequests: report.blockedExternal.filter(x => mode === 'brand' || !/^https:\/\/(?:[^/]+\.)?(?:vimeo\.com|vimeocdn\.com)(?:\/|$)/.test(x.url)).length,
  };
  report.passed = !report.fatalError && report.summary.stepsFailed === 0 && report.summary.pageErrors === 0 && report.summary.localHTTPFailures === 0 && report.summary.localRequestFailures === 0 && report.summary.unexpectedExternalRequests === 0 && (!routesMode || report.routes.length === 22);
  await save();
  await fs.writeFile(path.join(out, `${prefix}-network-errors.json`), JSON.stringify({ mode, runId, pageErrors: report.pageErrors, console: report.console, failedRequests: report.requests.filter(x => x.event === 'failed' || x.status >= 400), blockedExternal: report.blockedExternal }, null, 2));
  console.log(JSON.stringify({ passed: report.passed, report: reportFile, durationMs: report.durationMs, ...report.summary }, null, 2));
  if (!report.passed) process.exitCode = 1;
}
