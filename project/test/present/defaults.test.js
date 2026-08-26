// test/present/defaults.test.js — the app's default nativity, asserted to
// be ONE nativity across every file that carries a copy of it.
//
// Four files independently state where the app opens:
//
//   app.jsx        DEFAULT_SETTINGS  — the spread's chart (ISO instant + lat/lng)
//   hcrm-app.jsx   HCRM_DEFAULTS     — the register console's chart (same)
//   landing.jsx                      — the entry form's initial pickers
//                                      (month/day/year/hour/minute/meridiem)
//   cities.jsx     DEFAULT_CITY_KEY  — the place those pickers resolve against
//
// They cannot be collapsed into one constant: the two DEFAULT blocks are
// EDITMODE-delimited JSON that the host tooling rewrites in place, and the
// landing pickers are calendar fields rather than an instant. So instead of
// a shared constant this suite is the coupling — editing one file alone
// fails here rather than silently splitting the app's idea of "the default
// chart" four ways.
//
// The picker check is the real one: it does not compare numbers, it runs
// the pickers' values through the SAME tzresolve.js call landing.jsx's
// submit handler uses, against the default city's real IANA zone, and
// requires the resulting instant to be the one in DEFAULT_SETTINGS. That is
// what catches a wrong DST offset — 1980-10-21 is inside US daylight time
// (which ended 26 October that year), so the correct offset is −04:00, and
// a hand-written −05:00 would be an hour wrong in a way no eyeball on the
// literals would catch.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resolveUtcInstant } from "../../tzresolve.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const read = (f) => readFileSync(join(ROOT, f), "utf8");

/** Pull an EDITMODE-delimited JSON block out of a .jsx source file. */
function editModeBlock(src, constName) {
  const re = new RegExp(`const\\s+${constName}\\s*=\\s*/\\*EDITMODE-BEGIN\\*/([\\s\\S]*?)/\\*EDITMODE-END\\*/`);
  const m = src.match(re);
  if (!m) return null;
  return JSON.parse(m[1]);
}

/** Read a `React.useState(initial?.<field> ?? <literal>)` default out of landing.jsx. */
function landingDefault(src, field) {
  // Two shapes are in the file: a bare literal, and the partner-aware
  // ternary `(isPartner ? <partner> : <owner>)`. The owner's value is what
  // the app's default chart is, so the ternary's ELSE branch is taken.
  const ternary = new RegExp(`initial\\?\\.${field}\\s*\\?\\?\\s*\\(isPartner\\s*\\?\\s*[^:]+:\\s*([^)]+)\\)`);
  const plain = new RegExp(`initial\\?\\.${field}\\s*\\?\\?\\s*([^)]+)\\)`);
  const m = src.match(ternary) || src.match(plain);
  if (!m) return null;
  const raw = m[1].trim().replace(/^"(.*)"$/, "$1");
  return /^-?\d+$/.test(raw) ? Number(raw) : raw;
}

export async function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok, detail });

  const appSrc = read("app.jsx");
  const hcrmSrc = read("hcrm-app.jsx");
  const landingSrc = read("landing.jsx");
  const citiesSrc = read("cities.jsx");

  const app = editModeBlock(appSrc, "DEFAULT_SETTINGS");
  const hcrm = editModeBlock(hcrmSrc, "HCRM_DEFAULTS");

  t("app.jsx's DEFAULT_SETTINGS block still parses as JSON", !!app);
  t("hcrm-app.jsx's HCRM_DEFAULTS block still parses as JSON", !!hcrm);
  if (!app || !hcrm) return rows;

  // ── the nativity itself ──────────────────────────────────────────────
  const EXPECTED_ISO = "1980-10-21T17:31:00-04:00";
  const EXPECTED_LAT = 35.1408;
  const EXPECTED_LNG = -79.0058;
  const EXPECTED_PLACE = "Fort Liberty (Bragg) · NC";

  t("the spread opens on 21 October 1980, 17:31 −04:00",
    app.dateISO === EXPECTED_ISO, app.dateISO);
  t("the register console opens on the same instant",
    hcrm.dateISO === app.dateISO, `${hcrm.dateISO} vs ${app.dateISO}`);
  t("both open at the same latitude", app.lat === hcrm.lat && app.lat === EXPECTED_LAT, `${app.lat}`);
  t("both open at the same longitude", app.lng === hcrm.lng && app.lng === EXPECTED_LNG, `${app.lng}`);
  t("both name the same place", app.placeLabel === hcrm.placeLabel && app.placeLabel === EXPECTED_PLACE,
    `${app.placeLabel} vs ${hcrm.placeLabel}`);
  t("neither default marks the birth time unknown",
    app.timeUnknown === false && hcrm.timeUnknown === false);
  t("the default instant is a real, parseable date", !isNaN(new Date(app.dateISO).getTime()));
  t("the date really is 21 October 1980 in UTC terms",
    new Date(app.dateISO).toISOString() === "1980-10-21T21:31:00.000Z",
    new Date(app.dateISO).toISOString());

  // ── the default place resolves to those coordinates ──────────────────
  const cityKeyMatch = citiesSrc.match(/const DEFAULT_CITY_KEY = "([^"]+)"/);
  t("cities.jsx still declares a DEFAULT_CITY_KEY", !!cityKeyMatch);
  t("the default city is the default chart's place",
    !!cityKeyMatch && cityKeyMatch[1] === EXPECTED_PLACE, cityKeyMatch && cityKeyMatch[1]);

  // Parse the city row itself out of cities.jsx so the coordinates the
  // globe and the chart use are asserted to be the same ones.
  const rowRe = /\{\s*name:\s*"Fort Liberty \(Bragg\)",\s*region:\s*"NC",\s*lat:\s*([-\d.]+),\s*lng:\s*([-\d.]+),\s*off:\s*(-?[\d.]+),\s*tz:\s*"([^"]+)"\s*\}/;
  const row = citiesSrc.match(rowRe);
  t("the Fort Liberty row is present in the city registry", !!row);
  if (row) {
    t("the city row's latitude matches DEFAULT_SETTINGS", Number(row[1]) === EXPECTED_LAT, row[1]);
    t("the city row's longitude matches DEFAULT_SETTINGS", Number(row[2]) === EXPECTED_LNG, row[2]);
    t("the city row carries the Eastern IANA zone", row[4] === "America/New_York", row[4]);
  }

  // ── the landing pickers round-trip to the same instant ───────────────
  const year = landingDefault(landingSrc, "year");
  const month = landingDefault(landingSrc, "month");
  const day = landingDefault(landingSrc, "day");
  const hour12 = landingDefault(landingSrc, "hour12");
  const minute = landingDefault(landingSrc, "minute");
  const meridiem = landingDefault(landingSrc, "meridiem");

  t("landing.jsx's picker defaults are all readable",
    [year, month, day, hour12, minute, meridiem].every(v => v !== null),
    JSON.stringify({ year, month, day, hour12, minute, meridiem }));

  t("the pickers open on 21 October 1980",
    year === 1980 && month === 10 && day === 21, `${year}-${month}-${day}`);
  t("the pickers open on 5:31 PM", hour12 === 5 && minute === 31 && meridiem === "PM",
    `${hour12}:${minute} ${meridiem}`);

  // The conversion landing.jsx's submit handler performs, verbatim.
  const h24 = meridiem === "AM" ? (hour12 === 12 ? 0 : hour12) : (hour12 === 12 ? 12 : hour12 + 12);
  t("5 PM converts to hour 17 on the 24-hour clock", h24 === 17, `${h24}`);

  const resolved = resolveUtcInstant({ year, month, day, hour: h24, minute }, "America/New_York");
  t("the default wall-clock time is unambiguous (no DST fold)", resolved.kind === "ok", resolved.kind);
  t("tzresolve puts 21 October 1980 in daylight time, at −04:00",
    resolved.offsetMinutes === -240, `${resolved.offsetMinutes} minutes`);
  t("the pickers resolve to exactly the DEFAULT_SETTINGS instant",
    new Date(resolved.instant).getTime() === new Date(app.dateISO).getTime(),
    `${resolved.instant} vs ${app.dateISO}`);

  // ── voice defaults ───────────────────────────────────────────────────
  t("the default voice engine is ElevenLabs", app.voiceProvider === "elevenlabs", app.voiceProvider);
  t("the default reading voice is Nerissa", app.voiceName === "Nerissa", app.voiceName);
  t("voice narration ships on", app.voiceOn === true, String(app.voiceOn));
  t("no voice ID is hard-coded into the settings — it is resolved by name",
    app.elevenVoiceId === "", JSON.stringify(app.elevenVoiceId));
  t("the settings name a real ElevenLabs model id",
    /^eleven_[a-z0-9_]+$/.test(app.elevenModel || ""), app.elevenModel);

  // The one thing that must NEVER appear in a settings block: the API key.
  // useTweaks() posts every settings change to the host, which writes it
  // back into these very files — so a key here would be committed.
  t("no ElevenLabs API key is stored in app.jsx's settings",
    !Object.keys(app).some(k => /key|secret|token/i.test(k)), Object.keys(app).join(","));
  t("no API key literal appears anywhere in app.jsx",
    !/sk_[A-Za-z0-9]{8,}/.test(appSrc));
  t("elevenlabs.js keeps the key in localStorage, not in the settings",
    /localStorage/.test(read("elevenlabs.js")) && !/DEFAULT_SETTINGS/.test(read("elevenlabs.js")));

  // ── eclipse defaults ─────────────────────────────────────────────────
  t("the default eclipse orb is a positive number of degrees",
    typeof app.eclipseOrb === "number" && app.eclipseOrb > 0 && app.eclipseOrb <= 6, `${app.eclipseOrb}`);
  t("the default eclipse look-ahead is a positive number of years",
    typeof app.eclipseWindow === "number" && app.eclipseWindow >= 1, `${app.eclipseWindow}`);

  // ── the pages actually load the new modules ──────────────────────────
  const spreadHtml = read("Resonance Spread.html");
  t("the app page loads elevenlabs.js as a module",
    /<script type="module" src="elevenlabs\.js"><\/script>/.test(spreadHtml));
  t("the app page loads eclipses.js as a module",
    /<script type="module" src="eclipses\.js"><\/script>/.test(spreadHtml));
  t("the app page loads eclipse-view.jsx",
    /src="eclipse-view\.jsx"/.test(spreadHtml));
  t("elevenlabs.js is loaded before voice.jsx needs it (module scripts run first)",
    spreadHtml.indexOf('src="elevenlabs.js"') < spreadHtml.indexOf('src="voice.jsx"'));
  t("the spread mounts the eclipse panel", /<EclipsePanel\s/.test(appSrc));

  return rows;
}
