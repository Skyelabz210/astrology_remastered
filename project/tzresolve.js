// tzresolve.js — WP-18: DST-correct local-time → UTC-instant resolution.
//
// Dual-environment module: `export`ed for Node (test/tzresolve.test.js
// imports it directly) and also published as `window.TzResolve` so the
// Babel-standalone `.jsx` pages (which are plain classic scripts, not ES
// modules, and cannot `import`) can call it. Load it as
// `<script type="module" src="tzresolve.js"></script>` — same pattern as
// core-shim.js — before any `.jsx` script that needs `window.TzResolve`.
//
// ─────────────────────────── The problem ───────────────────────────
//
// cities.jsx's old `off` field is a single fixed UTC-offset number per
// city (e.g. -6 for Chicago) with no DST resolution: every birth date at
// that city used the same offset, which is wrong for roughly half the
// year in any zone that observes DST. Fixing this needs a real
// local-civil-time → UTC-instant resolver, keyed by IANA zone name
// (cities.jsx's new `tz` field) and the specific birth date (since the
// DST rule depends on the date, not just the place).
//
// `Intl.DateTimeFormat(..., { timeZone }).formatToParts()` can format a
// known UTC instant *into* a zone's local wall-clock time, but there is
// no built-in inverse (local wall-clock time → UTC instant). This module
// implements that inverse via the standard "guess and correct" technique:
// guess a UTC instant, format it in the target zone, compare the result
// to the requested local time, and correct — while explicitly handling
// the two ways that inverse can fail to be a clean bijection:
//
//   · "Spring forward" — a DST transition that skips an hour (e.g. US
//     zones jump from 01:59:59 straight to 03:00:00 local). Every local
//     wall-clock value inside the skipped hour (e.g. 02:30) never
//     occurs at all → `kind: "nonexistent"`.
//   · "Fall back" — a DST transition that repeats an hour (e.g. US zones
//     go from 01:59:59 back to 01:00:00 local). Every local wall-clock
//     value inside the repeated hour occurs at TWO distinct UTC instants,
//     exactly one DST-shift apart → `kind: "ambiguous"`.
//
// ─────────────────────────── The algorithm ───────────────────────────
//
// 1. Treat the requested local parts as if they were UTC — call this
//    `wallUTC` (just `Date.UTC(y, m-1, d, h, mi, s)`). This is *not* the
//    answer, but it is a stable, deterministic anchor to probe around.
//
// 2. `offsetAt(instant, tz)` returns the UTC offset (whole minutes) that
//    `tz` is actually observing at a given *real* UTC instant, computed
//    by formatting that instant in `tz` and diffing the result (also
//    read back through `Date.UTC`) against the instant itself. Offsets
//    are rounded to the nearest minute — real-world zones only ever
//    change on minute boundaries, but the formatToParts() round-trip
//    loses sub-second precision, which without rounding manifests as
//    the offset ending up a few milliseconds off of the "true" integer
//    value near a transition and breaking exact-equality comparisons.
//
// 3. Probe `offsetAt` twice, 12 hours to either side of a first-pass
//    estimate of the real instant. DST transitions are always many
//    months apart, so a 24-hour-wide probe window is always small
//    enough to contain at most the one transition (if any) that matters
//    for resolving *this* local wall-clock time, and always large
//    enough to bracket it (transitions never shift wall-clock time by
//    anywhere close to 12 hours).
//
//    - If both probes see the same offset, this local date has no DST
//      transition nearby: reconstruct the single UTC instant from that
//      offset and return `kind: "ok"`.
//    - If the probes disagree, this local wall-clock reading sits near a
//      transition. Reconstruct BOTH candidate instants (one per probed
//      offset) and check each for self-consistency — does formatting
//      that candidate back through `tz` actually reproduce the
//      requested local wall-clock time?
//        · both self-consistent  → `kind: "ambiguous"` (fall-back case)
//        · exactly one is        → `kind: "ok"` (an edge adjacent to,
//          but not actually inside, the gap/overlap)
//        · neither is            → `kind: "nonexistent"` (spring-forward
//          gap); binary-search the exact transition instant between the
//          two probes and report the last valid instant before the gap
//          and the first valid instant after it as `nearestValid`.
//
// This is deliberately a from-scratch, dependency-free implementation
// (no Luxon/date-fns-tz) — the project has no bundler (see astro.jsx's
// note on why it duplicates rather than imports astronomy-engine logic
// across the module/classic-script boundary) and Intl's tz database
// (ICU, via Node/the browser) is the actual source of DST-transition
// truth either way.

/**
 * @typedef {Object} LocalDateTimeParts
 * @property {number} year   Full year, e.g. 2021.
 * @property {number} month  1-indexed month, 1 = January.
 * @property {number} day    Day of month, 1-indexed.
 * @property {number} hour   0-23.
 * @property {number} minute 0-59.
 * @property {number} [second] 0-59, defaults to 0.
 */

/**
 * @typedef {Object} ResolveResult
 * @property {"ok"|"nonexistent"|"ambiguous"} kind
 * @property {string} [instant]
 *   Present when `kind === "ok"`. The resolved UTC instant, ISO 8601
 *   (e.g. "2021-06-15T16:00:00.000Z").
 * @property {number} [offsetMinutes]
 *   Present when `kind === "ok"`. The zone's UTC offset in minutes at
 *   `instant` (e.g. -240 for EDT), positive east of UTC.
 * @property {string[]} [instants]
 *   Present when `kind === "ambiguous"`. Exactly two distinct UTC
 *   instants, both of which format back to the requested local
 *   wall-clock time in `tz`, sorted ascending (index 0 is the EARLIER
 *   instant — the pre-transition offset, e.g. still-DST). Per WP-18's
 *   brief, callers needing a single deterministic instant without
 *   prompting the user should default to `instants[0]` (the earlier
 *   one) and note the ambiguity; WP-19 is expected to build the actual
 *   disambiguation prompt.
 * @property {string[]} [nearestValid]
 *   Present when `kind === "nonexistent"`. Exactly two UTC instants
 *   bracketing the skipped local-time gap: `nearestValid[0]` is the
 *   last valid instant immediately BEFORE the gap (pre-transition
 *   offset), `nearestValid[1]` is the first valid instant immediately
 *   AT/AFTER the gap (post-transition offset). Callers needing a single
 *   default without prompting the user should fall back to
 *   `nearestValid[1]` (the first valid instant after the gap — i.e. the
 *   requested wall-clock time nudged forward past the skip, which is
 *   the conventional "spring forward" resolution) and note that the
 *   local time did not exist as entered.
 * @property {number} [gapMinutes]
 *   Present when `kind === "nonexistent"`. Size of the skipped interval
 *   in minutes (e.g. 60 for a standard 1-hour spring-forward).
 */

const PROBE_WINDOW_MS = 12 * 60 * 60 * 1000; // 12h either side of the first-pass estimate

const OFFSET_FORMAT_OPTS = {
  hourCycle: "h23",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
};

// formatToParts() is comparatively expensive to construct a formatter
// for; cache one per IANA zone name (this module resolves the same
// handful of zones — one per birth city — repeatedly within a session).
const _formatterCache = new Map();
function _formatterFor(tz) {
  let f = _formatterCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, ...OFFSET_FORMAT_OPTS });
    _formatterCache.set(tz, f);
  }
  return f;
}

/** Read `utcMs` (a UTC instant, as epoch milliseconds) as wall-clock parts in `tz`. */
function partsAt(utcMs, tz) {
  const parts = _formatterFor(tz).formatToParts(new Date(utcMs));
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  return {
    year: Number(map.year), month: Number(map.month), day: Number(map.day),
    hour: Number(map.hour), minute: Number(map.minute), second: Number(map.second),
  };
}

/** Wall-clock parts (as read via partsAt) → their value if taken as UTC, in ms. */
function partsAsUTCms(p) {
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

/**
 * The UTC offset (whole minutes, positive east) that `tz` is observing at
 * the real UTC instant `utcMs`. E.g. -240 for America/New_York in EDT.
 */
function offsetAt(utcMs, tz) {
  return Math.round((partsAsUTCms(partsAt(utcMs, tz)) - utcMs) / 60000);
}

/** Do the wall-clock parts read back from `utcMs` in `tz` exactly match `wanted`? */
function matchesWall(utcMs, tz, wanted) {
  const p = partsAt(utcMs, tz);
  return p.year === wanted.year && p.month === wanted.month && p.day === wanted.day
    && p.hour === wanted.hour && p.minute === wanted.minute && p.second === wanted.second;
}

/**
 * Resolve a civil (wall-clock) local date/time in a given IANA zone to the
 * UTC instant(s) it denotes.
 *
 * @param {LocalDateTimeParts} localDateTimeParts
 * @param {string} ianaTz IANA zone name, e.g. "America/New_York".
 * @returns {ResolveResult}
 */
export function resolveUtcInstant(localDateTimeParts, ianaTz) {
  const { year, month, day, hour, minute, second = 0 } = localDateTimeParts;
  const wanted = { year, month, day, hour, minute, second };
  const wallUTC = Date.UTC(year, month - 1, day, hour, minute, second);

  // First-pass estimate: assume the offset in effect *if* wallUTC were the
  // real instant, refine once (handles the common case where that first
  // guess already lands on the correct side of any transition).
  const guess1 = offsetAt(wallUTC, ianaTz);
  let cand = wallUTC - guess1 * 60000;
  const guess2 = offsetAt(cand, ianaTz);
  cand = wallUTC - guess2 * 60000;

  // Bracket a 24h window around that estimate and read the offset at each
  // edge — this is wide enough to contain any nearby transition (they are
  // always months apart) and narrow enough to contain at most one.
  const probeBefore = cand - PROBE_WINDOW_MS;
  const probeAfter = cand + PROBE_WINDOW_MS;
  const offsetBefore = offsetAt(probeBefore, ianaTz);
  const offsetAfter = offsetAt(probeAfter, ianaTz);

  if (offsetBefore === offsetAfter) {
    // No transition within reach of this local time: unique answer.
    const instant = wallUTC - offsetBefore * 60000;
    return { kind: "ok", instant: new Date(instant).toISOString(), offsetMinutes: offsetBefore };
  }

  // Near a transition. Reconstruct both candidate instants and test each
  // for self-consistency (does re-formatting it in `tz` reproduce `wanted`?).
  const candBefore = wallUTC - offsetBefore * 60000;
  const candAfter = wallUTC - offsetAfter * 60000;
  const validBefore = matchesWall(candBefore, ianaTz, wanted);
  const validAfter = matchesWall(candAfter, ianaTz, wanted);

  if (validBefore && validAfter) {
    const instants = [candBefore, candAfter].sort((a, b) => a - b).map((x) => new Date(x).toISOString());
    return { kind: "ambiguous", instants };
  }
  if (validBefore) {
    return { kind: "ok", instant: new Date(candBefore).toISOString(), offsetMinutes: offsetBefore };
  }
  if (validAfter) {
    return { kind: "ok", instant: new Date(candAfter).toISOString(), offsetMinutes: offsetAfter };
  }

  // Neither candidate is self-consistent: the requested local time falls in
  // a spring-forward gap that skips it entirely. Binary-search the exact
  // transition instant between the two (offset-disagreeing) probes to
  // report the tightest possible bracket.
  let lo = probeBefore, hi = probeAfter; // invariant: offsetAt(lo)=offsetBefore, offsetAt(hi)=offsetAfter
  while (hi - lo > 1) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (offsetAt(mid, ianaTz) === offsetBefore) lo = mid; else hi = mid;
  }
  return {
    kind: "nonexistent",
    nearestValid: [new Date(lo).toISOString(), new Date(hi).toISOString()],
    gapMinutes: offsetAfter - offsetBefore,
  };
}

if (typeof window !== "undefined") {
  window.TzResolve = { resolveUtcInstant };
}
