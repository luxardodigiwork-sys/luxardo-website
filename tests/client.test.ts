// Client-side gating + catalogue state logic (pure functions, no Firebase).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as gateNs from '../src/utils/checkoutGate';
import * as catNs from '../src/utils/catalogueState';
import { readFileSync } from 'node:fs';

const gate: typeof gateNs = (gateNs as any).default ?? gateNs;
const cat: typeof catNs = (catNs as any).default ?? catNs;

// ---------- checkout authentication ----------
test('checkout gate: loading until auth resolves (no flash of checkout)', () => {
  assert.equal(gate.getCheckoutGate({ isAuthReady: false, firebaseUser: null }), 'loading');
  assert.equal(gate.getCheckoutGate({ isAuthReady: false, firebaseUser: { isAnonymous: false, phoneNumber: '+919876543210' } }), 'loading');
});
test('checkout gate: guest, anonymous and phone-less sessions are sent to login (expired session = null user)', () => {
  assert.equal(gate.getCheckoutGate({ isAuthReady: true, firebaseUser: null }), 'login');
  assert.equal(gate.getCheckoutGate({ isAuthReady: true, firebaseUser: { isAnonymous: true, phoneNumber: null } }), 'login');
  assert.equal(gate.getCheckoutGate({ isAuthReady: true, firebaseUser: { isAnonymous: false, phoneNumber: null } }), 'login');
});
test('checkout gate: phone-verified user proceeds', () => {
  assert.equal(gate.getCheckoutGate({ isAuthReady: true, firebaseUser: { isAnonymous: false, phoneNumber: '+919876543210' } }), 'ok');
});
test('auth failures from the backend (expired/invalid session) are detected; others are not', () => {
  assert.equal(gate.isAuthFailure({ code: 'functions/unauthenticated' }), true);
  assert.equal(gate.isAuthFailure({ code: 'auth/user-token-expired' }), true);
  assert.equal(gate.isAuthFailure({ code: 'functions/failed-precondition' }), false);
  assert.equal(gate.isAuthFailure(new Error('x')), false);
  assert.equal(gate.isAuthFailure(null), false);
});
test('payment error messages are customer-safe', () => {
  assert.match(gate.paymentErrorMessage({ code: 'functions/internal', message: 'stack trace secret' }), /Something went wrong/);
  assert.equal(gate.paymentErrorMessage({ code: 'functions/failed-precondition', message: 'Only 2 of "X" left in stock.' }), 'Only 2 of "X" left in stock.');
  assert.doesNotMatch(gate.paymentErrorMessage({ code: 'functions/internal', message: 'stack trace secret' }), /secret/);
});

// ---------- real-products-only catalogue ----------
const product = (o: object = {}) => ({ id: 'p', name: 'P', price: 100, category: 'c', image: '', description: '', ...o }) as any;
test('catalogue states: loading, error, empty ("coming soon"), ready', () => {
  assert.equal(cat.getCatalogueState({ isLoaded: false, error: null, products: [] }), 'loading');
  assert.equal(cat.getCatalogueState({ isLoaded: true, error: new Error('x'), products: [] }), 'error');
  assert.equal(cat.getCatalogueState({ isLoaded: true, error: null, products: [] }), 'empty');
  assert.equal(cat.getCatalogueState({ isLoaded: true, error: null, products: [product()] }), 'ready');
  // already-loaded products stay visible if the listener later errors
  assert.equal(cat.getCatalogueState({ isLoaded: true, error: new Error('x'), products: [product()] }), 'ready');
});
test('storefront hides hidden and invalid-price products; only in-stock products are purchasable', () => {
  const list = cat.getStorefrontProducts([product({ id: 'a' }), product({ id: 'b', visibility: 'hidden' }), product({ id: 'c', price: -1 }), product({ id: 'd', price: 'x' as any })]);
  assert.deepEqual(list.map((p: any) => p.id), ['a']);
  assert.equal(cat.isPurchasable({ stock: 3 }), true);
  assert.equal(cat.isPurchasable({ stock: 0 }), false);
  assert.equal(cat.isPurchasable({}), false); // unknown stock is never treated as available
});
test('placeholder catalogue is gone: no PRODUCTS export, no seed fallback or import path', () => {
  const constants = readFileSync(new URL('../src/constants.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(constants, /export const PRODUCTS/);
  assert.doesNotMatch(constants, /generateProducts/);
  const store = readFileSync(new URL('../src/utils/productStore.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(store, /SEED|importCatalogue|PRODUCTS/);
  const ls = readFileSync(new URL('../src/utils/localStorage.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(ls, /PRODUCTS\b.*from '\.\.\/constants'/);
});
test('checkout UI has no COD path and never sends prices', () => {
  const page = readFileSync(new URL('../src/pages/CheckoutPage.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /Cash on Delivery|COD|signInAnonymously|addDoc/);
  const pay = readFileSync(new URL('../src/utils/payments.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(pay, /unitPrice|totalAmount|price:/);
});

// ---------- INR-only display ----------
import * as curNs from '../src/utils/currency';
import * as countriesNs from '../src/countries';
import * as constantsNs from '../src/constants';
const cur: typeof curNs = (curNs as any).default ?? curNs;
const countries: typeof countriesNs = (countriesNs as any).default ?? countriesNs;
const constants: typeof constantsNs = (constantsNs as any).default ?? constantsNs;

test('money is always formatted as INR: no conversion, no stored-currency dependence, no "MRP" tax wording', () => {
  (globalThis as any).localStorage = { getItem: () => 'USD', setItem() {}, removeItem() {} }; // a stale non-INR preference must be ignored
  assert.equal(cur.formatCurrency(1999), '₹1,999');
  assert.equal(cur.formatINR(25000), '₹25,000');
  assert.equal(cur.formatCurrency(2500.5), '₹2,500.50');
  assert.equal(cur.formatCurrency(2500.5), cur.formatINR(2500.5));
  assert.doesNotMatch(cur.formatCurrency(100), /MRP|\$|USD|€|£/);
  assert.equal(cur.formatINR(NaN as any), '₹0');
  delete (globalThis as any).localStorage;
});
test('every country is INR with rate 1 (no exchange-rate tables remain)', () => {
  for (const c of [...countries.ALL_COUNTRIES, ...constants.COUNTRIES]) {
    assert.deepEqual([c.currency.code, c.currency.rate], ['INR', 1], c.name);
  }
  const src = readFileSync(new URL('../src/countries.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /rate:\s*0\.\d+|specificData/);
});

// ---------- configuration consistency ----------
test('Functions region is identical in the backend and the client', () => {
  const be = /export const REGION = "([a-z0-9-]+)"/.exec(readFileSync(new URL('../functions/src/index.ts', import.meta.url), 'utf8'))?.[1];
  const fe = /FUNCTIONS_REGION = "([a-z0-9-]+)"/.exec(readFileSync(new URL('../src/firebase.ts', import.meta.url), 'utf8'))?.[1];
  assert.equal(be, 'asia-south1');
  assert.equal(fe, be);
  const idx = readFileSync(new URL('../functions/src/index.ts', import.meta.url), 'utf8');
  // every deployed function must use the shared constant, never a hardcoded region
  assert.equal((idx.match(/region: REGION/g) || []).length, (idx.match(/\b(onCall|onRequest|onSchedule)\(/g) || []).length);
  assert.doesNotMatch(idx, /region:\s*["']/);
});

// ---------- Prime payments disabled ----------
test('Prime checkout cannot start a payment from the UI, and has no backend', () => {
  const stripComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const page = stripComments(readFileSync(new URL('../src/pages/PrimeMembershipCheckoutPage.tsx', import.meta.url), 'utf8'));
  assert.doesNotMatch(page, /fetch\(|\/api\/payment|razorpay|checkout\.js|httpsCallable|createCheckoutOrder|upgradeToPrime/i);
  assert.match(page, /disabled/);
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /prime-membership\/success"\s*\n\s*\/\/[^\n]*\n\s*element=\{<Navigate to="\/prime-membership"/); // no fake success page
  const fns = readFileSync(new URL('../functions/src/index.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(fns, /prime|membership/i);
  const server = readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(server, /app\.all\(\["\/api\/payment\/create-order", "\/api\/payment\/verify"\][\s\S]{0,120}410/);
  assert.doesNotMatch(server, /razorpay\.orders\.create|createHmac\("sha256", rpSettings/);
  const ctx = readFileSync(new URL('../src/context/AuthContext.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(ctx, /isPrimeMember:\s*true/); // client can never self-grant Prime
});

// ---------- tax stays unconfirmed ----------
test('no tax claims are rendered anywhere until GST pricing is confirmed', () => {
  const pricing = readFileSync(new URL('../src/constants/pricing.ts', import.meta.url), 'utf8');
  assert.match(pricing, /TAX_NOTE = ''/);
  for (const f of ['pages/ProductPage.tsx', 'pages/CartPage.tsx', 'pages/CheckoutPage.tsx', 'pages/PrimeMembershipCheckoutPage.tsx', 'pages/OrderConfirmationPage.tsx']) {
    const src = readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /Tax included|taxes calculated|Taxes<|\bMRP\b|inclusive of (all )?tax/i, f);
  }
});

// ---------- targeted launch fixes ----------
import * as trackNs from '../src/utils/trackingEvents';
import * as policiesNs from '../src/policies';
const track: typeof trackNs = (trackNs as any).default ?? trackNs;
const policies: typeof policiesNs = (policiesNs as any).default ?? policiesNs;
const read = (rel: string) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');

test('admin category options are exactly the storefront collection names (no legacy "Premium ..." names)', () => {
  assert.deepEqual(constants.COLLECTION_CATEGORIES, constants.COLLECTIONS.map((c: any) => c.fullName));
  assert.ok(constants.COLLECTION_CATEGORIES.includes('Tuxedo') && constants.COLLECTION_CATEGORIES.includes('3 Piece Suit'));
  for (const f of ['src/pages/admin/AdminAddProductPage.tsx', 'src/pages/admin/AdminEditProductPage.tsx']) {
    const src = read(f);
    assert.match(src, /categories = COLLECTION_CATEGORIES/, f);
    assert.doesNotMatch(src, /Premium (Tuxedos|Suits|Koti Kurta|Kurta Pajama|Bomber Jackets)|Kurta Editions/, f);
  }
  // storefront matching is exact, which is why the names above must match
  assert.match(read('src/pages/CollectionDetailPage.tsx'), /p\.category === collection\?\.fullName/);
});
test('new-product defaults: Ready-to-Stitch on, stock 0, no preselected category; edit never invents stock', () => {
  const add = read('src/pages/admin/AdminAddProductPage.tsx');
  assert.match(add, /readyToStitch: true/);
  assert.match(add, /\n\s+stock: 0,/);
  assert.match(add, /category: ''/);
  assert.match(add, /<select\s+required/);
  const edit = read('src/pages/admin/AdminEditProductPage.tsx');
  assert.doesNotMatch(edit, /stock[^\n]*: 10\b|\? formData\.stock : 10/);
  assert.match(edit, /readyToStitch: product\.readyToStitch \|\| false/); // existing products are not silently changed
  assert.doesNotMatch(read('src/pages/admin/AdminProductsPage.tsx'), /Unlimited/);
});
test('tracking history is built only from real order timestamps: no locations, no estimates, no invented hops', () => {
  const base = { id: 'o1', createdAt: '2026-10-11T05:30:00.000Z' } as any;
  const only = track.buildTrackingEvents(base);
  assert.deepEqual(only.map((e: any) => e.status), ['Order received']);
  const full = track.buildTrackingEvents({
    ...base, paymentStatus: 'paid', paidAt: '2026-10-11T05:35:00.000Z',
    statusHistory: [{ status: 'packed', timestamp: '2026-10-12T09:00:00.000Z', note: 'Packed by staff' }, { status: 'shipped', timestamp: '2026-10-13T09:00:00.000Z' }],
  });
  assert.deepEqual(full.map((e: any) => e.status), ['Shipped', 'Packed', 'Payment received', 'Order received']); // newest first
  assert.equal(full[1].description, 'Packed by staff');
  for (const e of full) assert.deepEqual(Object.keys(e).filter((k) => !['date', 'time', 'status', 'description'].includes(k)), []); // no "location"
  // unpaid orders never claim payment; bad timestamps are dropped, never guessed
  assert.deepEqual(track.buildTrackingEvents({ ...base, paymentStatus: 'pending', paidAt: '2026-10-11T05:35:00.000Z' }).map((e: any) => e.status), ['Order received']);
  assert.deepEqual(track.buildTrackingEvents({ id: 'x', createdAt: 'garbage' } as any), []);
});
test('no fabricated tracking data or hardcoded mock order IDs remain in customer pages', () => {
  const page = read('src/pages/TrackOrderPage.tsx') + read('src/utils/trackingEvents.ts');
  assert.doesNotMatch(page, /Mumbai|Sorting Center|Production Facility|Dispatch Facility|Out for Delivery|Estimated Delivery|generateMockTracking|setDate\(|setHours\(/);
  const acct = read('src/pages/AccountPage.tsx');
  assert.doesNotMatch(acct, /LX-8291|LX-7102|Mock tracking|trackedOrder/);
});
test('shipping copy reflects India-only delivery and free shipping; no international/customs claims', () => {
  const p = policies.SHIPPING_POLICY;
  assert.match(p, /within India only/);
  assert.match(p, /Shipping is free on orders of ₹7,499 or more/); assert.match(p, /shipping is ₹199/);
  assert.doesNotMatch(p, /International|customs|Customs|import dut|destination country|specific countries/);
  assert.doesNotMatch(read('src/pages/FAQPage.tsx'), /50 countries|internationally|globally/);
  assert.doesNotMatch(read('src/pages/HomePage.tsx'), /Global shipping/);
  assert.match(read('src/pages/HomePage.tsx'), /Free shipping on orders of ₹7,499 or more/);
});
test('no mock staff account or password is seeded into browser storage', () => {
  const ls = read('src/utils/localStorage.ts');
  assert.doesNotMatch(ls, /INITIAL_BACKEND_USERS|arjun|Arjun|password:\s*['"]/);
  assert.match(ls, /LEGACY_SEEDED_STAFF_IDS/);
});

// ---------- policy versioning ----------
import * as psNs from '../src/utils/policyStore';
import { createHash } from 'node:crypto';
const ps: typeof psNs = (psNs as any).default ?? psNs;
const memStore = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init)); const writes: string[] = [];
  return { m, writes,
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { writes.push(k); m.set(k, v); },
    removeItem: (k: string) => { m.delete(k); } };
};
const DEFAULTS = { shipping: { title: 'Shipping', content: 'NEW shipping text', secondaryNote: 'n1' }, terms: { title: 'Terms', content: 'NEW terms', secondaryNote: 'n2' } };

test('policies: reading never writes to storage, and returns the shipped defaults', () => {
  const s = memStore();
  assert.deepEqual(ps.readPolicies(DEFAULTS, s, 'v2'), DEFAULTS);
  assert.equal(s.writes.length, 0);
});
test('policies: a stale pre-versioning cache can no longer pin old text on returning visitors', () => {
  const stale = { shipping: { title: 'Shipping', content: 'OLD international shipping text', secondaryNote: 'n1' }, terms: { ...DEFAULTS.terms, content: 'OLD terms' } };
  const s = memStore({ [ps.LEGACY_POLICIES_KEY]: JSON.stringify(stale) });
  const out = ps.readPolicies(DEFAULTS, s, 'v2');
  assert.equal(out.shipping.content, 'NEW shipping text');
  assert.equal(out.terms.content, 'NEW terms');
  assert.ok(s.m.has(ps.LEGACY_POLICIES_KEY), 'legacy data is left in place, not deleted');
});
test('policies: deliberate admin edits apply only for the matching version, and only the edited fields are stored', () => {
  const s = memStore();
  const edited = { ...DEFAULTS, shipping: { ...DEFAULTS.shipping, content: 'ADMIN edit' } };
  ps.writePolicies(edited, DEFAULTS, s, 'v2');
  const stored = JSON.parse(s.m.get(ps.POLICY_OVERRIDES_KEY)!);
  assert.deepEqual(stored, { version: 'v2', overrides: { shipping: { content: 'ADMIN edit' } } });
  assert.equal(ps.readPolicies(DEFAULTS, s, 'v2').shipping.content, 'ADMIN edit');
  assert.equal(ps.readPolicies(DEFAULTS, s, 'v2').shipping.title, 'Shipping'); // untouched fields keep tracking defaults
  assert.equal(ps.readPolicies(DEFAULTS, s, 'v3').shipping.content, 'NEW shipping text'); // new release wins
  ps.writePolicies(DEFAULTS, DEFAULTS, s, 'v2'); // saving unchanged text removes the override entirely
  assert.equal(s.m.has(ps.POLICY_OVERRIDES_KEY), false);
});
test('policies: corrupt or malformed storage falls back to defaults; reset clears both keys', () => {
  for (const bad of ['{not json', 'null', '"str"', JSON.stringify({ version: 'v2', overrides: null })]) {
    assert.deepEqual(ps.readPolicies(DEFAULTS, memStore({ [ps.POLICY_OVERRIDES_KEY]: bad }), 'v2'), DEFAULTS);
  }
  const s = memStore({ [ps.POLICY_OVERRIDES_KEY]: 'x', [ps.LEGACY_POLICIES_KEY]: 'y' });
  ps.resetPolicies(s);
  assert.equal(s.m.size, 0);
});
test('policy text cannot change without bumping POLICY_VERSION', () => {
  const all = [policies.SHIPPING_POLICY, policies.RETURNS_POLICY, policies.PRIVACY_POLICY, policies.TERMS_POLICY, policies.MEMBERSHIP_TERMS];
  const hash = createHash('sha256').update(JSON.stringify(all)).digest('hex');
  // If this fails you edited a policy: bump POLICY_VERSION in src/policies.ts, then update both values here.
  assert.equal(policies.POLICY_VERSION, '2026-10-11.2');
  assert.equal(hash, '567a8f2baefaf37a2e3e3c60de201f8bc0521d0d5af766aa40b1d5e72974fb31');
  const ls = read('src/utils/localStorage.ts');
  assert.match(ls, /readPolicies\(INITIAL_POLICIES, localStorage, POLICY_VERSION\)/);
  assert.doesNotMatch(ls, /localStorage\.setItem\(KEYS\.POLICIES/);
});

// ---------- no mock customer / activity data ----------
test('no fake customers or fabricated dashboard activity are seeded or shown', () => {
  const ls = read('src/utils/localStorage.ts');
  assert.doesNotMatch(ls, /INITIAL_USERS|Rahul Sharma|Priya Patel|Amit Verma/);
  assert.match(ls, /isLegacySeededUser/); // stale seeded browsers are filtered, real users untouched
  const dash = read('src/pages/admin/AdminDashboardPage.tsx');
  assert.doesNotMatch(dash, /Alexander Wright|Midnight Blue|LX-82\d\d|mins? ago|hours? ago|Shipping policy updated/);
  assert.match(dash, /orders\.slice\(0, 5\)/);
});

// ---------- unfulfillable promises ----------
test('customer copy makes no email, Prime-handling or delivery-time promises the site cannot keep', () => {
  const ship = policies.SHIPPING_POLICY;
  assert.doesNotMatch(ship, /confirmation email|email with a tracking|expedited|Prime Member Orders|\d-\d business days|within 24 hours of order/i);
  assert.match(ship, /Delivery time depends on your location and the courier/);
  const faq = read('src/pages/FAQPage.tsx');
  assert.doesNotMatch(faq, /priority processing|2-3 business|within 24 hours\./);
  assert.doesNotMatch(read('src/pages/CheckoutPage.tsx'), /\d-\d business days/);
  assert.doesNotMatch(read('src/pages/ProductPage.tsx'), /\d-\d business days/); // the low-stock message below is unreachable while the flag is off
  const feats = read('src/constants/features.ts');
  assert.match(feats, /LOW_STOCK_ALERTS_ENABLED = false/);
  assert.match(read('src/pages/ProductPage.tsx'), /\{LOW_STOCK_ALERTS_ENABLED && \(/);
  assert.doesNotMatch(read('src/pages/PrimeMembershipSuccessPage.tsx'), /confirmation email has been sent/);
  // Prime stays disabled
  assert.match(read('src/pages/PrimeMembershipCheckoutPage.tsx'), /AVAILABLE AFTER LAUNCH/);
});

// ---------- Prime hidden until after launch ----------
import * as featNs from '../src/constants/features';
const feats: typeof featNs = (featNs as any).default ?? featNs;

test('Prime is switched off and every Prime URL is redirected away', () => {
  assert.equal(feats.PRIME_AVAILABLE, false);
  const app = read('src/App.tsx');
  assert.match(app, /PRIME_AVAILABLE \? \(/);
  for (const path of ['prime-membership/*', 'prime-dashboard', 'policies/membership-terms', 'private-client-services/*']) {
    assert.match(app, new RegExp(`path="${path.replace(/[*/]/g, (c) => '\\' + c)}" element=\\{<Navigate to="/" replace />\\}`), path);
  }
});
test('no Prime link, price, section or tab is rendered while Prime is off', () => {
  const gated = (file: string, needle: RegExp) => {
    const src = read(file);
    assert.match(src, needle, `${file}: Prime must sit behind PRIME_AVAILABLE`);
  };
  gated('src/components/Layout.tsx', /PRIME_AVAILABLE \? \[\{ name: 'PRIME MEMBER'/);
  gated('src/components/Layout.tsx', /PRIME_AVAILABLE && <li><Link to="\/prime-membership"/);
  gated('src/components/Layout.tsx', /PRIME_AVAILABLE && <li><Link to="\/policies\/membership-terms"/);
  gated('src/components/SearchOverlay.tsx', /PRIME_AVAILABLE \? \[\{ title: 'Prime Membership'/);
  gated('src/pages/HomePage.tsx', /\{PRIME_AVAILABLE && \(\n\s+<div className="p-8 md:p-20 bg-brand-black/);
  gated('src/pages/CraftsmanshipPage.tsx', /\{PRIME_AVAILABLE && \(\n\s+<Link/);
  gated('src/pages/OurStoryPage.tsx', /\{PRIME_AVAILABLE && \(\n\s+<Link to="\/prime-membership"/);
  gated('src/pages/ContactPage.tsx', /PRIME_AVAILABLE && <option value="membership">/);
  gated('src/pages/FAQPage.tsx', /PRIME_AVAILABLE \|\| c\.category !== 'Prime Member'/);
  gated('src/pages/AccountPage.tsx', /PRIME_AVAILABLE \? \[\{ id: 'membership'/);
  assert.match(read('src/pages/AccountPage.tsx'), /t === 'membership' && !PRIME_AVAILABLE/); // ?tab=membership falls back to profile
  // customer-facing legal text no longer carries Prime sections or prices (only the hidden Membership Terms document does)
  for (const doc of [policies.SHIPPING_POLICY, policies.RETURNS_POLICY, policies.PRIVACY_POLICY, policies.TERMS_POLICY]) {
    assert.doesNotMatch(doc, /Prime|1,499|membership/i);
  }
  assert.match(policies.MEMBERSHIP_TERMS, /Prime/); // kept for after launch
});

// ---------- unverified packaging claims ----------
test('unverified packaging claims are gone from live customer-facing content', () => {
  const live = ['src/pages/CartPage.tsx', 'src/pages/ProductPage.tsx', 'src/pages/FAQPage.tsx', 'src/pages/HomePage.tsx', 'src/constants/homeContent.ts'].map(read).join('\n');
  assert.doesNotMatch(live, /wax seal|acid-free|matte black|hand-signed|Signature Presentation|presentation box|premium luxury box|premium box packing|Box Packing|garment cover|Presentation Packaging|global dispatch/i);
  assert.doesNotMatch(read('src/pages/HomePage.tsx'), /Ready to wear/); // store sells Ready-to-Stitch only (AGENTS.md)
});

// ---------- password UI that cannot work ----------
test('there is no password reset / password change UI: login is phone OTP only', () => {
  const fp = read('src/pages/ForgotPasswordPage.tsx').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(fp, /<Navigate to="\/login" replace \/>/);
  assert.doesNotMatch(fp, /reset link|sent a password|useState/);
  assert.doesNotMatch(read('src/App.tsx'), /ForgotPassword|forgot-password/);
  const acct = read('src/pages/AccountPage.tsx');
  assert.doesNotMatch(acct, /Update Password|Current Password|New Password|Save Changes/);
  assert.match(read('src/pages/LoginPage.tsx'), /signInWithPhoneNumber/); // working login untouched
});

// ---------- fabricated staff metrics ----------
test('staff dashboards show no invented analytics or trend badges', () => {
  const a = read('src/pages/analysis/AnalysisDashboardPage.tsx');
  assert.doesNotMatch(a, /Math\.random|bounceRate|estimatedReach|avgSessionDuration|2m 45s|trend="[+-]/);
  assert.match(a, /newCustomersToday/);
});


// ====================== latest confirmed business rules ======================
import * as shipNs from '../src/utils/shipping';
import * as cancelNs from '../src/utils/cancellation';
import * as pricingNs from '../src/constants/pricing';
import * as serverCoreNs from '../functions/src/core';
const ship: typeof shipNs = (shipNs as any).default ?? shipNs;
const cancel: typeof cancelNs = (cancelNs as any).default ?? cancelNs;
const pricing: typeof pricingNs = (pricingNs as any).default ?? pricingNs;
const server: typeof serverCoreNs = (serverCoreNs as any).default ?? serverCoreNs;

test('free shipping from Rs 7,499, Rs 199 below: client and server constants agree', () => {
  assert.equal(pricing.FREE_SHIPPING_THRESHOLD_RUPEES, 7499);
  assert.equal(pricing.FREE_SHIPPING_THRESHOLD_RUPEES * 100, server.FREE_SHIPPING_THRESHOLD_PAISE);
  assert.equal(pricing.SHIPPING_FEE_BELOW_THRESHOLD_RUPEES, 199);
  assert.equal(server.SHIPPING_FEE_BELOW_THRESHOLD_PAISE, 19900);
  assert.equal(pricing.SHIPPING_FEE_BELOW_THRESHOLD_RUPEES! * 100, server.SHIPPING_FEE_BELOW_THRESHOLD_PAISE);
  assert.match(pricing.SHIPPING_NOTE, /₹7,499/);
});
test('shipping quote: Rs 199 below the threshold, free at exactly 7,499, float-safe', () => {
  const at = ship.getShippingQuote(7499);
  assert.deepEqual([at.free, at.shipping, at.canCheckout, at.total, at.amountToFreeShipping], [true, 0, true, 7499, 0]);
  const short = ship.getShippingQuote(7498.99);
  assert.deepEqual([short.free, short.shipping, short.canCheckout, short.total, short.amountToFreeShipping], [false, 199, true, 7697.99, 0.01]); // one paisa short
  assert.equal(ship.getShippingQuote(7499).shipping, 0);
  const below = ship.getShippingQuote(2000);
  assert.deepEqual([below.free, below.shipping, below.canCheckout, below.total, below.amountToFreeShipping], [false, 199, true, 2199, 5499]);
  assert.equal(ship.getShippingQuote(0.1 + 0.2).total, 199.3);   // no float drift
  const noFee = ship.getShippingQuote(2000, 7499, null);          // safety net if the fee were ever unset
  assert.deepEqual([noFee.shipping, noFee.canCheckout, noFee.total], [null, false, null]);
  assert.equal(ship.getShippingQuote(NaN as any).total, 199);
});
test('cart and checkout enforce the rule in the UI (server enforces it independently)', () => {
  const cart = read('src/pages/CartPage.tsx'), co = read('src/pages/CheckoutPage.tsx');
  assert.match(cart, /getShippingQuote\(cartSubtotal\)/); assert.match(cart, /CHECKOUT UNAVAILABLE/);
  assert.match(co, /getShippingQuote\(cartSubtotal\)/); assert.match(co, /disabled=\{isSubmitting \|\| !quote\.canCheckout\}/);
  assert.doesNotMatch(co + cart, /Free shipping on all orders|shipping is free on all/i);
});

test('cancellation rules: client and server implementations agree on every case', () => {
  const t0 = new Date('2026-10-11T05:30:00.000Z');
  const at = (h: number) => new Date(t0.getTime() + h * 3_600_000);
  const base = { createdAt: t0.toISOString(), paidAt: t0.toISOString() };
  const cases: [any, Date][] = [
    [{ status: 'pending', paymentStatus: 'pending', createdAt: t0.toISOString() }, at(0.1)],
    [{ ...base, status: 'processing', paymentStatus: 'paid' }, at(1)],
    [{ ...base, status: 'processing', paymentStatus: 'paid' }, at(24)],
    [{ ...base, status: 'processing', paymentStatus: 'paid' }, at(24.5)],
    [{ ...base, status: 'processing', paymentStatus: 'confirmed' }, at(2)],
    [{ ...base, status: 'packed', paymentStatus: 'paid' }, at(1)],
    [{ ...base, status: 'shipped', paymentStatus: 'paid' }, at(1)],
    [{ ...base, status: 'processing', paymentStatus: 'paid', trackingId: 'T1' }, at(1)],
    [{ ...base, status: 'cancelled', paymentStatus: 'paid' }, at(1)],
    [{ ...base, status: 'processing', paymentStatus: 'paid', cancellationRequest: { status: 'requested' } }, at(1)],
    [{ status: 'pending', paymentStatus: 'failed', createdAt: t0.toISOString() }, at(1)],
    [{ status: 'on_hold', paymentStatus: 'paid', ...base }, at(1)],
    [{ status: 'processing', paymentStatus: 'paid', paidAt: 'bad', createdAt: 'bad' }, at(1)],
  ];
  for (const [order, now] of cases) assert.deepEqual(cancel.evaluateCancellation(order, now), server.evaluateCancellation(order, now), JSON.stringify(order));
  assert.equal(cancel.CANCELLATION_WINDOW_HOURS, server.CANCELLATION_WINDOW_HOURS);
  assert.equal(server.CANCELLATION_WINDOW_HOURS, 24);
});
test('cancellation UI: customers get a request flow that never claims an automatic cancel/refund for paid orders', () => {
  const od = read('src/pages/OrderDetailsPage.tsx');
  assert.match(od, /requestOrderCancellation/); assert.match(od, /not a confirmed cancellation until we approve it/);
  assert.match(od, /paymentStatus: order\.rawPaymentStatus/); // evaluates the raw status, not the display label
  assert.doesNotMatch(od, /refund(ed)? (will be|has been) (processed|issued) automatically/i);
  const admin = read('src/pages/admin/AdminOrderDetailsPage.tsx');
  assert.match(admin, /Nothing is refunded automatically/); assert.match(admin, /needsRefund/);
  assert.match(read('functions/src/index.ts'), /export const requestCancellationFn = onCall\(\{ region: REGION \}/);
});

test('return window is 7 days; refund is a 7-day TARGET and explicitly not automatic; cancellation window is 24h', () => {
  const returns = policies.RETURNS_POLICY, terms = policies.TERMS_POLICY;
  assert.match(returns, /initiated within 7 days of delivery/);
  assert.match(returns, /we aim to issue the approved refund within 7 days/);
  assert.match(returns, /not automatic/);
  assert.match(returns, /within 24 hours of placing an order/);
  assert.match(terms, /within 24 hours of placing an order/);
  assert.doesNotMatch(returns + terms, /14 days|10-14|business days.*refund|automatically refunded|instant refund/i);
  assert.match(read('src/pages/ProductPage.tsx'), /returned within 7 days of delivery/);
  assert.doesNotMatch(read('src/pages/ProductPage.tsx'), /within 14 days/);
});

test('COD is not available anywhere a customer can place an order', () => {
  for (const f of ['src/pages/CheckoutPage.tsx', 'src/pages/CartPage.tsx', 'src/pages/OrderConfirmationPage.tsx', 'src/utils/payments.ts', 'functions/src/orders.ts', 'functions/src/index.ts']) {
    assert.doesNotMatch(read(f), /Cash on Delivery|\bCOD\b|paymentMethod:\s*['"]cod|signInAnonymously/i, f);
  }
  assert.match(read('functions/src/orders.ts'), /paymentMethod: "razorpay"/);
  assert.doesNotMatch(read('firestore.rules'), /'COD'|"cod"/);
});

test('no customer-facing promise about coupons, Navratri offers, or email/SMS notifications that do not exist', () => {
  const customer = ['src/pages/HomePage.tsx', 'src/pages/CartPage.tsx', 'src/pages/CheckoutPage.tsx', 'src/pages/ProductPage.tsx', 'src/pages/FAQPage.tsx', 'src/pages/OrderConfirmationPage.tsx', 'src/pages/OrderDetailsPage.tsx', 'src/constants/homeContent.ts', 'src/policies.ts'].map(read).join('\n');
  assert.doesNotMatch(customer, /navratri|coupon|promo ?code|voucher|discount code/i);
  assert.doesNotMatch(customer, /(sms|text message|whatsapp)[^.\n]{0,40}(will be sent|we will send|you will receive)/i);
  assert.doesNotMatch(customer, /(email|e-mail)[^.\n]{0,40}(will be sent|we will send|you will receive|has been sent)/i);
  // and there is no sender dependency that could make such a promise true
  for (const pkg of ['package.json', 'functions/package.json']) assert.doesNotMatch(read(pkg), /nodemailer|sendgrid|mailgun|twilio|msg91|@sendgrid|resend/i, pkg);
});

test('single-piece listings: the admin form tells staff to list one piece per product', () => {
  assert.match(read('src/pages/admin/AdminAddProductPage.tsx'), /List a single piece per product\. Do not create sets or bundles/);
});

// ---------- Firebase config (never hardcoded / never invalid) ----------
import * as fbNs from '../src/utils/firebaseConfig';
import * as loginNs from '../src/utils/loginFlow';
const fbc: typeof fbNs = (fbNs as any).default ?? fbNs;
const login: typeof loginNs = (loginNs as any).default ?? loginNs;
const GOOD_ENV = {
  VITE_FIREBASE_API_KEY: 'AIzaTESTKEY', VITE_FIREBASE_AUTH_DOMAIN: 'my-shop-123.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'my-shop-123', VITE_FIREBASE_STORAGE_BUCKET: 'my-shop-123.firebasestorage.app',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '123456', VITE_FIREBASE_APP_ID: '1:123456:web:abcdef01',
};
test('firebase config: complete valid env passes', () => {
  assert.deepEqual(fbc.buildFirebaseConfig(GOOD_ENV).problems, []);
});
test('firebase config: empty env, spaces, uppercase and bad bucket are rejected', () => {
  assert.ok(fbc.buildFirebaseConfig({}).problems.length >= 5);
  assert.ok(fbc.buildFirebaseConfig({ ...GOOD_ENV, VITE_FIREBASE_PROJECT_ID: 'LUXARDO FASHION-x' }).problems.some(p => /PROJECT_ID/.test(p)));
  assert.ok(fbc.buildFirebaseConfig({ ...GOOD_ENV, VITE_FIREBASE_AUTH_DOMAIN: 'A B.firebaseapp.com' }).problems.some(p => /AUTH_DOMAIN/.test(p)));
  assert.ok(fbc.buildFirebaseConfig({ ...GOOD_ENV, VITE_FIREBASE_STORAGE_BUCKET: 'bucket with space' }).problems.some(p => /BUCKET/.test(p)));
});
test('firebase config: no invalid hardcoded identifiers in src/config/deploy files', () => {
  for (const f of ['src/firebase.ts', '.firebaserc', 'firebase.json', '.github/workflows/firebase-deploy.yml', '.env.example']) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /LUXARDO FASHION-/, f);
  }
  assert.doesNotMatch(readFileSync('src/firebase.ts', 'utf8'), /AIza[0-9A-Za-z_-]{20,}/);
  assert.match(readFileSync('src/main.tsx', 'utf8'), /firebaseConfigProblems/);
});

// ---------- Google + phone login flow ----------
test('login flow: step is derived only from real auth state', () => {
  const step = (login as any).getLoginStep;
  assert.equal(step({ firebaseUser: null, hasProfile: false }), 'start');
  assert.equal(step({ firebaseUser: { isAnonymous: true, phoneNumber: null }, hasProfile: true }), 'start');
  assert.equal(step({ firebaseUser: { isAnonymous: false, phoneNumber: null }, hasProfile: true }), 'link-phone');
  assert.equal(step({ firebaseUser: { isAnonymous: false, phoneNumber: '+919876543210' }, hasProfile: false }), 'profile');
  assert.equal(step({ firebaseUser: { isAnonymous: false, phoneNumber: '+919876543210' }, hasProfile: true }), 'done');
});
test('login flow: error messages are customer-safe and never leak codes', () => {
  const m = (login as any).authErrorMessage;
  assert.match(m({ code: 'auth/popup-blocked' }), /pop-ups/);
  assert.match(m({ code: 'auth/credential-already-in-use' }), /already registered/);
  assert.match(m({ code: 'auth/weird' }), /Sign-in failed/);
  assert.doesNotMatch(m({ code: 'auth/weird' }), /auth\//);
});
test('login/account/app wiring: Google + link phone, register redirects to login', () => {
  assert.match(read('src/pages/LoginPage.tsx'), /signInWithPopup/);
  assert.match(read('src/pages/LoginPage.tsx'), /linkWithPhoneNumber/);
  assert.match(read('src/pages/AccountPage.tsx'), /linkWithPopup/);
  assert.match(read('src/App.tsx'), /path="register"[^>]*Navigate to="\/login"/);
});

// ---------- Express-only features are gated off ----------
test('express backend flag is off and every /api/ caller is gated by it', () => {
  assert.match(read('src/constants/features.ts'), /EXPRESS_BACKEND_AVAILABLE = false/);
  for (const f of ['src/components/admin/AdminLayout.tsx', 'src/App.tsx', 'src/pages/owner/OwnerDashboardPage.tsx', 'src/pages/dispatch/DispatchDashboardPage.tsx', 'src/pages/admin/AdminSettingsPage.tsx']) {
    assert.match(read(f), /EXPRESS_BACKEND_AVAILABLE/, f);
  }
  assert.match(read('src/pages/dispatch/DispatchDashboardPage.tsx').split("fetch('/api/dtdc/create-shipment'")[0].slice(-1500), /EXPRESS_BACKEND_AVAILABLE/);
});

// ---------- deploy safety ----------
test('firebase config: bucket/authDomain from another project are rejected (no half-staging/half-production)', () => {
  const bad = (k: string, v: string) => fbc.buildFirebaseConfig({ ...GOOD_ENV, [k]: v }).problems;
  assert.ok(bad('VITE_FIREBASE_STORAGE_BUCKET', 'other-prod-1.firebasestorage.app').some(p => /belong/.test(p)));
  assert.ok(bad('VITE_FIREBASE_AUTH_DOMAIN', 'other-prod-1.firebaseapp.com').some(p => /belong/.test(p)));
  assert.deepEqual(bad('VITE_FIREBASE_AUTH_DOMAIN', 'shop.example.com'), []); // custom domains allowed
});
test('deploy workflow: a push to main never deploys; production needs manual run + typed confirmation', () => {
  const w = read('.github/workflows/firebase-deploy.yml');
  assert.match(w, /workflow_dispatch/);
  assert.match(w, /DEPLOY PRODUCTION/);
  assert.match(w, /environment: production/);
  // every job that deploys is conditional; the only `channelId: live` is in the guarded production job
  const prod = w.split('  production:')[1];
  assert.match(prod, /if: github\.event_name == 'workflow_dispatch'/);
  assert.equal((w.match(/channelId: live/g) || []).length, 1);
  assert.ok(w.indexOf('channelId: live') > w.indexOf('  production:'));
  assert.doesNotMatch(w, /LUXARDO FASHION-/);
});
test('firebaserc has no default project (CLI needs an explicit --project) and only placeholders', () => {
  const rc = JSON.parse(read('.firebaserc'));
  assert.equal(rc.projects.default, undefined);
  assert.match(rc.projects.staging, /^REPLACE_WITH_/);
  assert.match(rc.projects.production, /^REPLACE_WITH_/);
  assert.doesNotMatch(read('firebase.json'), /"bucket"/);
});

// ---------- returns parity + checkout idempotency + dead admin code ----------
import * as retClientNs from '../src/utils/returns';
import * as coreRetNs from '../functions/src/core';
test('returns: client and server implementations agree on every case', () => {
  const c: any = (retClientNs as any).default ?? retClientNs;
  const sv: any = (coreRetNs as any).default ?? coreRetNs;
  const T = new Date('2026-10-11T10:00:00.000Z');
  const o = (extra: any = {}) => ({ status: 'delivered', paymentStatus: 'paid', statusHistory: [{ status: 'delivered', timestamp: T.toISOString() }], ...extra });
  const cases: Array<[any, number]> = [[o(), 0.1], [o(), 7], [o(), 7.0001], [o({ status: 'shipped' }), 1], [o({ paymentStatus: 'pending' }), 1], [o({ returnRequest: {} }), 1], [o({ statusHistory: [] }), 1]];
  for (const [order, days] of cases) {
    const now = new Date(T.getTime() + days * 86_400_000);
    assert.deepEqual(c.evaluateReturn(order, now), sv.evaluateReturn(order, now));
  }
  assert.equal(c.RETURN_WINDOW_DAYS, sv.RETURN_WINDOW_DAYS);
});
test('checkout sends a retry key; return UI and callable are wired; no dummy local admin', () => {
  assert.match(read('src/pages/CheckoutPage.tsx'), /requestIdRef/);
  assert.match(read('src/utils/payments.ts'), /requestReturnFn/);
  assert.match(read('src/pages/OrderDetailsPage.tsx'), /requestOrderReturn/);
  assert.match(read('functions/src/index.ts'), /export const requestReturnFn/);
  assert.doesNotMatch(read('src/utils/localStorage.ts'), /DUMMY_ADMIN|isAdminLoggedIn|loginAdmin/);
});

test('admin screens use create/update (no whole-document save that could overwrite stock)', () => {
  assert.doesNotMatch(read('src/utils/productStore.ts'), /async save\(/);
  for (const f of ['src/pages/admin/AdminEditProductPage.tsx', 'src/pages/admin/AdminProductsPage.tsx', 'src/pages/admin/AdminAddProductPage.tsx', 'src/utils/localStorage.ts']) {
    assert.doesNotMatch(read(f), /productStore\.save\(/, f);
  }
  assert.match(read('src/pages/admin/AdminEditProductPage.tsx'), /productStore\.update\(/);
  assert.match(read('src/utils/productStore.ts'), /increment\(stockDelta\)/);
});

test('checkout sends the total the customer saw; the server callable forwards it as expectedTotalPaise', () => {
  assert.match(read('src/pages/CheckoutPage.tsx'), /Math\.round\(quote\.total \* 100\)/);
  assert.match(read('src/utils/payments.ts'), /expectedTotalPaise/);
  assert.match(read('functions/src/index.ts'), /expectedTotalPaise:/);
  assert.match(read('functions/src/orders.ts'), /PRICE_CHANGED_MESSAGE/);
});
