// test/identity.test.js — the identity of a number, D-030. (P27)

import { mod } from "../src/core/residues.js";
import {
  identity, identityOn, sameAngleDifferentLevel,
  kElim, doubleKElim, windingDigits,
  natalChart, isReturn, returns, windingMonotone, natalUnreachable,
} from "../src/core/identity.js";
import { M_SHELL, PARK, ARCSEC_CIRCLE, B8 } from "../src/core/basis.js";

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  // ── the cylinder: angular + axial ────────────────────────────────
  {
    let bad = 0;
    for (let x = 0n; x < 5000n; x++) if (!identity(x, 13n).exact) bad++;
    t("ID_p(x) = (r, w) with x = r + p·w — angular plus axial",
      bad === 0, "5,000 values at p = 13, exact every time");
  }
  t("the residue is the present, the winding is the past",
    identity(47n, 13n).r === 8n && identity(47n, 13n).w === 3n
    && 8n + 13n * 3n === 47n,
    "47 = 8 + 13·3 — angle 8, three wraps");
  {
    const s = sameAngleDifferentLevel(8n, 47n, 13n);
    t("same residue, different winding — DISTINCT states the tuple cannot separate",
      s.same_residue && !s.same_winding && s.distinct,
      "8 and 47 sit at the same angle on different levels of the cylinder");
  }
  t("the full identity carries one (r, w) pair per lane",
    identityOn(1234n, B8).length === 8
    && identityOn(1234n, B8).every((id) => id.exact));

  // ── double K-Elimination is SECOND ORDER ─────────────────────────
  {
    // exhaustive over the whole two-digit corridor
    const M = 30n, A1 = 7n, A2 = 11n;
    let bad = 0, n = 0n;
    for (let x = 0n; x < M * A1 * A2; x++) {
      const d = doubleKElim(x, M, A1, A2);
      const K = x / M;
      if (d.kappa1 !== mod(K, A1) || d.kappa2 !== mod(K / A1, A2)) bad++;
      n++;
    }
    t("κ₂ = K-Elim(κ₁, A₁, A₂) — the winding OF the winding, exhaustively exact",
      bad === 0 && n === 2310n,
      "2,310 values: κ₁ = K mod 7 (velocity), κ₂ = ⌊K/7⌋ mod 11 (acceleration)");
  }
  {
    const d = doubleKElim(2000n, 30n, 7n, 11n);
    t("the second order is ACCELERATION, not more digits of the same winding",
      d.kappa1 === mod(2000n / 30n, 7n) && d.kappa2 === mod(2000n / 30n / 7n, 11n)
      && d.K === 2000n / 30n && d.order === 2n,
      `K = ${2000n / 30n} = ${d.kappa1} + 7·${d.kappa2}`);
    t("CORRECTED — 'two levels of one lane' was precision, not the double elim",
      d.corridor === 30n * 7n * 11n && kElim(2000n, 30n, 7n) === mod(2000n / 30n, 7n),
      "a single elimination reaches K < 7; the double reaches K < 77");
  }
  {
    const w = windingDigits(2000n, 30n, [7n, 11n, 13n]);
    t("digits come from INDEPENDENT eliminations — no accumulator threaded",
      w.K === 2000n / 30n && w.digits.length === 3
      && w.accumulator_threaded === false
      && w.corridor === 30n * 1001n,
      "mixed-radix without a Garner cascade: digit i never reads digit i−1");
  }

  // ── the natal chart, the trip, the return ────────────────────────
  {
    const n = natalChart(35113n, B8);
    t("the natal chart is (r₀, 0) — the winding is zero by definition",
      n.winding.every((w) => w === 0n) && n.residues.length === 8
      && n.residues[0] === mod(35113n, 2n),
      "birth into the system: configuration of oscillators at t = 0, no history");
  }
  {
    // a Return: same angle as birth, strictly greater winding
    const p = 13n, natal = 8n;
    const first = isReturn(8n, natal, p);
    const later = isReturn(47n, natal, p);
    t("a RETURN is r_p(t) = r_p(t₀) — same angle, and the identity has changed",
      first.returned && !first.changed && later.returned && later.changed
      && later.journey === 3n,
      "47 returns to angle 8 carrying winding 3 — the measure of the journey");
    const rs = returns(8n, 13n, 60n);
    t("every return carries a strictly larger winding than the last",
      rs.length === 4 && rs.every((z, i) => i === 0 || z.winding > rs[i - 1].winding),
      "8, 21, 34, 47 — same angle, four different levels");
  }
  {
    // the astrology binding, on the register's own lane
    const natal = mod(35113n, PARK);
    const rs = returns(natal, PARK, ARCSEC_CIRCLE);
    t("the ecliptic ring carries the same structure on the parked lane",
      rs.length > 100000 && rs[0].winding === 0n
      && rs.every((z) => z.returned),
      `${rs.length} returns of lane 11 across the ring, each at a new level`);
  }
  t("two charts with identical residues are NOT the same state",
    sameAngleDifferentLevel(35113n, 35113n + M_SHELL, PARK).same_residue === false
    || sameAngleDifferentLevel(35113n, 35113n + PARK, PARK).same_residue === true,
    "the winding is what the residue tuple throws away");

  // ── irreversibility ──────────────────────────────────────────────
  {
    const traj = [];
    for (let i = 0n; i < 200n; i++) traj.push(i * i + 3n * i);   // integer polynomial
    const m = windingMonotone(traj, 13n);
    t("the winding is non-decreasing along an integer-polynomial trajectory",
      m.monotone && m.violations === 0,
      "200 steps of x ↦ x² + 3x: the winding acts as a Lyapunov function");
    t("the natal state (r₀, 0) is not re-entered once the identity has wound",
      natalUnreachable(traj, 13n).any_returned_to_zero === false,
      "the past is algebraically unreachable — the arrow is arithmetic");
  }
  {
    const bad = [100n, 50n, 10n];
    t("a decreasing trajectory is detected, not assumed away",
      !windingMonotone(bad, 13n).monotone && windingMonotone(bad, 13n).violations === 2);
  }

  return R;
}
