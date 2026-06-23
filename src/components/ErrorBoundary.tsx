import React from 'react';

// Production hardening: a top-level React error boundary so an uncaught render
// error degrades to a recoverable fallback instead of a blank white screen.
// `onError` is a monitoring hook — wire it to Sentry/console/an endpoint in prod.
interface Props { children: React.ReactNode; onError?: (error: Error, info: React.ErrorInfo) => void }
interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Monitoring hook (do not throw): log + forward to the injected handler.
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] uncaught render error:', error, info?.componentStack);
    try { this.props.onError?.(error, info); } catch { /* never let the handler crash the boundary */ }
  }

  private reset = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div dir="rtl" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center', background: '#0b0e11', color: '#e1e2e7' }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: '#a3f95b', margin: 0 }}>حدث خطأ غير متوقع</h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', maxWidth: 360, lineHeight: 1.6 }}>
          نعتذر، حدث خطأ ما. يمكنك إعادة تحميل التطبيق للمتابعة.
          <br />
          <span dir="ltr" style={{ opacity: 0.7 }}>Something went wrong — please reload to continue.</span>
        </p>
        <button onClick={this.reset} style={{ height: 44, padding: '0 22px', borderRadius: 12, border: 'none', background: 'var(--color-primary-fixed, #a3f95b)', color: '#0c2000', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
          إعادة التحميل · Reload
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
