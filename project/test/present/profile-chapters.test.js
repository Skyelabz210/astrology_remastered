// Local profile + Life Chapters integration.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const read = (file) => readFileSync(join(ROOT, file), "utf8");

export async function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok: !!ok, detail });
  const memory = new Map();
  const localStorage = {
    getItem: (key) => memory.has(key) ? memory.get(key) : null,
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
  };

  const sb = { localStorage };
  sb.window = sb;
  sb.AstroCore = await import("../../src/present/astro-core.js");
  sb.Houses = await import("../../tools/ephemeris/houses.js");
  vm.createContext(sb);
  for (const file of [
    "vendor/astronomy.browser.min.js", "astro.jsx", "time.jsx", "cities.jsx", "chapters.jsx",
  ]) {
    vm.runInContext(read(file), sb, { filename: file });
  }

  const natal = sb.computeNatal({
    dateISO: "1980-10-21T21:31:00Z",
    lat: 35.1408,
    lng: -79.0058,
    tz: "America/New_York",
    placeLabel: "Fort Liberty (Bragg) · NC",
    placeKey: "Fort Liberty (Bragg) · NC",
    subjectName: "Anthony",
    houseSystem: "whole",
    sect: "auto",
  });
  const rawChapters = [
    { id: "ny", placeKey: "New York · NY", startISO: "2000-01-01", endISO: "2010-01-01" },
    { id: "la", placeKey: "Los Angeles · CA", startISO: "2010-01-01", endISO: "" },
  ];
  const normalized = sb.normalizeChapters(rawChapters, natal);
  t("two canonical residence rows normalize without loss",
    normalized.chapters.length === 2 && normalized.dropped === 0);
  t("the open final residence is active at a present-day target",
    sb.activeChapter(normalized.chapters, natal, sb.dateToJD(new Date("2026-10-02T12:00:00Z"))).place.placeKey === "Los Angeles · CA");
  const futureOnly = sb.normalizeChapters([
    { placeKey: "London · GB", startISO: "2035-01-01", endISO: "" },
  ], natal).chapters;
  t("a future move is never used for an earlier target",
    sb.activeChapter(futureOnly, natal, sb.dateToJD(new Date("2026-10-02T12:00:00Z"))) === null);

  const targetJd = sb.dateToJD(new Date("2026-10-02T12:00:00Z"));
  const solarReturn = sb.returnChart(natal, "Sun", targetJd, rawChapters);
  t("return charts use the residence active on the exact return date",
    solarReturn.relocated === true && solarReturn.placeLabel === "Los Angeles · CA");
  t("the relocated return carries the active residence coordinates",
    solarReturn.chart.birth.lat === 34.0522 && solarReturn.chart.birth.lng === -118.2437);

  const unknown = { ...natal, timeUnknown: true, birth: { ...natal.birth, timeUnknown: true } };
  const unknownDigest = sb.chapterDigest(unknown, normalized.chapters).join(" ");
  t("unknown-time relocation withholds derived angle and house claims",
    unknownDigest.includes("withheld because the birth time is unknown") &&
    !unknownDigest.includes("rising") && !unknownDigest.includes("Houses shift"));

  const settings = {
    dateISO: natal.birth.dateISO,
    lat: natal.birth.lat,
    lng: natal.birth.lng,
    placeLabel: natal.birth.placeLabel,
    placeKey: natal.birth.placeKey,
    subjectName: "Anthony",
    houseSystem: "whole",
    agentOn: false,
    secretThatMustNotPersist: "nope",
  };
  const birthForm = {
    year: 1980, month: 10, day: 21, hour12: 5, minute: 31,
    meridiem: "PM", place: natal.birth.placeKey, subjectName: "Anthony",
    timeUnknown: false, injected: "drop me",
  };
  t("ProfileStore saves an atomic local profile", sb.ProfileStore.save(settings, rawChapters, birthForm));
  const stored = JSON.parse(memory.get(sb.PROFILE_STORAGE_KEY));
  t("profile persistence allowlists settings and form fields",
    stored.settings.subjectName === "Anthony" &&
    stored.settings.secretThatMustNotPersist === undefined &&
    stored.birthForm.injected === undefined);
  const loaded = sb.ProfileStore.load();
  t("saved birth form and life chapters round-trip",
    loaded.birthForm.place === "Fort Liberty (Bragg) · NC" && loaded.chapters.length === 2);

  sb.ProfileStore.clear();
  t("forgetting a profile removes only the profile storage key",
    memory.get(sb.PROFILE_STORAGE_KEY) === undefined);

  const html = read("Resonance Spread.html");
  const app = read("app.jsx");
  const landing = read("landing.jsx");
  const profile = read("profile.jsx");
  t("the production page loads chapters and profile UI before app.jsx",
    html.indexOf('src="chapters.jsx"') > 0 &&
    html.indexOf('src="profile.jsx"') > html.indexOf('src="chapters.jsx"') &&
    html.indexOf('src="profile.jsx"') < html.indexOf('src="app.jsx"'));
  t("app startup hydrates saved settings, birth form, and chapters",
    app.includes("window.ProfileStore.load()") && app.includes("storedProfile.birthForm") && app.includes("storedProfile.chapters"));
  t("the natal entry captures the reader's name and exposes the local profile editor",
    landing.includes("Name for the reading") && landing.includes("LifeChaptersEditor"));
  t("the profile editor explains relocation and keeps explicit save/forget controls",
    profile.includes("Your natal planets stay fixed") &&
    profile.includes("save profile locally") && profile.includes("forget saved profile"));

  const alpha = sb.alphaLifeChapters(settings);
  const flow = sb.normalizeChapters(alpha, natal);
  t("alpha journey resolves all four canonical places", flow.dropped === 0 && flow.chapters.length === 4);
  for (const [date, key] of [["1980-10-21T21:31:00Z", "Fort Liberty (Bragg) · NC"], ["1980-10-22T00:00:00Z", "Wetzlar · DE"], ["1993-10-22T00:00:00Z", "Fort Leonard Wood · MO"], ["1996-10-22T00:00:00Z", "San Antonio · TX"]]) {
    t(`alpha residence boundary ${date}`, sb.chapterAt(flow.chapters, sb.dateToJD(new Date(date))).placeKey === key);
  }
  t("approximate dates survive normalization and storage", flow.chapters.every(ch => ch.approximate) && sb.profileChapters(alpha).every(ch => ch.approximate));
  t("another birth date cannot inherit alpha residences", sb.alphaLifeChapters({ ...settings, dateISO: "1993-06-10T14:45:00Z" }).length === 0);
  t("another birthplace cannot inherit alpha residences", sb.alphaLifeChapters({ ...settings, lat: -33.86, lng: 151.2 }).length === 0);
  t("alpha seed returns independent editable rows", sb.alphaLifeChapters(settings)[0] !== alpha[0]);
  t("misspelled Wezlar resolves to Wetzlar without borrowing a city", sb.chapterCity("Wezlar").name === "Wetzlar");
  const alphaReturn = sb.returnChart(natal, "Sun", targetJd, alpha);
  t("current alpha returns use San Antonio while natal remains Bragg", alphaReturn.chart.birth.lat === 29.4241 && natal.birth.lat === 35.1408);
  return rows;
}
