/**
 * LUXARDO FASHION — public site settings, in ONE place.
 *
 * Everything here is public by nature (it is visible in every visitor's
 * browser anyway), so it lives in the code instead of a hidden .env file.
 * That way every build — from any computer or from GitHub — ships the same
 * tracking, and changing one thing can't silently switch another off.
 *
 * Secrets (Razorpay secret, Resend key, admin passwords) never go here; they
 * live only in Firebase Functions secrets.
 *
 * An env var with the same name still overrides a value, for testing.
 */
export const SITE = {
  /** Google Analytics 4 measurement ID (also the Firebase measurementId). */
  ga4Id: import.meta.env.VITE_GA4_ID || "G-4B6F1EXHKT",
  /** Meta (Facebook/Instagram) Pixel ID. */
  metaPixelId: import.meta.env.VITE_META_PIXEL_ID || "1465672478130736",
  currency: "INR",
  /** Sentry error reporting (automatic bug tracker). Public key; empty = off. */
  sentryDsn: import.meta.env.VITE_SENTRY_DSN ||
    "https://551c54bafe1f3f0b2bf6ea8a56aa4bc0@o4511394718875648.ingest.us.sentry.io/4511394732769280",
} as const;
