/**
 * Google Analytics 4 + Meta Pixel.
 *
 * IDs come from src/config/site.ts (committed), so tracking can't disappear
 * when the site is built somewhere else.
 *
 * Page views: both tools record the first load, and both follow in-app page
 * changes on their own (GA4 "enhanced measurement" and the Pixel's
 * history tracking), so we don't send page views by hand — doing so would
 * count every page twice.
 *
 * Shop events (what ads optimise on): view_item / ViewContent,
 * add_to_cart / AddToCart, begin_checkout / InitiateCheckout,
 * purchase / Purchase. Purchase carries the order id as the Pixel eventID so
 * a future server-side (Conversions API) event can be de-duplicated.
 */
import { SITE } from "../config/site";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

export type TrackItem = {
  id: string;
  name?: string;
  price: number;
  quantity?: number;
  size?: string;
  category?: string;
};

let initialized = false;

export function initAnalytics(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  if (SITE.ga4Id) {
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + SITE.ga4Id;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer!.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", SITE.ga4Id);
  }

  if (SITE.metaPixelId && !window.fbq) {
    const n: any = function (...args: any[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
    };
    window.fbq = n;
    if (!window._fbq) window._fbq = n;
    n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
    const t = document.createElement("script");
    t.async = true;
    t.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(t);
    window.fbq("init", SITE.metaPixelId);
    window.fbq("track", "PageView");
  }
}

/* Tracking must never break shopping: every call is wrapped. */
function safe(fn: () => void) {
  try { fn(); } catch (e) { console.warn("[analytics]", e); }
}

const gaItems = (items: TrackItem[]) =>
  items.map((i) => ({
    item_id: i.id,
    item_name: i.name,
    item_variant: i.size,
    item_category: i.category,
    price: i.price,
    quantity: i.quantity ?? 1,
  }));

const total = (items: TrackItem[]) =>
  items.reduce((s, i) => s + i.price * (i.quantity ?? 1), 0);

export function trackViewItem(item: TrackItem): void {
  safe(() => {
    window.gtag?.("event", "view_item", { currency: SITE.currency, value: item.price, items: gaItems([item]) });
    window.fbq?.("track", "ViewContent", {
      content_ids: [item.id], content_name: item.name, content_type: "product",
      value: item.price, currency: SITE.currency,
    });
  });
}

export function trackAddToCart(item: TrackItem): void {
  safe(() => {
    const value = item.price * (item.quantity ?? 1);
    window.gtag?.("event", "add_to_cart", { currency: SITE.currency, value, items: gaItems([item]) });
    window.fbq?.("track", "AddToCart", {
      content_ids: [item.id], content_name: item.name, content_type: "product",
      value, currency: SITE.currency,
    });
  });
}

export function trackBeginCheckout(items: TrackItem[]): void {
  safe(() => {
    const value = total(items);
    window.gtag?.("event", "begin_checkout", { currency: SITE.currency, value, items: gaItems(items) });
    window.fbq?.("track", "InitiateCheckout", {
      content_ids: items.map((i) => i.id), content_type: "product",
      num_items: items.reduce((s, i) => s + (i.quantity ?? 1), 0),
      value, currency: SITE.currency,
    });
  });
}

/** Call once per order — repeat calls for the same id are ignored. */
export function trackPurchase(orderId: string, value: number, items: TrackItem[], paymentMethod?: string): void {
  safe(() => {
    const key = "lx_tracked_purchase_" + orderId;
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch {}
    window.gtag?.("event", "purchase", {
      transaction_id: orderId, currency: SITE.currency, value,
      payment_type: paymentMethod, items: gaItems(items),
    });
    window.fbq?.("track", "Purchase", {
      content_ids: items.map((i) => i.id), content_type: "product",
      num_items: items.reduce((s, i) => s + (i.quantity ?? 1), 0),
      value, currency: SITE.currency,
    }, { eventID: orderId });
  });
}
