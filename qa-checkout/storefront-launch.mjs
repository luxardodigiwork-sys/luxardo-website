import { chromium, devices } from 'playwright';
import fs from 'fs';
const base = 'http://localhost:4173';
const out = process.env.SHOTS || './shots'; fs.mkdirSync(out, { recursive: true });
const results = []; const ok = (name, cond, info = '') => { results.push([cond ? 'PASS' : 'FAIL', name, info]); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 7'], locale: 'en-IN' });
// Record analytics calls without loading Google/Facebook scripts.
await ctx.route(/googletagmanager|connect\.facebook\.net|facebook\.com|api\.postalpincode/, r => r.abort());
await ctx.addInitScript(() => {
  window.__ev = [];
  const rec = (src) => function () { window.__ev.push([src, ...Array.from(arguments).map(a => (typeof a === 'object' && a && !(a instanceof Date)) ? JSON.parse(JSON.stringify(a)) : a)]); };
  Object.defineProperty(window, 'fbq', { configurable: true, get() { return window.__fbq; }, set(v) { window.__fbq = rec('fbq'); } });
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|Failed to load resource|net::/.test(m.text())) errors.push(m.text().slice(0, 200)); });
const shot = n => page.screenshot({ path: `${out}/${n}.png` });
const ev = () => page.evaluate(() => [...window.__ev, ...(window.dataLayer || []).map(a => ['gtag', ...Array.from(a)])]);

// 1. Home loads, no country popup
await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await shot('01-home');
ok('Home: no "Select Your Country" popup', !(await page.getByText('Select Your Country').isVisible().catch(() => false)));

// 2. Menu collection links come from the database (slug "tuxedos")
const html = await page.content();
ok('Menu/home links use admin collection slugs', html.includes('/collections/tuxedos') && html.includes('/collections/lxf3piecesuit'));
ok('Hidden collection not in menu', !html.includes('/collections/secret'));

// 3. Collection page shows the right products (case-insensitive match)
await page.goto(base + '/collections/casual', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500); await shot('02-casual');
ok('CASUAL collection shows Silent Bloom', await page.getByText('Silent Bloom Shirt').first().isVisible());
ok('Hidden product not shown', !(await page.getByText('Draft Hidden Product').first().isVisible().catch(() => false)));
await page.goto(base + '/collections/lxf3piecesuit', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2000);
ok('"3 piece suit" (lower case) matches "3 Piece Suit"', await page.getByText('Royal 3 Piece').first().isVisible());
await page.goto(base + '/collections/tuxedo', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2000); await shot('03-legacy-tuxedo');
ok('Old link /collections/tuxedo still works', await page.getByText('Midnight Tuxedo').first().isVisible());

// 4. In-app navigation does not reload the page
await page.goto(base + '/collections', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2000);
await page.evaluate(() => { window.__noReload = 1; });
await page.getByText('Midnight Tuxedo').first().click();
await page.waitForURL(/\/product\//); await page.waitForTimeout(1500); await shot('04-product');
ok('Clicking a product does not reload the website', await page.evaluate(() => window.__noReload === 1));
ok('Product page shows product', await page.getByText('Midnight Tuxedo').first().isVisible());
let e = await ev();
ok('ViewContent sent to Pixel', e.some(x => x[0] === 'fbq' && x[1] === 'track' && x[2] === 'ViewContent' && x[3]?.content_ids?.[0] === 'LXF-TUX-001'));
ok('view_item sent to GA4', e.some(x => x[0] === 'gtag' && x[1] === 'event' && x[2] === 'view_item'));

// 5. Add to cart
const sizeBtn = page.locator('button', { hasText: /^\s*40\s*$/ }).first();
if (await sizeBtn.isVisible().catch(() => false)) await sizeBtn.click();
await page.getByRole('button', { name: /add to (cart|bag)/i }).first().click();
await page.waitForTimeout(1200); await shot('05-added');
e = await ev();
ok('AddToCart sent to Pixel', e.some(x => x[0] === 'fbq' && x[2] === 'AddToCart' && x[3]?.value === 14999), JSON.stringify(e.filter(x => x[2] === 'AddToCart')).slice(0, 200));

// 6. Checkout (guest, COD to a Jaipur pincode)
await page.goto(base + '/checkout', { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2500); await shot('06-checkout');
e = await ev();
ok('InitiateCheckout sent', e.some(x => x[0] === 'fbq' && x[2] === 'InitiateCheckout'));
const fill = async (name, v) => { const l = page.locator(`[name="${name}"]`).first(); if (!(await l.count())) return; const tag = await l.evaluate(e => e.tagName); if (tag === 'SELECT') await l.selectOption({ label: v }).catch(() => l.selectOption(v)); else await l.fill(v); };
await fill('fullName', 'Test Buyer'); await fill('email', 'buyer@test.lux'); await fill('phone', '9876543210');
await fill('addressLine1', '12 MI Road'); await fill('postalCode', '302001'); await fill('city', 'Jaipur'); await fill('state', 'Rajasthan');
await page.locator('input[name="pay"][value="cod"]').check();
await page.waitForTimeout(500); await shot('07-filled');
await page.getByRole('button', { name: /place order|confirm order|pay/i }).last().click();
await page.waitForURL(/order-confirmation/, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500); await shot('08-confirmation');
ok('COD order reaches confirmation page', /order-confirmation/.test(page.url()), page.url());
e = await ev();
const purchase = e.filter(x => x[0] === 'fbq' && x[2] === 'Purchase');
ok('Purchase sent to Pixel once, with order id and server price', purchase.length === 1 && purchase[0][3]?.value >= 14999 && !!purchase[0][4]?.eventID, JSON.stringify(purchase).slice(0, 220));
ok('purchase sent to GA4', e.some(x => x[0] === 'gtag' && x[2] === 'purchase'));
await page.reload(); await page.waitForTimeout(1500);

ok('No crashes / JS errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();
for (const r of results) console.log(r.join('  '));
console.log(`RESULT pass=${results.filter(r => r[0] === 'PASS').length} fail=${results.filter(r => r[0] === 'FAIL').length}`);
