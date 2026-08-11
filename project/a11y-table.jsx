// a11y-table.jsx — WP-20 accessibility & privacy.
//
// Textual alternative to the visual zodiac-card spread / shadow-lane wheel:
// a real <table> (real <th scope="col"> headers, not a div-grid pretending
// to be one) built from the exact same computed chart object those visuals
// render from (computeNatal()'s return value — see astro.jsx). Screen
// readers get full linear access to every body's placement without having
// to parse hover-driven foil cards or an SVG wheel.
//
// Design choice (documented per the WP-20 brief): BOTH always-present-for-
// screen-readers AND toggleable-for-sighted-users, not one or the other.
// The <table> itself is always in the DOM and always in the accessibility
// tree; while collapsed it is visually hidden via the .sr-only clip-rect
// pattern (see styles.css) rather than `display:none`/`hidden`, so a screen
// reader user never has to find and press the toggle first just to reach
// data a sighted user gets "for free" from the card spread. The visible
// <button> toggle then exists for the *other* audience the brief calls
// out — low-vision, keyboard-only, or anyone who simply prefers scanning a
// dense table over the animated card grid — without permanently pushing a
// long table into every sighted user's page. `aria-expanded` on the toggle
// and the table's own visibility state stay in lockstep.
//
// Data transformation lives in src/present/a11y-table-data.js (plain JS,
// dual ES/window export) purely so it is unit-testable from Node — see
// project/test/a11y-table.test.js — the same split WP-21 drew between
// astro-core.js (testable logic) and astro.jsx (thin JSX wrapper).

function A11yChartTable({ chart, title = "Chart placements" }) {
  const [expanded, setExpanded] = React.useState(false);
  if (!chart) return null;

  const data = (typeof window !== "undefined" && window.A11yTableData) || null;
  const bodyRows = data ? data.chartToTableRows(chart) : [];
  const angleRows = data ? data.chartAngleRows(chart) : [];
  const rows = [...angleRows, ...bodyRows];
  if (rows.length === 0) return null;

  return (
    <section className="a11y-table-wrap">
      <button
        type="button"
        className="a11y-table-toggle"
        aria-expanded={expanded}
        aria-controls="a11y-chart-table"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? "Hide" : "Show"} chart as table
        <span className="a11y-table-toggle-hint">— every placement, in reading order</span>
      </button>

      <table id="a11y-chart-table" className={`a11y-table ${expanded ? "" : "sr-only"}`}>
        <caption>{title} — {rows.length} rows: body, sign, degree within sign, house, and whether retrograde.</caption>
        <thead>
          <tr>
            <th scope="col">Body</th>
            <th scope="col">Sign</th>
            <th scope="col">Degree</th>
            <th scope="col">House</th>
            <th scope="col">Retrograde</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.body + i}>
              <th scope="row">{r.body}</th>
              <td>{r.sign}</td>
              <td>{r.degree}</td>
              <td>{r.house}</td>
              <td>{r.retrograde ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

Object.assign(window, { A11yChartTable });
