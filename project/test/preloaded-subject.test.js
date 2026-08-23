// test/preloaded-subject.test.js — the preloaded subject, stated once. (P26)
//
// The chart the app opens on before anyone touches a picker is declared in
// FOUR places that cannot import each other:
//
//   app.jsx        DEFAULT_SETTINGS   — an EDITMODE block, literal JSON
//   hcrm-app.jsx   HCRM_DEFAULTS      — an EDITMODE block, literal JSON
//   landing.jsx    picker fallbacks   — React.useState defaults
//   cities.jsx     DEFAULT_CITY_KEY   — the selected option
//
// The two EDITMODE blocks are rewritten on disk by the host (see the protocol
// note in tweaks-panel.jsx), so they must stay literal — they cannot be derived
// from a shared constant. That leaves agreement to be asserted rather than
// enforced by construction, which is what this suite does: parse all four and
// fail if they ever name different people, a different place, or a birth
// instant that disagrees with the picker fields.
//
// Previously app.jsx opened on a generic San Antonio 1990 placeholder while the
// HCRM console already carried the real subject — the two consoles showed
// different charts on load.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = (f) => readFileSync(join(HERE, "..", f), "utf8");

/** Pull an EDITMODE JSON block out of a source file. */
function editModeBlock(src, file) {
  const m = src.match(/\/\*EDITMODE-BEGIN\*\/([\s\S]*?)\/\*EDITMODE-END\*\//);
  if (!m) throw new Error(`${file}: no EDITMODE block`);
  return JSON.parse(m[1]);
}

/** Read a `React.useState(initial?.<field> ?? <literal>)` fallback. */
function pickerFallback(src, field) {
  const m = src.match(
    new RegExp(`initial\\?\\.${field}\\s*\\?\\?\\s*("[^"]*"|[0-9]+)`)
  );
  return m ? JSON.parse(m[1]) : null;
}

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  const app = editModeBlock(SRC("app.jsx"), "app.jsx");
  const hcrm = editModeBlock(SRC("hcrm-app.jsx"), "hcrm-app.jsx");
  const landing = SRC("landing.jsx");
  const cities = SRC("cities.jsx");

  // ── the two consoles open on the same person ─────────────────────
  for (const field of ["dateISO", "lat", "lng", "placeLabel"]) {
    t(`app.jsx and hcrm-app.jsx agree on ${field}`,
      app[field] === hcrm[field],
      `${JSON.stringify(app[field])} vs ${JSON.stringify(hcrm[field])}`);
  }

  // ── the place resolves in the city registry, exactly ─────────────
  // Located by string, not by regex: the place name legitimately contains
  // parentheses ("Fort Liberty (Bragg)"), and building a pattern from it is
  // how an earlier draft of this suite reported a row that was plainly there.
  const label = app.placeLabel;
  const [cityName, region] = label.split(" · ");
  const line = cities.split("\n").find(
    (l) => l.includes(`name: "${cityName}"`) && l.includes(`region: "${region}"`)
  );
  t("the preloaded place exists in the city registry", !!line, label);

  if (line) {
    const num = (k) => {
      const at = line.indexOf(`${k}:`);
      return at < 0 ? NaN : Number(line.slice(at + k.length + 1).match(/^\s*(-?[\d.]+)/)?.[1]);
    };
    const tz = line.match(/tz:\s*"([^"]+)"/)?.[1] ?? "";
    t("registry lat/lng match the preloaded settings exactly",
      num("lat") === app.lat && num("lng") === app.lng,
      `registry ${num("lat")},${num("lng")} · settings ${app.lat},${app.lng}`);
    t("the registry row carries an IANA zone (needed for DST resolution)",
      /^[A-Za-z]+\/[A-Za-z_]+$/.test(tz), tz);
    var zone = tz;
  }

  t("DEFAULT_CITY_KEY selects the preloaded place",
    cities.includes(`DEFAULT_CITY_KEY = "${label}"`), label);

  // ── the picker fallbacks reconstruct the same instant ────────────
  const f = {
    year: pickerFallback(landing, "year"),
    month: pickerFallback(landing, "month"),
    day: pickerFallback(landing, "day"),
    hour12: pickerFallback(landing, "hour12"),
    minute: pickerFallback(landing, "minute"),
    meridiem: pickerFallback(landing, "meridiem"),
  };
  t("every landing picker fallback is readable",
    Object.values(f).every((v) => v !== null), JSON.stringify(f));

  const iso = app.dateISO;
  const parts = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):\d{2}([+-]\d{2}:\d{2})$/);
  t("the preloaded dateISO carries an explicit UTC offset", !!parts, iso);

  if (parts && Object.values(f).every((v) => v !== null)) {
    const [, y, mo, d, hh, mi] = parts;
    const hour24 = f.meridiem === "PM"
      ? (f.hour12 === 12 ? 12 : f.hour12 + 12)
      : (f.hour12 === 12 ? 0 : f.hour12);
    t("picker fallbacks reconstruct the preloaded dateISO exactly",
      Number(y) === f.year && Number(mo) === f.month && Number(d) === f.day
      && Number(hh) === hour24 && Number(mi) === f.minute,
      `picker ${f.year}-${f.month}-${f.day} ${hour24}:${f.minute} · iso ${y}-${mo}-${d} ${hh}:${mi}`);
  }

  // ── the offset is the one actually in force on that date ─────────
  // Guards the DST trap: a birth in late October can fall either side of the
  // changeover, and a hand-written offset is easy to get wrong by an hour.
  if (parts && zone) {
    const stamped = new Date(iso);
    const local = new Intl.DateTimeFormat("en-US", {
      timeZone: zone, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    }).formatToParts(stamped).reduce((a, p) => (a[p.type] = p.value, a), {});
    const hour = local.hour === "24" ? "00" : local.hour;
    t("the stamped offset is the zone's actual offset on that date (DST-correct)",
      local.year === parts[1] && local.month === parts[2] && local.day === parts[3]
      && hour === parts[4] && local.minute === parts[5],
      `${iso} renders in ${zone} as ${local.year}-${local.month}-${local.day} ${hour}:${local.minute}`);
  }

  // ── no placeholder left behind ───────────────────────────────────
  t("the San Antonio 1990 placeholder is gone from the loaded defaults",
    !/1990-03-21T12:30/.test(SRC("app.jsx")) && !/1990-03-21T12:30/.test(SRC("hcrm-app.jsx")),
    "the app no longer opens on a stand-in chart");

  return R;
}
