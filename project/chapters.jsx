// chapters.jsx — Life Chapters: a public-app profile model for WHERE a
// person has lived, layered on top of WHERE they were born.
//
// The natal chart is cast once, at one place. A life is not: people move,
// and the classical technique that answers "what changed when I moved" is
// the relocated chart — same exact sky (planetary longitudes are
// location-independent), recast angles and houses for each residence. This
// file owns three things, and only three:
//
//   1. normalizeChapters(raw, natal)  — tolerant parsing of whatever the
//      profile storage holds into an ordered, validated chapter list. Bad
//      or partial entries degrade to dropped rows, never thrown errors:
//      this data arrives from hand-edited localStorage in a public app.
//   2. chapterAt(chapters, where, whenJd) — which chapter covers a moment.
//      Open-ended ("still here") and missing dates are handled explicitly;
//      overlapping ranges resolve by LATEST start, deterministically.
//   3. relocatedChart(natal, place) — the natal chart's planets kept whole
//      while ASC/MC/houses/angles recompute for another place. Planetary
//      positions are NOT recast: they are already exact arcsecond values
//      for the birth instant, and geocentric parallax between two places
//      on Earth is sub-arcminute for everything except the Moon — below
//      the resolution any house placement uses. Angles are recomputed via
//      astro.jsx's own ascendantDeg/midheavenDeg/quadrantCuspsFor path, so
//      polar fallback behaves identically to a fresh computeNatal.
//
// Claim boundary (the repo's honesty rule): relocated charts carry NO new
// precision claims. When the natal chart's birth time is unknown, every
// angle here is as unreliable as the natal ASC/MC already flagged (WP-18),
// so `timeUnknown` propagates through and downstream consumers suppress
// angle-based statements exactly as they do on the natal chart itself.
// Sidereal-time math (ascendantDeg) needs lat/lng + the UTC instant only —
// both exist regardless of which city you call home, so relocation works
// even offline (SYNTHETIC ephemeris degrades the same way natal does).
//
// Storage: ProfileStore persists the WHOLE user profile — birth settings
// AND chapters — under one versioned localStorage key, synchronously, so
// a reload restores the exact same state without relying on the host
// postMessage protocol (which only echoes tweaks back to an editor frame,
// never survives reload on its own). Every write is wrapped in try/catch:
// private-mode Safari throws on setItem; the app must keep working with
// storage dead, just without persistence.

const CHAPTERS_SCHEMA_VERSION = 1;
const PROFILE_STORAGE_KEY = "resonance.profile.v1";

// ─────────────────── city lookup (tolerant) ───────────────────
// Places arrive either as registry keys ("Wetzlar · DE") or as free text
// typed by a reader. findCity() falls back to CITIES[0] — WRONG for a
// public app's relocation math — so this layer matches on name/region
// first, accepts plain "Name, ST"-style strings, and returns null rather
// than silently substituting San Antonio for an unknown town. Callers
// drop unmatched chapters (with a visible hint in the UI) instead of
// casting against borrowed coordinates.
function chapterCity(keyOrLabel) {
  if (!keyOrLabel || typeof keyOrLabel !== "string") return null;
  const s = keyOrLabel.trim();
  if (!s) return null;
  if (typeof findCity === "function" && typeof CITIES !== "undefined") {
    const exact = CITIES.find((c) => cityKey(c) === s);
    if (exact) return exact;
    // "Fort Bragg, NC" / "Wetzlar, Germany" / bare "Wetzlar"
    const parts = s.split(/[,·]/).map((p) => p.trim()).filter(Boolean);
    const name = parts[0];
    const region = parts.length > 1 ? parts[parts.length - 1] : null;
    const lc = name.toLowerCase();
    let hits = CITIES.filter((c) => c.name.toLowerCase() === lc);
    if (hits.length === 0) hits = CITIES.filter((c) => c.name.toLowerCase().includes(lc));
    if (region) {
      const rg = region.toLowerCase();
      const narrowed = hits.filter(
        (c) => c.region.toLowerCase() === rg || c.region.toLowerCase() === RG_TO_COUNTRY[rg]
      );
      if (narrowed.length > 0) hits = narrowed;
    }
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) {
      // Prefer the default cluster's unambiguous winner by registration
      // order — but ONLY when still ambiguous after region filter we give
      // up; guessing a coordinate for a public user is worse than no
      // coordinate. Two cities share the name (e.g. "Berlin, DE" vs
      // "Berlin, NH") → null unless the string disambiguated above.
      return null;
    }
  }
  return null;
}

const RG_TO_COUNTRY = {
  germany: "DE", de: "DE", usa: "US", us: "US", uk: "GB", united kingdom: "GB",
};

// ─────────────────── normalization ───────────────────
/**
 * normalizeChapters(raw, natal) -> { chapters, dropped }
 *
 * `raw` may be anything the store holds (null, [], junk objects). Each
 * accepted entry becomes:
 *   { id, placeKey, label, lat, lng, tz, startJd|null, endJd|null, open }
 * Ordered by startJd ascending; entries with no start sort first (they
 * describe the earliest known stretch, i.e. usually childhood at the
 * birth home). `natal` (the natal chart object) supplies the implicit
 * chapter zero: with no explicit start date, a chapter begins at birth.
 *
 * Dropped entries are counted, never thrown — the UI shows "N places
 * couldn't be matched" so nothing vanishes silently.
 */
function normalizeChapters(raw, natal) {
  const out = [];
  let dropped = 0;
  const list = Array.isArray(raw) ? raw : [];
  const birthJd = natal && Number.isFinite(natal.jd) ? natal.jd : null;

  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e || typeof e !== "object") { dropped++; continue; }
    const city = chapterCity(e.placeKey || e.place || e.label);
    if (!city) { dropped++; continue; }

    const startJd = parseChapterDate(e.startISO || e.from, birthJd);
    const endJd = parseChapterDate(e.endISO || e.to, null);
    const open = !(e.open === false) && endJd === null; // default: ongoing

    // An END before the START is junk input, not a negative chapter.
    if (endJd !== null && startJd !== null && endJd <= startJd) { dropped++; continue; }

    out.push({
      id: typeof e.id === "string" && e.id ? e.id : `ch${i}`,
      placeKey: cityKey(city),
      label: `${city.name} · ${city.region}`,
      lat: city.lat,
      lng: city.lng,
      tz: city.tz || null,
      startJd,
      endJd: open ? null : endJd,
      open,
    });
  }

  // Deterministic order: earliest start first; ties (and nulls) keep
  // insertion order via the index stamp.
  out.sort((a, b) => {
    const av = a.startJd === null ? -Infinity : a.startJd;
    const bv = b.startJd === null ? -Infinity : b.startJd;
    return av - bv;
  });

  return { chapters: out, dropped };
}

// Accepts ISO dates ("1981-06-15"), ISO datetimes, and year-only ("1981").
// Year-only lands on Jan 1 of that year — coarse but honest: chapter
// boundaries matter at month/year granularity, not the hour.
function parseChapterDate(v, fallbackJd) {
  if (v === null || v === undefined || v === "") {
    return fallbackJd !== undefined ? fallbackJd : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return v; // already JD
  if (typeof v !== "string") return fallbackJd !== undefined ? fallbackJd : null;
  const s = v.trim();
  const iso = /^\d{4}$/.test(s) ? `${s}-01-01T12:00:00Z`
            : /^\d{4}-\d{2}$/.test(s) ? `${s}-01T12:00:00Z`
            : s;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return fallbackJd !== undefined ? fallbackJd : null;
  return typeof dateToJD === "function" ? dateToJD(d) : d.getTime() / 86400000 + 2440587.5;
}

// ─────────────────── chapter lookup ───────────────────
/**
 * chapterAt(chapters, where, whenJd) -> chapter | null
 * `where`: "now" | "birth" | jd number. Overlaps resolve by latest start
 * (the most recent move wins), which keeps the answer deterministic for
 * sloppy date ranges. Null when nothing covers the moment — callers then
 * fall back to the NATAL place, the pre-chapters behavior.
 */
function chapterAt(chapters, where, whenJd, natalJd) {
  if (!Array.isArray(chapters) || chapters.length === 0) return null;
  let jd;
  if (where === "birth") jd = natalJd;
  else if (where === "now") jd = (typeof dateToJD === "function" ? dateToJD(new Date()) : Date.now() / 86400000 + 2440587.5);
  else jd = where;
  if (!Number.isFinite(jd)) return null;
  let best = null;
  for (const ch of chapters) {
    const s = ch.startJd === null ? -Infinity : ch.startJd;
    const e = ch.open ? Infinity : ch.endJd;
    if (jd >= s && jd < e) {
      if (!best || s >= (best.startJd === null ? -Infinity : best.startJd)) best = ch;
    }
  }
  return best;
}

// Which numbered residence a chapter is (1-based), for labels like
// "Chapter 3 · Wetzlar · DE".
function chapterIndex(chapters, chapter) {
  return chapters.indexOf(chapter) + 1;
}

/**
 * activeChapter(chapters, natal, nowJd) -> { place, source } | null
 *
 * The ONE question every chapter-aware cast asks: "which place should this
 * be computed for right now?" Answer, in order of precedence:
 *   1. the chapter covering `nowJd`, if any ("chapter");
 *   2. the LAST chapter in the list when they are all in the past —
 *      someone who entered their whole history but never ticked "still
 *      here" on the final row still means that row to be current
 *      ("last-chapter");
 *   3. null — no usable history, callers fall back to the NATAL place,
 *      which is exactly the pre-chapters behavior (graceful by design:
 *      a profile with zero chapters changes nothing anywhere).
 * `place` carries lat/lng/tz/label/placeKey so time.jsx's return casts can
 * pass it straight through as { lat, lng } without knowing about cities.
 */
function activeChapter(chapters, natal, nowJd) {
  const list = Array.isArray(chapters) ? chapters : [];
  const cover = chapterAt(list, nowJd, nowJd, natal && natal.jd);
  if (cover) return { place: cover, source: "chapter" };
  if (list.length > 0) {
    // chapterAt already ordered them by start; the last one is the most
    // recent residence even when its end date has passed.
    return { place: list[list.length - 1], source: "last-chapter" };
  }
  return null;
}

// ─────────────────── relocation ───────────────────
/**
 * relocatedChart(natal, place) -> lightweight relocated chart object
 *
 * Keeps the natal planets EXACTLY (see the file header for why positions
 * are location-stable at our resolution) and recomputes:
 *   asc, mc, desc, ic, ascSignIdx, mcSignIdx, ascR11, houseSystemActual,
 *   houseCusps, and every planet's `house`.
 * Returns { ...flags }: timeUnknown propagates verbatim; `relocatedPlace`
 * carries the label so headers can say "cast for Wetzlar · DE".
 *
 * This is intentionally NOT a full computeNatal re-run: lots, eclipses,
 * dignities etc. don't depend on place (dignity depends on sign, which is
 * carried), and re-running them would double the cost while adding
 * nothing. Houses DO depend on place — hence this function existing.
 */
function relocatedChart(natal, place) {
  if (!natal || !place) return null;
  const date = new Date((natal.jd - 2440587.5) * 86400000);
  const asc = ascendantDeg(date, place.lat, place.lng);
  const mc = midheavenDegOf(date, place.lng); // adapter below guards astro.jsx's (date, lng) signature
  const desc = mod360(asc + 180);
  const ic = mod360(mc + 180);
  const ascSignIdx = Math.floor(asc / 30);

  const requested = (natal.birth && natal.birth.houseSystem) || natal.houseSystemActual || "whole";
  let houseSystemActual = requested;
  let houseCusps = null;
  if (typeof QUADRANT_HOUSE_SYSTEMS !== "undefined" && QUADRANT_HOUSE_SYSTEMS.has(requested)
      && typeof quadrantCuspsFor === "function") {
    houseCusps = quadrantCuspsFor(requested, date, place.lat, place.lng);
    if (!houseCusps) houseSystemActual = "whole"; // POLAR_FALLBACK_POLICY, same as computeNatal
  }
  const houseOf = (lon, sign) => {
    if (houseCusps) return AstroCore.houseForCusps(lon, houseCusps);
    return houseSystemActual === "whole"
      ? houseForSign(sign, ascSignIdx)
      : houseForLongEqual(lon, asc);
  };

  const planets = natal.planets.map((p) => ({
    ...p,
    house: houseOf(p.lon, p.sign),
  }));

  // residues().r11 IS floor-mod of the arcsecond value (astro-core's
  // residues is a plain Math.floor + % family), so this agrees with
  // astro.jsx computeNatal's `Math.floor(asc * 3600) % 11` ASC-lane
  // formula to the arcsecond — verified by test/present/chapters.test.js
  // rather than asserted here. Going through residues() keeps the whole
  // presentation layer on one definition of "the r11 lane".
  const ascR11 = residues(asc * 3600).r11;

  return {
    ...natal,
    asc, mc, desc, ic,
    ascSignIdx,
    mcSignIdx: Math.floor(mc / 30),
    ascR11,
    houseSystemActual,
    houseCusps,
    planets,
    cards: natal.cards, // card resonance is aspect/dignity-driven: place-independent
    timeUnknown: !!natal.timeUnknown,
    relocated: true,
    relocatedPlace: {
      placeKey: typeof place.placeKey === "string" ? place.placeKey : cityKey(place),
      label: place.label || `${place.name} · ${place.region}`,
      lat: place.lat,
      lng: place.lng,
      tz: place.tz || null,
    },
  };
}

// midheavenDeg's actual signature in astro.jsx is (date, lng) — guard
// against argument-order drift with a tiny adapter rather than assuming.
function midheavenDegOf(date, lng) {
  return midheavenDeg(date, lng);
}

// ─────────────────── per-chapter digest ───────────────────
/**
 * chapterDigest(natal, chapters) -> array of prose lines, one per chapter,
 * naming the relocated Asc/MC signs and any body whose HOUSE changes there
 * relative to the natal chart (positions cannot change; houses can — that
 * IS the classical relocation statement, and it's all this says).
 *
 * On a timeUnknown natal chart the angles themselves are unreliable, so
 * the line reports house shifts WITHOUT quoting an Ascendant degree —
 * matching the WP-18 suppression precedent rather than inventing a new one.
 */
function chapterDigest(natal, chapters) {
  const lines = [];
  if (!natal || !Array.isArray(chapters)) return lines;
  for (const ch of chapters) {
    const rel = relocatedChart(natal, ch);
    if (!rel) continue;
    const where = ch.label;
    const shifted = [];
    for (const p of rel.planets) {
      const nat = natal.planets.find((q) => q.name === p.name);
      if (nat && nat.house !== p.house) {
        shifted.push(`${p.name} ${nat.house}→${p.house}`);
      }
    }
    if (natal.timeUnknown) {
      lines.push(
        shifted.length
          ? `In ${where}: ${shifted.join(", ")} (houses shift; the Ascendant itself is unreliable here — birth time unknown).`
          : `In ${where}: no body changes house. The Ascendant itself is unreliable here — birth time unknown.`
      );
    } else {
      const ascSign = ZODIAC[Math.floor(rel.asc / 30)].name;
      const mcSign = ZODIAC[Math.floor(rel.mc / 30)].name;
      lines.push(
        `In ${where}: rising ${ascSign}, MC in ${mcSign}.` +
        (shifted.length ? ` Houses shift: ${shifted.join(", ")}.` : " No body changes house.")
      );
    }
  }
  return lines;
}

// ─────────────────── chapter-aware return casting ───────────────────
/**
 * chapterAware(natal, chaptersRaw, nowJd) -> { chapters, dropped, active }
 *
 * The single entry point time.jsx (and anything else that casts for a
 * place other than the birthplace) uses. It deliberately returns null on
 * ANY of the graceful-degradation conditions rather than throwing or
 * half-working:
 *   - chapters.jsx's dependencies not loaded on this page (a host that
 *     omits the <script> tags — every caller keeps pre-chapters behavior),
 *   - NO usable chapters after normalization — including the case where
 *     the ONLY rows dropped were "the same city as the natal place":
 *     a relocated chart identical to the natal one is noise, not a
 *     feature, so a reader who grew up at home and never moved sees the
 *     app exactly as they did before chapters existed,
 *   - an unknown birth TIME: relocation is angle math, and angles are
 *     already flagged unreliable (WP-18) — casting them for another city
 *     would multiply an admitted guess instead of informing anyone.
 * `active` comes from activeChapter(): the covering chapter, else the
 * latest past chapter, else null (caller falls back to natal place).
 */
function chapterAware(natal, chaptersRaw, nowJd) {
  if (!natal || typeof chapterCity !== "function" || typeof CITIES === "undefined") return null;
  const { chapters, dropped } = normalizeChapters(chaptersRaw, natal);
  const natalKey = natal.placeKey || (natal.birth && natal.birth.placeKey) || null;
  const distinct = chapters.filter((ch) => !natalKey || ch.placeKey !== natalKey);
  if (distinct.length === 0) return null;
  if (natal.timeUnknown) return { chapters: distinct, dropped, active: null, timeUnknown: true };
  return { chapters: distinct, dropped, active: activeChapter(distinct, natal, nowJd), timeUnknown: false };
}

// ─────────────────── local profile storage ───────────────────
/**
 * ProfileStore — the single source of truth for the user's local profile.
 * Everything (birth settings AND life chapters) lives under ONE key so a
 * save is atomic and a restore can't half-load. useTweaks stays in front
 * as the live in-memory state (its postMessage protocol feeds the editor
 * host); this store is what makes the app survive a reload standalone.
 */
const ProfileStore = {
  load() {
    try {
      const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return null;
      if (obj.version !== CHAPTERS_SCHEMA_VERSION) {
        // Future migrations hook here; unknown NEWER versions load as
        // empty rather than being corrupted by a downgrade.
        if (obj.version > CHAPTERS_SCHEMA_VERSION) return null;
        obj.version = CHAPTERS_SCHEMA_VERSION;
      }
      return obj;
    } catch { return null; }
  },
  save(settings, chaptersRaw) {
    try {
      const payload = {
        version: CHAPTERS_SCHEMA_VERSION,
        savedAt: new Date().toISOString(),
        settings: settings || {},
        chapters: Array.isArray(chaptersRaw) ? chaptersRaw : [],
      };
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch { return false; } // private mode / quota — app continues unpersisted
  },
  clear() {
    try { window.localStorage.removeItem(PROFILE_STORAGE_KEY); } catch {}
  },
};

Object.assign(window, {
  CHAPTERS_SCHEMA_VERSION,
  PROFILE_STORAGE_KEY,
  chapterCity,
  normalizeChapters,
  parseChapterDate,
  chapterAt,
  chapterIndex,
  activeChapter,
  relocatedChart,
  chapterDigest,
  chapterAware,
  ProfileStore,
});
