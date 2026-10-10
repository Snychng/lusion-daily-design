import { chromium } from '../../Hashgraph-Daily-Design/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

// This harness owns a new, temporary Chrome process. Never connect to an existing
// browser, profile or debugging port. Page evaluation below only reads browser/DOM
// state or samples RAF; application objects, scene parameters and shaders are untouched.
const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
function option(name, fallback) {
  const inline = args.find(x => x.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}
if (args.includes('--help')) {
  console.log('node scripts/verify-browser.mjs --mode reference|brand [--quick] [--out PATH] [--budget-ms 480000] [--angle metal]');
  process.exit(0);
}
const mode = option('--mode', 'brand');
if (!['reference', 'brand'].includes(mode)) throw new Error('--mode must be reference or brand');
const quick = args.includes('--quick');
const origin = 'http://127.0.0.1:4207';
const out = path.resolve(root, option('--out', '分析/20261010-live'));
const budgetMs = Number(option('--budget-ms', quick ? '180000' : '480000'));
if (!Number.isFinite(budgetMs) || budgetMs < 30000) throw new Error('--budget-ms must be at least 30000');
const angle = option('--angle', '');
if (angle && !['metal', 'default'].includes(angle)) throw new Error('--angle must be metal or default');
const runId = new Date().toISOString().replace(/[-:.]/g, '');
const prefix = `${mode}-${runId}-${quick ? 'quick' : 'full'}`;
const reportPath = path.join(out, `${prefix}-report.json`);
const started = Date.now();
const report = {
  mode, quick, runId, origin, startedAt: new Date(started).toISOString(),
  browserPolicy: 'New isolated headless Chrome process and temporary profile; localhost:4207 only; no existing Chrome or CDP port connection.',
  runtimePolicy: 'No application-state injection, runtime edits, forced animation completion or synthetic DOM scroll. Desktop motion uses browser wheel input followed by supported ArrowUp/ArrowDown keys to stop native tunnel auto-scroll and settle near the target; touch uses Input.dispatchTouchEvent on this harness-owned page.',
  externalPolicy: 'All non-local HTTP(S) requests are blocked and recorded. Vimeo playback and external links/forms are outside this local visual verification.',
  limitations: [
    'Screenshots and input traces require visual review; successful input dispatch is not proof of optical or pixel identity.',
    'RAF cadence measures this headless browser session, not GPU render cost, real-device performance or production frame rate.',
    'Hold/release screenshots exercise the published slowdown input but do not numerically measure its time multiplier.',
    'Mobile/tablet are Chrome viewport, UA and touch emulation, not Safari or real-device tests.',
    'No formal video recording, newsletter submission, external project launch or outbound contact action is performed.'
  ],
  steps: [], screenshots: [], performance: [], requests: [], console: [], pageErrors: [],
  blockedExternal: [], scrollTraces: [], pageSnapshots: [], cleanup: {},
};
let browser;
let activePage;
let activeLabel = '';
let stopRequested = false;
const elapsed = () => Date.now() - started;
const stamp = () => ({ at: new Date().toISOString(), elapsedMs: elapsed() });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function ensureBudget() {
  if (stopRequested || elapsed() > budgetMs) throw new Error(`Verification budget exceeded (${budgetMs} ms)`);
}
function localURL(url) {
  try { return new URL(url).origin === origin; } catch { return false; }
}
function assert(value, message) { if (!value) throw new Error(message); }
async function saveReport() {
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
}
async function step(label, action) {
  ensureBudget();
  activeLabel = label;
  const entry = { label, ...stamp(), status: 'running' };
  report.steps.push(entry);
  console.log(`[${mode}] ${label}`);
  try {
    entry.result = await action();
    entry.status = 'passed';
  } catch (error) {
    entry.status = 'failed';
    entry.error = error.stack || String(error);
    console.error(`[${mode}] ${label}: ${error.message}`);
    if (activePage && !activePage.isClosed()) {
      try { await capture(activePage, `${label}-failure`, { performance: false }); } catch { /* Keep the original failure. */ }
    }
  }
  entry.durationMs = elapsed() - entry.elapsedMs;
  await saveReport();
  return entry.status === 'passed';
}

async function newPage(label, contextOptions = {}) {
  ensureBudget();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, ...contextOptions });
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (localURL(url) || /^(data|blob):/.test(url)) return route.continue();
    report.blockedExternal.push({ context: label, step: activeLabel, url, type: route.request().resourceType(), ...stamp() });
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  activePage = page;
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(45000);
  page.on('console', msg => {
    if (['warning', 'error'].includes(msg.type())) report.console.push({ context: label, step: activeLabel, type: msg.type(), text: msg.text(), location: msg.location(), ...stamp() });
  });
  page.on('pageerror', error => report.pageErrors.push({ context: label, step: activeLabel, message: error.message, stack: error.stack, ...stamp() }));
  page.on('requestfailed', request => report.requests.push({ context: label, step: activeLabel, event: 'failed', url: request.url(), type: request.resourceType(), error: request.failure()?.errorText, local: localURL(request.url()), ...stamp() }));
  page.on('response', response => report.requests.push({ context: label, step: activeLabel, event: 'response', url: response.url(), status: response.status(), type: response.request().resourceType(), local: localURL(response.url()), ...stamp() }));
  page.on('popup', async popup => {
    report.blockedExternal.push({ context: label, step: activeLabel, event: 'popup-closed', url: popup.url(), ...stamp() });
    await popup.close().catch(() => {});
  });
  page.on('crash', () => report.pageErrors.push({ context: label, step: activeLabel, message: 'Page crashed', ...stamp() }));
  return { context, page };
}

async function ready(page, marker) {
  await page.waitForFunction(({ marker }) => {
    const loader = document.querySelector('#preloader');
    const canvas = document.querySelector('#canvas');
    const container = document.querySelector(marker);
    return container && getComputedStyle(container).display !== 'none'
      && document.documentElement.classList.contains('is-ready')
      && canvas?.width > 1 && canvas?.height > 1
      && (!loader || getComputedStyle(loader).display === 'none' || getComputedStyle(loader).visibility === 'hidden');
  }, { marker }, { timeout: 75000 });
  await pause(1100);
}

async function load(page, route, marker) {
  ensureBudget();
  assert(route.startsWith('/') && !route.startsWith('//'), 'Only local routes are allowed');
  const response = await page.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' });
  assert(response && response.ok(), `Local page load failed: ${route} (${response?.status()})`);
  assert(response.headers()['x-study-mode'] === mode, `Server mode mismatch: expected ${mode}, got ${response.headers()['x-study-mode'] || 'missing X-Study-Mode'}`);
  await ready(page, marker);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    const main = document.querySelector('#page-container');
    const transform = main ? getComputedStyle(main).transform : 'none';
    const offset = transform === 'none' ? 0 : -new DOMMatrixReadOnly(transform).m42;
    const visible = e => { const r = e.getBoundingClientRect(); const c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.display !== 'none' && c.visibility !== 'hidden' && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; };
    return {
      url: location.href, title: document.title, userAgent: navigator.userAgent,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, maxTouchPoints: navigator.maxTouchPoints },
      htmlClass: document.documentElement.className, scrollOffset: offset,
      documentSize: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
      menuOpened: document.querySelector('#header-right-menu-btn')?.classList.contains('--opened'),
      loaderDisplay: document.querySelector('#preloader') ? getComputedStyle(document.querySelector('#preloader')).display : null,
      text: document.body.innerText.slice(0, 6500),
      headings: [...document.querySelectorAll('h1,h2,h3')].map(e => ({ text: e.textContent.trim(), visible: visible(e), ...rect(e) })),
      sections: [...document.querySelectorAll('.section')].map(e => ({ id: e.id, visible: visible(e), ...rect(e) })),
      canvases: [...document.querySelectorAll('canvas')].map(e => ({ id: e.id, width: e.width, height: e.height, visible: visible(e), ...rect(e) })),
      visibleControls: [...document.querySelectorAll('a,button')].filter(visible).slice(0, 45).map(e => ({ id: e.id, text: e.textContent.trim().slice(0, 100), href: e.getAttribute('href'), ...rect(e) })),
      videos: [...document.querySelectorAll('video')].map(e => ({ src: e.currentSrc, readyState: e.readyState, paused: e.paused, currentTime: e.currentTime, error: e.error?.code })),
      memory: performance.memory ? { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize } : null,
      resources: performance.getEntriesByType('resource').map(e => ({ name: e.name, type: e.initiatorType, durationMs: e.duration, transferSize: e.transferSize, decodedBodySize: e.decodedBodySize })),
    };
  });
}

async function rafSample(page, name, durationMs = 2000) {
  const data = await page.evaluate(duration => new Promise(resolve => {
    const samples = [];
    const start = performance.now();
    let previous;
    function frame(time) {
      if (previous !== undefined) samples.push(time - previous);
      previous = time;
      if (time - start < duration) requestAnimationFrame(frame);
      else {
        const ordered = [...samples].sort((a, b) => a - b);
        const elapsedMs = samples.reduce((a, b) => a + b, 0);
        resolve({ elapsedMs, frames: samples.length, fps: samples.length * 1000 / elapsedMs,
          medianMs: ordered[Math.floor(ordered.length * 0.5)], p95Ms: ordered[Math.floor(ordered.length * 0.95)],
          maxMs: ordered.at(-1), over33Ms: samples.filter(x => x > 33.34).length, over50Ms: samples.filter(x => x > 50).length,
          samplesMs: samples, visibilityState: document.visibilityState });
      }
    }
    requestAnimationFrame(frame);
  }), durationMs);
  report.performance.push({ name, ...stamp(), ...data });
  return data;
}

async function capture(page, name, { performance: measure = false } = {}) {
  ensureBudget();
  assert(localURL(page.url()), `Refusing to capture non-local page: ${page.url()}`);
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, '-');
  const filename = `${prefix}-${safe}.png`;
  const before = stamp();
  const png = await page.screenshot({ path: path.join(out, filename), fullPage: false, animations: 'allow', timeout: 18000 });
  const data = await snapshot(page);
  report.screenshots.push({ name, file: path.relative(root, path.join(out, filename)), sha256: createHash('sha256').update(png).digest('hex'), ...before, captureDurationMs: elapsed() - before.elapsedMs, url: page.url(), viewport: data.viewport, scrollOffset: data.scrollOffset });
  report.pageSnapshots.push({ name, ...stamp(), ...data });
  if (measure) await rafSample(page, name);
  return { screenshot: filename, title: data.title, scrollOffset: data.scrollOffset, horizontalOverflow: data.horizontalOverflow };
}

async function scrollMetrics(page) {
  return page.evaluate(() => {
    const el = document.querySelector('#page-container');
    const transform = getComputedStyle(el).transform;
    return { offset: transform === 'none' ? 0 : -new DOMMatrixReadOnly(transform).m42,
      max: Math.max(0, el.getBoundingClientRect().height - innerHeight), height: innerHeight };
  });
}

async function wheelTo(page, target, name) {
  const initial = await scrollMetrics(page);
  target = Math.min(initial.max, Math.max(0, target));
  const trace = { name, requestedOffset: target, input: 'page.mouse.wheel + supported ArrowUp/ArrowDown settle', tolerancePx: 60, startedOffset: initial.offset, ...stamp(), samples: [] };
  report.scrollTraces.push(trace);
  await page.mouse.move(20, Math.round(initial.height * 0.68));
  let previous = initial.offset;
  let stalled = 0;
  let keyboardSettling = false;
  // The published input normalizer limits effective wheel distance even when
  // Chromium receives a large delta. Budget iterations from actual travel,
  // while retaining the global deadline and the same 60 px settle tolerance.
  const maxIterations = Math.min(240, Math.max(65, Math.ceil(Math.abs(target - initial.offset) / 150) + 15));
  trace.maxIterations = maxIterations;
  for (let i = 0; i < maxIterations; i++) {
    ensureBudget();
    const current = await scrollMetrics(page);
    const remaining = target - current.offset;
    // GoalTunnels intentionally auto-scrolls at up to 2.5 viewport heights/s.
    // A supported arrow key calls ScrollPane.scrollToPixel(), which sets its
    // native skipAutoScroll flag. Do not inject that flag or alter the runtime.
    // Start settling within one viewport so a final wheel pause cannot propel
    // the camera repeatedly past the target before a key can arrest it.
    if (!keyboardSettling && Math.abs(remaining) <= Math.max(350, current.height)) {
      keyboardSettling = true;
      const key = remaining < 0 ? 'ArrowUp' : 'ArrowDown';
      await page.keyboard.press(key);
      await pause(240);
      const after = await scrollMetrics(page);
      trace.samples.push({ key, purpose: 'stop native automatic advance', offset: after.offset, atMs: elapsed() });
      previous = after.offset;
      continue;
    }
    if (keyboardSettling && Math.abs(remaining) <= 60) {
      await pause(260);
      const settled = await scrollMetrics(page);
      if (Math.abs(target - settled.offset) <= 60) {
        trace.finalOffset = settled.offset;
        trace.errorPx = settled.offset - target;
        trace.durationMs = elapsed() - trace.elapsedMs;
        return settled;
      }
    }
    let input;
    if (keyboardSettling) {
      const key = remaining < 0 ? 'ArrowUp' : 'ArrowDown';
      await page.keyboard.press(key);
      input = { key, purpose: '100 px native key calibration' };
      await pause(240);
    } else {
      const deltaY = Math.sign(remaining) * Math.min(Math.abs(remaining), current.height * 3.5);
      await page.mouse.wheel(0, deltaY);
      input = { deltaY };
      await pause(210);
    }
    const after = await scrollMetrics(page);
    trace.samples.push({ ...input, offset: after.offset, atMs: elapsed() });
    stalled = Math.abs(after.offset - previous) < 1 && Math.abs(remaining) > 60 ? stalled + 1 : 0;
    if (stalled >= 6) throw new Error(`Browser scroll input did not move ${name}: current ${after.offset}, target ${target}`);
    previous = after.offset;
  }
  throw new Error(`Wheel/key target did not settle for ${name}`);
}

async function sectionPosition(page, selector) {
  return page.evaluate(selector => {
    const e = document.querySelector(selector);
    if (!e) throw new Error(`Missing section: ${selector}`);
    const parent = document.querySelector('#page-container');
    const transform = getComputedStyle(parent).transform;
    const offset = transform === 'none' ? 0 : -new DOMMatrixReadOnly(transform).m42;
    const r = e.getBoundingClientRect();
    return { top: r.top + offset, height: r.height, viewportHeight: innerHeight, viewportWidth: innerWidth };
  }, selector);
}

async function section(page, selector, name, viewportOffset = 0.05, measure = false) {
  const geometry = await sectionPosition(page, selector);
  await wheelTo(page, geometry.top + geometry.viewportHeight * viewportOffset, name);
  await pause(700);
  return capture(page, name, { performance: measure });
}

async function menuCycle(page, name, touch = false) {
  const menu = page.locator('#header-right-menu-btn');
  const act = () => touch ? menu.tap() : menu.click();
  if (await menu.evaluate(e => e.classList.contains('--opened'))) await act();
  await act();
  await page.waitForFunction(() => document.querySelector('#header-right-menu-btn')?.classList.contains('--opened'));
  await pause(850);
  await capture(page, `${name}-open`);
  await act();
  await page.waitForFunction(() => !document.querySelector('#header-right-menu-btn')?.classList.contains('--opened'));
  await pause(500);
  await act(); await pause(400); await act(); await pause(500);
  assert(!await menu.evaluate(e => e.classList.contains('--opened')), 'Menu did not close after repeated toggles');
  return capture(page, `${name}-closed`);
}

async function mouseSweep(page, { down = false, region = [0.15, 0.62, 0.85, 0.82] } = {}) {
  const v = page.viewportSize();
  const [x0, y0, x1, y1] = region;
  await page.mouse.move(v.width * x0, v.height * y0);
  if (down) await page.mouse.down();
  try {
    for (let i = 0; i <= 28; i++) {
      const t = i / 28;
      await page.mouse.move(v.width * (x0 + (x1 - x0) * t), v.height * (y0 + (y1 - y0) * (0.5 - 0.5 * Math.cos(t * Math.PI * 4))));
      await pause(22);
    }
  } finally { if (down) await page.mouse.up(); }
}

async function goalRanges(page) {
  // Mirror only the public GoalSectionRanges geometry equation in the test.
  // This reads initial DOM rectangles and never accesses the module's objects.
  return page.evaluate(() => {
    const transform = getComputedStyle(document.querySelector('#page-container')).transform;
    const scroll = transform === 'none' ? 0 : -new DOMMatrixReadOnly(transform).m42;
    const rect = selector => { const r = document.querySelector(selector).getBoundingClientRect(); return { top: r.top + scroll, bottom: r.bottom + scroll, height: r.height }; };
    const goal = rect('#home-goal'), imageIn = rect('#home-goal-image-in'), imageOut = rect('#home-goal-image-out'), footer = rect('#footer-section');
    const baseY = imageIn.top - innerHeight;
    const available = goal.bottom - baseY - (innerHeight + imageIn.height) / 2 - (innerHeight + imageOut.height) / 2;
    const specs = [['blackFrameShow', (innerHeight + imageIn.height) / 2], ['blackFrameIn', available / 22.5], ['blackTitle', available * 5 / 22.5], ['blackTunnel', available * 12 / 22.5], ['whiteTunnel', available * 2 / 22.5], ['whiteFrameOut', available / 22.5], ['whiteFrameBreak', available * 1.5 / 22.5], ['astronautDrop', (innerHeight + imageOut.height) / 2 + innerHeight], ['astronautWait', footer.bottom - goal.bottom]];
    let cursor = baseY;
    const ranges = Object.fromEntries(specs.map(([name, size]) => { const start = cursor; cursor += size; return [name, { start, end: cursor, size }]; }));
    return { source: 'GoalSectionRanges.resize, reference/_astro/hoisted.CUO_IjfL.js', baseY, available, goal, imageIn, imageOut, footer, ranges };
  });
}

async function holdSequence(page, name) {
  const v = page.viewportSize();
  await page.mouse.move(v.width * 0.4, v.height * 0.7);
  await capture(page, `${name}-natural-a`);
  await pause(650);
  await capture(page, `${name}-natural-b`);
  await page.mouse.down();
  try {
    await pause(500);
    await capture(page, `${name}-held-a`);
    await pause(650);
    await capture(page, `${name}-held-b`);
  } finally { await page.mouse.up(); }
  await pause(800);
  await capture(page, `${name}-released`);
  return { input: 'mouse down held then released', verification: 'Input exercised; review temporal screenshots. Runtime time multiplier is not inferred from RAF.' };
}

async function desktopFlow(page) {
  let goal;
  const homeReady = await step('desktop-home-load', async () => {
    await load(page, '/', '#home');
    goal = await goalRanges(page);
    report.homeGoalRanges = goal;
    return capture(page, 'desktop-home-hero', { performance: true });
  });
  if (homeReady && !quick) {
    await step('desktop-menu-repeat', () => menuCycle(page, 'desktop-menu'));
    await step('desktop-home-pointer', async () => { await mouseSweep(page, { region: [0.2, 0.25, 0.82, 0.72] }); return capture(page, 'desktop-home-pointer'); });
    for (const [selector, name, offset] of [['#home-reel', 'desktop-home-reel', 0.2], ['#home-featured', 'desktop-home-featured', 0.22], ['#home-goal', 'desktop-home-goal-context', 0]]) {
      await step(name, () => section(page, selector, name, offset));
    }
    const stages = [['blackFrameIn', 0.55], ['blackTitle', 0.6], ['blackTunnel', 0.16], ['blackTunnel', 0.68], ['whiteTunnel', 0.5], ['whiteFrameOut', 0.55], ['whiteFrameBreak', 0.65], ['astronautDrop', 0.65]];
    for (const [key, ratio] of stages) {
      const name = `desktop-home-${key}-${Math.round(ratio * 100)}`;
      await step(name, async () => {
        const range = goal.ranges[key];
        await wheelTo(page, range.start + range.size * ratio, name);
        await pause(650);
        return capture(page, name, { performance: key === 'blackTunnel' && ratio > 0.5 });
      });
      if (key === 'blackTunnel' && ratio > 0.5) await step('desktop-tunnel-hold-release', () => holdSequence(page, 'desktop-tunnel'));
    }
    for (const [key, ratio] of [['whiteFrameBreak', 0.35], ['whiteTunnel', 0.5], ['blackTunnel', 0.5]]) {
      const name = `desktop-home-reverse-${key}`;
      await step(name, async () => { const range = goal.ranges[key]; await wheelTo(page, range.start + range.size * ratio, name); await pause(550); return capture(page, name); });
    }
    await step('desktop-home-end', () => section(page, '#end-section', 'desktop-home-end', 1));
    await step('desktop-home-footer', () => section(page, '#footer-section', 'desktop-home-footer', -0.05));
    await step('desktop-home-scroll-nav', () => section(page, '#scroll-nav-section', 'desktop-home-scroll-nav', -0.3));
  }
  const aboutReady = await step('desktop-about-load', async () => {
    await load(page, '/about', '#about');
    await mouseSweep(page, { region: [0.25, 0.4, 0.75, 0.66] });
    return capture(page, 'desktop-about-hero', { performance: true });
  });
  if (quick) return;
  if (aboutReady) {
    await step('desktop-about-details', async () => { const p = await sectionPosition(page, '#about-who'); await wheelTo(page, p.top + p.viewportWidth * 5.15, 'about-details'); await pause(700); return capture(page, 'desktop-about-details'); });
    await step('desktop-about-team-pointer', async () => {
      const p = await sectionPosition(page, '#about-who');
      await wheelTo(page, p.top + p.viewportWidth * 7.8, 'about-team');
      await pause(900);
      await capture(page, 'desktop-about-team-before');
      await mouseSweep(page, { region: [0.08, 0.32, 0.62, 0.8] });
      await pause(650);
      return capture(page, 'desktop-about-team-after', { performance: true });
    });
    for (const [selector, name] of [['#about-clients', 'desktop-about-clients'], ['#about-award', 'desktop-about-awards'], ['#about-capability', 'desktop-about-capability']]) await step(name, () => section(page, selector, name, 0.1));
    await step('desktop-about-end-flip', async () => {
      await section(page, '#end-section', 'desktop-about-flip-before', 1);
      await mouseSweep(page, { region: [0.13, 0.64, 0.86, 0.88] });
      await capture(page, 'desktop-about-flip-move');
      await mouseSweep(page, { down: true, region: [0.13, 0.77, 0.87, 0.88] });
      await pause(600);
      return capture(page, 'desktop-about-flip-after-press', { performance: true });
    });
    await step('desktop-about-footer', () => section(page, '#footer-section', 'desktop-about-footer', -0.05));
    await step('desktop-about-scroll-nav', () => section(page, '#scroll-nav-section', 'desktop-about-scroll-nav', -0.3));
  }
  const projectsReady = await step('desktop-projects-load', async () => { await load(page, '/projects', '#projects'); return capture(page, 'desktop-projects-home'); });
  if (projectsReady) {
    for (let index = 0; index < 2; index++) await step(`desktop-project-detail-${index + 1}`, async () => {
      const cards = page.locator('#projects .project-item');
      assert(await cards.count() > index, `Project card ${index + 1} missing`);
      const card = cards.nth(index);
      const href = await card.getAttribute('href');
      assert(href && href.startsWith('/projects/'), `Unexpected project route: ${href}`);
      const selector = `#projects .project-item:nth-of-type(${index + 1})`;
      const position = await sectionPosition(page, selector);
      await wheelTo(page, Math.max(0, position.top - position.viewportHeight * 0.28), `project-${index + 1}-card`);
      await card.hover(); await pause(500);
      await capture(page, `desktop-project-${index + 1}-hover`);
      await card.click();
      await page.waitForURL(url => url.origin === origin && url.pathname.replace(/\/$/, '') === href.replace(/\/$/, ''));
      await ready(page, '#project');
      await capture(page, `desktop-project-${index + 1}-detail`);
      await page.mouse.move(300, 500);
      await page.mouse.wheel(0, 1050); await pause(950);
      await capture(page, `desktop-project-${index + 1}-detail-scroll`);
      await page.mouse.wheel(0, -650); await pause(750);
      if (index === 0) await page.locator('#header-center-project-back-btn').click();
      else await page.goBack({ waitUntil: 'domcontentloaded' });
      await page.waitForURL(url => url.origin === origin && url.pathname.replace(/\/$/, '') === '/projects');
      await ready(page, '#projects');
      await capture(page, `desktop-project-${index + 1}-returned`);
      return { href, exit: index === 0 ? 'site Back button' : 'browser history Back' };
    });
    await step('desktop-menu-return-home', async () => {
      await page.locator('#header-right-menu-btn').click(); await pause(500);
      await page.locator('#header-menu a[data-page="home"]').click();
      await page.waitForURL(`${origin}/`); await ready(page, '#home');
      return capture(page, 'desktop-home-returned');
    });
  }
}

async function swipe(page, name, direction = 1) {
  const before = await scrollMetrics(page);
  const v = page.viewportSize();
  const session = await page.context().newCDPSession(page);
  const x = Math.round(v.width * 0.48);
  const y0 = Math.round(v.height * (direction > 0 ? 0.8 : 0.3));
  const y1 = Math.round(v.height * (direction > 0 ? 0.28 : 0.8));
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0, radiusX: 4, radiusY: 4, force: 1, id: 1 }] });
    for (let i = 1; i <= 16; i++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 + (y1 - y0) * i / 16, radiusX: 4, radiusY: 4, force: 1, id: 1 }] });
      await pause(22);
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await session.detach(); }
  await pause(650);
  const after = await scrollMetrics(page);
  report.scrollTraces.push({ name, input: 'isolated-page CDP touch swipe', direction, startedOffset: before.offset, finalOffset: after.offset, ...stamp() });
  assert(direction > 0 ? after.offset > before.offset + 5 : after.offset < before.offset - 5, `Touch swipe did not move in expected direction: ${name}`);
  return after;
}

async function responsiveFlow(label, viewport, userAgent) {
  const { context, page } = await newPage(label, { viewport, isMobile: true, hasTouch: true, userAgent });
  const extendedMobile = viewport.width === 390 && viewport.height === 844;
  let mobileGoal;
  try {
    const loaded = await step(`${label}-home-load`, async () => {
      await load(page, '/', '#home');
      if (extendedMobile) {
        // Capture the initial layout before touch input changes moving scene DOM.
        mobileGoal = await goalRanges(page);
        report.mobileGoalRanges = { label, inputPolicy: 'Mobile UA/touch context; scene positioning uses real wheel and supported arrow keys. Separate touch-swipe tests remain unchanged.', ...mobileGoal };
      }
      return capture(page, `${label}-home-hero`, { performance: true });
    });
    if (loaded) {
      await step(`${label}-menu-repeat`, () => menuCycle(page, `${label}-menu`, true));
      await step(`${label}-touch-scroll-return`, async () => {
        for (let i = 0; i < 3; i++) await swipe(page, `${label}-swipe-forward-${i + 1}`);
        await capture(page, `${label}-home-scrolled`);
        await swipe(page, `${label}-swipe-reverse`, -1);
        return capture(page, `${label}-home-reverse`);
      });
      if (extendedMobile) {
        for (const [key, ratio] of [['blackTunnel', 0.5], ['whiteTunnel', 0.5], ['whiteFrameBreak', 0.65]]) {
          const name = `${label}-home-${key}`;
          await step(name, async () => {
            const range = mobileGoal.ranges[key];
            await wheelTo(page, range.start + range.size * ratio, name);
            await pause(550);
            const result = await capture(page, name, { performance: key === 'blackTunnel' });
            return { ...result, positioning: 'Mobile UA and touch emulation, wheel/key scene positioning; not a touch-scroll traversal of this whole scene.' };
          });
        }
        await step(`${label}-home-end`, async () => {
          const result = await section(page, '#end-section', `${label}-home-end`, 1);
          return { ...result, scene: 'Home end uses astronaut/tunnel continuation. Published HomePage.hasEndVisual is false; FLIP is tested on About.', positioning: 'Mobile UA with wheel/key input' };
        });
      }
    }
    const aboutLoaded = await step(`${label}-about-load`, async () => { await load(page, '/about', '#about'); await swipe(page, `${label}-about-swipe`); return capture(page, `${label}-about`, { performance: true }); });
    if (aboutLoaded && extendedMobile) {
      await step(`${label}-about-team`, async () => {
        const geometry = await sectionPosition(page, '#about-who');
        // AboutWhoSection mobile thresholds are 3.5, 5.25, 7, 8.75, 11.25
        // viewport HEIGHTS. At 9.2 h the mobile team panel has fully entered.
        const target = geometry.top + geometry.viewportHeight * 9.2;
        await wheelTo(page, target, `${label}-about-team`);
        await pause(750);
        return { ...await capture(page, `${label}-about-team`), positioning: 'Mobile About branch: 9.2 × viewportHeight, not desktop viewportWidth', requestedOffset: target };
      });
      await step(`${label}-about-end-flip`, async () => {
        await section(page, '#end-section', `${label}-about-flip-before`, 1);
        const before = await scrollMetrics(page);
        const session = await page.context().newCDPSession(page);
        const y = Math.round(viewport.height * 0.77);
        try {
          await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: viewport.width * 0.18, y, radiusX: 4, radiusY: 4, force: 1, id: 1 }] });
          for (let i = 1; i <= 24; i++) {
            await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: viewport.width * (0.18 + 0.64 * i / 24), y, radiusX: 4, radiusY: 4, force: 1, id: 1 }] });
            await pause(22);
          }
          await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } finally { await session.detach(); }
        await pause(500);
        const after = await scrollMetrics(page);
        report.scrollTraces.push({ name: `${label}-flip-touch-stroke`, input: 'isolated-page CDP horizontal touch stroke; constant y to avoid intentional vertical scrolling', startedOffset: before.offset, finalOffset: after.offset, ...stamp() });
        return { ...await capture(page, `${label}-about-flip-after-touch`, { performance: true }), positioning: 'Wheel/key positioning followed by actual touch stroke in the phone context' };
      });
    }
  } finally { await context.close(); }
}

let deadline;
try {
  await fs.mkdir(out, { recursive: true });
  const probe = await fetch(`${origin}/`, { signal: AbortSignal.timeout(10000) });
  assert(probe.ok, `Local server is unavailable (${probe.status}); start scripts/serve.mjs first`);
  assert(probe.headers.get('x-study-mode') === mode, `Port 4207 serves ${probe.headers.get('x-study-mode') || 'unknown'}, not ${mode}`);
  report.server = { mode: probe.headers.get('x-study-mode'), status: probe.status };
  const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  await fs.access(executablePath);
  const launchArgs = ['--enable-webgl'];
  if (angle && angle !== 'default') launchArgs.push(`--use-angle=${angle}`);
  browser = await chromium.launch({ executablePath, headless: true, args: launchArgs, timeout: 45000 });
  report.browser = { version: browser.version(), executablePath, headless: true, launchArgs, isolated: true };
  try {
    const session = await browser.newBrowserCDPSession();
    const info = await session.send('SystemInfo.getInfo');
    report.gpu = info.gpu;
    await session.detach();
  } catch (error) { report.gpuReadError = error.message; }
  deadline = setTimeout(() => { stopRequested = true; browser?.close().catch(() => {}); }, Math.max(1000, budgetMs - elapsed()));
  const desktop = await newPage('desktop');
  try { await desktopFlow(desktop.page); } finally { await desktop.context.close(); }
  if (!quick) {
    await responsiveFlow('mobile-390x844', { width: 390, height: 844 }, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
    await responsiveFlow('tablet-768x1024', { width: 768, height: 1024 }, 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1');
  }
} catch (error) {
  report.fatalError = error.stack || String(error);
  console.error(error.message);
} finally {
  clearTimeout(deadline);
  if (browser) {
    try { await browser.close(); report.cleanup.ownedBrowserClosed = true; }
    catch (error) { report.cleanup.error = error.message; }
  }
  report.cleanup.serverTouched = false;
  report.cleanup.existingBrowserTouched = false;
  report.finishedAt = new Date().toISOString();
  report.durationMs = elapsed();
  report.summary = {
    stepsPassed: report.steps.filter(x => x.status === 'passed').length,
    stepsFailed: report.steps.filter(x => x.status === 'failed').length,
    screenshots: report.screenshots.length,
    pageErrors: report.pageErrors.length,
    localHTTPFailures: report.requests.filter(x => x.local && x.status >= 400).length,
    localRequestFailures: report.requests.filter(x => x.local && x.event === 'failed' && !x.error?.includes('ERR_ABORTED')).length,
    blockedExternalRequests: report.blockedExternal.length,
    unexpectedExternalRequests: report.blockedExternal.filter(x => mode === 'brand' || !/^https:\/\/(?:[^/]+\.)?(?:vimeo\.com|vimeocdn\.com)(?:\/|$)/.test(x.url)).length,
    overflowSnapshots: report.pageSnapshots.filter(x => x.horizontalOverflow).map(x => x.name),
  };
  report.passed = !report.fatalError && report.summary.stepsFailed === 0 && report.summary.pageErrors === 0 && report.summary.localHTTPFailures === 0 && report.summary.localRequestFailures === 0 && report.summary.unexpectedExternalRequests === 0;
  await saveReport();
  await fs.writeFile(path.join(out, `${prefix}-performance.json`), JSON.stringify({ mode, runId, browser: report.browser, gpu: report.gpu, limitations: report.limitations, samples: report.performance }, null, 2));
  await fs.writeFile(path.join(out, `${prefix}-network-errors.json`), JSON.stringify({ mode, runId, pageErrors: report.pageErrors, console: report.console, failedRequests: report.requests.filter(x => x.event === 'failed' || x.status >= 400), blockedExternal: report.blockedExternal }, null, 2));
  console.log(JSON.stringify({ passed: report.passed, report: reportPath, durationMs: report.durationMs, ...report.summary }, null, 2));
  if (!report.passed) process.exitCode = 1;
}
