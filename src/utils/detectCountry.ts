import { SUPPORTED_COUNTRY_CODES } from '../countries';

const CACHE_KEY = 'luxardo_detected_country';

// Rough fallback when the IP lookup is blocked/offline: guess from the browser timezone.
const TIMEZONE_HINTS: Record<string, string> = {
  'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN',
  'Asia/Dubai': 'AE',
  'Europe/London': 'GB',
  'Asia/Singapore': 'SG',
  'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Edmonton': 'CA', 'America/Winnipeg': 'CA', 'America/Halifax': 'CA',
  'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU', 'Australia/Perth': 'AU', 'Australia/Adelaide': 'AU',
};

function fromTimezone(): string | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TIMEZONE_HINTS[tz]) return TIMEZONE_HINTS[tz];
    if (tz?.startsWith('America/')) return 'US';
  } catch { /* ignore */ }
  return null;
}

/**
 * Returns the visitor's ISO country code (e.g. "IN") detected from their IP,
 * falling back to timezone. Returns null if nothing could be detected.
 * The result is cached for the browser session.
 */
export async function detectCountryCode(): Promise<string | null> {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) return cached;
  } catch { /* ignore */ }

  let code: string | null = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (typeof data?.country_code === 'string') code = data.country_code.toUpperCase();
    }
  } catch { /* blocked or offline - use fallback */ }

  if (!code) code = fromTimezone();
  if (code) {
    try { sessionStorage.setItem(CACHE_KEY, code); } catch { /* ignore */ }
  }
  return code;
}

export function isSupportedCountryCode(code: string | null | undefined): boolean {
  return !!code && (SUPPORTED_COUNTRY_CODES as readonly string[]).includes(code);
}
