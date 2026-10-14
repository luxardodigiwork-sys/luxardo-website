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

/** Wire global handlers. Safe no-op when no endpoint is configured. */
export function installErrorReporter(endpoint: string | undefined): void {
  if (!endpoint || typeof window === 'undefined') return;
  if (!/^https:\/\//.test(endpoint)) return;
  const report = createReporter({
    path: () => window.location.pathname,
    userAgent: navigator.userAgent,
    send: (r) => {
      const body = JSON.stringify(r);
      if (navigator.sendBeacon) navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain' }));
      else void fetch(endpoint, { method: 'POST', body, keepalive: true, mode: 'no-cors' }).catch(() => {});
    },
  });
  window.addEventListener('error', (ev) => report(ev.error ?? ev.message));
  window.addEventListener('unhandledrejection', (ev) => report(ev.reason));
}
