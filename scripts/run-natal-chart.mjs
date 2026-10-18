// run-natal-chart.mjs — Node driver that runs the app's own astro.jsx
// computeNatal() pipeline headlessly (vendored astronomy-engine + houses.js
// solver + tzresolve.js DST-correct local→UTC resolution).
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.join(__dirname, "..", "project");

// ── inputs (overridable via CLI args) ──────────────────────────────────
const argv = process.argv.slice(2);
function arg(name, dflt) {
  const i = argv.indexOf("--" + name);
  return i >= 0 ? argv[i + 1] : dflt;
}
const localDate = arg("date", "1980-10-21");        // YYYY-MM-DD
const localTime = arg("time", "17:31");             // HH:MM (24h, local wall clock)
const birthTz   = arg("tz", "America/New_York");    // IANA zone of birthplace
const lat       = Number(arg("lat", 35.1408));      // Fort Liberty (Bragg), NC
const lng       = Number(arg("lng", -79.0058));
const houseSystem = arg("houses", "placidus");
const currentTz = arg("current-tz", "America/Chicago"); // San Antonio, TX
const currentLat = Number(arg("current-lat", 29.4241));
const currentLng = Number(arg("current-lng", -98.4936));

// ── browser globals the classic scripts expect ────────────────────────
globalThis.window = globalThis;
// astronomy-engine is an ES module in node_modules; the vendored browser
// build is a minified IIFE that only assigns window.Astronomy (no exports).
window.Astronomy = await import(pathToFileURL(path.join(projectDir, "node_modules", "astronomy-engine", "esm", "astronomy.js")).href)
  .then(m => m.default ?? m)
  .catch(() => import("astronomy-engine").then(m => m.default ?? m));
if (!window.Astronomy || typeof window.Astronomy.MakeTime !== "function") {
  throw new Error("Astronomy engine failed to load");
}

// ── repo modules (ES imports) ─────────────────────────────────────────
const Houses = await import(pathToFileURL(path.join(projectDir, "tools", "ephemeris", "houses.js")));
window.Houses = Houses;
const AstroCore = await import(pathToFileURL(path.join(projectDir, "src", "present", "astro-core.js")));
window.AstroCore = AstroCore;
const { resolveUtcInstant } = await import(pathToFileURL(path.join(projectDir, "tzresolve.js")));

// ── evaluate astro.jsx as a classic script in this context ────────────
{
  let src = readFileSync(path.join(projectDir, "astro.jsx"), "utf8");
  // strip JSX if present (this layer is plain JS today, but be safe)
  const f = new Function("window", "Astronomy", "AstroCore", "Houses", "PLANET_ORDER_LOCAL", src + `
    ;Object.assign(globalThis.__natalApi, {
      computeNatal, ZODIAC, PLANET_GLYPH, planetLongitude, dateToJD,
      ascendantDeg, midheavenDeg, residues, houseForSign
    });`);
  globalThis.__natalApi = {};
  f(window, window.Astronomy, AstroCore, Houses, null);
}
const api = globalThis.__natalApi;
if (!api.computeNatal) throw new Error("computeNatal not exported from astro.jsx eval");

// ── resolve birth instant (DST-correct) ───────────────────────────────
const [y, mo, d] = localDate.split("-").map(Number);
const [h, mi] = localTime.split(":").map(Number);
const resolved = resolveUtcInstant({ year: y, month: mo, day: d, hour: h, minute: mi, second: 0 }, birthTz);
if (resolved.kind !== "ok") { console.error("TZ resolution:", JSON.stringify(resolved)); process.exit(1); }
const dateISO = resolved.instant;
console.log(`Birth local time : ${localDate} ${localTime} (${birthTz}, UTC${resolved.offsetMinutes / 60 >= 0 ? "+" : ""}${resolved.offsetMinutes / 60})`);
console.log(`Resolved UTC     : ${dateISO}`);

// ── natal chart via the app's own pipeline ────────────────────────────
const birth = { dateISO, lat, lng, houseSystem, sect: "auto" };
const chart = api.computeNatal(birth);

const fmtDeg = (lon) => {
  const sign = Math.floor(lon / 30), dd = lon - sign * 30;
  const deg = Math.floor(dd), min = Math.floor((dd - deg) * 60);
  return `${String(deg).padStart(2, "0")}°${String(min).padStart(2, "0")}′ ${chart.signs ? chart.signs[sign].name : ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"][sign]}`;
};

console.log("\n=== NATAL CHART ===");
console.log(`Ascendant : ${fmtDeg(chart.asc)}   (mode: ${window.ANGLES_MODE})`);
console.log(`MC        : ${fmtDeg(chart.mc)}`);
console.log(`Sect      : ${chart.isDayChart ? "DAY" : "NIGHT"} chart`);
console.log(`Ephemeris mode: ${window.EPHEMERIS_MODE}`);
console.log("\nPlanets:");
for (const p of chart.planets) {
  const retro = p.retrograde ? " R" : "  ";
  console.log(`  ${p.name.padEnd(10)} ${fmtDeg(p.lon)}${retro}  H${String(p.house).padStart(2)}  spd ${p.speed.toFixed(3)}°/d  dignity: ${p.dignity.kind}`);
}
if (chart.lots) {
  console.log("\nLots:");
  for (const l of chart.lots) console.log(`  ${l.name.padEnd(10)} ${fmtDeg(l.lon)}`);
}
if (chart.aspects) {
  console.log("\nAspects (within orbs):");
  for (const a of chart.aspects) {
    console.log(`  ${a.a ?? a.planetA ?? "?"} ${a.aspect?.name ?? a.name ?? "?"}@${a.angle ?? ""}° ${b_or_c(a)} orb ${(a.orb ?? a.deltaOrb ?? "").toString()} ${a.phase ?? ""}`);
  }
}
function b_or_c(a){ return a.b ?? a.planetB ?? "?"; }

console.log("\nWarnings:", JSON.stringify(chart.positionWarnings ?? [], null, 1));
console.log("\nFull chart keys:", Object.keys(chart).join(", "));

// ── extra reporting: cusps, aspects, patterns, balance ────────────────
if (chart.houseCusps) {
  console.log("\nPlacidus house cusps:");
  chart.houseCusps.forEach((c, i) => console.log(`  H${i + 1}: ${fmtDeg(c)}`));
}
console.log("\nAspect grid (tightest first):");
for (const a of chart.aspectGrid) {
  console.log(`  ${a.a} ${a.aspect} ${a.b}  orb ${a.orb.toFixed(2)}° (${a.phase})`);
}
console.log("\nPatterns:", JSON.stringify(chart.patterns));
console.log("Stelliums:", JSON.stringify(chart.stelliums));
console.log("Element balance:", JSON.stringify(chart.elementCount));
console.log("Modality balance:", JSON.stringify(chart.modalityCount));
console.log("Moon phase:", chart.phase.name ?? JSON.stringify(chart.phase).slice(0, 120), "illum:", chart.phase.illumination?.toFixed?.(3));
console.log("Chart shape:", chart.shape);

// ── relocated local ASC/MC for current residence (San Antonio, TX) ────
{
  const jd = chart.jd;
  const rel = api.ascendantDeg(new Date(dateISO), currentLat, currentLng);
  const relMc = api.midheavenDeg(new Date(dateISO), currentLng);
  console.log("\n=== RELOCATED CHART (local ASC/MC at current residence) ===");
  console.log(`San Antonio, TX (${currentLat}, ${currentLng}, ${currentTz})`);
  console.log(`Relocated Ascendant : ${fmtDeg(rel)}`);
  console.log(`Relocated MC        : ${fmtDeg(relMc)}`);
}
