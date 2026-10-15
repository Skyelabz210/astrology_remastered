// Astronomy and civil-time adapters belong outside the float-free core.
// Integer sector assignments are exact after the stated ayanamsha quantization.
import { FRAMES } from '../core/variants.js';
const RING = 1296000n, MANSION = 48000n;
export const NAKSHATRAS = ['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishta','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];
export const DASHA_LORDS = ['Ketu','Venus','Sun','Moon','Mars','Rahu','Jupiter','Saturn','Mercury'];
export const DASHA_YEARS = [7,20,6,10,7,18,16,19,17];
export const DAY_SIGNS = ['Imix','Ik','Akbal','Kan','Chicchan','Cimi','Manik','Lamat','Muluc','Oc','Chuen','Eb','Ben','Ix','Men','Cib','Caban','Etznab','Cauac','Ajaw'];
export const HAAB_MONTHS = ['Pop','Wo','Sip','Sotz','Sek','Xul','Yaxkin','Mol','Chen','Yax','Sak','Keh','Mak','Kankin','Muwan','Pax','Kayab','Kumku','Wayeb'];
const mod = (a,b) => ((a % b) + b) % b;
const integerLongitude = value => {
  if (typeof value !== 'bigint' || value < 0n || value >= RING) throw new TypeError('An admitted integer longitude in [0,1296000) is required.');
  return value;
};
export function ayanamshaArcsec(jd, id = 'lahiri') {
  if (!Number.isFinite(jd) || jd < 2378496.5 || jd > 2524593.5) throw new RangeError('Ayanamsha approximation supports 1800–2200.');
  const frame = FRAMES.find(f => f.id === id && ['lahiri','krishnamurti','raman','fagan_bradley'].includes(id));
  if (!frame) throw new Error('Unsupported ayanamsha.');
  const t = (jd - 2451545) / 36525;
  // IAU 2006 general precession in longitude, anchored to this repository's
  // declared J2000 offsets; not an official recalculation of each school.
  const precession = 5028.796195*t + 1.1054348*t*t + 0.00007964*t**3 - 0.000023857*t**4;
  return frame.offset_arcsec + BigInt(Math.round(precession));
}
export function nakshatra(tropicalArcsec, offsetArcsec) {
  integerLongitude(tropicalArcsec);
  if (typeof offsetArcsec !== 'bigint') throw new TypeError('Integer ayanamsha required.');
  const sidereal = mod(tropicalArcsec - offsetArcsec, RING), index = Number(sidereal / MANSION), within = sidereal % MANSION;
  return { index, name: NAKSHATRAS[index], lord: DASHA_LORDS[index % 9], pada: Number(within / 12000n) + 1,
    siderealArcsec: String(sidereal), offsetArcsec: String(offsetArcsec), withinArcsec: String(within),
    elapsedNumerator: String(within), elapsedDenominator: String(MANSION) };
}
export function vimshottari(tropicalMoonArcsec, offsetArcsec, birthISO, targetISO = birthISO) {
  const moon = nakshatra(tropicalMoonArcsec, offsetArcsec);
  const birth = new Date(birthISO).getTime(), target = new Date(targetISO).getTime();
  if (!Number.isFinite(birth) || !Number.isFinite(target)) throw new RangeError('Valid birth and target instants required.');
  const year = 31557600000n; // Explicit 365.25-day year; civil anniversaries differ.
  const startIndex = moon.index % 9, firstLength = BigInt(DASHA_YEARS[startIndex]) * year;
  let start = BigInt(birth) - firstLength * BigInt(moon.withinArcsec) / MANSION;
  const periods = [];
  const iso = ms => new Date(Number(ms)).toISOString();
  for (let step = 0; step < 18; step++) {
    const lordIndex = (startIndex + step) % 9, length = BigInt(DASHA_YEARS[lordIndex]) * year, end = start + length;
    const subperiods = []; let cumulative = 0n;
    for (let sub = 0; sub < 9; sub++) {
      const subIndex = (lordIndex + sub) % 9, from = start + length * cumulative / 120n;
      cumulative += BigInt(DASHA_YEARS[subIndex]);
      const until = start + length * cumulative / 120n;
      subperiods.push({ lord: DASHA_LORDS[subIndex], from: iso(from), until: iso(until), active: target >= Number(from) && target < Number(until) });
    }
    periods.push({ lord: DASHA_LORDS[lordIndex], years: DASHA_YEARS[lordIndex], from: iso(start), until: iso(end), active: target >= Number(start) && target < Number(end), subperiods });
    start = end;
  }
  return { moon, periods, active: periods.find(p => p.active) || null,
    convention: 'Vimshottari, 120-year cycle; 365.25-day years, continuous from the natal lunar mansion fraction. Dates are model estimates; ayanamsha and birth-time uncertainty apply.' };
}
export function mayanCalendar(civilDate) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(civilDate);
  if (!match) throw new RangeError('Use a Gregorian YYYY-MM-DD civil date.');
  const [year,month,day] = match.slice(1).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  if (month < 1 || month > 12 || day < 1 || day > [31,leap?29:28,31,30,31,30,31,31,30,31,30,31][month-1]) throw new RangeError('Invalid Gregorian date.');
  const a = Math.floor((14-month)/12), y = year+4800-a, m = month+12*a-3;
  const jdn = day + Math.floor((153*m+2)/5) + 365*y + Math.floor(y/4) - Math.floor(y/100) + Math.floor(y/400) - 32045;
  const days = jdn - 584283, sacred = mod(days,260), solar = mod(days+348,365);
  return { civilDate, jdn, correlation: 'GMT 584283; proleptic Gregorian civil date; other correlations and day-boundary traditions differ.',
    daysSinceEpoch: days, tzolkin: { number: mod(days+3,13)+1, name: DAY_SIGNS[mod(days+19,20)], index: sacred },
    haab: { day: solar % 20, month: HAAB_MONTHS[Math.floor(solar/20)], index: solar } };
}
if (typeof window !== 'undefined') window.Traditions = { ayanamshaArcsec, nakshatra, vimshottari, mayanCalendar };
