// End-to-end check of the website's Firestore-backed content and forms, against the LOCAL Firestore emulator + the real firestore.rules.
// Never touches production. Needs playwright-core and a Chromium (set CHROMIUM_PATH). How to run:
//   1) VITE_FIREBASE_EMULATOR=true VITE_FIREBASE_PROJECT_ID=demo-lux VITE_FIREBASE_API_KEY=AIza<35 chars> VITE_FIREBASE_AUTH_DOMAIN=demo-lux.firebaseapp.com \
//      VITE_FIREBASE_STORAGE_BUCKET=demo-lux.appspot.com VITE_FIREBASE_MESSAGING_SENDER_ID=1 VITE_FIREBASE_APP_ID=1:1:web:a npx vite build --mode e2e --outDir /tmp/dist-e2e
//   2) npx vite preview --outDir /tmp/dist-e2e --port 4178 &
//   3) npx firebase emulators:exec --config firebase.rules-test.json --only firestore --project demo-lux "node --import tsx tests/e2e/content.mjs"
// Checks: published site content + collections reach visitors; contact form and newsletter write to Firestore;
// anonymous visitors cannot read the inbox or write site content.
import { DEFAULT_SITE_CONTENT } from '../../src/constants/homeContent.ts';
import { chromium } from 'playwright-core';
const B = process.env.BASE_URL || 'http://127.0.0.1:4178', FS = 'http://127.0.0.1:8080/v1/projects/demo-lux/databases/(default)/documents';
const SITE = JSON.stringify({ ...DEFAULT_SITE_CONTENT, footer: { ...(DEFAULT_SITE_CONTENT.footer || {}), copyrightText: 'E2E COPYRIGHT 12345' } });
const admin = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
const noModal = (p) => p.evaluate(() => document.querySelectorAll('.fixed.inset-0').forEach(e => { if (/z-\[100\]/.test(e.className)) e.remove(); }));
const out = []; const log = (...a) => out.push(a.join(' '));
async function put(path, fields) { const r = await fetch(`${FS}/${path}`, { method: 'PATCH', headers: admin, body: JSON.stringify({ fields }) }); if (!r.ok) throw new Error('seed ' + path + ' ' + r.status); }
async function list(coll) { const r = await fetch(`${FS}/${coll}`, { headers: admin }); const j = await r.json(); return j.documents || []; }
const str = (v) => ({ stringValue: v });
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
try {
  // seed published content as an admin would (siteContent + collections)
  await put('siteContent/main', { json: str(SITE), updatedAt: str('now') });
  await put('collections/e2e-fabric', { id: str('e2e-fabric'), name: str('E2E Fabric'), slug: str('e2e-fabric'), shortDescription: str('d'), longDescription: str('l'), bannerImageUrl: str('/placeholder.svg'), heroImageUrl: str(''), isVisible: { booleanValue: true }, sortOrder: { integerValue: '1' } });
  await put('siteContent/collectionsMeta', { initialized: { booleanValue: true } });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('LUXARDO FASHION_first_visit_completed', 'true'); localStorage.setItem('LUXARDO FASHION_country', 'IN'); } catch {} });
  const p = await ctx.newPage();
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(6000); await noModal(p);
  const text = await p.locator('body').innerText();
  log('visitor sees Firestore site content (footer text):', text.includes('E2E COPYRIGHT 12345'));
  await p.locator('header >> text=COLLECTIONS').first().hover(); await p.waitForTimeout(1200);
  log('visitor nav (Collections menu) lists the published collection:', (await p.locator('body').innerText()).includes('E2E Fabric'));
  // contact form -> Firestore
  await p.goto(B + '/contact', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(3500); await noModal(p);
  await p.fill('input[name=firstName]', 'Asha'); await p.fill('input[name=lastName]', 'Test');
  await p.fill('input[name=email]', 'Asha@Example.com');
  const subj = p.locator('[name=subject]'); if (await subj.count()) { const tag = await subj.first().evaluate(e => e.tagName); if (tag === 'SELECT') await subj.first().selectOption({ index: 1 }); else await subj.first().fill('Order question'); }
  await p.fill('textarea[name=message]', 'Hello, I want to ask about fabric.');
  await p.getByRole('button', { name: /send|submit/i }).first().click(); await p.waitForTimeout(2500);
  log('contact: success screen shown:', (await p.getByText('Message Sent').count()) === 1);
  const docs = await list('contactMessages');
  log('contact: documents in Firestore:', docs.length, '| email stored lower-case:', docs[0]?.fields?.email?.stringValue, '| status:', docs[0]?.fields?.status?.stringValue);
  // newsletter in footer
  await p.goto(B + '/', { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(4500); await noModal(p);
  await p.fill('input[aria-label="Email address for newsletter"]', 'News@Shop.in'); await p.locator('button[aria-label=Subscribe]').click(); await p.waitForTimeout(1500);
  log('newsletter: thanks shown:', (await p.getByText('Thank you for subscribing.').count()) === 1);
  const subs = await list('newsletterSubscribers');
  log('newsletter: doc ids:', subs.map(d => d.name.split('/').pop()).join(','));
  await p.fill('input[aria-label="Email address for newsletter"]', 'news@shop.in'); await p.waitForTimeout(5200); await p.locator('button[aria-label=Subscribe]').click(); await p.waitForTimeout(1500);
  log('newsletter: repeat is accepted quietly:', (await p.getByText('Thank you for subscribing.').count()) === 1, '| still one doc:', (await list('newsletterSubscribers')).length === 1);
  // privacy: unauthenticated read of the inbox must be refused by the rules
  const anon = await fetch(`${FS}/contactMessages`);
  log('anonymous read of contactMessages ->', anon.status);
  const anonWrite = await fetch(`${FS}/siteContent/main`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fields: { json: str('{}') } }) });
  log('anonymous write of siteContent ->', anonWrite.status);
} catch (e) { log('ERROR:', String(e.message).split('\n').slice(0,4).join(' / ').slice(0, 300)); }
finally { await b.close(); console.log(out.join('\n')); }
