/**
 * Google Analytics 4 + Meta (Facebook) Pixel, loaded ONLY after the visitor accepts cookies (India DPDP / GDPR style consent).
 * Inert unless VITE_GA_MEASUREMENT_ID (G-XXXXXXXXXX) and/or VITE_META_PIXEL_ID (digits) are set at build time.
 * Staff areas (/admin, /owner, /dispatch, /backend) are never tracked. Only product ids, names, prices and order totals are sent.
 */
export type ConsentState = 'granted' | 'denied' | null;
export type TrackEvent = 'page_view' | 'view_item' | 'add_to_cart' | 'begin_checkout' | 'purchase';
export interface TrackItem { id: string; name?: string; price?: number; quantity?: number }
export interface TrackParams { value?: number; currency?: string; items?: TrackItem[]; transactionId?: string; path?: string }

const CONSENT_KEY = 'LUXARDO_consent_v1';
const env = (k: string): string => {
  try { return String(((import.meta as any).env || {})[k] || '').trim(); } catch { return ''; }
};

export const isValidGaId = (id: string) => /^G-[A-Z0-9]{6,14}$/.test(id);
export const isValidPixelId = (id: string) => /^\d{8,20}$/.test(id);
export const isStaffPath = (path: string) => /^\/(admin|owner|dispatch|backend|analysis)(\/|$)/i.test(path);

export function configuredIds() {
  const ga = env('VITE_GA_MEASUREMENT_ID');
  const px = env('VITE_META_PIXEL_ID');
  return { ga: isValidGaId(ga) ? ga : '', pixel: isValidPixelId(px) ? px : '' };
}
export const trackingConfigured = () => { const c = configuredIds(); return !!(c.ga || c.pixel); };

export function mapToGa(event: TrackEvent, p: TrackParams) {
  if (event === 'page_view') return { name: 'page_view', data: { page_path: p.path } };
  const items = (p.items || []).map((i) => ({ item_id: i.id, item_name: i.name, price: i.price, quantity: i.quantity ?? 1 }));
  const data: Record<string, unknown> = { currency: p.currency || 'INR', value: p.value, items };
  if (event === 'purchase') data.transaction_id = p.transactionId;
  return { name: event, data };
}

export function mapToMeta(event: TrackEvent, p: TrackParams): { name: string; data?: Record<string, unknown> } | null {
  const ids = (p.items || []).map((i) => i.id);
  const base = { content_ids: ids, content_type: 'product', value: p.value, currency: p.currency || 'INR' };
  switch (event) {
    case 'page_view': return { name: 'PageView' };
    case 'view_item': return { name: 'ViewContent', data: base };
    case 'add_to_cart': return { name: 'AddToCart', data: base };
    case 'begin_checkout': return { name: 'InitiateCheckout', data: { ...base, num_items: (p.items || []).reduce((n, i) => n + (i.quantity ?? 1), 0) } };
    case 'purchase': return { name: 'Purchase', data: { ...base, num_items: (p.items || []).reduce((n, i) => n + (i.quantity ?? 1), 0) } };
    default: return null;
  }
}

export function getConsent(): ConsentState {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'granted' || v === 'denied' ? v : null;
  } catch { return null; }
}

let loaded = false;
function loadScript(src: string) {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

function loadTrackers() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  const w = window as any;
  const { ga, pixel } = configuredIds();
  if (ga) {
    w.dataLayer = w.dataLayer || [];
    w.gtag = function gtag() { w.dataLayer.push(arguments); };
    w.gtag('js', new Date());
    w.gtag('config', ga, { anonymize_ip: true, send_page_view: false });
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga)}`);
  }
  if (pixel) {
    if (!w.fbq) {
      const n: any = (w.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); });
      if (!w._fbq) w._fbq = n;
      n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
      loadScript('https://connect.facebook.net/en_US/fbevents.js');
    }
    w.fbq('init', pixel);
  }
}

/** Call once at startup: loads trackers only if the visitor already accepted. */
export function initAnalytics() {
  if (trackingConfigured() && getConsent() === 'granted') loadTrackers();
}

export function setConsent(granted: boolean) {
  try { localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied'); } catch {}
  if (granted) loadTrackers();
}

export function track(event: TrackEvent, params: TrackParams = {}) {
  try {
    if (typeof window === 'undefined' || getConsent() !== 'granted' || !trackingConfigured()) return;
    if (params.path && isStaffPath(params.path)) return;
    loadTrackers();
    const w = window as any;
    const { ga, pixel } = configuredIds();
    if (ga && w.gtag) { const g = mapToGa(event, params); w.gtag('event', g.name, g.data); }
    if (pixel && w.fbq) { const m = mapToMeta(event, params); if (m) m.data ? w.fbq('track', m.name, m.data) : w.fbq('track', m.name); }
  } catch { /* analytics must never break the shop */ }
}
