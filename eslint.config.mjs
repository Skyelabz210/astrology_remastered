// eslint.config.mjs — root flat config. (WP-05)
//
// Scope: project/src/**, project/test/**, project/tools/**, scripts/** (the
// latter two are largely empty until WP-06+/WP-03 land — the globs just pick
// their files up automatically once they exist, no edit needed here).
//
// Deliberately excluded:
//   · project/vendor/**       — third-party vendored code (arrives with WP-17),
//                                not ours to lint.
//   · project/*.js at the project root EXCEPT core-shim.js — api-ref.js,
//     cram-api.js, cram-calc.js, cram-int.js are pre-existing browser-global
//     scripts (IIFEs closing over `window`/`document`, IDs assumed present in
//     the HTML pages that load them). They were tried against this config
//     (browser globals + eslint:recommended) and do not lint clean as-is
//     (undeclared page-specific DOM ids, intentional loose patterns in legacy
//     code) — fixing them is a behavior-risking rewrite out of scope for a
//     tooling-only package, so they stay unlinted for now. core-shim.js IS an
//     ES module (import/export, `typeof window` guard) and lints clean, so it
//     is included — and so is zodiac-globe.js, which is new code of exactly
//     that shape rather than legacy.
//
// project/*.jsx — no longer excluded. It used to be, on the reasoning
// "Babel-standalone JSX, not valid plain JS syntax; no parser is configured
// for it here" — true as far as it went, but flat-config ESLint's default
// parser (espree) parses JSX natively once `parserOptions.ecmaFeatures.jsx`
// is set; no separate JSX parser package was ever actually needed. See
// docs/COMPLETION_AUDIT.md §4 ("lint excludes the whole JSX layer... 'lint
// is clean' covers 69 files and none of the browser application code") for
// why this was worth revisiting.
//
// The real obstacle was `no-undef`: these 22 files are classic <script>
// tags sharing one global namespace (not ES modules — Babel-standalone
// transpiles JSX to React.createElement but does not change module scope),
// so a symbol defined in one file and used in another reads as "not
// defined" to a file-at-a-time linter. JSX_GLOBALS below is every top-level
// function/const/let/var/class binding across all of project/*.jsx,
// generated mechanically (not hand-maintained) by scanning the files
// themselves — see the regeneration command in its own comment. This keeps
// no-undef genuinely meaningful (a real typo — a name matching nothing
// anywhere — still fails) rather than either disabling the rule (silently
// losing the exact class of bug it found the first time it ran: session.jsx
// called a bare `primeSpeech()` that was never defined anywhere, a
// guaranteed ReferenceError crash the instant a user clicked voice
// controls) or hand-declaring ~280 names one at a time (error-prone in a
// way a mechanical scan is not). Declaring a file's own top-level names as
// globals for itself would normally trip `no-redeclare`; `builtinGlobals:
// false` below is the documented escape hatch for exactly this shape of
// setup. `no-empty`'s `allowEmptyCatch` covers this layer's
// `try { window.speechSynthesis.X(); } catch {}` convention (voice.jsx,
// landing.jsx) — a deliberate "best-effort, the Speech API is unreliable
// across browsers" pattern, not a swallowed bug.
//
// Invocation note: `files`/`ignores` globs below are resolved relative to
// process.cwd() at the moment eslint runs — NOT relative to this file's own
// location — whenever `--config` is passed explicitly (verified against this
// eslint version's source, lib/config/config-loader.js:
// `locateConfigFileToUse`: basePath = cwd unless eslint auto-discovers the
// config by searching upward, which we don't rely on). `project/package.json`'s
// "lint" script therefore `cd`s to the repo root before invoking eslint, so
// cwd = repo root here and every pattern below is repo-root-relative, matching
// the paths as written.
//
// Resolution note: this file lives at the repo root, but eslint/@eslint/js/
// globals are installed only under project/node_modules (project/package.json
// is the sole package manifest per the plan — see project/tools/README.md and
// EXECUTION_PLAN.md WP-05/06). Plain `import "@eslint/js"` from a file at the
// repo root would walk node_modules from the root's ANCESTORS, never finding a
// CHILD directory — so bare specifiers are loaded via a require() scoped to a
// path inside project/ instead (Node's CJS algorithm checks that directory's
// own node_modules first). Both packages ship as CommonJS, so this is safe.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(HERE, "project", "package.json"));

const js = require("@eslint/js");
const globals = require("globals");

// The codebase is BigInt-heavy (Mandate A1 pushes all core arithmetic through
// BigInt rather than Number) — `globals.es2022`/ecmaVersion 2022 covers the
// `BigInt` global plus every other ES2022 builtin (Array, JSON, Map, Set,
// Promise, Reflect, globalThis, ...).
const ES_GLOBALS = globals.es2022;
const NODE_GLOBALS = { ...ES_GLOBALS, ...globals.node };
// no-float-core.test.js is a deliberate browser twin of the Node no-float
// audit (see test/no-float-audit.js) — it uses `fetch()` (a Node global too)
// and `location` (browser-only) to detect file:// vs http serving. Declaring
// just that one extra global keeps test/** otherwise honestly Node-scoped
// instead of pulling in the full browser global set.
const TEST_GLOBALS = { ...NODE_GLOBALS, location: "readonly" };

// Every top-level function/const/let/var/class binding across all of
// project/*.jsx, plus React/ReactDOM (loaded from a CDN <script> tag) and
// the window.<Name> namespace objects the non-jsx dual-environment modules
// publish (AstroCore, Astronomy, Contrast, Eclipses, ElevenLabs, HCRM_CORE,
// Houses, HousesPolicy, TzResolve, Validate — accessed bare in these files
// because a browser promotes `window.X` assignments to global identifiers). See the comment
// above the `ignores` block for why this list exists at all.
//
// Regenerate with (repo root, after any *.jsx file gains/loses a top-level
// binding another file depends on):
//   python3 -c '
//   import re, glob
//   names = set()
//   decl = re.compile(r"^(?:function|async function)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(", re.M)
//   const = re.compile(r"^(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=", re.M)
//   klass = re.compile(r"^class\s+([A-Za-z_$][A-Za-z0-9_$]*)", re.M)
//   destr = re.compile(r"^const\s*\{\s*([^}]+?)\s*\}\s*=", re.M)
//   for f in sorted(glob.glob("project/*.jsx")):
//       src = open(f, encoding="utf-8").read()
//       names |= set(decl.findall(src)) | set(const.findall(src)) | set(klass.findall(src))
//       for m in destr.finditer(src):
//           for part in m.group(1).split(","):
//               part = part.strip()
//               if not part: continue
//               alias = part.split(":")[1].strip() if ":" in part else part
//               alias = alias.split("=")[0].strip()
//               if re.match(r"^[A-Za-z_$][A-Za-z0-9_$]*$", alias): names.add(alias)
//   print(",".join(sorted(names)))
//   '
// A newly-added cross-file symbol missing from this list is NOT a silent
// gap: no-undef fails loudly, in CI, on the file that references it — fix
// by adding the one name, not by disabling the rule.
const JSX_GLOBALS = {
  "$cardUseCallback": "readonly", "$cardUseRef": "readonly", "$cardUseState": "readonly", "$ecEffect": "readonly", "$ecMemo": "readonly",
  "$ecState": "readonly", "$hUseEffect": "readonly", "$hUseMemo": "readonly", "$hUseState": "readonly", "$haMemo": "readonly",
  "$haState": "readonly", "$hvEffect": "readonly", "$hvMemo": "readonly", "$hvState": "readonly", "$sUseEffect": "readonly", "$sUseMemo": "readonly",
  "$sUseRef": "readonly", "$sUseState": "readonly", "$synUseEffect": "readonly", "$synUseMemo": "readonly", "$synUseState": "readonly",
  "$useEffect": "readonly", "$useMemo": "readonly", "$useState": "readonly", "A11yChartTable": "readonly", "ARCSEC_CIRCLE": "readonly",
  "ARCSEC_SIGN": "readonly", "ASPECT_FAMILY_SOURCE_TAG": "readonly", "ASPECT_FN": "readonly", "ASPECT_SYMBOL": "readonly", "App": "readonly",
  "AstroCore": "readonly", "Astronomy": "readonly", "BODY_LEDGER": "readonly", "BOUNDARY_LANE_NAMES": "readonly", "BalanceBar": "readonly",
  "BirthGeophysics": "readonly", "Boundary": "readonly", "CITIES": "readonly", "CardBack": "readonly", "CarryPropagation": "readonly",
  "ChartStatusBanners": "readonly", "CinematicStage": "readonly", "ClassLegend": "readonly", "CompatibilityDial": "readonly", "Contrast": "readonly",
  "CramState": "readonly", "DEFAULT_CITY_KEY": "readonly", "DEFAULT_SETTINGS": "readonly", "DEFAULT_VOICE_PROVIDER": "readonly",
  "DIGNITY_SOURCE_TAG": "readonly", "DIGNITY_STATEMENT": "readonly", "DOMICILE": "readonly", "DialRing": "readonly", "Domain": "readonly",
  "DotmatrixGlobe": "readonly", "ELEMENT_FN": "readonly", "ELEVEN_CACHE_MAX": "readonly", "EXALT": "readonly", "EclipseGeo": "readonly",
  "EclipsePanel": "readonly", "EclipseRows": "readonly", "Eclipses": "readonly", "EdgeGraph": "readonly", "ElevenLabs": "readonly",
  "ElevenLabsTweaks": "readonly", "ErrorBanner": "readonly", "ErrorBoundary": "readonly", "FIXTURE_BIRTH": "readonly", "GEAR_ANCHORS": "readonly",
  "GEO_BASIS_NOTE": "readonly", "HAAB_MONTHS": "readonly", "HBoundary": "readonly", "HCRMApp": "readonly", "HCRMConsole": "readonly",
  "HCRM_ASPECTS": "readonly", "HCRM_BASIS": "readonly", "HCRM_CORE": "readonly", "HCRM_DEFAULTS": "readonly", "HOUSE_FUNCTION": "readonly",
  "HOUSE_SHORT": "readonly", "HOUSE_TOPIC": "readonly", "Harness": "readonly", "HcrmStatusBanners": "readonly", "Header": "readonly",
  "Heatmap": "readonly", "HelixViz": "readonly", "Houses": "readonly", "HousesPolicy": "readonly", "KElimination": "readonly",
  "KIND_LABEL": "readonly", "LEGACY_GEAR_INV_MOD": "readonly", "Landing": "readonly", "LatLngTweak": "readonly", "Ledger": "readonly",
  "LiveStatePanel": "readonly", "MAYA_EPOCH_JD": "readonly", "MODALITY_FN": "readonly", "M_SAFE8": "readonly", "M_SHELL6": "readonly",
  "NARRATION_CACHE_MAX": "readonly", "NARRATIVE_MAX_CHARS": "readonly", "NatalTweaks": "readonly", "ORDINAL_HOUSE": "readonly",
  "Odometer": "readonly", "PLANET_FN": "readonly", "PLANET_GLYPH": "readonly", "PLANET_JOY": "readonly", "PLANET_ORDER": "readonly",
  "PLANET_PERIODS": "readonly", "PLANET_PHASE0": "readonly", "PLANET_SIGNIFIES": "readonly", "POWER_WORD_TRANSFORMS": "readonly",
  "PRIME_ROLE": "readonly", "PhaseRing": "readonly", "Picker": "readonly", "PrenatalCard": "readonly", "PrimeLayer": "readonly",
  "QUADRANT_HOUSE_SYSTEMS": "readonly", "QUALITY_SOURCE_TAG": "readonly", "REAL_EPHEMERIS_BODIES": "readonly", "React": "readonly",
  "ReactDOM": "readonly", "ReadingSession": "readonly", "RowDetail": "readonly", "SHADOW_LANE_NAMES": "readonly", "SHELL6": "readonly",
  "SIGN_BODY": "readonly", "SILENT_WAV": "readonly", "STYLE_PRESETS": "readonly", "SUBSTRATE_NOTE": "readonly", "SUITES": "readonly",
  "SYN_ASPECTS": "readonly", "SYN_BODIES": "readonly", "SearchablePicker": "readonly", "SessionControls": "readonly", "SessionHeader": "readonly",
  "SessionScreen": "readonly", "ShadowWheel": "readonly", "ShuffleAnimation": "readonly", "Signature": "readonly", "SpeakerIcon": "readonly",
  "Spread": "readonly", "Stat": "readonly", "SubstrateTweaks": "readonly", "SuiteCard": "readonly", "SynAspectDetail": "readonly",
  "SynastryScreen": "readonly", "SynastryView": "readonly", "Synthesis": "readonly", "SyntheticBadge": "readonly", "TRIP_DAY": "readonly",
  "TRIP_NIGHT": "readonly", "TRIP_PART": "readonly", "TZOLKIN_SIGNS": "readonly", "ToolsMenu": "readonly", "TraditionalPanel": "readonly",
  "TweakButton": "readonly", "TweakColor": "readonly", "TweakLikeText": "readonly", "TweakNumber": "readonly", "TweakRadio": "readonly",
  "TweakRow": "readonly", "TweakSection": "readonly", "TweakSelect": "readonly", "TweakSlider": "readonly", "TweakText": "readonly",
  "TweakToggle": "readonly", "TweaksPanel": "readonly", "TzResolve": "readonly", "VISUAL_CLASSES": "readonly", "VOICE_PREF_KEYWORDS": "readonly",
  "VOICE_PROVIDER_BROWSER": "readonly", "VOICE_PROVIDER_ELEVEN": "readonly", "Validate": "readonly", "VisualTweaks": "readonly",
  "WordReveal": "readonly", "ZODIAC": "readonly", "ZodiacCard": "readonly", "__TWEAKS_STYLE": "readonly", "__TwkCheck": "readonly",
  "__cache": "readonly", "__eleven": "readonly", "__fail": "readonly", "__mod": "readonly", "__narration": "readonly", "__pass": "readonly",
  "__pending": "readonly", "__twkIsLight": "readonly", "antiscion": "readonly", "applyPower": "readonly", "applyingPhase": "readonly",
  "approxAscendantDeg": "readonly", "approxMidheavenDeg": "readonly", "ascendantDeg": "readonly", "aspectArticle": "readonly",
  "aspectMeaning": "readonly", "aspectWeight": "readonly", "bodyEvents": "readonly", "buildBirthISO": "readonly", "buildCardPrompt": "readonly",
  "buildChartNarrative": "readonly", "buildChartPrompt": "readonly", "buildEdges": "readonly", "buildSynastryAspectPrompt": "readonly",
  "buildSynastryOverviewPrompt": "readonly", "cacheKey": "readonly", "cacheKeyFor": "readonly", "calendarRound": "readonly",
  "chartShape": "readonly", "chartSignature": "readonly", "chunkNarrative": "readonly", "cityKey": "readonly", "compatibilityScore": "readonly",
  "computeAllLots": "readonly", "computeHCRM": "readonly", "computeLots": "readonly", "computeNatal": "readonly", "computeSynastry": "readonly",
  "contraAntiscion": "readonly", "cramStep": "readonly", "criticalKind": "readonly", "crossAspects": "readonly", "crossReceptions": "readonly",
  "ctmState": "readonly", "currentTransits": "readonly", "dateToJD": "readonly", "deckOrder": "readonly", "dedupeLanes": "readonly",
  "detectPatterns": "readonly", "dignityFor": "readonly", "dignityMeaning": "readonly", "dominantElement": "readonly", "dwellFor": "readonly",
  "eclipsePointsFor": "readonly", "edgeEvents": "readonly", "edgeResiduePreservation": "readonly", "elevenAudioElement": "readonly",
  "elevenModule": "readonly", "elevenReady": "readonly", "expect": "readonly", "exportReading": "readonly", "faceRuler": "readonly", "factorizeSmall": "readonly",
  "findCity": "readonly", "fmtDate": "readonly", "fmtDateTime": "readonly", "fmtDegree": "readonly", "formatOffset": "readonly",
  "gearClass": "readonly", "haab": "readonly", "hcrmAngle": "readonly", "houseForLongEqual": "readonly", "houseForSign": "readonly",
  "houseOverlays": "readonly", "houseTopic": "readonly", "interpretCard": "readonly", "interpretChart": "readonly",
  "interpretSynastryAspect": "readonly", "interpretSynastryOverview": "readonly", "isJoyHit": "readonly", "isRetrograde": "readonly",
  "isqrtN": "readonly", "kElimWinding": "readonly", "listVoices": "readonly", "lunarPhase": "readonly", "mayaLongCount": "readonly",
  "midheavenDeg": "readonly", "mod360": "readonly", "nAspectMeaning": "readonly", "nDignityMeaning": "readonly", "nHouseTopic": "readonly",
  "nLaneName": "readonly", "nPlanetSignifies": "readonly", "nSignName": "readonly", "narrationCacheKey": "readonly", "narrativeClosing": "readonly",
  "narrativeForCard": "readonly", "narrativeLifecycle": "readonly", "narrativeOpening": "readonly", "narrativeProgressions": "readonly", "nearestAspect": "readonly", "operatorClass": "readonly",
  "phaseSyndrome": "readonly", "pickBrowserVoice": "readonly", "planetDeclination": "readonly", "planetLongitude": "readonly",
  "planetSignifies": "readonly", "planetSpeed": "readonly", "playNarrationChunk": "readonly", "primeElevenAudio": "readonly",
  "progressedAt": "readonly", "progressionsDigest": "readonly", "putCached": "readonly", "quadrantCuspsFor": "readonly", "rankVoice": "readonly", "readingFor": "readonly",
  "realAngles": "readonly", "realEclipticLatitudeDeg": "readonly", "realEclipticLongitudeDeg": "readonly", "realPlanetSpeedDegPerDay": "readonly",
  "receptionFor": "readonly", "registerRow": "readonly", "renderNarrationChunk": "readonly", "requireCore": "readonly", "residues": "readonly",
  "residues8": "readonly", "resolveProvider": "readonly", "rigorousFor": "readonly", "roman": "readonly", "runAllSuites": "readonly",
  "runSuite": "readonly", "segmentTimingsFromAlignment": "readonly", "segmentTimingsFromAlignmentSafe": "readonly",
  "segmentTimingsFromDuration": "readonly", "shadowClusters": "readonly", "signOf": "readonly", "speakBrowser": "readonly",
  "speakEleven": "readonly", "speakNarrative": "readonly", "speakNarrativeBrowser": "readonly", "speakNarrativeEleven": "readonly",
  "speakNow": "readonly", "spokenDate": "readonly", "spokenOrb": "readonly", "starIndex": "readonly", "stopBrowserSpeech": "readonly",
  "stopEleven": "readonly", "stopSpeech": "readonly", "stripMd": "readonly", "suite": "readonly", "synAspect": "readonly", "synastryCTM": "readonly",
  "syntheticCertificate": "readonly", "tcoPeriod": "readonly", "tcoPhase": "readonly", "termRuler": "readonly", "tightAspectsFor": "readonly",
  "toArcsec": "readonly", "tzolkin": "readonly", "useAgentChartReading": "readonly", "useAgentReading": "readonly", "useErrorBanner": "readonly",
  "useNow": "readonly", "useSynastryReading": "readonly", "useTweaks": "readonly", "useVoice": "readonly", "windingLift": "readonly", "transitPerfections": "readonly", "nearestBodyReturns": "readonly", "returnChart": "readonly", "RETURN_BODIES": "readonly", "lifecycleDigest": "readonly", "mergeNearPerfections": "readonly", "mutualPerfections": "readonly", "MUTUAL_SAME_DAY_WINDOW": "readonly",
};

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "project/vendor/**",
      "project/*.js",
      "!project/core-shim.js",
      "!project/zodiac-globe.js",
    ],
  },
  js.configs.recommended,
  {
    files: ["project/src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: ES_GLOBALS,
    },
  },
  {
    // src/demo is the labelled synthetic/presentation boundary (never src/core
    // — see src/demo/SYNTHETIC_DEMO.js's own header) and logs a console
    // banner when a demo surface boots; console is otherwise deliberately not
    // a global anywhere under src/** so a stray console.log in src/core is
    // still a lint error, not just an A1 audit finding.
    files: ["project/src/demo/**/*.js"],
    languageOptions: {
      globals: { console: "readonly" },
    },
  },
  {
    files: ["project/test/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: TEST_GLOBALS,
    },
    rules: {
      // The hand-rolled suites assert self-checking literal arithmetic
      // ("59n * 509n === 30031n && <the actual behavior under test>") as a
      // deliberate convention — the left operand documents the fact being
      // relied on and re-verifies it every run, chained with && into the
      // real assertion. eslint:recommended's no-constant-binary-expression
      // reads that as "left side is always truthy, the && is dead" (a
      // sensible default for hand-written app logic) but it is exactly the
      // pattern this codebase's tests intentionally use throughout — see
      // e.g. test/cram.test.js, test/anchor.test.js, test/variant-coverage.test.js.
      "no-constant-binary-expression": "off",
    },
  },
  {
    // project/bench/** (WP-24) is a Node CLI benchmark script, same shape
    // as project/tools/** and scripts/** — process/console as globals.
    files: ["project/tools/**/*.{js,mjs}", "project/bench/**/*.{js,mjs}", "scripts/**/*.{js,mjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: NODE_GLOBALS,
    },
  },
  {
    // zodiac-globe.js (the landing globe's zodiac stencil) is the same
    // shape as core-shim.js — a root-level dual-environment ES module with
    // a `typeof window` guard publishing onto `window` for the .jsx layer —
    // so it is un-ignored above and shares this block's `window` global.
    files: ["project/core-shim.js", "project/zodiac-globe.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...ES_GLOBALS, window: "readonly" },
    },
  },
  {
    // project/src/present/astro-core.js (WP-21) is, like core-shim.js
    // above, a dual-environment ES module whose bottom guard
    // (`if (typeof window !== "undefined")`) publishes onto `window` for
    // the browser side of the bridge — it needs `window` declared as a
    // global for the same reason core-shim.js does.
    files: ["project/src/present/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...ES_GLOBALS, window: "readonly" },
    },
  },
  {
    // project/tools/ephemeris/houses.js (WP-19) gains the same
    // dual-environment `if (typeof window !== "undefined") window.X = ...`
    // publish tzresolve.js/core-shim.js/astro-core.js use — this file is
    // otherwise plain Node-importable (produce-ledger.mjs, its own test
    // suite), so only it (not the whole tools/ephemeris/**) needs `window`
    // declared as a global.
    files: ["project/tools/ephemeris/houses.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...NODE_GLOBALS, window: "readonly" },
    },
  },
  {
    // See the comment above JSX_GLOBALS's declaration for the full
    // rationale. sourceType "script" (not "module"): these 22 files use no
    // import/export syntax anywhere — Babel-standalone transpiles the
    // JSX, nothing here changes module scoping.
    files: ["project/*.jsx"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...JSX_GLOBALS },
    },
    rules: {
      // Every file in this global-namespace architecture re-declares its
      // own top-level bindings, which are ALSO listed in JSX_GLOBALS so
      // other files can reference them -- without this, every single one
      // of those ~280 declarations would trip "already defined as a
      // built-in global variable" — this is the rule's own documented
      // escape hatch for exactly that shape of setup, not a blanket
      // disable: a genuine redeclaration WITHIN one file (two `const x`
      // at the same scope) is still caught.
      "no-redeclare": ["error", { builtinGlobals: false }],
      // voice.jsx/landing.jsx's `try { window.speechSynthesis.X(); }
      // catch {}` is a deliberate "best-effort, the Speech API is
      // unreliable across browsers" convention, not a swallowed bug —
      // see voice.jsx's own header. Empty non-catch blocks (an accidental
      // `if (x) {}`) are still flagged.
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
];
