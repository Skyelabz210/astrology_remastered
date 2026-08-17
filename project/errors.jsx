// errors.jsx — WP-19: error boundary + toast/banner for visible chart-build
// failures. Replaces app.jsx's (and hcrm-app.jsx's) `try { ... } catch (e) {
// console.error(e); return null; }` pattern in the chart-builder useMemo
// hooks, which previously swallowed the error entirely — the screen just
// rendered a static "substrate failed to resolve" message with no detail
// about *why*, indistinguishable from any other failure.
//
// Two genuinely different failure modes, per the WP-19 brief:
//
//   1. A useMemo (or any plain function) THROWS during a try/catch. React
//      never sees this as a render error — nothing propagates for an error
//      boundary to catch — so the only way to surface it is an ordinary
//      settable UI state variable the catch block writes into. That's
//      `useErrorBanner()` + `<ErrorBanner>` below.
//
//   2. A component actually THROWS WHILE RENDERING (a bug in a downstream
//      presentational component, not a caught try/catch). React's
//      sanctioned mechanism for that is a class component implementing
//      `componentDidCatch`/`getDerivedStateFromError` — no hook equivalent
//      exists. That's `ErrorBoundary` below.
//
// Same file-loading convention as every other presentation `.jsx` in this
// repo (classic <script type="text/babel">, not an ES module): top-level
// declarations are published as globals via Object.assign(window, ...) at
// the bottom, consumed the same way app.jsx already consumes `Landing`,
// `computeNatal`, etc.

// ─────────────────────── 1. Render-time boundary ───────────────────────

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error(`ErrorBoundary${this.props.name ? ` (${this.props.name})` : ""} caught a render error:`, error, info);
  }
  render() {
    if (this.state.error) {
      const err = this.state.error;
      const message = (err && err.message) || String(err);
      return (
        <div className="err-boundary" role="alert">
          <div className="err-boundary-title">{this.props.title || "Something went wrong rendering this view."}</div>
          <div className="err-boundary-detail">{message}</div>
          <button
            type="button"
            className="err-boundary-reset"
            onClick={() => this.setState({ error: null })}
          >
            {this.props.resetLabel || "try again"}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─────────────────────── 2. Toast / banner mechanism ───────────────────

// useErrorBanner() — call from any function component. `pushError(err,
// context)` from a catch block; render <ErrorBanner banners={...}
// onDismiss={...} /> once, near the top of the tree, to surface it. Each
// pushed error gets its own dismissible banner; `context` (optional, e.g.
// "natal chart") is prefixed to the message so the user knows which part
// of the app failed.
function useErrorBanner() {
  const [banners, setBanners] = React.useState([]);

  const pushError = React.useCallback((err, context) => {
    const message = (err && err.message) || String(err);
    console.error(context ? `[${context}]` : "[error]", err);
    setBanners((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, message, context: context || null },
    ]);
  }, []);

  const dismiss = React.useCallback((id) => {
    setBanners((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const clear = React.useCallback(() => setBanners([]), []);

  return { banners, pushError, dismiss, clear };
}

function ErrorBanner({ banners, onDismiss }) {
  if (!banners || banners.length === 0) return null;
  return (
    <div className="err-banner-stack" role="alert" aria-live="assertive">
      {banners.map((b) => (
        <div className="err-banner" key={b.id}>
          <span className="err-banner-icon" aria-hidden="true">⚠</span>
          <span className="err-banner-text">
            {b.context ? `${b.context}: ` : ""}{b.message}
          </span>
          <button
            type="button"
            className="err-banner-dismiss"
            onClick={() => onDismiss(b.id)}
            aria-label="Dismiss error"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

Object.assign(window, { ErrorBoundary, useErrorBanner, ErrorBanner });
