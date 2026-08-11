// test/tzresolve.test.js — WP-18: DST-correct local-time -> UTC-instant
// resolution (project/tzresolve.js). Not under src/core/: floats/Date are
// fine here (this whole module is Date-based, by design — Intl's tz
// database is the ground truth for DST rules, not something the exact
// integer core needs to reason about).
//
// Auto-discovered by test/run.js (exports run() -> [{name, ok, detail}]).

import { resolveUtcInstant } from "../tzresolve.js";

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  // ── New York, 2021-03-14 02:30 — US spring-forward transition ──────
  // Clocks jump from 01:59:59 EST straight to 03:00:00 EDT that morning,
  // so every local time in [02:00, 03:00) that day never occurs.
  {
    const r = resolveUtcInstant({ year: 2021, month: 3, day: 14, hour: 2, minute: 30 }, "America/New_York");
    t("NY 2021-03-14 02:30 (spring-forward gap) -> kind 'nonexistent'",
      r.kind === "nonexistent", `got kind=${r.kind}, detail=${JSON.stringify(r)}`);
    if (r.kind === "nonexistent") {
      t("NY spring-forward: nearestValid has exactly 2 bracketing instants",
        Array.isArray(r.nearestValid) && r.nearestValid.length === 2,
        `got ${JSON.stringify(r.nearestValid)}`);
      t("NY spring-forward: gapMinutes is the standard 60-minute US DST jump",
        r.gapMinutes === 60, `got ${r.gapMinutes}`);
      const [before, after] = r.nearestValid.map((s) => new Date(s).getTime());
      t("NY spring-forward: nearestValid instants are ordered before < after",
        Number.isFinite(before) && Number.isFinite(after) && before < after,
        `before=${r.nearestValid[0]} after=${r.nearestValid[1]}`);
      // The two bracket UTC instants are adjacent (the binary search
      // converges to a sub-second window around the transition moment
      // itself) — what's actually ~1 hour apart is their LOCAL wall-clock
      // readings (01:59:59.xxx vs 03:00:00.000), which is the whole point
      // of a spring-forward gap: an hour of local time compressed into an
      // instant of real time. Check the local-time jump directly.
      const localHourMin = (ms) => {
        const dtf = new Intl.DateTimeFormat("en-US", {
          timeZone: "America/New_York", hourCycle: "h23", hour: "2-digit", minute: "2-digit",
        });
        const parts = {};
        for (const p of dtf.formatToParts(new Date(ms))) parts[p.type] = Number(p.value);
        return parts.hour * 60 + parts.minute;
      };
      t("NY spring-forward: local wall-clock jumps from ~01:59 to 03:00 across the bracket",
        localHourMin(before) === 119 && localHourMin(after) === 180,
        `before local=${localHourMin(before)}min after local=${localHourMin(after)}min`);
      t("NY spring-forward: the two bracket instants are themselves adjacent (sub-second) in real UTC time",
        after - before < 1000,
        `gap=${after - before}ms`);
    }
  }

  // ── New York, 2021-11-07 01:30 — US fall-back transition ───────────
  // Clocks go from 01:59:59 EDT back to 01:00:00 EST, so every local time
  // in [01:00, 02:00) that day occurs twice, 1 hour apart.
  {
    const r = resolveUtcInstant({ year: 2021, month: 11, day: 7, hour: 1, minute: 30 }, "America/New_York");
    t("NY 2021-11-07 01:30 (fall-back repeat) -> kind 'ambiguous'",
      r.kind === "ambiguous", `got kind=${r.kind}, detail=${JSON.stringify(r)}`);
    if (r.kind === "ambiguous") {
      t("NY fall-back: instants has exactly 2 distinct UTC instants",
        Array.isArray(r.instants) && r.instants.length === 2 && r.instants[0] !== r.instants[1],
        `got ${JSON.stringify(r.instants)}`);
      const [earlier, later] = r.instants.map((s) => new Date(s).getTime());
      t("NY fall-back: instants are exactly 1 hour (3,600,000 ms) apart",
        later - earlier === 3600000, `earlier=${r.instants[0]} later=${r.instants[1]} delta=${later - earlier}`);
      t("NY fall-back: instants[0] is the earlier (EDT, pre-transition) instant",
        earlier < later, `${r.instants[0]} vs ${r.instants[1]}`);
      // Cross-check against the known real-world UTC instants: EDT (-04:00)
      // occurrence is 2021-11-07T05:30:00Z, EST (-05:00) occurrence is
      // 2021-11-07T06:30:00Z.
      t("NY fall-back: earlier instant is the EDT (-04:00) occurrence, 2021-11-07T05:30:00Z",
        r.instants[0] === "2021-11-07T05:30:00.000Z", `got ${r.instants[0]}`);
      t("NY fall-back: later instant is the EST (-05:00) occurrence, 2021-11-07T06:30:00Z",
        r.instants[1] === "2021-11-07T06:30:00.000Z", `got ${r.instants[1]}`);
    }
  }

  // ── London, 1970-06-01 12:00 — permanent "British Standard Time" ───
  // Verified against Node's actual ICU tzdata (not asserted from memory):
  // the UK ran continuous summer time (+01:00, no autumn fallback) from
  // 27 Oct 1968 to 31 Oct 1971 (the "British Standard Time" experiment),
  // so 1 June 1970 noon London time is +01:00, not the +00:00 GMT that
  // would apply in an ordinary (non-experiment) year. Node/ICU's
  // Europe/London zone does encode this correctly (spot-checked directly
  // via Intl.DateTimeFormat before writing this assertion — see WP-18
  // package notes), so no substitute case was needed.
  {
    const r = resolveUtcInstant({ year: 1970, month: 6, day: 1, hour: 12, minute: 0 }, "Europe/London");
    t("London 1970-06-01 12:00 (permanent BST experiment) -> kind 'ok'",
      r.kind === "ok", `got kind=${r.kind}, detail=${JSON.stringify(r)}`);
    if (r.kind === "ok") {
      t("London 1970-06-01: offset is +01:00 (+60 min), confirming ICU models the BST experiment",
        r.offsetMinutes === 60, `got offsetMinutes=${r.offsetMinutes}`);
      t("London 1970-06-01 12:00 +01:00 -> UTC instant 1970-06-01T11:00:00Z",
        r.instant === "1970-06-01T11:00:00.000Z", `got ${r.instant}`);
    }
  }

  // ── Sydney, 2021-01-15 12:00 — southern-hemisphere summer (AEDT) ───
  // January is Australian summer, so Sydney observes daylight time
  // (+11:00), not its +10:00 standard offset.
  {
    const r = resolveUtcInstant({ year: 2021, month: 1, day: 15, hour: 12, minute: 0 }, "Australia/Sydney");
    t("Sydney 2021-01-15 12:00 (southern-hemisphere DST) -> kind 'ok'",
      r.kind === "ok", `got kind=${r.kind}, detail=${JSON.stringify(r)}`);
    if (r.kind === "ok") {
      t("Sydney 2021-01-15: offset is +11:00 (+660 min), AEDT summer time",
        r.offsetMinutes === 660, `got offsetMinutes=${r.offsetMinutes}`);
      t("Sydney 2021-01-15 12:00 +11:00 -> UTC instant 2021-01-15T01:00:00Z",
        r.instant === "2021-01-15T01:00:00.000Z", `got ${r.instant}`);
    }
  }

  // ── New York, 2021-06-15 12:00 — sanity baseline, unambiguous EDT ──
  {
    const r = resolveUtcInstant({ year: 2021, month: 6, day: 15, hour: 12, minute: 0 }, "America/New_York");
    t("NY 2021-06-15 12:00 (ordinary summer date) -> kind 'ok'",
      r.kind === "ok", `got kind=${r.kind}, detail=${JSON.stringify(r)}`);
    if (r.kind === "ok") {
      t("NY 2021-06-15: offset is -04:00 (-240 min), EDT",
        r.offsetMinutes === -240, `got offsetMinutes=${r.offsetMinutes}`);
      t("NY 2021-06-15 12:00 -04:00 -> UTC instant 2021-06-15T16:00:00Z",
        r.instant === "2021-06-15T16:00:00.000Z", `got ${r.instant}`);
    }
  }

  // ── Round-trip sanity: every 'ok' instant, reformatted in its zone, ──
  // reproduces the requested wall-clock time exactly (defensive check that
  // doesn't rely on hardcoded expected ISO strings).
  {
    const cases = [
      [{ year: 2024, month: 4, day: 1, hour: 9, minute: 15 }, "Asia/Tokyo"],
      [{ year: 2024, month: 12, day: 25, hour: 0, minute: 0 }, "America/Los_Angeles"],
      [{ year: 1999, month: 1, day: 1, hour: 0, minute: 0 }, "America/Chicago"],
    ];
    for (const [parts, tz] of cases) {
      const r = resolveUtcInstant(parts, tz);
      const ok = r.kind === "ok";
      let roundTrips = false;
      if (ok) {
        const dtf = new Intl.DateTimeFormat("en-US", {
          timeZone: tz, hourCycle: "h23",
          year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
        });
        const fp = {};
        for (const p of dtf.formatToParts(new Date(r.instant))) fp[p.type] = Number(p.value);
        roundTrips = fp.year === parts.year && fp.month === parts.month && fp.day === parts.day
          && fp.hour === parts.hour && fp.minute === parts.minute;
      }
      t(`round-trip sanity: ${JSON.stringify(parts)} in ${tz} resolves 'ok' and reformats back exactly`,
        ok && roundTrips, `got kind=${r.kind} instant=${r.instant}`);
    }
  }

  return R;
}
