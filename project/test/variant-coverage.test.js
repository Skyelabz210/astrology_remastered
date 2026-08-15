// test/variant-coverage.test.js — every major astrological variant, checked. (P11)
//
// This suite asserts two things at once:
//
//   1. COVERAGE — each tradition's own divisions, frames, house systems and
//      aspect families are present and computed exactly, or explicitly gated
//      as requiring a certified ledger. Nothing is silently absent.
//
//   2. REINFORCEMENT — the received Western/Hellenistic apparatus is exactly
//      the part of the space that closes on the integer arcsecond ring, and the
//      divisions that fail to close are precisely those carrying a spine prime.
//      The tradition's selection is recovered as an arithmetic fact.
//
// BigInt only. Returns a list of {name, ok, detail} results.

import { B8 } from "../src/core/basis.js";
import { mod } from "../src/core/residues.js";
import {
  RING, RING_PRIMES, RING_RADICAL, OFF_RING_PRIMES,
  ringFromFactors, closes, stepArcsec, defect, offRingPrimes, isRingSmooth, ipow,
} from "../src/core/ring.js";
import {
  FRAMES, DIVISIONS, ASPECT_FAMILIES, HOUSE_SYSTEMS, VARIANTS,
  FIRDARIA_YEARS, VIMSHOTTARI_YEARS, totalYears,
  frame, division, variant, variantReport, allVariantReports,
  toFrame, fromFrame, separation, signIndex, wholeSignHouse, equalHouse,
  vehlowHouse, porphyryCusps, DegenerateAnglesError, ARCSEC_PER_SIGN, ARCSEC_PER_DEGREE,
} from "../src/core/variants.js";
import { divisionClosure, divisionShadow } from "../src/core/shadow-spine.js";

const DEG = 3600n;

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });
  const div = (id) => division(id).n;

  // ── the ring itself ────────────────────────────────────────────────
  t("ring R = 2^7·3^4·5^3 = 1,296,000″",
    ringFromFactors() === RING && RING === 1296000n, RING.toString());
  t("only {2,3,5} divide the ring",
    RING_PRIMES.every((p) => mod(RING, p) === 0n) && RING_RADICAL === 30n,
    "radical = " + RING_RADICAL.toString());
  t("2^8 ∤ R — smoothness alone is not closure",
    isRingSmooth(256n) && !closes(256n), "256 = 2^8 > 2^7");

  // ── the off-ring set is derived (this is the CLOSURE axis) ───────
  {
    const derived = B8.filter((p) => mod(RING, p) !== 0n);
    const same = derived.length === OFF_RING_PRIMES.length
      && derived.every((p, i) => p === OFF_RING_PRIMES[i]);
    t("off-ring set = SafeS8 primes that do NOT divide the ring", same,
      derived.map(String).join(" · "));
  }
  {
    const want = { 7: 6n, 11: 2n, 13: 4n, 17: 5n, 19: 10n };
    const ok = OFF_RING_PRIMES.every((p) => mod(RING, p) === want[p.toString()]);
    t("off-ring defects R mod p = 6, 2, 4, 5, 10", ok,
      OFF_RING_PRIMES.map((p) => `${p}→${mod(RING, p)}`).join(" "));
  }

  // ── closure theorem over a meaningful range ───────────────────────
  {
    let bad = null;
    for (let n = 1n; n <= 2000n; n++) {
      let m = n, a = 0n, b = 0n, c = 0n;
      while (mod(m, 2n) === 0n) { m = m / 2n; a++; }
      while (mod(m, 3n) === 0n) { m = m / 3n; b++; }
      while (mod(m, 5n) === 0n) { m = m / 5n; c++; }
      const predicted = m === 1n && a <= 7n && b <= 4n && c <= 3n;
      if (predicted !== closes(n)) { bad = n; break; }
    }
    t("closes(n) ⟺ n = 2^a·3^b·5^c, a≤7 b≤4 c≤3  (n ≤ 2000)",
      bad === null, bad === null ? "2000/2000 agree" : "first disagreement n=" + bad);
  }

  // ── frames ────────────────────────────────────────────────────────
  t("7 frames registered incl. tropical, 4 sidereal, draconic, heliocentric",
    FRAMES.length === 7 && frame("tropical").offset_arcsec === 0n,
    FRAMES.map((f) => f.id).join(" · "));
  t("Lahiri ayanamsa = 23°51′11″ = 85,871″",
    frame("lahiri").offset_arcsec === 23n * DEG + 51n * 60n + 11n, "85871");
  t("Fagan–Bradley = 24°05′41″ = 86,741″",
    frame("fagan_bradley").offset_arcsec === 24n * DEG + 5n * 60n + 41n, "86741");
  t("Raman = 22°22′48″ = 80,568″",
    frame("raman").offset_arcsec === 22n * DEG + 22n * 60n + 48n, "80568");
  t("Krishnamurti = 23°48′11″ = 85,691″",
    frame("krishnamurti").offset_arcsec === 23n * DEG + 48n * 60n + 11n, "85691");
  t("heliocentric is OPEN — a change of origin, not a rotation",
    frame("heliocentric").status === "OPEN" && frame("heliocentric").offset_arcsec === null);
  {
    const x = 987654n, w = frame("lahiri").offset_arcsec;
    t("frame rotation is invertible", fromFrame(toFrame(x, w), w) === x);
    t("separation is frame-independent",
      separation(toFrame(x, w), toFrame(mod(x + 432000n, RING), w)) === separation(x, mod(x + 432000n, RING)),
      "trine preserved under Lahiri");
  }

  // ── Western / Hellenistic apparatus: all of it closes ─────────────
  for (const id of ["sign", "decan", "dwad", "degree", "minute", "arcsec", "monomoiria"]) {
    const n = div(id);
    t(`${id} (n=${n}) closes exactly`, closes(n), "step = " + stepArcsec(n) + "″");
  }
  t("12 signs = 108,000″ = 30° each", stepArcsec(div("sign")) === ARCSEC_PER_SIGN);
  t("36 decans = 36,000″ = 10° each", stepArcsec(div("decan")) === 36000n);
  t("1° = 3,600″", ARCSEC_PER_DEGREE === 3600n);

  // ── aspect families: Ptolemaic closes, the marginal families do not ──
  {
    const ptol = ASPECT_FAMILIES.find((f) => f.id === "ptolemaic");
    t("Ptolemaic divisors {1,2,3,4,6} all close",
      ptol.divisors.every((n) => closes(n)), "conj · sextile · square · trine · opp");
    t("opposition = 648,000″ = 180°", RING / 2n === 648000n);
    t("trine = 432,000″ = 120°", RING / 3n === 432000n);
    t("square = 324,000″ = 90°", RING / 4n === 324000n);
    t("sextile = 216,000″ = 60°", RING / 6n === 216000n);
  }
  t("minor family: 45° and 30° close", closes(8n) && closes(12n) && RING / 8n === 162000n);
  t("quintile family: 72° and 36° close", closes(5n) && closes(10n) && RING / 5n === 259200n);
  t("novile family: 40° and 20° close", closes(9n) && closes(18n) && RING / 9n === 144000n);
  t("septile does NOT close — off-ring prime 7",
    !closes(7n) && defect(7n) === 6n && offRingPrimes(7n)[0] === 7n, "defect 6″");
  t("undecile does NOT close — off-ring prime 11",
    !closes(11n) && defect(11n) === 2n, "defect 2″");
  t("13th harmonic does NOT close — off-ring prime 13",
    !closes(13n) && defect(13n) === 4n, "defect 4″");
  t("classical tredecile 108° lives in the quintile family, not lane 13",
    closes(10n) && mod(RING * 3n, 10n) === 0n && (RING * 3n) / 10n === 388800n, "3/10 of the ring");

  // ── house systems ─────────────────────────────────────────────────
  {
    const exact = HOUSE_SYSTEMS.filter((h) => h.exact);
    const gated = HOUSE_SYSTEMS.filter((h) => !h.exact);
    t("5 house systems are integer-exact on the ring", exact.length === 5,
      exact.map((h) => h.id).join(" · "));
    t("8 quadrant systems gated LEDGER (need oblique ascension; WP-12: fulfilled via the ledger admission path, not core float arithmetic)",
      gated.length === 8 && gated.every((h) => h.status === "LEDGER"),
      gated.map((h) => h.id).join(" · "));
  }
  {
    const asc = 456789n, w = 0n;
    t("whole-sign: ASC is in house 1", wholeSignHouse(asc, asc, w) === 1n);
    t("whole-sign: ASC + 30° is in house 2",
      wholeSignHouse(mod(asc + ARCSEC_PER_SIGN, RING), asc, w) === 2n);
    t("whole-sign: opposition is in house 7",
      wholeSignHouse(mod(asc + RING / 2n, RING), asc, w) === 7n);
    t("equal houses partition the ring", equalHouse(asc, asc) === 1n
      && equalHouse(mod(asc - 1n, RING), asc) === 12n);
    t("Vehlow places ASC at the mid-point of house 1",
      vehlowHouse(asc, asc) === 1n
      && vehlowHouse(mod(asc - ARCSEC_PER_SIGN / 2n, RING), asc) === 1n
      && vehlowHouse(mod(asc - ARCSEC_PER_SIGN / 2n - 1n, RING), asc) === 12n);
  }
  {
    // Porphyry must tile the ring exactly, remainder and all.
    const asc = 271828n, mc = 141421n;
    const cusps = porphyryCusps(asc, mc);
    let sum = 0n, distinct = new Set(cusps.map(String));
    for (let i = 0; i < 12; i++) sum += mod(cusps[(i + 1) % 12] - cusps[i], RING);
    t("Porphyry: 12 cusps, exact ring partition, no gap",
      cusps.length === 12 && distinct.size === 12 && sum === RING,
      "Σ arcs = " + sum.toString() + "″");
    t("Porphyry: cusp 1 = ASC, cusp 4 = IC, cusp 7 = DSC, cusp 10 = MC",
      cusps[0] === asc && cusps[3] === mod(mc + RING / 2n, RING)
      && cusps[6] === mod(asc + RING / 2n, RING) && cusps[9] === mc);
  }
  {
    // Regression: porphyryCusps() used to hardcode the ASC->IC->DSC->MC
    // traversal order unconditionally. That's correct only when MC leads
    // ASC by more than half the ring (the ordinary, non-polar case) — when
    // it doesn't (asc=mc here is the most degenerate instance: MC leads by
    // exactly 0), the old code silently produced cusps whose arcs summed to
    // a multiple of the ring instead of exactly one ring. It must now throw
    // instead of silently corrupting the partition.
    const asc = 200000n, mc = 200000n; // MC leads ASC by 0 — squarely degenerate
    let threw = null;
    try {
      porphyryCusps(asc, mc);
    } catch (e) {
      threw = e;
    }
    t("Porphyry: degenerate asc===mc throws DegenerateAnglesError instead of corrupting cusps",
      threw instanceof DegenerateAnglesError, threw ? threw.name : "no throw");

    // MC leading by exactly half the ring (asc and mc antipodal) is the
    // other degenerate boundary — also must throw, not silently produce
    // zero-width quadrants.
    const asc2 = 200000n, mc2 = mod(asc2 + RING / 2n, RING);
    let threw2 = null;
    try {
      porphyryCusps(asc2, mc2);
    } catch (e) {
      threw2 = e;
    }
    t("Porphyry: MC exactly opposite ASC also throws DegenerateAnglesError",
      threw2 instanceof DegenerateAnglesError, threw2 ? threw2.name : "no throw");

    // Just past the boundary (MC leads by half-the-ring + 1″) must NOT
    // throw and must still tile the ring exactly — confirms the guard's
    // threshold doesn't over-reject valid input.
    const asc3 = 200000n, mc3 = mod(asc3 + RING / 2n + 1n, RING);
    const cusps3 = porphyryCusps(asc3, mc3);
    let sum3 = 0n;
    for (let i = 0; i < 12; i++) sum3 += mod(cusps3[(i + 1) % 12] - cusps3[i], RING);
    t("Porphyry: just past the degenerate boundary does NOT throw and still tiles the ring exactly",
      cusps3.length === 12 && sum3 === RING, "Σ arcs = " + sum3.toString() + "″");
  }

  // ── Vedic / Jyotiṣa ───────────────────────────────────────────────
  t("27 nakṣatras = 48,000″ = 13°20′ each",
    closes(27n) && stepArcsec(27n) === 48000n, "48000″");
  t("navāṁśa D-9 divisor 108 ≡ nakṣatra pada (27 × 4)",
    div("navamsa") === 27n * 4n && closes(108n) && stepArcsec(108n) === 12000n,
    "12,000″ = 3°20′");
  t("drekkāṇa D-3 divisor ≡ Egyptian decan (36)", div("decan") === 36n);
  t("triṁśāṁśa D-30 divisor ≡ the degree division (360)",
    div("trimsamsa") === div("degree"));
  {
    // The classical ṣoḍaśavarga: exactly one of the sixteen fails to close.
    const varga = [
      ["D-1", 12n], ["D-2", 24n], ["D-3", 36n], ["D-4", 48n], ["D-7", 84n],
      ["D-9", 108n], ["D-10", 120n], ["D-12", 144n], ["D-16", 192n], ["D-20", 240n],
      ["D-24", 288n], ["D-27", 324n], ["D-30", 360n], ["D-40", 480n], ["D-45", 540n],
      ["D-60", 720n],
    ];
    const fail = varga.filter(([, n]) => !closes(n));
    t("ṣoḍaśavarga: 16 divisions, exactly one non-closing, and it is D-7",
      varga.length === 16 && fail.length === 1 && fail[0][0] === "D-7",
      "D-7 = 84 = 2²·3·7, defect " + defect(84n) + "″");
    t("D-7 fails through the spine prime 7",
      divisionClosure(84n).off_ring_primes.join() === "7"
      && divisionClosure(84n).off_ring_lanes.join() === "H7");
  }
  t("rudrāṁśa D-11 (132) fails through the shadow prime 11",
    !closes(div("rudramsa")) && divisionClosure(132n).off_ring_lanes.join() === "SH11",
    "defect " + defect(132n) + "″");
  t("Viṁśottarī daśā total = 120 years, and 120 closes on the ring",
    totalYears(VIMSHOTTARI_YEARS) === 120n && closes(120n), "step 10,800″");
  t("Viṁśottarī lords carry the spine primes 7, 17, 19",
    VIMSHOTTARI_YEARS.some((r) => r.years === 7n)
    && VIMSHOTTARI_YEARS.some((r) => r.years === 17n)
    && VIMSHOTTARI_YEARS.some((r) => r.years === 19n),
    "Ketu 7 · Mercury 17 · Saturn 19");

  // ── Krishnamurti Paddhati ─────────────────────────────────────────
  t("KP 249 subs do NOT close — 249 = 3 · 83, alien factor 83",
    !closes(div("kp_sub")) && divisionClosure(249n).alien_factor === "83",
    "defect " + defect(249n) + "″");

  // ── Medieval / Perso-Arabic ───────────────────────────────────────
  t("Firdāria total = 75 years",
    totalYears(FIRDARIA_YEARS) === 75n, "75");
  t("Firdāria periods are built from the spine primes 7, 11, 13",
    FIRDARIA_YEARS.some((r) => r.years === 7n)
    && FIRDARIA_YEARS.some((r) => r.years === 11n)
    && FIRDARIA_YEARS.some((r) => r.years === 13n),
    "Mars 7 · Saturn 11 · Mercury 13");
  t("28 Arabic manāzil do NOT close — 28 = 2²·7",
    !closes(div("mansion_arabic")) && divisionClosure(28n).off_ring_lanes.join() === "H7",
    "defect " + defect(28n) + "″");

  // ── Chinese ───────────────────────────────────────────────────────
  t("10 stems, 12 branches and the 60-cycle all close",
    closes(div("stem")) && closes(div("branch")) && closes(div("sexagenary")),
    "60 → 21,600″");
  t("sexagenary cycle = lcm(10, 12) = 60", div("sexagenary") === 60n);
  t("28 xiù ≡ 28 manāzil — the same divisor in two traditions, both off-ring",
    div("xiu") === div("mansion_arabic") && !closes(div("xiu")));

  // ── Maya / Mesoamerican ───────────────────────────────────────────
  t("veintena (20) closes; trecena (13) does not",
    closes(div("veintena")) && !closes(div("trecena")),
    "20 → 64,800″ · 13 → defect 4″");
  t("Tzolk'in 260 = 2²·5·13 does NOT close — the boundary prime 13",
    !closes(div("tzolkin")) && divisionClosure(260n).off_ring_lanes.join() === "B13",
    "defect " + defect(260n) + "″");
  t("Haab 365 = 5·73 does NOT close — alien factor 73",
    !closes(div("haab")) && divisionClosure(365n).alien_factor === "73",
    "defect " + defect(365n) + "″");
  t("Calendar Round 18,980 = 260·73 carries both 13 and 73",
    18980n === 260n * 73n && !closes(18980n)
    && divisionClosure(18980n).off_ring_lanes.join() === "B13"
    && divisionClosure(18980n).alien_factor === "73");

  // ── Uranian ───────────────────────────────────────────────────────
  t("Uranian 90° / 45° / 22°30′ dials all close",
    closes(div("dial_90")) && closes(div("dial_45")) && closes(div("dial_22_5")),
    "324,000″ · 162,000″ · 81,000″");
  {
    // A midpoint is exact iff the two longitudes have the same parity — the
    // only place lane 2 can raise a defect on an otherwise closing structure.
    const a = 100000n, b = 100002n, c = 100003n;
    t("Uranian midpoint exact iff longitudes share parity",
      mod(a + b, 2n) === 0n && mod(a + c, 2n) === 1n,
      "odd sum ⇒ ½″ residue in lane 2");
  }

  // ── modern / speculative ──────────────────────────────────────────
  t("thirteen-sign zodiac cannot tile the ring — 13 ∤ 1,296,000",
    !closes(div("ophiuchus")) && defect(13n) === 4n,
    "4″ left over after 13 equal parts");
  t("draconic frame is a pure ring rotation",
    frame("draconic").offset_arcsec === null && variant("draconic").frame === "draconic",
    "offset supplied from the node at runtime");

  // ── registry integrity ───────────────────────────────────────────
  t("13 variants registered", VARIANTS.length === 13, VARIANTS.map((v) => v.id).join(" · "));
  {
    let bad = [];
    for (const v of VARIANTS) {
      const rep = variantReport(v.id);
      if (rep.kind !== "HCRM_VARIANT_REPORT_V1") bad.push(v.id + ":kind");
      if (rep.divisions.length === 0 && rep.aspects.length === 0) bad.push(v.id + ":empty");
      for (const d of rep.divisions) {
        if (d.closes !== (d.defect_arcsec === "0")) bad.push(v.id + "/" + d.id + ":defect");
        if (d.closes && d.step_arcsec === null) bad.push(v.id + "/" + d.id + ":step");
        if (!d.closes && d.step_arcsec !== null) bad.push(v.id + "/" + d.id + ":step!");
      }
      for (const f of rep.aspects) for (const a of f.angles) {
        if (a.closes !== (a.defect_arcsec === "0")) bad.push(v.id + "/" + f.id + ":angle");
      }
    }
    t("every variant report is internally consistent", bad.length === 0,
      bad.length ? bad.slice(0, 4).join(", ") : "13/13 consistent");
  }
  {
    const reports = allVariantReports();
    const gated = reports.flatMap((r) => r.houses.filter((h) => !h.exact).map((h) => h.id));
    t("ledger-gated house systems are named, never silently faked",
      gated.length > 0 && new Set(gated).size >= 5,
      [...new Set(gated)].join(" · "));
  }
  {
    // The reinforcement result, stated as one assertion over the whole registry:
    // every non-closing division in every tradition carries an off-ring prime,
    // and no closing division does.
    let bad = null;
    for (const d of DIVISIONS) {
      const off = offRingPrimes(d.n);
      if (closes(d.n) !== (off.length === 0)) { bad = d.id; break; }
    }
    t("across all traditions: a division fails to close ⟺ it carries an off-ring prime",
      bad === null, bad === null ? `${DIVISIONS.length}/${DIVISIONS.length} divisions agree` : "counterexample " + bad);
  }
  {
    const nonClosing = DIVISIONS.filter((d) => !closes(d.n));
    const traditions = new Set(nonClosing.flatMap((d) => d.traditions));
    t("non-closing divisions appear in Vedic, KP, Maya, Chinese, medieval and modern practice",
      nonClosing.length >= 8 && traditions.size >= 5,
      nonClosing.map((d) => `${d.id}(${d.n})`).join(" · "));
  }
  {
    // ρ over the whole registry — the finding the band legend would otherwise hide
    const bands = DIVISIONS.map((d) => divisionShadow(d.n).band);
    const worst = DIVISIONS.map((d) => BigInt(divisionShadow(d.n).rho)).reduce((a, b) => (b > a ? b : a), 0n);
    t("every division any tradition names lands in the Stable band (ρ ≤ 4)",
      bands.every((b) => b === "stable") && worst <= 4n,
      `${DIVISIONS.length}/${DIVISIONS.length} Stable, max ρ = ${worst}`);
    t("the zodiac is quieter than its own basis — ring ρ 3 < shell ρ 7 < Colony ρ 10",
      divisionShadow(RING).rho === "3" && divisionShadow(30030n).rho === "7"
      && divisionShadow(9699690n).rho === "10"
      && divisionShadow(RING).band === "stable" && divisionShadow(30030n).band === "strong"
      && divisionShadow(9699690n).band === "chaotic");
  }
  t("ipow agrees with repeated multiplication", ipow(2n, 7n) === 128n && ipow(5n, 3n) === 125n);
  t("signIndex is exact at every sign boundary",
    signIndex(0n, 0n) === 0n && signIndex(ARCSEC_PER_SIGN - 1n, 0n) === 0n
    && signIndex(ARCSEC_PER_SIGN, 0n) === 1n && signIndex(RING - 1n, 0n) === 11n);

  return R;
}
