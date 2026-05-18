import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || "";

export function initSentry(): void {
  if (!SENTRY_DSN) {
    console.log("[Sentry] Not configured. Add VITE_SENTRY_DSN to .env.local");
    return;
  }
  
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    beforeSend(event) {
      if (window.location.hostname === "localhost") return null;
      return event;
    },
  });
  console.log("[Sentry] Initialized");
}
