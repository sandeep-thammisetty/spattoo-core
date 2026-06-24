import { reportError } from './index.js';

// Catch errors that escape React boundaries — async callbacks, event handlers,
// and unhandled promise rejections. The host app calls this once at startup
// (after configureTelemetry). Idempotent and SSR-safe.
let installed = false;

export function installGlobalHandlers() {
  if (installed || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (e) => {
    reportError(e.error || new Error(e.message), { action: 'window.onerror' });
  });

  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason;
    reportError(r instanceof Error ? r : new Error(String(r)), { action: 'unhandledrejection' });
  });
}
