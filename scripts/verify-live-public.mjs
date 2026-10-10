import { chromium } from '../../Hashgraph-Daily-Design/node_modules/playwright/index.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

// Public-source evidence only. Always launch a fresh temporary Chrome profile;
// never connect to an existing browser, a persistent user profile or CDP 9222.
const root = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
function option(name, fallback) {
  const inline = args.find(x => x.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback;
}
if (args.includes('--help')) {
  console.log('node scripts/verify-live-public.mjs [--out PATH] [--budget-ms 120000]');
  process.exit(0);
}
const out = path.resolve(root, option('--out', '分析/20261010-live'));
const budgetMs = Number(option('--budget-ms', '120000'));
if (!Number.isFinite(budgetMs) || budgetMs < 10000 || budgetMs > 120000) throw new Error('Public check budget must be between 10000 and 120000 ms');
const runId = new Date().toISOString().replace(/[-:.]/g, '');
const prefix = `public-${runId}`;
const started = Date.now();
const elapsed = () => Date.now() - started;
const stamp = () => ({ at: new Date().toISOString(), elapsedMs: elapsed() });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const reportFile = path.join(out, `${prefix}-report.json`);
const report = {
  runId, startedAt: new Date(started).toISOString(), budgetMs,
  requestedPages: [{ url: 'https://lusion.co/about', viewport: { width: 1440, height: 900 } }, { url: 'https://lusion.co/', viewport: { width: 390, height: 844 } }],
  policy: 'Fresh isolated headless Chrome with a temporary profile. No existing browser connection, user-profile inspection, current-tab access, CDP port connection, credentials, challenge interaction or access bypass. Top-level navigation is limited to the two requested public Lusion URLs.',
  resourcePolicy: 'Only HTTPS lusion.co/lusion.dev and their subdomains, plus data/blob assets. Other domains, including Vimeo and analytics, are blocked. No service workers, downloads, external windows, form submissions or outbound links.',
  limitations: ['A restricted-resource public observation, not a claim that all external dependencies work.', 'Mobile is Chrome viewport/UA/touch emulation, not a real phone or Safari.', 'Scene positions are produced with real wheel/touch input and recorded DOM offsets; no application objects, shaders or physical parameters are changed.', 'Screenshots require visual review and do not establish complete animation or pixel identity.'],
  steps: [], screenshots: [], sources: [], navigation: [], network: [], console: [], pageErrors: [], blockedResources: [], inputs: [], cleanup: {},
};
let browser, activePage, currentStep = '', deadline, timeoutReached = false;
function ownedDomain(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && ['lusion.co', 'lusion.dev'].some(d => u.hostname === d || u.hostname.endsWith(`.${d}`));
  } catch { return false; }
}
function authorizedPage(url) {
  try { const u = new URL(url); return u.origin === 'https://lusion.co' && ['/', '/about', '/about/'].includes(u.pathname) && !u.search; } catch { return false; }
}
function assert(value, message) { if (!value) throw new Error(message); }
function check() {
  if (report.blocker) throw new Error(`Public check stopped: ${report.blocker.reason}`);
  if (timeoutReached || elapsed() >= budgetMs) throw new Error(`Public check reached its ${budgetMs} ms budget`);
}
async function save() { await fs.mkdir(out, { recursive: true }); await fs.writeFile(reportFile, JSON.stringify(report, null, 2)); }
function block(reason, evidence = {}) {
  if (report.blocker) return;
  report.blocker = { reason, ...evidence, step: currentStep, ...stamp() };
  // Stop only this owned process. Never retry a challenge or navigate around it.
  browser?.close().catch(() => {});
}
async function step(name, action) {
  check(); currentStep = name; const entry = { name, status: 'running', ...stamp() }; report.steps.push(entry);
  console.log(`[public] ${name}`);
  try { entry.result = await action(); entry.status = 'passed'; }
  catch (error) {
    entry.status = report.blocker ? 'blocked' : 'failed'; entry.error = error.stack || String(error);
    if (!report.blocker && activePage && !activePage.isClosed() && authorizedPage(activePage.url())) {
      try { await capture(activePage, `${name}-incomplete`); } catch { /* Preserve original problem. */ }
    }
  }
  entry.durationMs = elapsed() - entry.elapsedMs; await save(); check(); return entry.status === 'passed';
}
async function pageContext(label, mobile) {
  check();
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: 1,
    isMobile: mobile, hasTouch: mobile, serviceWorkers: 'block', acceptDownloads: false,
    ...(mobile ? { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1' } : {}),
  });
  await context.route('**/*', async route => {
    const request = route.request(), url = request.url();
    if (report.blocker || timeoutReached) return route.abort('blockedbyclient');
    if (request.isNavigationRequest() && request.frame().parentFrame() === null && !authorizedPage(url)) {
      report.blockedResources.push({ context: label, url, type: request.resourceType(), reason: 'Top-level URL outside the two authorized public pages', ...stamp() });
      await route.abort('blockedbyclient'); block('Top-level navigation left the authorized public pages; no redirected page was opened', { url }); return;
    }
    if (ownedDomain(url) && /\/(?:cdn-cgi\/challenge-platform|captcha|challenge)(?:\/|\?|$)/i.test(new URL(url).pathname)) {
      await route.abort('blockedbyclient'); block('Public source requested an access challenge; stopped without interacting', { url }); return;
    }
    if (/^(?:data|blob):/.test(url) || ownedDomain(url)) return route.continue();
    report.blockedResources.push({ context: label, step: currentStep, url, type: request.resourceType(), reason: 'Outside permitted resource domains', ...stamp() });
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage(); activePage = page;
  page.setDefaultTimeout(8000); page.setDefaultNavigationTimeout(35000);
  page.on('console', msg => report.console.push({ context: label, step: currentStep, type: msg.type(), text: msg.text().slice(0, 4000), location: msg.location(), ...stamp() }));
  page.on('pageerror', error => report.pageErrors.push({ context: label, step: currentStep, message: error.message, stack: error.stack, ...stamp() }));
  page.on('requestfailed', request => report.network.push({ context: label, step: currentStep, event: 'failed', url: request.url(), type: request.resourceType(), error: request.failure()?.errorText, permittedDomain: ownedDomain(request.url()), ...stamp() }));
  page.on('response', response => {
    const request = response.request(); const headers = response.headers();
    report.network.push({ context: label, step: currentStep, event: 'response', url: response.url(), type: request.resourceType(), status: response.status(), permittedDomain: ownedDomain(response.url()), contentType: headers['content-type'], ...stamp() });
    const top = request.isNavigationRequest() && request.frame().parentFrame() === null;
    if (ownedDomain(response.url()) && headers['cf-mitigated'] === 'challenge') block('Public source returned a challenge response', { url: response.url(), status: response.status() });
    else if (top && [401, 403, 407, 429].includes(response.status())) block('Public page returned an authentication, permission or rate-limit response', { url: response.url(), status: response.status() });
  });
  page.on('framenavigated', frame => {
    if (frame !== page.mainFrame() || frame.url() === 'about:blank') return;
    report.navigation.push({ context: label, url: frame.url(), ...stamp() });
    if (!authorizedPage(frame.url())) block('Unexpected top-level public navigation; no further interaction', { url: frame.url() });
  });
  page.on('popup', async popup => { report.blockedResources.push({ context: label, event: 'popup-closed', url: popup.url(), ...stamp() }); await popup.close().catch(() => {}); });
  return { context, page };
}
async function gateAndState(page, marker) {
  return page.evaluate(marker => {
    const title = document.title, text = (document.body?.innerText || '').slice(0, 12000);
    const challenge = /verify (?:that )?you are human|checking your browser before accessing|complete the security check|access denied|attention required.{0,30}cloudflare|enable (?:javascript and )?cookies to continue|just a moment\.\.\./i.test(`${title}\n${text}`);
    const auth = Boolean(document.querySelector('input[type="password"]')) && /sign in|log in|login|authentication required/i.test(text);
    const loader = document.querySelector('#preloader'), content = document.querySelector(marker), canvas = document.querySelector('#canvas');
    return { title, challenge, auth, textExcerpt: challenge || auth ? text.slice(0, 1200) : null, ready: Boolean(content && getComputedStyle(content).display !== 'none' && document.documentElement.classList.contains('is-ready') && canvas?.width > 1 && canvas?.height > 1 && (!loader || getComputedStyle(loader).display === 'none')), loaderDisplay: loader ? getComputedStyle(loader).display : null };
  }, marker);
}
async function load(page, url, marker, name) {
  check(); assert(authorizedPage(url), 'Refusing unauthorized public URL');
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' }); check();
  assert(response && response.ok(), `Public page HTTP ${response?.status()}`);
  const html = await response.text(); const sourceFile = `${prefix}-${name}-source.html`;
  await fs.writeFile(path.join(out, sourceFile), html);
  const headers = response.headers(); report.sources.push({ name, requestedURL: url, finalURL: response.url(), status: response.status(), capturedAt: new Date().toISOString(), file: path.relative(root, path.join(out, sourceFile)), sha256: createHash('sha256').update(html).digest('hex'), bytes: Buffer.byteLength(html), headers: { contentType: headers['content-type'], etag: headers.etag, lastModified: headers['last-modified'], server: headers.server } });
  const until = Math.min(Date.now() + 40000, started + budgetMs - 2000);
  while (Date.now() < until) {
    check(); const state = await gateAndState(page, marker);
    if (state.challenge || state.auth) { block('Public page displayed an access challenge or sign-in requirement', { url: page.url(), title: state.title, excerpt: state.textExcerpt }); check(); }
    if (state.ready) { await pause(700); return state; }
    await pause(300);
  }
  throw new Error('Public page did not reach its original loader-complete state within this observation window; restricted or unavailable dependencies are recorded');
}
async function readPage(page) {
  return page.evaluate(() => {
    const box = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    const transform = document.querySelector('#page-container') ? getComputedStyle(document.querySelector('#page-container')).transform : 'none';
    return {
      url: location.href, title: document.title, observedAt: new Date().toISOString(), userAgent: navigator.userAgent,
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, touchPoints: navigator.maxTouchPoints },
      zoom: { visualViewportScale: visualViewport?.scale || 1, note: 'Default browser zoom; no zoom override applied' },
      meta: [...document.querySelectorAll('meta[name],meta[property]')].map(e => ({ key: e.getAttribute('name') || e.getAttribute('property'), content: e.getAttribute('content') })),
      canonical: document.querySelector('link[rel="canonical"]')?.href,
      scripts: [...document.scripts].map(e => e.src).filter(Boolean), stylesheets: [...document.querySelectorAll('link[rel="stylesheet"]')].map(e => e.href),
      htmlClass: document.documentElement.className, scrollOffset: transform === 'none' ? 0 : -new DOMMatrixReadOnly(transform).m42,
      loaderDisplay: document.querySelector('#preloader') ? getComputedStyle(document.querySelector('#preloader')).display : null,
      sections: [...document.querySelectorAll('.section')].map(e => ({ id: e.id, ...box(e) })), canvases: [...document.querySelectorAll('canvas')].map(e => ({ id: e.id, width: e.width, height: e.height, ...box(e) })),
      text: document.body.innerText.slice(0, 8500), resources: performance.getEntriesByType('resource').map(e => ({ url: e.name, type: e.initiatorType, durationMs: e.duration, transferSize: e.transferSize, decodedBodySize: e.decodedBodySize })),
    };
  });
}
async function capture(page, name) {
  check(); assert(authorizedPage(page.url()), 'Refusing screenshot outside the public page allowlist');
  const gate = await gateAndState(page, page.url().includes('/about') ? '#about' : '#home');
  if (gate.challenge || gate.auth) { block('Access gate appeared during public observation', { url: page.url(), title: gate.title, excerpt: gate.textExcerpt }); check(); }
  const file = `${prefix}-${name}.png`; const png = await page.screenshot({ path: path.join(out, file), fullPage: false, animations: 'allow', timeout: 10000 });
  const state = await readPage(page);
  const entry = { name, file: path.relative(root, path.join(out, file)), sha256: createHash('sha256').update(png).digest('hex'), ...stamp(), ...state };
  report.screenshots.push(entry); return { file, url: state.url, title: state.title, viewport: state.viewport, scrollOffset: state.scrollOffset, ready: gate.ready };
}
async function offset(page) {
  return page.evaluate(() => { const t = getComputedStyle(document.querySelector('#page-container')).transform; return t === 'none' ? 0 : -new DOMMatrixReadOnly(t).m42; });
}
async function aboutWheel(page, name, target) {
  const trace = { name, requestedOffset: target, input: 'real browser wheel; no scene state access', startedOffset: await offset(page), ...stamp(), samples: [] }; report.inputs.push(trace);
  await page.mouse.move(70, 600);
  for (let i = 0; i < 95; i++) {
    check(); const current = await offset(page), remaining = target - current;
    if (Math.abs(remaining) < 120) { await pause(450); trace.finalOffset = await offset(page); return; }
    const deltaY = Math.sign(remaining) * Math.min(1100, Math.abs(remaining));
    await page.mouse.wheel(0, deltaY); await pause(100);
    trace.samples.push({ deltaY, offset: await offset(page), atMs: elapsed() });
  }
  trace.finalOffset = await offset(page);
  throw new Error(`Public About input did not reach the requested observation range: ${trace.finalOffset} / ${target}`);
}
async function mobileSwipe(page, index) {
  const session = await page.context().newCDPSession(page); const before = await offset(page);
  try {
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 690, radiusX: 4, radiusY: 4, force: 1, id: 1 }] });
    for (let i = 1; i <= 14; i++) { await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y: 690 - 430 * i / 14, radiusX: 4, radiusY: 4, force: 1, id: 1 }] }); await pause(23); }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await session.detach(); }
  await pause(600); const after = await offset(page);
  report.inputs.push({ name: `mobile-swipe-${index}`, input: 'CDP touch input to this harness-owned page only', startedOffset: before, finalOffset: after, ...stamp() });
  assert(after > before + 5, 'Public mobile touch swipe did not advance the original scroll container');
}
try {
  await fs.mkdir(out, { recursive: true });
  const executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'; await fs.access(executablePath);
  browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-webgl'], timeout: 25000 });
  report.browser = { version: browser.version(), executablePath, headless: true, isolatedTemporaryProfile: true, noExistingBrowserConnection: true };
  deadline = setTimeout(() => { timeoutReached = true; browser?.close().catch(() => {}); }, Math.max(1000, budgetMs - elapsed()));
  const about = await pageContext('desktop-about', false);
  try {
    const ready = await step('desktop-about-load', async () => { await load(about.page, 'https://lusion.co/about', '#about', 'desktop-about'); return capture(about.page, 'desktop-about-hero'); });
    if (ready) {
      await step('desktop-about-point-cloud', async () => { await aboutWheel(about.page, 'about-point-cloud', 1440 * 3.8); return capture(about.page, 'desktop-about-point-cloud'); });
      await step('desktop-about-introduction', async () => { await aboutWheel(about.page, 'about-introduction', 1440 * 5.3); return capture(about.page, 'desktop-about-introduction'); });
    }
  } finally { await about.context.close(); }
  check();
  const mobile = await pageContext('mobile-home', true);
  try {
    const ready = await step('mobile-home-load', async () => { await load(mobile.page, 'https://lusion.co/', '#home', 'mobile-home'); return capture(mobile.page, 'mobile-home-hero'); });
    if (ready) await step('mobile-home-touch-scroll', async () => { await mobileSwipe(mobile.page, 1); await mobileSwipe(mobile.page, 2); return capture(mobile.page, 'mobile-home-after-touch'); });
  } finally { await mobile.context.close(); }
} catch (error) { report.fatalError = error.stack || String(error); }
finally {
  clearTimeout(deadline);
  if (browser) { try { await browser.close(); report.cleanup.ownedBrowserClosed = true; } catch (error) { report.cleanup.error = error.message; } }
  report.cleanup.existingBrowserTouched = false; report.cleanup.localServicesTouched = false;
  report.finishedAt = new Date().toISOString(); report.durationMs = elapsed(); report.timeoutReached = timeoutReached;
  report.summary = { stepsPassed: report.steps.filter(x => x.status === 'passed').length, stepsFailed: report.steps.filter(x => x.status === 'failed').length, stepsBlocked: report.steps.filter(x => x.status === 'blocked').length, screenshots: report.screenshots.length, sourceHTMLFiles: report.sources.length, pageErrors: report.pageErrors.length, blockedResourceRequests: report.blockedResources.length, permittedDomainHTTPFailures: report.network.filter(x => x.permittedDomain && x.status >= 400).length, permittedDomainRequestFailures: report.network.filter(x => x.permittedDomain && x.event === 'failed' && !x.error?.includes('ERR_ABORTED')).length };
  report.observationComplete = !report.blocker && !report.fatalError && !timeoutReached && report.summary.stepsPassed === 5 && report.summary.stepsFailed === 0;
  report.cleanRuntime = report.summary.pageErrors === 0 && report.summary.permittedDomainHTTPFailures === 0 && report.summary.permittedDomainRequestFailures === 0;
  await save();
  await fs.writeFile(path.join(out, `${prefix}-network-console.json`), JSON.stringify({ runId, policy: report.resourcePolicy, console: report.console, pageErrors: report.pageErrors, network: report.network, blockedResources: report.blockedResources, blocker: report.blocker }, null, 2));
  console.log(JSON.stringify({ observationComplete: report.observationComplete, cleanRuntime: report.cleanRuntime, report: reportFile, blocker: report.blocker, durationMs: report.durationMs, ...report.summary }, null, 2));
  if (!report.observationComplete || !report.cleanRuntime) process.exitCode = 1;
}
