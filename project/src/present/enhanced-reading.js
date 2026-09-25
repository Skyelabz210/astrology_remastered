// Presentation adapters only. Each exact register passes ledger admission.
import { admitForCore } from "../ledger/import-ledger.js";
import { computeHcrmRegister } from "../core/hcrm-core.js";
import { divisionProfile, bodyEvents } from "../core/shadow-spine.js";
import { carrySplit } from "../core/carry.js";
import { B8 } from "../core/basis.js";
import { julianDayUTC, ttFromUtc, gmstDeg, gastDeg, meanObliquityDeg, deltaTSeconds } from "../../tools/ephemeris/timescale.js";
import { ascMcFromDate } from "../../tools/ephemeris/houses.js";
import { LEDGER_BODIES, produceBrowserLedger } from "../../tools/ephemeris/browser-ledger.js";
import { eclipticLongitudeOf, prenatalEclipses, contactsFor } from "../../eclipses.js";
import * as AstroCore from "./astro-core.js";

export function buildDiagnostics(entries, dateISO) {
  if (!Array.isArray(entries) || !entries.length) throw new Error("Admitted ledger entries required.");
  const iso = new Date(dateISO).toISOString();
  // Validate the entire batch before evaluating any chart diagnostics.
  entries.forEach(e => {
    admitForCore(e);
    if (e.event_id.split("#")[0] !== iso) throw new Error("Ledger belongs to a different chart instant.");
  });
  const registers = entries.map(e => {
    const x = BigInt(e.longitude_arcsec);
    return {register:computeHcrmRegister(e), events:bodyEvents(x,e.body),
      carry:B8.map(p=>{const c=carrySplit(x,p);return {p:String(p), r:String(c.r), w:String(c.w)};})};
  });
  return {status:"ready", registers, divisions:[3n,12n,36n,108n,7n,13n].map(divisionProfile)};
}

export function buildTimeBasis(chart) {
  const jd = julianDayUTC(chart.birth.dateISO), tt = ttFromUtc(jd);
  const date = new Date(chart.birth.dateISO);
  const gmst = gmstDeg(jd), gast = gastDeg(jd,tt);
  return {deltaTSeconds:deltaTSeconds(date.getUTCFullYear()+(date.getUTCMonth()+0.5)/12),
    gmstDeg:gmst, gastDeg:gast, obliquityDeg:meanObliquityDeg(tt),
    localSiderealDeg:chart.timeUnknown ? null : ((gast+chart.birth.lng)%360+360)%360,
    houseSystem:chart.timeUnknown ? null : chart.houseSystemActual,
    requestedHouseSystem:chart.birth.houseSystem,
    assumedTime:!!chart.timeUnknown,
    basis:"timescale.js: UTC approximates UT1; polynomial ΔT; two-term GAST; IAU2006 mean obliquity",
  };
}

export function realEclipsePoints(Astronomy, chart) {
  if (!Astronomy) return [];
  const time = Astronomy.MakeTime(new Date(chart.birth.dateISO));
  const points = chart.planets.filter(p=>LEDGER_BODIES.includes(p.name)).map(p=>({name:p.name,lon:eclipticLongitudeOf(Astronomy,p.name,time)}));
  if (!chart.timeUnknown) {
    try {
      const angles = ascMcFromDate(new Date(chart.birth.dateISO),chart.birth.lat,chart.birth.lng);
      points.push({name:"ASC",lon:angles.ascDeg},{name:"MC",lon:angles.mcDeg});
    } catch { /* Polar angles unavailable; retain real planets. */ }
  }
  return points;
}

export function eclipseHouse(rec,chart) {
  if (chart.timeUnknown || Math.abs(chart.birth.lat)>66.56) return null;
  if (chart.houseCusps) return AstroCore.houseForCusps(rec.lon,chart.houseCusps);
  return chart.houseSystemActual === "whole"
    ? AstroCore.houseForSign(Math.floor(rec.lon/30),chart.ascSignIdx)
    : AstroCore.houseForLongEqual(rec.lon,chart.asc);
}

const THEMES = {Sun:"identity and purpose",Moon:"emotional needs and home",Mercury:"communication and learning",Venus:"love and values",Mars:"initiative and boundaries",Jupiter:"growth and belief",Saturn:"commitment and responsibility",Uranus:"change and independence",Neptune:"imagination and ideals",Pluto:"power and renewal",ASC:"self-presentation",MC:"public direction"};
export function eclipseReading(rec,chart) {
  if (!rec) return "No eclipse of this type was found in the search window.";
  const house = eclipseHouse(rec,chart);
  const contacts = (rec.contacts||[]).map(c=>`${c.aspect} to natal ${c.name} (${c.orb.toFixed(2)}° orb), highlighting ${THEMES[c.name]||c.name}`);
  return `This ${rec.type} eclipse${house ? ` falls in house ${house}` : ""}. ${contacts.length ? contacts.join("; ")+"." : "No natal contact falls within the selected orb."}${chart.timeUnknown ? " Contacts use the assumed birth time." : ""}`;
}

export function natalEclipseText(Astronomy,chart,orbDeg=2.5) {
  if (!Astronomy) return "";
  const points = realEclipsePoints(Astronomy,chart);
  const pair = prenatalEclipses(Astronomy,chart.birth.dateISO);
  return [pair.solar,pair.lunar].filter(Boolean).map(rec=>{
    const contacts = contactsFor(rec.lon,points,orbDeg);
    return `Prenatal ${rec.type} eclipse, ${rec.peakISO.slice(0,10)}. ${eclipseReading({...rec,contacts},chart)}`;
  }).join(" ");
}

if (typeof window !== "undefined") window.EnhancedReading = {buildDiagnostics,buildTimeBasis,realEclipsePoints,eclipseReading,natalEclipseText,produceBrowserLedger};
