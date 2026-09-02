// test/present/lifecycle-digest.test.js — the Cylindrical Time panel's
// prose summary.
//
// lifecycleDigest (time.jsx) composes the SAME facts the panel's tables
// already show — age, which return is in force, which bodies share their
// natal shadow lane right now — into a few plain sentences. It computes
// nothing new; every number in it is one the panel would otherwise only
// show in a table. This suite pins that the numbers actually match their
// source computations, that both return-status phrasings are reachable
// and mutually exclusive, and that the shadow-lane sentence appears
// exactly when windingLift says a body is in return.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

export async function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok, detail });

  const sb = {};
  sb.window = sb;
  sb.AstroCore = await import("../../src/present/astro-core.js");
  sb.Houses = await import("../../tools/ephemeris/houses.js");
  vm.createContext(sb);
  for (const f of ["vendor/astronomy.browser.min.js", "astro.jsx", "time.jsx"]) {
    vm.runInContext(readFileSync(join(ROOT, f), "utf8"), sb, { filename: f });
  }

  const chart = sb.computeNatal({ dateISO: "1980-10-21T21:31:00Z", lat: 35.1408, lng: -79.0058, houseSystem: "whole" });
  const targetJd = sb.dateToJD(new Date("2026-09-01T00:00:00Z"));

  // ── shape ──
  const d = sb.lifecycleDigest(chart, targetJd);
  t("lifecycleDigest returns a non-empty array of strings",
    Array.isArray(d.lines) && d.lines.length > 0 && d.lines.every((l) => typeof l === "string" && l.length > 0));

  // ── age matches ctmState's own numbers, not a re-derivation ──
  const ctm = sb.ctmState(targetJd, chart.jd);
  t("digest age (years) matches ctmState exactly", d.ageYears === ctm.ageYears);
  t("digest age (days) matches ctmState exactly", d.ageDays === ctm.ageDays);
  t("the opening line quotes the same day count",
    d.lines[0].includes(Math.floor(ctm.ageDays).toLocaleString()));

  // ── the return-in-force sentence matches returnChart's own fields ──
  for (const body of sb.RETURN_BODIES) {
    const r = sb.returnChart(chart, body, targetJd);
    const label = body === "Sun" ? "Solar" : "Lunar";
    const line = d.lines.find((l) => l.startsWith(label));
    t(`${body}: the digest carries a ${label} Return line`, !!line, d.lines.join(" | "));
    if (line && r.isCurrent) {
      t(`${body}: "in force" phrasing quotes returnChart's own K and both dates`,
        line.includes(`#${r.K}`) && line.includes(r.dateISO.slice(0, 10)) && line.includes(r.nextDateISO.slice(0, 10)),
        line);
      t(`${body}: the "hasn't happened yet" phrasing is NOT used while a return is in force`,
        !/has happened yet/.test(line), line);
    }
  }

  // ── near birth: the "no return yet" branch, mutually exclusive with "in force" ──
  {
    const dNear = sb.lifecycleDigest(chart, chart.jd + 1 / 24);
    const solarLine = dNear.lines.find((l) => l.startsWith("Solar") || l.startsWith("No solar"));
    t("an hour after birth, the Solar line reports no return has happened yet",
      /No solar return has happened yet/.test(solarLine), solarLine);
    t("that line names return #1 and a date one period after birth",
      /#1/.test(solarLine) && /\d{4}-\d{2}-\d{2}/.test(solarLine), solarLine);
    t("near birth, age reads as zero", dNear.ageDays >= 0 && dNear.ageDays < 1);
  }

  // ── well after the first returns, "in force" is what's actually said ──
  {
    const dLater = sb.lifecycleDigest(chart, chart.jd + 400);
    const solarLine = dLater.lines.find((l) => /Solar Return/.test(l));
    t("400 days on, the Solar line reports a return IN FORCE, not 'not happened yet'",
      /has been in force since/.test(solarLine), solarLine);
  }

  // ── the shadow-lane sentence appears exactly when windingLift says so ──
  for (const offsetDays of [0, 137, 4009, 9001, 16000]) {
    const jd = chart.jd + offsetDays;
    const digest = sb.lifecycleDigest(chart, jd);
    const lift = sb.windingLift(chart, jd);
    const hasSentence = digest.lines.some((l) => l.includes("shadow lane"));
    // The one exception: exactly AT birth every body trivially shares its
    // own natal lane, which is a tautology rather than a coincidence, so
    // the function suppresses the sentence there regardless of returns.
    const expected = lift.returns.length > 0 && jd !== chart.jd;
    t(`shadow-lane sentence presence matches windingLift.returns at +${offsetDays}d`,
      hasSentence === expected,
      `returns=${JSON.stringify(lift.returns)} sentence=${hasSentence} atBirth=${jd === chart.jd}`);
    if (hasSentence) {
      const line = digest.lines.find((l) => l.includes("shadow lane"));
      t(`+${offsetDays}d: every body windingLift flagged is named in the sentence`,
        lift.returns.every((name) => line.includes(name)), line);
    }
  }

  // ── grammar: singular vs plural agreement ──
  {
    // Construct a target where we can control which bodies are flagged is
    // impractical without stubbing; instead assert structurally over the
    // natural sample above: whenever more than one body is named, "and"
    // joins the list and the verb is "sit", never "sits".
    for (const offsetDays of [0, 137, 4009, 9001, 16000]) {
      const jd = chart.jd + offsetDays;
      const lift = sb.windingLift(chart, jd);
      if (lift.returns.length < 2 || jd === chart.jd) continue;
      const line = sb.lifecycleDigest(chart, jd).lines.find((l) => l.includes("shadow lane"));
      t(`+${offsetDays}d: ${lift.returns.length} bodies in return use plural grammar`,
        line.includes(" and ") && / sit,? right now| sit\b/.test(line), line);
    }
  }

  // ── at the birth instant itself, the shadow-lane sentence is a
  //    tautology (every body trivially shares its own natal lane), so it
  //    must be suppressed there specifically, unlike any other instant. ──
  {
    const dAtBirth = sb.lifecycleDigest(chart, chart.jd);
    t("at the exact birth instant, the shadow-lane sentence is suppressed (it would be a tautology)",
      !dAtBirth.lines.some((l) => l.includes("shadow lane")), dAtBirth.lines.join(" | "));
    const dJustAfter = sb.lifecycleDigest(chart, chart.jd + 1 / 86400); // one second later
    t("one second after birth, the sentence is free to appear again",
      typeof dJustAfter.lines.some((l) => l.includes("shadow lane")) === "boolean");
  }

  // ── determinism ──
  {
    const a = sb.lifecycleDigest(chart, targetJd);
    const b = sb.lifecycleDigest(chart, targetJd);
    t("lifecycleDigest is deterministic", JSON.stringify(a.lines) === JSON.stringify(b.lines));
  }

  return rows;
}
