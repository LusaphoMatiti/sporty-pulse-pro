// sentry.server.config.ts (project root)
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  environment: process.env.NODE_ENV,

  // Capture 100% of errors, 10% of performance traces
  // Raise tracesSampleRate toward 1.0 once you have real traffic data
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Don't send events in development — keeps your Sentry quota clean
  enabled: process.env.NODE_ENV === "production",

  // Scrub sensitive fields before they leave the server
  beforeSend(event) {
    if (event.request?.headers) {
      delete event.request.headers["authorization"];
      delete event.request.headers["cookie"];
    }
    return event;
  },
});
