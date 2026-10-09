import { SITE } from "../config/site";

const SENTRY_DSN = SITE.sentryDsn;

export async function initSentry(): Promise<void> {
  // Off unless a DSN is set in src/config/site.ts. Loaded on demand so the
  // library (with session replay) never weighs down the shop when unused.
  if (!SENTRY_DSN) return;
  const Sentry = await import("@sentry/react");
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event) {
      const h = window.location.hostname;
      if (h === "localhost" || h === "127.0.0.1") return null; // don't report local testing
      return event;
    },
  });
}
