// Read-only browser smoke test for a LIVE or STAGING site. Never logs in, never orders, never pays.
// Usage: BASE_URL=https://your-site node tests/e2e/smoke.mjs   (needs playwright-core + a Chromium; see workflow)
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = (process.env.BASE_URL || '').replace(/\/$/, '');
if (!/^https?:\/\//.test(BASE)) { console.error('Set BASE_URL to the site address, e.g. https://example.com'); process.exit(2); }
const OUT = process.env.SMOKE_OUT || 'smoke-report';
mkdirSync(OUT, { recursive: true });

const PAGES = ['/', '/collections', '/cart', '/login', '/faq', '/contact', '/policies/returns', '/policies/privacy', '/policies/terms', '/track-order/TEST'];
// 'Failed to load resource' lines carry no URL; failed requests are reported separately (with URL) below.
const IGNORE_CONSOLE = [/favicon/i, /Download the React DevTools/i, /^Failed to load resource/i];
const findings = []; // { level: 'FAIL'|'WARN', page, msg }
const add = (level, page, msg) => findings.push({ level, page, msg });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }); // phone-size first: most shoppers
let firstProductHref = null;

async function visit(path, { expectRedirectAwayFrom } = {}) {
  const page = await ctx.newPage();
  const errs = [], bad = [];
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORE_CONSOLE.some((r) => r.test(m.text()))) errs.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => errs.push('JS exception: ' + String(e.message).slice(0, 300)));
  page.on('response', (r) => { const u = r.url(); if (r.status() >= 400) bad.push(u.startsWith(BASE) ? `${r.status()} ${u.replace(BASE, '')}` : `${r.status()} ${new URL(u).host}`); });
  page.on('requestfailed', (r) => { const u = new URL(r.url()); if (r.resourceType() !== 'media') bad.push(`${r.failure()?.errorText || 'failed'} ${u.startsWith ? '' : ''}${u.host}${u.host === new URL(BASE).host ? u.pathname : ''}`); });
  let status = 0;
  try {
    const resp = await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 45000 });
    status = resp?.status() ?? 0;
  } catch (e) { add('FAIL', path, 'page did not load: ' + String(e.message).split('\n')[0]); await page.close(); return null; }
  await page.waitForTimeout(800);
  const text = (await page.locator('body').innerText()).trim();
  if (status >= 400) add('FAIL', path, `HTTP ${status}`);
  if (text.length < 40) add('FAIL', path, 'page looks blank');
  if (/Site temporarily unavailable/i.test(text)) add('FAIL', path, 'site shows "temporarily unavailable" (Firebase config problem)');
  if (/something went wrong|application error/i.test(text)) add('WARN', path, 'error text visible on page');
  for (const e of errs) add('FAIL', path, 'console: ' + e);
  for (const b of [...new Set(bad)]) add(b.startsWith('404') && !b.includes('.') ? 'FAIL' : 'WARN', path, 'failed request: ' + b);
  const brokenImgs = await page.$$eval('img', (imgs) => imgs.filter((i) => i.complete && i.naturalWidth === 0 && i.src && !i.src.startsWith('data:')).map((i) => i.src.slice(0, 120)));
  for (const s of brokenImgs.slice(0, 5)) add('WARN', path, 'broken image: ' + s);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 4) add('WARN', path, `horizontal scroll on phone (+${overflow}px)`);
  if (path === '/') {
    firstProductHref = await page.$$eval('a[href^="/product/"]', (a) => a[0]?.getAttribute('href') || null);
    if (!/ready[- ]to[- ]stitch/i.test(await page.content()) && !/ready[- ]to[- ]stitch/i.test(text)) add('WARN', path, 'no "Ready-to-Stitch" wording found on home page');
  }
  if (expectRedirectAwayFrom && new URL(page.url()).pathname.startsWith(expectRedirectAwayFrom)) add('FAIL', path, `not redirected away from ${expectRedirectAwayFrom} while logged out`);
  await page.screenshot({ path: `${OUT}/${path.replace(/[^\w]+/g, '_') || 'home'}.png`, fullPage: false }).catch(() => {});
  await page.close();
  return { status, url: page.url() };
}

for (const p of PAGES) await visit(p);
if (firstProductHref) await visit(firstProductHref);
else add('WARN', '/', 'no product links found on home page (catalogue empty or not loading)');
await visit('/checkout', { expectRedirectAwayFrom: '/checkout' });
await visit('/account', { expectRedirectAwayFrom: '/account' });
await visit('/admin/dashboard', { expectRedirectAwayFrom: '/admin' });

// Security headers on the document response
const head = await ctx.request.get(BASE + '/');
const h = head.headers();
if (h['x-content-type-options'] !== 'nosniff') add('WARN', '/', 'missing header X-Content-Type-Options: nosniff');
if (!h['x-frame-options']) add('WARN', '/', 'missing header X-Frame-Options');

await browser.close();
const fails = findings.filter((f) => f.level === 'FAIL');
const lines = [`Smoke report for ${BASE}`, `FAIL: ${fails.length}  WARN: ${findings.length - fails.length}`, ...findings.map((f) => `[${f.level}] ${f.page} - ${f.msg}`)];
writeFileSync(`${OUT}/report.txt`, lines.join('\n') + '\n');
console.log(lines.join('\n'));
process.exit(fails.length ? 1 : 0);
