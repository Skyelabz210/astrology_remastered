// Local profile + Life Chapters integration.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { transformSync } from "esbuild";

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

  const returnHome = [
    { placeKey: "Wetzlar · DE", startISO: "1980-10-22", endISO: "1993-10-22" },
    { placeKey: "Fort Liberty (Bragg) · NC", startISO: "1993-10-22", endISO: "" },
    { placeKey: "London · GB", startISO: "2035-01-01", endISO: "" },
  ];
  const homeContext = sb.chapterAware(natal, returnHome, targetJd);
  t("moving back home replaces the earlier foreign residence", homeContext.active.place.placeKey === natal.birth.placeKey);
  t("the natal-place chapter is retained before a future move", homeContext.chapters.length === 3 && homeContext.active.place.placeKey !== "London · GB");
  t("residence immediately before returning home remains Wetzlar", sb.chapterAware(natal, returnHome,
    sb.dateToJD(new Date("1993-10-21T23:59:59Z"))).active.place.placeKey === "Wetzlar · DE");
  t("residence on the exact return-home boundary is the birthplace", sb.chapterAware(natal, returnHome,
    sb.dateToJD(new Date("1993-10-22T00:00:00Z"))).active.place.placeKey === natal.birth.placeKey);
  for (const body of ["Sun", "Moon"]) {
    const r = sb.returnChart(natal, body, targetJd, returnHome);
    t(`${body} return after moving home uses the natal coordinates`, r.chart.birth.lat === natal.birth.lat && r.chart.birth.lng === natal.birth.lng && r.placeLabel === natal.birth.placeLabel);
  }
  for (const [field, value] of [["startISO", "garbage"], ["endISO", "garbage"], ["startISO", "2025-02-30"], ["endISO", "2024-04-31"], ["startISO", "2025-13-01"], ["startISO", "2025-02-30T12:00:00Z"], ["startISO", "2025-01-01T24:00:00Z"]]) {
    const invalid = sb.normalizeChapters([{ placeKey: "Wetzlar · DE", startISO: "2000-01-01", endISO: "", [field]: value }], natal);
    t(`invalid chapter ${field} ${value} cannot become residence coverage`, invalid.dropped === 1 && invalid.chapters.length === 0);
  }
  t("a valid leap-day chapter date is preserved", sb.parseChapterDate("2024-02-29", null) === sb.dateToJD(new Date("2024-02-29T00:00:00Z")));
  t("year-only boundaries retain their documented noon convention", sb.parseChapterDate("1981", null) === sb.dateToJD(new Date("1981-01-01T12:00:00Z")));
  t("year-month boundaries retain their documented noon convention", sb.parseChapterDate("1981-06", null) === sb.dateToJD(new Date("1981-06-01T12:00:00Z")));
  t("zoned ISO boundary times resolve to the correct instant", sb.parseChapterDate("1981-06-01T14:00:00+02:00", null) === sb.dateToJD(new Date("1981-06-01T12:00:00Z")));
  const omitted = sb.normalizeChapters([{ placeKey: "Wetzlar · DE", startISO: "", endISO: "" }], natal);
  t("omitted chapter boundaries still mean birth to ongoing", omitted.dropped === 0 && omitted.chapters[0].startJd === natal.jd && omitted.chapters[0].open);
  const invalidContext = sb.chapterAware(natal, [{ placeKey: "Wetzlar · DE", startISO: "2025-02-30" }], targetJd);
  t("all-invalid histories retain their dropped count for visible feedback", invalidContext.dropped === 1 && invalidContext.active === null && invalidContext.chapters.length === 0);

  // Exercise the actual App handlers: a global edited flag previously
  // allowed another person to inherit the alpha residence biography.
  function appHarness(saved = null) {
    const hooks = []; let cursor = 0;
    const useState = initial => {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === "function" ? initial() : initial;
      return [hooks[index], value => { hooks[index] = typeof value === "function" ? value(hooks[index]) : value; }];
    };
    const react = { useState, useMemo: fn => fn(), useCallback: fn => fn, useEffect() {}, useLayoutEffect() {},
      useRef: initial => { const index = cursor++; if (!(index in hooks)) hooks[index] = { current: initial }; return hooks[index]; },
      createElement: (type, props, ...children) => ({ type, props: { ...props, children: children.length === 1 ? children[0] : children } }) };
    const box = { React: react, console, Date, ProfileStore: { load: () => saved, save: (...args) => sb.ProfileStore.save(...args), clear() {} },
      sameBirthRecord: sb.sameBirthRecord, chapterBirthKey: sb.chapterBirthKey, chapterRowsFor: sb.chapterRowsFor, alphaLifeChapters: sb.alphaLifeChapters,
      useTechniqueNavigation() {},
      Landing() {}, document: { getElementById() {} }, ReactDOM: { createRoot: () => ({ render() {} }) } };
    box.window = box;
    box.useTweaks = initial => { const [value, set] = useState(initial); return [value, (key, next) => set(prior => ({ ...prior, ...(typeof key === "object" ? key : { [key]: next }) }))]; };
    vm.createContext(box);
    vm.runInContext(transformSync(read("app.jsx"), { loader: "jsx" }).code, box);
    return () => { cursor = 0; return box.App().props.children.props; };
  }
  const otherBirth = { dateISO: "1993-06-10T11:45:00Z", lat: -33.8688, lng: 151.2093, tz: "Australia/Sydney",
    subjectName: "Other reader", placeKey: "Sydney · AU", placeLabel: "Sydney · AU", timeUnknown: false,
    formState: { year: 1993, month: 6, day: 10, hour12: 9, minute: 45, meridiem: "PM", place: "Sydney · AU", subjectName: "Other reader" } };
  const ownChapters = [{ id: "other-la", placeKey: "Los Angeles · CA", startISO: "2010-01-01", endISO: "" }];
  const renderApp = appHarness();
  let entry = renderApp();
  t("changing the form birth reads an empty owner-scoped chapter collection", entry.chaptersForBirth(otherBirth).length === 0);
  entry.onChaptersChange(ownChapters, otherBirth); entry = renderApp();
  t("a new reader can add a chapter without inheriting alpha rows", entry.chaptersForBirth(otherBirth).length === 1 && entry.chaptersForBirth(otherBirth)[0].id === "other-la");
  t("the alpha journey remains separately editable", entry.chaptersForBirth(natal.birth).length === 4);
  entry.onSaveProfile(otherBirth); entry = renderApp();
  t("saving a new reader persists only their own residence rows", sb.ProfileStore.load().chapters.length === 1 && sb.ProfileStore.load().chapters[0].id === "other-la");
  entry.onCast(otherBirth); let session = renderApp();
  t("casting after a chapter edit cannot transfer the alpha biography", session.settings.lat === otherBirth.lat && session.chapters.length === 1 && session.chapters[0].id === "other-la");
  session.onBack(); entry = renderApp();
  t("renaming the same birth preserves that person's chapter collection", entry.chaptersForBirth({ ...otherBirth, subjectName: "Renamed reader" }).length === 1);
  entry.onChaptersChange([{ ...ownChapters[0], id: "edited-alpha" }], natal.birth); entry = renderApp();
  entry.onCast(otherBirth); session = renderApp();
  t("editing the alpha collection before switching cannot overwrite another birth's chapters", session.chapters.length === 1 && session.chapters[0].id === "other-la");
  const storedRender = appHarness({ settings, birthForm, chapters: rawChapters, savedAt: "2026-10-02T12:00:00Z" });
  const storedEntry = storedRender();
  t("stored custom histories are preserved instead of replaced by alpha defaults", storedEntry.chaptersForBirth(natal.birth).length === 2 && storedEntry.chaptersForBirth(natal.birth)[0].id === "ny");

  // Render the real summary/editor in a lightweight element tree to verify
  // validation remains visible when normalization drops every row.
  const ui = { React: { useMemo: fn => fn(), useState: () => [false, () => {}], createElement: (type, props, ...children) => ({ type: typeof type === "string" ? type : "component", props, children }) },
    normalizeChapters: sb.normalizeChapters, activeChapter: sb.activeChapter, chapterDigest: sb.chapterDigest,
    chapterCity: sb.chapterCity, parseChapterDate: sb.parseChapterDate, dateToJD: sb.dateToJD,
    CITIES: vm.runInContext("CITIES", sb), cityKey: vm.runInContext("cityKey", sb), SearchablePicker() {} };
  ui.window = ui; vm.createContext(ui);
  vm.runInContext(transformSync(profile, { loader: "jsx" }).code, ui);
  const invalidRows = [{ placeKey: "Wetzlar · DE", startISO: "2025-02-30", endISO: "" }];
  const summaryText = JSON.stringify(ui.LifeChapterSummary({ chart: natal, chapters: invalidRows }));
  t("all-invalid residence rows show skipped-entry feedback in the chart", summaryText.includes("No usable residence history") && summaryText.includes("skipped because the place or dates were invalid"));
  const editorTree = ui.LifeChaptersEditor({ chapters: invalidRows, onChange() {}, onSave() {} });
  const editorText = JSON.stringify(editorTree);
  t("the chapter editor identifies impossible dates and disables saving", editorText.includes("The start date must be a real calendar date.") && editorText.includes('"className":"profile-save","disabled":true'));
  const consentRender = appHarness({settings:{...settings,shareBehavioralDataWithAI:true},birthForm,chapters:rawChapters,savedAt:"2026-10-02T12:00:00Z"});
  consentRender().onCast(otherBirth);
  t("private feedback sharing is reset when casting another birth",consentRender().settings.shareBehavioralDataWithAI===false);
  const saveConsentRender = appHarness({settings:{...settings,shareBehavioralDataWithAI:true},birthForm,chapters:rawChapters,savedAt:"2026-10-02T12:00:00Z"});
  saveConsentRender().onSaveProfile(otherBirth);
  t("saving another birth cannot inherit private feedback consent",sb.ProfileStore.load().settings.shareBehavioralDataWithAI===false);
  return rows;
}
