/**
 * Lightweight client error reporter. Inert unless VITE_ERROR_REPORT_URL is set at build time
 * (point it at any HTTPS endpoint that accepts a JSON POST, e.g. a Sentry-compatible relay or a Cloud Function).
 *
 * Privacy: only the error message, a short stack, the page PATH (no query/hash) and the user agent are sent.
 * Emails, long digit runs (phones/cards/ids) and URLs' query strings are scrubbed. No user or order data is attached.
 */

export interface ErrorReport {
  message: string;
  stack: string;
  path: string;
  userAgent: string;
  time: string;
}

const MAX_REPORTS_PER_PAGE = 5;

export function scrub(text: string, max = 600): string {
  return String(text ?? '')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/\d{6,}/g, '[num]')
    .replace(/\?[^\s)'"]*/g, '?[q]')
    .slice(0, max);
}

export function buildReport(
  err: unknown,
  ctx: { path: string; userAgent: string; now: () => Date },
): ErrorReport {
  const e = err as { message?: unknown; stack?: unknown } | null;
  const message = typeof err === 'string' ? err : typeof e?.message === 'string' ? e.message : 'Unknown error';
  const stack = typeof e?.stack === 'string' ? e.stack : '';
  return {
    message: scrub(message, 300),
    stack: scrub(stack, 1200),
    path: String(ctx.path).split(/[?#]/)[0].slice(0, 200),
    userAgent: String(ctx.userAgent).slice(0, 200),
    time: ctx.now().toISOString(),
  };
}

/** Pure, testable reporter: dedupes identical errors and caps reports per page load. */
export function createReporter(opts: {
  send: (report: ErrorReport) => void;
  path: () => string;
  userAgent: string;
  now?: () => Date;
}) {
  const seen = new Set<string>();
  let count = 0;
  return function report(err: unknown): boolean {
    if (count >= MAX_REPORTS_PER_PAGE) return false;
    let built: ErrorReport;
    try {
      built = buildReport(err, { path: opts.path(), userAgent: opts.userAgent, now: opts.now ?? (() => new Date()) });
    } catch {
      return false;
    }
    const key = `${built.message}|${built.stack.slice(0, 200)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    count++;
    try {
      opts.send(built);
    } catch {
      return false;
    }
    return true;
  };
}

/** Parses a Sentry DSN (https://<publicKey>@<host>/<projectId>) into the envelope URL. Returns null if invalid. */
export function parseSentryDsn(dsn: string | undefined | null): { url: string; dsn: string } | null {
  if (!dsn) return null;
  const m = /^https:\/\/([A-Za-z0-9]+)@([A-Za-z0-9.-]+)\/(\d+)$/.exec(dsn.trim());
  if (!m) return null;
  return { url: `https://${m[2]}/api/${m[3]}/envelope/?sentry_key=${m[1]}&sentry_version=7`, dsn: dsn.trim() };
}

/** Builds a minimal Sentry envelope for one scrubbed error report (no user, cookies, headers or query strings). */
export function buildSentryEnvelope(r: ErrorReport, dsn: string, eventId: string, origin = ''): string {
  const event = {
    event_id: eventId,
    timestamp: Math.floor(new Date(r.time).getTime() / 1000),
    platform: 'javascript',
    level: 'error',
    message: r.message,
    exception: { values: [{ type: 'Error', value: r.message }] },
    request: { url: `${origin}${r.path}` },
    extra: { stack: r.stack, userAgent: r.userAgent },
    tags: { site: 'luxardo-fashion' },
  };
  return [JSON.stringify({ event_id: eventId, sent_at: r.time, dsn }), JSON.stringify({ type: 'event' }), JSON.stringify(event)].join('\n');
}

/** Wire global handlers. Safe no-op when neither a generic endpoint nor a Sentry DSN is configured. */
export function installErrorReporter(endpoint: string | undefined, sentryDsn?: string): void {
  if (typeof window === 'undefined') return;
  const sentry = parseSentryDsn(sentryDsn);
  const generic = endpoint && /^https:\/\//.test(endpoint) ? endpoint : '';
  if (!generic && !sentry) return;
  const post = (url: string, body: string) => {
    if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }));
    else void fetch(url, { method: 'POST', body, keepalive: true, mode: 'no-cors' }).catch(() => {});
  };
  const report = createReporter({
    path: () => window.location.pathname,
    userAgent: navigator.userAgent,
    send: (r) => {
      if (generic) post(generic, JSON.stringify(r));
      if (sentry) {
        const id = (crypto.randomUUID?.() ?? `${Date.now()}${Math.random()}`).replace(/[^a-f0-9]/gi, '').padEnd(32, '0').slice(0, 32);
        post(sentry.url, buildSentryEnvelope(r, sentry.dsn, id, window.location.origin));
      }
    },
  });
  window.addEventListener('error', (ev) => report(ev.error ?? ev.message));
  window.addEventListener('unhandledrejection', (ev) => report(ev.reason));
}
