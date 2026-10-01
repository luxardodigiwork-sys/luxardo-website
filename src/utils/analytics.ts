const GA4_ID = import.meta.env.VITE_GA4_ID || "";
const META_PIXEL_ID = import.meta.env.VITE_META_PIXEL_ID || "";

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
    fbq?: (...args: any[]) => void;
  }
}

let initialized = false;

export function initAnalytics(): void {
  if (initialized) return;
  initialized = true;
  
  if (GA4_ID) {
    const s1 = document.createElement("script");
    s1.async = true;
    s1.src = "https://www.googletagmanager.com/gtag/js?id=" + GA4_ID;
    document.head.appendChild(s1);
    
    window.dataLayer = window.dataLayer || [];
    window.gtag = function() { window.dataLayer!.push(arguments); };
    (window as any).gtag("js", new Date());
    (window as any).gtag("config", GA4_ID, { send_page_view: true });
    console.log("[Analytics] GA4 initialized:", GA4_ID);
  }
  
  if (META_PIXEL_ID) {
    (function(f: any, b, e, v, n: any, t: any, s: any) {
      if (f.fbq) return; n = f.fbq = function() {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0";
      n.queue = []; t = b.createElement(e); t.async = !0;
      t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js", null, null, null);
    (window as any).fbq("init", META_PIXEL_ID);
    (window as any).fbq("track", "PageView");
    console.log("[Analytics] Meta Pixel initialized:", META_PIXEL_ID);
  }
  
  if (!GA4_ID && !META_PIXEL_ID) {
    console.log("[Analytics] No IDs configured. Add VITE_GA4_ID and VITE_META_PIXEL_ID to .env.local");
  }
}

export function trackPageView(path: string): void {
  if (window.gtag && GA4_ID) {
    window.gtag("event", "page_view", { page_path: path });
  }
  if (window.fbq && META_PIXEL_ID) {
    window.fbq("track", "PageView");
  }
}

export function trackPurchase(orderId: string, value: number, currency = "INR"): void {
  if (window.gtag && GA4_ID) {
    window.gtag("event", "purchase", { transaction_id: orderId, value, currency });
  }
  if (window.fbq && META_PIXEL_ID) {
    window.fbq("track", "Purchase", { value, currency });
  }
}

export function trackAddToCart(productId: string, price: number): void {
  if (window.gtag && GA4_ID) {
    window.gtag("event", "add_to_cart", { items: [{ item_id: productId, price }] });
  }
  if (window.fbq && META_PIXEL_ID) {
    window.fbq("track", "AddToCart", { content_ids: [productId], value: price, currency: "INR" });
  }
}
