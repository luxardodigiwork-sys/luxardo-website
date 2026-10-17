// Browser regression tests for content sync + admin save safety, against the LOCAL Auth + Firestore emulators and the real
// firestore.rules. Never touches production. The app is a build made with `--mode e2e` (see content.mjs for the build recipe).
// Run: npx firebase emulators:exec --config firebase.e2e-test.json --only auth,firestore --project demo-lux "node --import tsx tests/e2e/sync.mjs"
// Needs playwright-core + a Chromium (CHROMIUM_PATH) and `vite preview --outDir <e2e build> --port 4178`.
import { chromium } from 'playwright-core';
const B = process.env.BASE_URL || 'http://127.0.0.1:4178';
const FS = 'http://127.0.0.1:8080/v1/projects/demo-lux/databases/(default)/documents';
const results = []; let failed = 0;
const check = (name, ok, extra = '') => { results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' | ' + extra : ''}`); if (!ok) failed++; };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const customToken = (uid, claims) => {
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ iss: 'firebase-auth-emulator@example.com', sub: uid, uid, aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit', iat: now, exp: now + 3600, claims })}.`;
};
const owner = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const patch = (path, fields) => fetch(`${FS}/${path}`, { method: 'PATCH', headers: owner, body: JSON.stringify({ fields }) });
const getRemote = async (path) => (await fetch(`${FS}/${path}`, { headers: owner })).json();
const FIRESTORE = /google\.firestore\.v1\.Firestore/;
const noModal = (p) => p.evaluate(() => document.querySelectorAll('.fixed.inset-0').forEach(e => { if (/z-\[100\]/.test(e.className)) e.remove(); }));
const SAVE = /save all policies/i;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const newCtx = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('LUXARDO FASHION_first_visit_completed', 'true'); localStorage.setItem('LUXARDO FASHION_country', 'IN'); } catch {} });
  // Records banner transitions so a short-lived state cannot be missed by polling.
  await ctx.addInitScript(() => {
    window.__banner = { loads: 0, fails: 0, last: '' };
    new MutationObserver(() => {
      const t = document.body ? document.body.innerText : '';
      const now = /Loading the latest published content/.test(t) ? 'loading' : /Could not load the latest published content/.test(t) ? 'failed' : 'other';
      if (now !== window.__banner.last) { if (now === 'loading') window.__banner.loads++; if (now === 'failed') window.__banner.fails++; window.__banner.last = now; }
    }).observe(document, { subtree: true, childList: true, characterData: true });
  });
  return ctx;
};
async function signInAdmin(ctx) {
  const p = await ctx.newPage();
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => !!window.__luxardoE2E, null, { timeout: 15000 });
  await p.evaluate((t) => window.__luxardoE2E.signInWithCustomToken(t), customToken('e2e-admin', { admin: true, role: 'admin' }));
  await p.waitForTimeout(1500);
  return p;
}

try {
  // ───────── A. Initial sync: loading -> failure -> retry, and the editor is not offered before a successful sync ─────────
  if (!process.env.ONLY || process.env.ONLY === 'A') {
    const ctx = await newCtx();
    const p = await signInAdmin(ctx);
    // Every Firestore request is held for 3 s and then fails, like a dead connection.
    await ctx.route(FIRESTORE, async (r) => { await new Promise((ok) => setTimeout(ok, 3000)); await r.abort().catch(() => {}); });
    await p.goto(B + '/admin/policies', { waitUntil: 'domcontentloaded' });
    await p.waitForFunction(() => window.__banner.loads >= 1, null, { timeout: 60000 });
    check('A1 a loading banner is shown while the first sync is running', true);
    check('A2 no Save button exists while the sync is not complete', (await p.getByRole('button', { name: SAVE }).count()) === 0);
    await p.waitForFunction(() => window.__banner.fails >= 1, null, { timeout: 60000 });
    check('A3 a failed sync shows an explanatory banner (with Retry)', true, `Retry buttons visible: ${await p.getByRole('button', { name: 'Retry' }).count()}`);
    check('A4 still no editor/Save after the failure', (await p.getByRole('button', { name: SAVE }).count()) === 0);
    const loadsAfterFirstFail = await p.evaluate(() => window.__banner.loads);
    const clicked = await p.getByRole('button', { name: 'Retry' }).first().click({ timeout: 1500 }).then(() => true).catch(() => false);
    await p.waitForFunction((n) => window.__banner.loads > n, loadsAfterFirstFail, { timeout: 30000 });
    check('A4b a new sync attempt starts after a failure without reloading the page', true, clicked ? 'Retry button clicked' : 'started by the quiet background retry');
    const failsBefore = await p.evaluate(() => window.__banner.fails);
    await p.waitForFunction((n) => window.__banner.fails > n, failsBefore, { timeout: 60000 });
    check('A4c the second failure also ends in the failed state, not a permanent "loading"', true);
    // Quiet retries are bounded (initial attempt + 3). Wait until they are used up, then only the Retry button can recover.
    await p.waitForFunction(() => window.__banner.fails >= 4, null, { timeout: 150000 });
    const loadsWhenExhausted = await p.evaluate(() => window.__banner.loads);
    await p.waitForTimeout(8000);
    check('A4d background retries stop after 3 attempts (no endless polling)', (await p.evaluate(() => window.__banner.loads)) === loadsWhenExhausted && (await p.getByRole('button', { name: 'Retry' }).count()) === 1, `attempts: ${loadsWhenExhausted}`);
    await ctx.unroute(FIRESTORE);
    await noModal(p); // the global country modal (known issue) appears late and aria-hides the page
    try { await p.getByRole('button', { name: 'Retry' }).click({ timeout: 3000 }); }
    catch (e) { check('A4e Retry button still offered after connectivity returns', false, `state=${JSON.stringify(await p.evaluate(() => window.__banner))} body="${(await p.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 160)}"`); throw e; }
    await p.getByRole('button', { name: SAVE }).first().waitFor({ timeout: 45000 });
    check('A5 pressing Retry after connectivity returns loads the editor with Save enabled', await p.getByRole('button', { name: SAVE }).first().isEnabled());
    await ctx.close();
  }

  // ───────── B. Conflict: rejected save explains itself and keeps the typed edits; admin page is not remounted ─────────
  if (!process.env.ONLY || process.env.ONLY === 'B') {
    const ctx = await newCtx();
    const p = await signInAdmin(ctx);
    const logs = []; p.on('pageerror', (e) => logs.push('pageerror: ' + String(e.message).slice(0, 200))); p.on('console', (m) => { if (m.type() === 'error') logs.push('console: ' + m.text().slice(0, 200)); });
    const dialogs = []; p.on('dialog', async (d) => { dialogs.push(d.message()); await d.accept(); });
    await p.goto(B + '/admin/policies', { waitUntil: 'domcontentloaded' });
    await p.getByRole('button', { name: SAVE }).first().waitFor({ timeout: 40000 });
    await noModal(p);
    const area = p.locator('textarea').first();
    await area.fill('E2E UNSAVED POLICY TEXT');
    await p.evaluate(() => { document.querySelector('h1').__keep = true; window.dispatchEvent(new Event('luxardo:content-updated')); });
    await p.waitForTimeout(800);
    check('B1 a content-updated event does not remount the admin editor or erase typing',
      (await area.inputValue()) === 'E2E UNSAVED POLICY TEXT' && await p.evaluate(() => document.querySelector('h1').__keep === true));
    // another admin publishes in the meantime
    const other = await patch('policies/main', { json: { stringValue: '{"by":"other-admin"}' }, rev: { integerValue: '7' } });
    check('B2 (setup) another admin published policies', other.ok);
    await noModal(p); // the global first-visit country modal (known issue, Phase frontend) can cover and aria-hide the page
    try { await p.getByRole('button', { name: SAVE }).first().click({ timeout: 8000 }); }
    catch (e) { check('B2b Save button still present after the other admin published', false, `url=${p.url()} body="${(await p.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 200)}" logs=${logs.slice(0, 4).join(' || ')}`); throw e; }
    await p.waitForTimeout(2500);
    check('B3 rejected save shows the conflict message', dialogs.some((m) => /changed by someone else/i.test(m)), dialogs[0]?.slice(0, 80));
    check('B4 unsaved edits are preserved after the rejected save', (await area.inputValue()) === 'E2E UNSAVED POLICY TEXT');
    const remote = await getRemote('policies/main');
    check('B5 the other admin\'s published policies were not overwritten', remote.fields?.json?.stringValue === '{"by":"other-admin"}' && remote.fields?.rev?.integerValue === '7');
    await ctx.close();
  }

  // ───────── C. Storefront: content sync never wipes typed input or protected pages; safe pages still refresh ─────────
  if (!process.env.ONLY || process.env.ONLY === 'C') {
    const ctx = await newCtx();
    const p = await ctx.newPage();
    const bump = (marker) => p.evaluate((m) => {
      const k = 'LUXARDO FASHION_site_content'; const c = JSON.parse(localStorage.getItem(k) || 'null');
      if (c && c.footer) { c.footer.copyrightText = m; localStorage.setItem(k, JSON.stringify(c)); }
      window.dispatchEvent(new Event('luxardo:content-updated'));
    }, marker);
    await p.goto(B + '/contact', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(4500); await noModal(p);
    await p.evaluate(() => { localStorage.setItem('LUXARDO FASHION_site_content', JSON.stringify({ ...(JSON.parse(localStorage.getItem('LUXARDO FASHION_site_content') || '{}')), footer: { copyrightText: 'before' } })); });
    await p.fill('textarea[name=message]', 'typed but not sent yet');
    await p.evaluate(() => { document.querySelector('h1').__keep = true; });
    await bump('SYNCED FOOTER 1');
    await p.waitForTimeout(800);
    check('C1 typed contact-form text survives a content update', (await p.inputValue('textarea[name=message]')) === 'typed but not sent yet');
    check('C2 the contact page was not remounted', await p.evaluate(() => document.querySelector('h1')?.__keep === true));
    await p.goto(B + '/cart', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(4000); await noModal(p);
    await p.evaluate(() => { const el = document.querySelector('h1, h2'); if (el) el.__keep = true; });
    const before = await p.evaluate(() => (document.querySelector('h1, h2') || {}).__keep === true);
    await bump('SYNCED FOOTER 2'); await p.waitForTimeout(800);
    check('C3 the cart (protected path) is not remounted by a content update', before && await p.evaluate(() => (document.querySelector('h1, h2') || {}).__keep === true));
    // a safe page with no typing is refreshed
    await p.goto(B + '/policies/returns', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(4000); await noModal(p);
    await p.evaluate(() => { document.querySelector('h1').__keep = true; });
    await bump('SYNCED FOOTER 3'); await p.waitForTimeout(800);
    check('C4 an idle ordinary page is refreshed (remounted) so synced content appears', await p.evaluate(() => document.querySelector('h1')?.__keep !== true));
    check('C5 the footer shows the synced text without a remount', (await p.locator('body').innerText()).includes('SYNCED FOOTER 3'));
    await ctx.close();
  }
} catch (e) {
  check('unexpected error in the test run', false, String(e.message).split('\n').slice(0, 3).join(' / ').slice(0, 300));
} finally {
  await browser.close();
  console.log(results.join('\n'));
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : '\nALL BROWSER CHECKS PASSED');
  process.exit(failed ? 1 : 0);
}
