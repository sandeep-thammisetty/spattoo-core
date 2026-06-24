// ── Frontend error telemetry façade (vendor-neutral) ─────────────────────────
// Mirrors the backend contract (reportError / reportMessage / setContext) so both
// runtimes feel identical. spattoo-core imports NO vendor SDK — each consuming app
// (spattoo-web via @sentry/nextjs, spattoo-admin via @sentry/react) initialises its
// own SDK and injects a Sentry-backed transport via configureTelemetry(). Until
// then the default transport logs structured JSON to the console, so the library
// works with zero deps (same pattern as the API's Phase 0).
//
// A browser tab is a single user, so global context (baker_id / customer_id /
// surface) is safe to hold at module scope — unlike the server, which must scope
// per request.

let transport = consoleTransport();
let ctx = { surface: 'unknown' };

// Called once by the host app. `transport` is { capture(error, ctx), setContext?(ctx) }.
export function configureTelemetry({ transport: t, surface } = {}) {
  if (t) transport = t;
  if (surface) ctx.surface = surface;
  if (ctx.surface) safe(() => transport.setContext?.(ctx));
}

// Merge identifying context (e.g. bakerId once the designer resolves it). Every
// subsequent report carries it automatically.
export function setContext(partial = {}) {
  ctx = { ...ctx, ...partial };
  safe(() => transport.setContext?.(ctx));
}

// The one call everything funnels through.
// extra: { screen, action, severity, extra:{...} }
export function reportError(error, extra = {}) {
  safe(() => transport.capture(
    error instanceof Error ? error : new Error(String(error)),
    { ...ctx, severity: 'error', ...extra },
  ), error);
}

export function reportMessage(message, extra = {}) {
  reportError(new Error(message), { severity: 'info', ...extra });
}

// Telemetry must never throw into the caller.
function safe(fn, original) {
  try { fn(); }
  catch (e) { console.error('[telemetry] failed:', e?.message, original ? `| original: ${original?.message}` : ''); }
}

function consoleTransport() {
  return {
    capture(error, c) {
      console.error('[error]', {
        level: c.severity || 'error',
        message: error?.message || String(error),
        ...c,
        time: new Date().toISOString(),
        stack: error?.stack,
      });
    },
  };
}
