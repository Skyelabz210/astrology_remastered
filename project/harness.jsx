// harness.jsx — UI for the test battery.

const { useState: $hUseState, useEffect: $hUseEffect, useMemo: $hUseMemo } = React;

function Harness() {
  const [results, setResults] = $hUseState(null);
  const [running, setRunning] = $hUseState(false);
  const [filter, setFilter] = $hUseState("all"); // all | passing | failing
  const [runAt, setRunAt] = $hUseState(null);

  const run = () => {
    setRunning(true);
    setResults(null);
    setTimeout(() => {
      const r = runAllSuites();
      setResults(r);
      setRunAt(new Date());
      setRunning(false);
    }, 50);
  };

  $hUseEffect(() => { run(); /* auto-run on mount */ }, []);

  const totals = $hUseMemo(() => {
    if (!results) return { pass: 0, total: 0, suites: 0 };
    return {
      pass: results.reduce((s, r) => s + r.pass, 0),
      total: results.reduce((s, r) => s + r.total, 0),
      suites: results.length,
      passingSuites: results.filter(r => r.pass === r.total).length,
    };
  }, [results]);

  const filtered = $hUseMemo(() => {
    if (!results) return [];
    if (filter === "all") return results;
    if (filter === "failing") return results.filter(r => r.pass !== r.total);
    if (filter === "passing") return results.filter(r => r.pass === r.total);
    return results;
  }, [results, filter]);

  const allPassing = results && totals.pass === totals.total;

  return (
    <div className="hn">
      <header className="hn-hdr">
        <div className="hn-brand">
          <span className="hn-mark">✦</span>
          <div>
            <div className="hn-title">Resonance · Correctness Battery</div>
            <div className="hn-sub">classical astrology · cylindrical time · the shadow prime</div>
          </div>
        </div>
        <div className="hn-actions">
          <a className="hn-link" href="Resonance Spread.html">← return to app</a>
          <button className="hn-run" onClick={run} disabled={running}>
            {running ? "running…" : "rerun"}
          </button>
        </div>
      </header>

      {results && (
        <section className={`hn-summary ${allPassing ? "all-pass" : "has-fail"}`}>
          <div className="hn-summary-num">
            <span className="hn-summary-pass">{totals.pass}</span>
            <span className="hn-summary-slash">/</span>
            <span className="hn-summary-total">{totals.total}</span>
          </div>
          <div className="hn-summary-meta">
            <div>{totals.passingSuites} / {totals.suites} suites green</div>
            {runAt && <div className="hn-ran-at">ran {runAt.toLocaleTimeString()}</div>}
          </div>
          <div className="hn-summary-verdict">
            {allPassing
              ? "the substrate preserves what astrology already offers."
              : `${totals.total - totals.pass} assertion(s) need attention.`}
          </div>
        </section>
      )}

      <nav className="hn-filter">
        {["all","failing","passing"].map(k => (
          <button key={k} className={`hn-filter-btn ${filter === k ? "is-on" : ""}`} onClick={() => setFilter(k)}>
            {k}
          </button>
        ))}
      </nav>

      <main className="hn-suites">
        {!results && <div className="hn-loading">running suites…</div>}
        {filtered.map(s => (
          <SuiteCard key={s.name} suite={s} />
        ))}
      </main>
    </div>
  );
}

function SuiteCard({ suite }) {
  const allGreen = suite.pass === suite.total;
  const failures = suite.results.filter(r => r.error !== null);
  const [open, setOpen] = $hUseState(!allGreen);
  return (
    <article className={`hn-suite ${allGreen ? "is-pass" : "is-fail"}`}>
      <header className="hn-suite-head" onClick={() => setOpen(o => !o)}>
        <div className="hn-suite-l">
          <span className={`hn-pill ${allGreen ? "is-pass" : "is-fail"}`}>
            {suite.pass}/{suite.total}
          </span>
          <div>
            <div className="hn-suite-title">{suite.name}</div>
            <div className="hn-suite-sub">{suite.fixture}</div>
          </div>
        </div>
        <div className="hn-suite-toggle">{open ? "−" : "+"}</div>
      </header>
      {open && (
        <ol className="hn-tests">
          {suite.results.map((r, i) => (
            <li key={i} className={`hn-test ${r.error ? "is-fail" : "is-pass"}`}>
              <span className="hn-test-icon" aria-hidden="true">{r.error ? "✕" : "✓"}</span>
              <span className="hn-test-name">{r.name}</span>
              {r.error && <pre className="hn-test-err">{r.error}</pre>}
            </li>
          ))}
        </ol>
      )}
      {!open && failures.length > 0 && (
        <div className="hn-suite-failures">
          {failures.map((f, i) => (
            <div key={i} className="hn-suite-failure">✕ {f.name}</div>
          ))}
        </div>
      )}
    </article>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<Harness />);
