// Agent grounding and chart-scope regression tests.
//
// These checks pin the user-facing contract introduced with follow-up
// questions: a natal answer must cite that natal chart, a synastry answer
// must preserve A/B ownership, unsupported claims are rejected, and one
// failed draft gets a constrained repair pass before anything is displayed.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");

async function loadSandbox() {
  const sb = {};
  sb.window = sb;
  sb.React = {
    useState: () => [null, () => {}],
    useEffect: () => {},
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
  };
  sb.AstroCore = await import("../../src/present/astro-core.js");
  sb.Houses = await import("../../tools/ephemeris/houses.js");
  vm.createContext(sb);
  for (const file of [
    "vendor/astronomy.browser.min.js",
    "astro.jsx",
    "time.jsx",
    "synastry.jsx",
    "readings.jsx",
    "agent.jsx",
  ]) {
    vm.runInContext(readFileSync(join(ROOT, file), "utf8"), sb, { filename: file });
  }
  return sb;
}

function signOf(sb, planet) {
  return sb.ZODIAC[planet.sign].name;
}

export async function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok: !!ok, detail });
  const sb = await loadSandbox();
  const {
    computeNatal, computeSynastry, chartIdentityKey,
    buildChartPrompt, buildNatalFollowUpPrompt, buildSynastryFollowUpPrompt,
    validateNatalGrounding, validateSynastryGrounding,
    answerNatalFollowUp,
  } = sb;

  const chartA = computeNatal({
    dateISO: "1980-10-21T21:31:00Z",
    lat: 35.1408,
    lng: -79.0058,
    houseSystem: "whole",
    subjectName: "You",
  });
  const chartB = computeNatal({
    dateISO: "1981-02-25T20:32:00Z",
    lat: 29.4241,
    lng: -98.4936,
    houseSystem: "whole",
    subjectName: "Jordan",
  });
  const syn = computeSynastry(chartA, chartB);

  const followUpUi = readFileSync(join(ROOT, "follow-up.jsx"), "utf8");
  const appUi = readFileSync(join(ROOT, "app.jsx"), "utf8");
  const sessionUi = readFileSync(join(ROOT, "session.jsx"), "utf8");
  const synastryUi = readFileSync(join(ROOT, "synastry-view.jsx"), "utf8");
  const pageHtml = readFileSync(join(ROOT, "Resonance Spread.html"), "utf8");
  t("the follow-up component provides a labeled question form and verified answer history",
    /<form className="follow-up-form"/.test(followUpUi)
      && followUpUi.includes("Chart-linked answer")
      && followUpUi.includes("Ask about this"));
  t("the natal session and full spread both expose chart-scoped follow-ups",
    sessionUi.includes('<FollowUpQuestions mode="natal" chart={chart} agentOn={agentOn} />')
      && appUi.includes('mode="natal"'));
  t("the synastry screen exposes the same area with the synastry bundle",
    synastryUi.includes('<FollowUpQuestions mode="synastry" syn={syn} agentOn={agentOn} />'));
  t("the page loads the follow-up component after the agent functions and before its consumers",
    pageHtml.indexOf('src="agent.jsx"') < pageHtml.indexOf('src="follow-up.jsx"')
      && pageHtml.indexOf('src="follow-up.jsx"') < pageHtml.indexOf('src="synastry-view.jsx"'));

  const sunA = chartA.planets.find((p) => p.name === "Sun");
  const moonA = chartA.planets.find((p) => p.name === "Moon");
  const natalPrompt = buildChartPrompt(chartA);
  t("whole-chart prompt names actual signs instead of numeric sign indexes",
    natalPrompt.includes(`your Sun is in ${signOf(sb, sunA)}`)
      && !natalPrompt.includes(`sign ${sunA.sign},`),
    natalPrompt.slice(0, 600));
  t("whole-chart prompt requires familiar language tied to computed facts",
    natalPrompt.includes("Every interpretation must be attached to a named computed fact")
      && natalPrompt.includes("Do not read coordinates, raw degrees, residues, scores, or sign indexes aloud"));

  const natalFollowUp = buildNatalFollowUpPrompt("What drives the relationship pattern?", chartA);
  t("natal follow-up carries the exact current question and chart identity",
    natalFollowUp.includes("What drives the relationship pattern?")
      && natalFollowUp.includes("SOURCE OF TRUTH — CHART FOR YOU")
      && natalFollowUp.includes(`your Moon is in ${signOf(sb, moonA)}`));

  const synFollowUp = buildSynastryFollowUpPrompt("How do our Moons interact?", syn);
  t("synastry follow-up keeps two named chart blocks",
    synFollowUp.includes("CHART A — You")
      && synFollowUp.includes("CHART B — Jordan")
      && synFollowUp.includes("ownership is fixed"));
  t("synastry follow-up includes both users' actual placement data",
    synFollowUp.includes(`your Sun is in ${signOf(sb, sunA)}`)
      && synFollowUp.includes(`Jordan's Sun is in ${signOf(sb, chartB.planets.find((p) => p.name === "Sun"))}`));

  const groundedNatal = `Your Sun is in ${signOf(sb, sunA)}. Your Moon is in ${signOf(sb, moonA)}.`;
  t("natal verifier accepts exact, explicitly owned placements",
    validateNatalGrounding(groundedNatal, chartA, 2).ok);
  t("natal verifier rejects a generic answer with no chart evidence",
    !validateNatalGrounding("You are complex, thoughtful, and resilient.", chartA, 1).ok);

  const wrongSign = sb.ZODIAC.find((z) => z.name !== signOf(sb, sunA)).name;
  const wrongNatal = `Your Sun is in ${wrongSign}. Your Moon is in ${signOf(sb, moonA)}.`;
  const wrongNatalReport = validateNatalGrounding(wrongNatal, chartA, 1);
  t("natal verifier rejects a wrong placement even when another placement is correct",
    !wrongNatalReport.ok && wrongNatalReport.errors.some((e) => e.includes("not")),
    wrongNatalReport.errors.join(" | "));

  const wrongHouseNumber = sunA.house === 12 ? 1 : sunA.house + 1;
  const wrongHouse = `Your Sun is in ${signOf(sb, sunA)}, in the ${sb.HOUSE_ORDINAL[wrongHouseNumber]} house. Your Moon is in ${signOf(sb, moonA)}.`;
  const wrongHouseReport = validateNatalGrounding(wrongHouse, chartA, 1);
  t("natal verifier rejects a wrong house even when the sign is correct",
    !wrongHouseReport.ok && wrongHouseReport.errors.some((e) => e.includes("house")),
    wrongHouseReport.errors.join(" | "));

  const controlled = { ...chartA, planets: [
    {name:'Sun',sign:6,house:1,lon:194 + 23/60 + 7/3600},
    {name:'Moon',sign:0,house:7,lon:14},
    {name:'Mercury',sign:7,house:2,lon:215},
  ], aspectGrid:[{a:'Sun',b:'Moon',aspect:'Opposition',orb:0.3852777778,phase:'separating'}] };
  const anchor = 'Your Sun in Libra. Your Moon in Aries. Your Mercury in Scorpio. ';
  for (const verb of ['occupies','is positioned in','is located in','was in']) {
    const report = validateNatalGrounding(anchor + `Your Sun ${verb} Aries.`,controlled,3);
    t(`natal verifier checks contradictory placement phrasing: ${verb}`,!report.ok && report.errors.some(e => e.includes('not Aries')));
  }
  t('a wrong minor aspect cannot hide behind three correct placements',
    !validateNatalGrounding(anchor + 'Your Sun quintile your Mercury.',controlled,3).ok);
  t('a second unsupported aspect cannot hide behind a first supported aspect',
    !validateNatalGrounding(anchor + 'Your Sun opposite your Moon and your Sun square your Mercury.',controlled,3).ok);
  t('each pair in a coordinated aspect statement is checked',
    !validateNatalGrounding(anchor + 'Your Sun opposite your Moon and your Mercury.',controlled,3).ok);
  t('a supported opposition verb is accepted',
    validateNatalGrounding('Your Sun opposes your Moon.',controlled,1).ok);
  t('the cited orb and phase are checked against the specific natal contact',
    validateNatalGrounding('Your Sun opposition your Moon, orb 0°23′07″, separating.',controlled,1).ok
      && !validateNatalGrounding('Your Sun opposition your Moon, orb 2°23′07″, separating.',controlled,1).ok
      && !validateNatalGrounding('Your Sun opposition your Moon, orb 0°23′07″, applying.',controlled,1).ok);
  t('a correctly cited natal degree is accepted to the supplied arcsecond',
    validateNatalGrounding('Your Sun at 14°23′07″ Libra.',controlled,1).ok);
  t('a fabricated degree is rejected even when the sign and other facts match',
    !validateNatalGrounding(anchor + 'Your Sun at 15°23′07″ Libra.',controlled,3).ok);
  t('the validator attributes coordinated house clauses to the correct bodies',
    validateNatalGrounding('Your Sun in Libra, in the first house and your Moon in Aries, in the seventh house.',controlled,2).ok);
  const minorNames = ['Semisquare','Semisextile','Sesquiquadrate','Novile','Decile','Tridecile','Quintile','BiQuintile','Septile','Undecile','Tredecile'];
  t('all implemented minor aspects are recognized and checked against their own pair',minorNames.every(aspect => {
    const source = { ...controlled, aspectGrid:[{a:'Sun',b:'Mercury',aspect}] };
    return validateNatalGrounding(`Your Sun ${aspect.toLowerCase()} your Mercury.`,source,1).ok
      && !validateNatalGrounding(anchor + `Your Sun ${aspect.toLowerCase()} your Moon.`,source,3).ok;
  }));
  const trajectoryChart = { ...controlled,readingContext:{evidence:{
    transits:{status:'ready',value:{hits:[{T:'Moon',N:'Sun',aspect:'Trine',orb:0.1,phase:'applying'}]}},
    behavioralTrajectories:{status:'ready',value:{status:'ready',byBody:{Sun:[{transitPlanet:'Moon',natalPlanet:'Sun',aspect:'Trine',exactHitDate:'2026-10-15T12:30:00.000Z'}]}}},
  }} };
  t('supplied transiting contacts are kept distinct from natal aspects',
    validateNatalGrounding(anchor + 'Transiting Moon trine natal Sun is located on 2026-10-15.',trajectoryChart,3).ok);
  t('a fabricated transit pair is rejected',
    !validateNatalGrounding(anchor + 'Transiting Mercury trine natal Sun.',trajectoryChart,3).ok);
  t('a fabricated exact transit date is rejected',
    !validateNatalGrounding(anchor + 'Transiting Moon trine natal Sun is located on 2026-10-16.',trajectoryChart,3).ok);
  t('an unknown birth time cannot regain a searched natal-degree contact date',
    !validateNatalGrounding(anchor + 'Transiting Moon trine natal Sun is located on 2026-10-15.',{...trajectoryChart,timeUnknown:true},3).ok);

  const hit = syn.hits[0];
  const groundedSyn = `Your ${hit.a} ${hit.aspect.toLowerCase()} Jordan's ${hit.b}. This connects your ${hit.a} with Jordan's ${hit.b} in the specific way shown by that ${hit.aspect.toLowerCase()}.`;
  const groundedSynReport = validateSynastryGrounding(groundedSyn, syn, 1);
  t("synastry verifier accepts a computed cross-aspect with both owners named",
    groundedSynReport.ok, groundedSynReport.errors.join(" | "));
  t("synastry verifier rejects an owner-free relationship generalization",
    !validateSynastryGrounding(`${hit.a} and ${hit.b} create a powerful connection.`, syn, 1).ok);

  const allAspectNames = ["Conjunction", "Opposition", "Trine", "Square", "Sextile", "Quincunx"];
  const wrongAspect = allAspectNames.find((name) =>
    !(syn.hits || []).some((candidate) => candidate.a === hit.a && candidate.b === hit.b && candidate.aspect === name)
  );
  const swappedClaim = `Your ${hit.a} ${wrongAspect.toLowerCase()} Jordan's ${hit.b}.`;
  const swappedReport = validateSynastryGrounding(swappedClaim, syn, 1);
  t("synastry verifier rejects a cross-chart aspect absent from the computed pair",
    !swappedReport.ok && swappedReport.errors.some((e) => e.includes("does not match")),
    swappedReport.errors.join(" | "));
  t('a second unsupported synastry contact cannot hide behind a valid first contact',
    !validateSynastryGrounding(`Your ${hit.a} ${hit.aspect.toLowerCase()} Jordan's ${hit.b} and your ${hit.a} ${wrongAspect.toLowerCase()} Jordan's ${hit.b}.`,syn,1).ok);
  const scanJd = sb.dateToJD(new Date('2026-10-15T12:00:00.000Z'));
  const scanHitA = {transit:'Mars',natal:'Sun',aspect:'Conjunction',jd:scanJd,dateISO:'2026-10-15T12:00:00.000Z'};
  const scanHitB = {transit:'Saturn',natal:'Moon',aspect:'Square',jd:scanJd+0.25,dateISO:'2026-10-15T18:00:00.000Z'};
  const completedScan = {status:'ready',input:{birthA:chartA.birth,birthB:chartB.birth},
    parameters:{centerAt:'2026-10-15T12:00:00.000Z',startJd:scanJd-183,endJd:scanJd+183,nearDays:0.5},
    hitsA:[scanHitA],hitsB:[scanHitB],hits:[{a:scanHitA,b:scanHitB}],limitations:['Numerical contacts are not relationship event predictions.']};
  const withScan = {...syn,readingContext:{cacheFingerprint:'completed-window-A',evidence:{mutualPerfections:{status:'ready',value:{scans:[completedScan]}}}}};
  const scanFacts = sb.synastryFactBlock(withScan);
  t('relationship prompts contain the completed owner-scoped window and actual paired contact dates',
    scanFacts.includes('pairing tolerance 0.5 days') && scanFacts.includes('2026-10-15T18:00:00.000Z')
      && scanFacts.includes('your transiting Mars conjunction your natal Sun') && scanFacts.includes("Jordan's transiting Saturn square Jordan's natal Moon"));
  t('pending or another-owner mutual scans cannot enter relationship prompt facts',
    sb.synastryFactBlock({...withScan,readingContext:{evidence:{mutualPerfections:{status:'ready',value:{scans:[{...completedScan,status:'pending'}]}}}}}).includes('no completed scan')
      && sb.synastryFactBlock({...withScan,readingContext:{evidence:{mutualPerfections:{status:'ready',value:{scans:[{...completedScan,input:{birthA:chartB.birth,birthB:chartA.birth}}]}}}}}).includes('no completed scan'));
  t('a completed scan contact is accepted separately from cross-chart natal aspects',
    validateSynastryGrounding(groundedSyn + ' Your transiting Mars conjunction your natal Sun, exact at 2026-10-15T12:00:00Z.',withScan,1).ok
      && !validateSynastryGrounding(groundedSyn + ' Your transiting Mars conjunction your natal Sun, exact at 2026-10-16.',withScan,1).ok);
  t('relationship cache and hook identities change when completed scan evidence changes',
    sb.synastryCacheIdentity(withScan) !== sb.synastryCacheIdentity({...withScan,readingContext:{...withScan.readingContext,cacheFingerprint:'completed-window-B'}}));
  t('shared cache revision covers natal exports and both relationship cache paths',
    chartIdentityKey(chartA).startsWith('personal-reading-v2|') && sb.synastryCacheIdentity(syn).startsWith('personal-reading-v2|'));

  const privateContext = { ...chartA,readingContext:{personalText:'Computed astrology context.',eclipseText:'',limitations:[],
    input:{settings:{shareBehavioralDataWithAI:false}},evidence:{livingProfile:{value:{notes:'PRIVATE_OBSERVATION',goals:['PRIVATE_GOAL']}}}} };
  const privatePrompts = [buildChartPrompt(privateContext),sb.buildCardPrompt(chartA.cards[0],privateContext),buildNatalFollowUpPrompt('What does my chart show?',privateContext)];
  t('chart interpretation consent alone does not disclose living-profile observations or goals',
    privatePrompts.every(prompt => !prompt.includes('PRIVATE_OBSERVATION') && !prompt.includes('PRIVATE_GOAL')));
  const sharedContext = { ...privateContext,readingContext:{...privateContext.readingContext,input:{settings:{shareBehavioralDataWithAI:true}}} };
  t('separately opted-in self-reports are labeled as user-shared context',
    buildChartPrompt(sharedContext).includes('PRIVATE_OBSERVATION') && buildChartPrompt(sharedContext).includes('self-reports, not computed astrological facts'));
  const longHistory = Array.from({length:25},(_,i) => ({id:`note-${i}`,domain:'Sun',note:'x'.repeat(800)}));
  const journalContext = { ...sharedContext,readingContext:{...sharedContext.readingContext,
    evidence:{livingProfile:{value:{history:longHistory,observationCount:25,preferences:{goals:'Study chart evidence'}}}}} };
  const sharedSummary = chart => JSON.parse(buildChartPrompt(chart).split('USER-SHARED BEHAVIORAL CONTEXT — self-reports, not computed astrological facts\n')[1]);
  const fallbackSummary = sharedSummary(journalContext);
  t('standalone AI context bounds recent journal notes while retaining aggregate count',
    fallbackSummary.history.length === 10 && fallbackSummary.history[0].id === 'note-15'
      && fallbackSummary.history.every(row => row.note.length === 300) && fallbackSummary.observationCount === 25);
  const contextHelper = readFileSync(join(ROOT,'reading-context.jsx'),'utf8').split('function buildPersonalReadingContext')[0];
  vm.runInContext(contextHelper,sb,{filename:'compact-living-summary'});
  const compactSummary = sharedSummary(journalContext);
  t('the shared context helper also limits AI disclosure to ten short observations',
    compactSummary.history.length === 10 && compactSummary.history.every(row => row.note.length === 300)
      && compactSummary.preferences.goals === 'Study chart evidence' && compactSummary.observationCount === 25);

  const overlay = syn.overlaysBonA[0];
  const overlayAnswer = `Jordan's ${overlay.planet} falls in your ${sb.HOUSE_ORDINAL[overlay.house]} house, placing that part of Jordan's chart in a specific area of your chart.`;
  const overlayReport = validateSynastryGrounding(overlayAnswer, syn, 1);
  t("synastry verifier accepts a correctly directed house overlay",
    overlayReport.ok, overlayReport.errors.join(" | "));
  const wrongOverlayHouse = overlay.house === 12 ? 1 : overlay.house + 1;
  const wrongOverlay = `Jordan's ${overlay.planet} falls in your ${sb.HOUSE_ORDINAL[wrongOverlayHouse]} house.`;
  const wrongOverlayReport = validateSynastryGrounding(wrongOverlay, syn, 1);
  t("synastry verifier rejects a house overlay with the wrong direction or house",
    !wrongOverlayReport.ok && wrongOverlayReport.errors.some((e) => e.includes("does not fall")),
    wrongOverlayReport.errors.join(" | "));

  const renamed = { ...chartA, birth: { ...chartA.birth, subjectName: "Another person" } };
  t("chart cache identity changes with the subject label",
    chartIdentityKey(chartA) !== chartIdentityKey(renamed));
  const movedHouse = {
    ...chartA,
    planets: chartA.planets.map((p, index) => index === 0 ? { ...p, house: p.house === 12 ? 1 : p.house + 1 } : p),
  };
  t("chart cache identity changes with computed house placement",
    chartIdentityKey(chartA) !== chartIdentityKey(movedHouse));

  let calls = 0;
  sb.window.claude = {
    complete: async () => {
      calls += 1;
      return calls === 1 ? "You have a meaningful and layered personality." : groundedNatal;
    },
  };
  const repaired = await answerNatalFollowUp("What stands out?", chartA);
  t("a generic first draft is repaired once and only the grounded answer is returned",
    calls === 2 && repaired === groundedNatal, `calls=${calls}; answer=${repaired}`);

  calls = 0;
  sb.window.claude = {
    complete: async () => {
      calls += 1;
      return "The chart data does not contain a verified employment history, so that event cannot be determined from the computed chart facts.";
    },
  };
  const bounded = await answerNatalFollowUp("Which company hired me first?", chartA);
  t("a clear source-limit answer is accepted without forcing an invented chart claim",
    calls === 1 && bounded.includes("cannot be determined"), `calls=${calls}; answer=${bounded}`);

  return rows;
}
