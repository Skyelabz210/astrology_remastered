// test/producer.test.js — WP-08: validate tools/ephemeris/produce-ledger.mjs
// output against the real ledger admission gate.
//
// This is the standing-invariant test that the producer's output is actually
// admissible to the exact core (project/src/ledger/import-ledger.js), not
// merely plausible-looking JSON: every emitted entry is piped through
// validateLedgerEntry() and admitForCore() and must not throw.
//
// Runs the producer in-process (imports produceLedgerEntries() directly)
// rather than shelling out to the CLI repeatedly.
//
// Auto-discovered by test/run.js (exports run() -> [{name, ok, detail}]).

import { produceLedgerEntries, DEFAULT_BODIES } from "../tools/ephemeris/produce-ledger.mjs";
import { validateLedgerEntry, admitForCore } from "../src/ledger/import-ledger.js";

const ARCSEC_CIRCLE = 1296000;
const ARCSEC_PATTERN = /^(0|[1-9][0-9]*)$/;
const SIGNED_ARCSEC_PATTERN = /^-?(0|[1-9][0-9]*)$/;

function trap(fn) {
  try { fn(); return { threw: false, msg: "no throw" }; }
  catch (err) { return { threw: true, msg: String((err && err.message) || err) }; }
}

// Fixtures: [label, { time, lat, lng }]
const FIXTURES = [
  ["J2000 epoch (Greenwich meridian, equator)", { time: "2000-01-01T12:00:00Z", lat: 0, lng: 0 }],
  ["1994-01-11T14:30:00Z (San Antonio, TX — plan's own worked example)",
    { time: "1994-01-11T14:30:00Z", lat: 29.4241, lng: -98.4936 }],
];

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  for (const [label, opts] of FIXTURES) {
    let entries = null;
    const r = trap(() => { entries = produceLedgerEntries(opts); });
    t(`produceLedgerEntries succeeds for ${label}`, !r.threw, r.msg);
    if (r.threw) continue;

    t(`${label}: emits one entry per default body (${DEFAULT_BODIES.length})`,
      entries.length === DEFAULT_BODIES.length,
      `got ${entries.length} entries`);

    for (const entry of entries) {
      const tag = `${label} / ${entry.body}`;

      // ── admissible to the exact core, not just plausible JSON ──────
      const rv = trap(() => validateLedgerEntry(entry));
      t(`${tag}: validateLedgerEntry does not throw`, !rv.threw, rv.msg);

      const ra = trap(() => admitForCore(entry));
      t(`${tag}: admitForCore does not throw (status=${entry.certificate && entry.certificate.status})`,
        !ra.threw, ra.msg);

      // ── longitude_arcsec: decimal-integer string in [0, 1296000) ───
      const arcsecStr = entry.longitude_arcsec;
      const formatOk = typeof arcsecStr === "string" && ARCSEC_PATTERN.test(arcsecStr);
      t(`${tag}: longitude_arcsec is a decimal-integer string`, formatOk, `got ${JSON.stringify(arcsecStr)}`);
      if (formatOk) {
        const n = BigInt(arcsecStr);
        t(`${tag}: longitude_arcsec in [0, 1296000)`,
          n >= 0n && n < BigInt(ARCSEC_CIRCLE), `got ${arcsecStr}`);
      }

      // ── speed / retrograde sign consistency ─────────────────────────
      const meta = entry.meta || {};
      const speedStr = meta.speed_arcsec_per_day;
      const speedFormatOk = typeof speedStr === "string" && SIGNED_ARCSEC_PATTERN.test(speedStr);
      t(`${tag}: meta.speed_arcsec_per_day is a signed decimal-integer string`,
        speedFormatOk, `got ${JSON.stringify(speedStr)}`);
      if (speedFormatOk) {
        const speedNum = Number(speedStr);
        t(`${tag}: meta.retrograde exactly matches sign of speed_arcsec_per_day`,
          meta.retrograde === (speedNum < 0),
          `speed=${speedStr}, retrograde=${meta.retrograde}`);
      }

      // ── meta block shape ─────────────────────────────────────────────
      t(`${tag}: meta.jd_tt is a finite number`,
        typeof meta.jd_tt === "number" && Number.isFinite(meta.jd_tt), `got ${meta.jd_tt}`);
      t(`${tag}: meta.delta_t_seconds is a finite number`,
        typeof meta.delta_t_seconds === "number" && Number.isFinite(meta.delta_t_seconds), `got ${meta.delta_t_seconds}`);
    }
  }

  // ── Sun longitude sanity check at J2000 ───────────────────────────────
  // Well-known reference: apparent geocentric ecliptic longitude of the Sun
  // at 2000-01-01T12:00:00Z (J2000.0) is approximately 280.37 degrees
  // (≈ 1,009,332 arcsec). astronomy-engine should land far tighter than a
  // "few hundred arcsec" description implies, so this uses a tight ±60
  // arcsec tolerance and reports the actual value obtained.
  {
    const entries = produceLedgerEntries({ time: "2000-01-01T12:00:00Z", lat: 0, lng: 0, bodies: ["Sun"] });
    const sunArcsec = Number(entries[0].longitude_arcsec);
    const expected = 1009332; // 280.37 deg * 3600
    const diff = Math.abs(sunArcsec - expected);
    t("Sun longitude at J2000 within 60 arcsec of 280.37deg (1,009,332 arcsec)",
      diff <= 60,
      `got ${sunArcsec} arcsec (${(sunArcsec / 3600).toFixed(6)} deg), expected ~${expected} arcsec, diff ${diff} arcsec`);
  }

  // ── argument validation ────────────────────────────────────────────────
  {
    const r = trap(() => produceLedgerEntries({ time: "2000-01-01T12:00:00Z", lat: 999, lng: 0 }));
    t("rejects out-of-range lat", r.threw && r.msg.includes("lat"), r.msg);
  }
  {
    const r = trap(() => produceLedgerEntries({ time: "2000-01-01T12:00:00Z", lat: 0, lng: -999 }));
    t("rejects out-of-range lng", r.threw && r.msg.includes("lng"), r.msg);
  }
  {
    const r = trap(() => produceLedgerEntries({ time: "not-a-date", lat: 0, lng: 0 }));
    t("rejects unparseable --time", r.threw, r.msg);
  }
  {
    const r = trap(() => produceLedgerEntries({ time: "2000-01-01T12:00:00Z", lat: 0, lng: 0, bodies: ["Chiron"] }));
    t("rejects unknown body name", r.threw && r.msg.includes("Chiron"), r.msg);
  }

  return R;
}
