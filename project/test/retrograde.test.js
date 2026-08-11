// test/retrograde.test.js — WP-10: retrograde/station tests.
//
// Three groups of assertions:
//
//   1. Station sign flips: for each of the 5 published station instants
//      (Mercury x2, Mars x2, Venus x1), sample produceLedgerEntries() at
//      -36h and +36h around the instant and assert the speed sign (and the
//      meta.retrograde flag, which produce-ledger.mjs derives from that
//      same sign — see its header comment) flips across the window, in
//      the expected direction. Cross-referenced against
//      fixtures/reference-vectors.json's independently-built `stations`
//      block (JPL Horizons daily sampling) as a second, coarser check:
//      that block's own before/after signs must agree with ours.
//
//   2. Invariant check across all 20 accuracy fixtures: meta.retrograde
//      === (speed_arcsec_per_day < 0), reusing produceLedgerEntries() at
//      each fixture instant (10 bodies x 20 points = 200 checks).
//
//   3. Sun/Moon are never retrograde at any of those 200 checks. Note:
//      produce-ledger.mjs does NOT special-case Sun/Moon out of a
//      "retrograde-eligible set" — reading the source, meta.retrograde is
//      computed identically for all 10 DEFAULT_BODIES (same central-
//      difference + sign-of-rounded-integer formula, no body-specific
//      branch). This assertion instead pins a real astronomical fact: the
//      Sun's apparent geocentric motion (Earth's orbital motion mirrored)
//      and the Moon's geocentric orbital motion around Earth never reverse
//      direction in ecliptic longitude, unlike the outer/inner planets
//      whose apparent motion is periodically overtaken by Earth's own
//      orbital motion. So this is a physics regression pin, not a
//      code-shortcut check.
//
// Auto-discovered by test/run.js (exports run() -> [{name, ok, detail}]).
// Also runnable standalone: `node test/retrograde.test.js`.

import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { produceLedgerEntries } from "../tools/ephemeris/produce-ledger.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(HERE, "fixtures", "reference-vectors.json");

const BODIES = [
  "Sun", "Moon", "Mercury", "Venus", "Mars",
  "Jupiter", "Saturn", "Uranus", "Neptune", "Pluto",
];

// Published station instants (brief-provided dates). Direction ("kind") is
// cross-checked below against the fixture's own `stations` block, whose
// bracket days are close to but not always identical to these dates (the
// fixture is a 1-day-resolution sign-change detector; these are the
// brief's own station dates) — that's expected and is exactly why the
// ±36h window, not exact-day equality, is the thing under test here.
const STATIONS = [
  { body: "Mercury", date: "2023-04-21", kind: "prograde->retrograde" },
  { body: "Mercury", date: "2023-05-15", kind: "retrograde->prograde" },
  { body: "Mars", date: "2022-10-30", kind: "prograde->retrograde" },
  { body: "Mars", date: "2023-01-12", kind: "retrograde->prograde" },
  { body: "Venus", date: "2023-07-22", kind: "prograde->retrograde" },
];

const WINDOW_HOURS = 36;

function isoAtOffsetHours(dateStr, hours) {
  const center = new Date(`${dateStr}T12:00:00Z`); // noon UTC anchor for a bare date
  return new Date(center.getTime() + hours * 3600 * 1000).toISOString();
}

function speedAndRetro(body, iso) {
  const [entry] = produceLedgerEntries({ time: iso, lat: 0, lng: 0, bodies: [body] });
  return { speed: Number(entry.meta.speed_arcsec_per_day), retrograde: entry.meta.retrograde };
}

function loadFixture() {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
}

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  const fixture = loadFixture();

  // ── 1. station sign flips within ±36h of each published instant ──────
  for (const { body, date, kind } of STATIONS) {
    const beforeIso = isoAtOffsetHours(date, -WINDOW_HOURS);
    const afterIso = isoAtOffsetHours(date, WINDOW_HOURS);
    const before = speedAndRetro(body, beforeIso);
    const after = speedAndRetro(body, afterIso);

    const expectBeforePositive = kind === "prograde->retrograde";
    const beforeOk = expectBeforePositive ? before.speed > 0 : before.speed < 0;
    const afterOk = expectBeforePositive ? after.speed < 0 : after.speed > 0;

    t(
      `${body} station ${date} (${kind}): speed sign flips within ±${WINDOW_HOURS}h`,
      beforeOk && afterOk,
      `t-${WINDOW_HOURS}h(${beforeIso})=${before.speed}″/day retro=${before.retrograde}; ` +
        `t+${WINDOW_HOURS}h(${afterIso})=${after.speed}″/day retro=${after.retrograde}`,
    );

    t(
      `${body} station ${date}: meta.retrograde flag matches speed sign at both samples`,
      before.retrograde === (before.speed < 0) && after.retrograde === (after.speed < 0),
      `before retro=${before.retrograde} speed=${before.speed}; after retro=${after.retrograde} speed=${after.speed}`,
    );

    // ── cross-check against fixture's independently-built stations block ──
    const stationBlock = fixture.stations && fixture.stations[body];
    const bracket = stationBlock && stationBlock.sign_changes
      && stationBlock.sign_changes.find((sc) => sc.kind.startsWith(kind));
    if (bracket) {
      const fixtureBeforeSign = Math.sign(bracket.delta_before_deg_per_day);
      const fixtureAfterSign = Math.sign(bracket.delta_after_deg_per_day);
      const oursBeforeSign = Math.sign(before.speed);
      const oursAfterSign = Math.sign(after.speed);
      t(
        `${body} station ${date}: direction agrees with fixture stations block (bracket ${bracket.between.join("..")})`,
        fixtureBeforeSign === oursBeforeSign && fixtureAfterSign === oursAfterSign,
        `fixture before/after signs=${fixtureBeforeSign}/${fixtureAfterSign}; ` +
          `ours before/after signs=${oursBeforeSign}/${oursAfterSign}`,
      );
    } else {
      t(`${body} station ${date}: fixture stations block has a matching bracket`, false,
        "no sign_changes entry found with matching kind prefix");
    }
  }

  // ── 2 & 3: retro-flag invariant + Sun/Moon never retrograde, over all
  //    20 accuracy fixtures (200 body/point checks) ───────────────────
  const points = fixture.points || [];
  t("fixture loads with 20 points (for invariant sweep)", points.length === 20, `got ${points.length}`);

  let invariantChecked = 0;
  let sunMoonChecked = 0;
  for (const point of points) {
    let entries;
    try {
      entries = produceLedgerEntries({ time: point.utc, lat: 0, lng: 0, bodies: BODIES });
    } catch (err) {
      t(`point ${point.id} (${point.utc}): produceLedgerEntries succeeds`, false, String(err && err.message || err));
      continue;
    }
    for (const entry of entries) {
      const speed = Number(entry.meta.speed_arcsec_per_day);
      invariantChecked += 1;
      t(
        `point ${point.id} / ${entry.body}: meta.retrograde === (speed < 0)`,
        entry.meta.retrograde === (speed < 0),
        `retrograde=${entry.meta.retrograde} speed=${speed}`,
      );
      if (entry.body === "Sun" || entry.body === "Moon") {
        sunMoonChecked += 1;
        t(
          `point ${point.id} / ${entry.body}: never retrograde`,
          entry.meta.retrograde === false,
          `retrograde=${entry.meta.retrograde} speed=${speed}`,
        );
      }
    }
  }

  t("retro-flag invariant checked across all fixtures x bodies (200 expected)",
    invariantChecked === 200, `checked ${invariantChecked}`);
  t("Sun/Moon never-retrograde checked across all fixtures (40 expected)",
    sunMoonChecked === 40, `checked ${sunMoonChecked}`);

  return R;
}

// ── standalone execution: `node test/retrograde.test.js` ──────────────
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const rows = run();
  const pass = rows.filter((r) => r.ok).length;
  for (const r of rows) {
    console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.name}${r.detail ? ` — ${r.detail}` : ""}`);
  }
  console.log(`\n  ${pass === rows.length ? "PASS" : "FAIL"}  ${pass}/${rows.length} assertions`);
  process.exit(pass === rows.length ? 0 : 1);
}
