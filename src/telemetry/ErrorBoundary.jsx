import { Component } from 'react';
import { reportError } from './index.js';

// Generic top-level React error boundary: reports a render crash to telemetry
// (carrying the current baker/customer context) and shows a fallback instead of
// white-screening the whole app. Distinct from canvas/TextureErrorBoundary, which
// deliberately renders null for a single bad texture deep inside the R3F tree.
//
// Props: { screen?, fallback?, children }. `fallback` may be a node or a
// ({ error, reset }) => node render-prop. Omit it for the default card.
export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error, info) {
    reportError(error, {
      screen: this.props.screen || 'ErrorBoundary',
      action: 'render',
      extra: { componentStack: info?.componentStack },
    });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    const { fallback } = this.props;
    if (typeof fallback === 'function') return fallback({ error: this.state.error, reset: this.reset });
    if (fallback !== undefined) return fallback;
    return <DefaultFallback onReset={this.reset} />;
  }
}

// White/grey neutral fallback (brand colour is not pink). Compact + mobile-safe.
function DefaultFallback({ onReset }) {
  return (
    <div role="alert" style={{ padding: '1.5rem', textAlign: 'center', font: '14px system-ui, sans-serif', color: '#444' }}>
      <p style={{ margin: '0 0 12px' }}>Something went wrong.</p>
      <button
        onClick={onReset}
        style={{ padding: '8px 16px', border: '1px solid #ccc', borderRadius: 8, background: '#fff', color: '#222', cursor: 'pointer' }}
      >
        Try again
      </button>
    </div>
  );
}
