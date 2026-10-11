// Traditional conventions use seven classical planets. Minor/harmonic aspects
// are offered separately; declination aspects never use ecliptic longitude.
import { ASPECTS, termRuler, faceRuler, TRIP_DAY, TRIP_NIGHT, TRIP_PART, EXALT } from '../present/astro-core.js';
import { ARCSECONDS_PER_DEGREE, ARCSECONDS_PER_CIRCLE, normalizeArcsec,
  angularSeparationArcsec, signedArcsec } from './angles.js';
import { calculateMoonPhase, prenatalSyzygy } from './moonphase.js';
export { ARCSECONDS_PER_DEGREE, ARCSECONDS_PER_CIRCLE, normalizeArcsec, angularSeparationArcsec };
export const CLASSICAL_PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
export const DOMICILE_RULERS = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];
export const EXALTATION_RULERS = ['Sun', 'Moon', null, 'Jupiter', null, 'Mercury', 'Saturn', null, null, 'Mars', null, 'Venus'];
export const TRADITIONAL_ASPECTS = ASPECTS.map(a => ({ ...a, angleArcsec: a.angle * 3600, orbArcsec: a.orb * 3600 }));
export const DECLINATION_ASPECTS = ['Parallel', 'Contra-Parallel'];
export const TRADITIONAL_ORBS = { Sun: 17 * 3600, Moon: 12.5 * 3600,
  Mercury: 7 * 3600, Venus: 8 * 3600, Mars: 7.5 * 3600, Jupiter: 12 * 3600, Saturn: 10 * 3600 };
export const SOLAR_ORBS = { cazimi: 1020, combust: 8.5 * 3600, underTheBeams: 17 * 3600 };
export function nearestTraditionalAspect(separation, aspects = TRADITIONAL_ASPECTS) {
  const delta = angularSeparationArcsec(separation, 0);
  let best = null;
  for (const aspect of aspects) {
    const error = Math.abs(delta - aspect.angleArcsec);
    if (error <= aspect.orbArcsec && (!best || error < best.sepArcsec))
      best = { ...aspect, sepArcsec: error, exact: error <= 1 };
  }
  return best;
}
export function nearestAspectWithTraditionalOrbs(separation, planetA, planetB) {
  if (!(planetA in TRADITIONAL_ORBS) || !(planetB in TRADITIONAL_ORBS)) return null;
  const orb = (TRADITIONAL_ORBS[planetA] + TRADITIONAL_ORBS[planetB]) / 2;
  return nearestTraditionalAspect(separation, TRADITIONAL_ASPECTS.filter(a => [0, 60, 90, 120, 180].includes(a.angle)).map(a => ({ ...a, orbArcsec: orb })));
}
export function declinationAspects(decA, decB, orbArcsec = 3600) {
  if (![decA, decB, orbArcsec].every(Number.isFinite) || orbArcsec < 0) throw new RangeError('Invalid declination/orb');
  const result = [];
  if (decA * decB >= 0 && Math.abs(decA - decB) <= orbArcsec)
    result.push({ name: 'Parallel', sepArcsec: Math.abs(decA - decB) });
  if (decA * decB < 0 && Math.abs(decA + decB) <= orbArcsec)
    result.push({ name: 'Contra-Parallel', sepArcsec: Math.abs(decA + decB) });
  return result;
}
export function aspectError(lonA, lonB, target) {
  const delta = lonA - lonB;
  const a = signedArcsec(delta - target), b = signedArcsec(delta + target);
  return Math.abs(a) <= Math.abs(b) ? a : b;
}
export function isApplying(lonA, lonB, speedA, speedB, target) {
  const speed = speedA - speedB;
  if (!Number.isFinite(speed)) throw new RangeError('Invalid speed');
  if (Math.abs(speed) < 1e-9) return 'stationary';
  const error = aspectError(lonA, lonB, target);
  if (Math.abs(error) <= 1) return 'exact';
  return error * speed < 0 ? 'applying' : 'separating';
}
export function checkMutualReception(planetA, signA, planetB, signB) {
  if (![signA, signB].every(s => Number.isInteger(s) && s >= 0 && s < 12)) throw new RangeError('Invalid sign');
  const domicile = DOMICILE_RULERS[signA] === planetB && DOMICILE_RULERS[signB] === planetA;
  const exaltation = EXALTATION_RULERS[signA] === planetB && EXALTATION_RULERS[signB] === planetA;
  const mixed = (DOMICILE_RULERS[signA] === planetB && EXALTATION_RULERS[signB] === planetA)
    || (EXALTATION_RULERS[signA] === planetB && DOMICILE_RULERS[signB] === planetA);
  return { planetA, planetB, type: planetA === planetB ? 'none' : domicile ? 'domicile' : exaltation ? 'exaltation' : mixed ? 'mixed' : 'none' };
}
export function findAllMutualReceptions(planets) {
  const result = [];
  for (let i = 0; i < planets.length; i++) for (let j = i + 1; j < planets.length; j++) {
    const a = planets[i], b = planets[j];
    const reception = checkMutualReception(a.name, Math.floor(normalizeArcsec(a.lon) / 108000), b.name, Math.floor(normalizeArcsec(b.lon) / 108000));
    if (reception.type !== 'none') result.push(reception);
  }
  return result;
}
export function checkSolarCondition(planetLon, sunLon, planetName) {
  const separationArcsec = angularSeparationArcsec(planetLon, sunLon);
  const condition = planetName === 'Sun' ? 'free' : separationArcsec <= SOLAR_ORBS.cazimi ? 'cazimi'
    : separationArcsec <= SOLAR_ORBS.combust ? 'combust' : separationArcsec <= SOLAR_ORBS.underTheBeams ? 'underTheBeams' : 'free';
  return { condition, separationArcsec, isExact: separationArcsec <= 1 };
}
export function checkAllSolarConditions(planets) {
  const sun = planets.find(p => p.name === 'Sun');
  if (!sun) throw new Error('Sun is required');
  return Object.fromEntries(planets.filter(p => p.name !== 'Sun').map(p => [p.name, checkSolarCondition(p.lon, sun.lon, p.name)]));
}
export function determineSect(sunLon, ascLon, option = 'auto') {
  if (option === 'day' || option === 'night') return option;
  return normalizeArcsec((sunLon - ascLon) * 3600) > 648000 ? 'day' : 'night';
}
// Hayz requires sect, hemisphere and sign gender, not merely location.
// Mercury is diurnal when oriental, nocturnal when occidental.
export function checkHayz(planetName, planetLon, sunLon, ascLon, sect) {
  const dayPlanet = ['Sun', 'Jupiter', 'Saturn'].includes(planetName)
    || (planetName === 'Mercury' && signedArcsec(planetLon - sunLon) < 0);
  if (!CLASSICAL_PLANETS.includes(planetName)) return false;
  const above = normalizeArcsec(planetLon - ascLon) > 648000;
  const masculine = Math.floor(normalizeArcsec(planetLon) / 108000) % 2 === 0;
  return (dayPlanet === (sect === 'day')) && (above === (dayPlanet ? sect === 'day' : sect !== 'day')) && (masculine === dayPlanet);
}
export function checkAllHayz(planets, ascLon, sect) {
  const sun = planets.find(p => p.name === 'Sun');
  if (!sun) throw new Error('Sun is required');
  return Object.fromEntries(planets.map(p => [p.name, checkHayz(p.name, p.lon, sun.lon, ascLon, sect)]));
}
export function dignityScore(planet, longitude, sect = 'day') {
  const lon = normalizeArcsec(longitude) / 3600, sign = Math.floor(lon / 30), degree = lon % 30;
  if (!CLASSICAL_PLANETS.includes(planet)) return 0;
  const element = ['Fire', 'Earth', 'Air', 'Water'][sign % 4];
  const trip = sect === 'day' ? TRIP_DAY : TRIP_NIGHT;
  return (DOMICILE_RULERS[sign] === planet ? 5 : 0) + (EXALT[planet] === sign ? 4 : 0)
    + (trip[element] === planet || TRIP_PART[element] === planet ? 3 : 0)
    + (termRuler(sign, degree) === planet ? 2 : 0) + (faceRuler(sign, degree) === planet ? 1 : 0);
}
// Almuten of supplied points: sum all five essential dignities for every
// candidate ruler, not each planet's own placement. Callers name the points.
export function calculateAlmuten(points, sect = 'day') {
  if (!points.length) throw new Error('At least one point is required');
  const dignityBreakdown = Object.fromEntries(CLASSICAL_PLANETS.map(p => [p, points.reduce((sum, point) => sum + dignityScore(p, point.lon, sect), 0)]));
  const score = Math.max(...Object.values(dignityBreakdown));
  const tied = CLASSICAL_PLANETS.filter(p => dignityBreakdown[p] === score);
  return { planet: tied[0], tied, score, dignityBreakdown, method: 'Essential dignities of supplied points (Dorothean triplicities, Egyptian bounds, Chaldean faces)' };
}
// A transparent essential/accidental strength estimate; schools differ.
export function calculateLordOfGeniture(planets, sect = 'day') {
  const scores = planets.filter(p => CLASSICAL_PLANETS.includes(p.name)).map(p => ({ planet: p.name,
    score: dignityScore(p.name, p.lon, sect) + ([1, 4, 7, 10].includes(p.house) ? 5 : 0)
      - (p.retrograde ? 5 : 0) - (p.solarCondition === 'combust' ? 5 : 0) }));
  scores.sort((a, b) => b.score - a.score);
  return { ...scores[0], scores, method: 'Essential dignity + angularity − retrogradation − combustion estimate' };
}
const FIRDARIA_DURATION = { Sun: 10, Venus: 8, Mercury: 13, Moon: 9, Saturn: 11, Jupiter: 12, Mars: 7, NorthNode: 3, SouthNode: 2 };
export const FIRDARIA_YEARS = Object.entries(FIRDARIA_DURATION).map(([lord, years]) => ({ lord, years }));
export const FIRDARIA_CYCLE_YEARS = 75;
function validateAge(age) { if (!Number.isFinite(age) || age < 0) throw new RangeError('Age must be nonnegative'); }
export function calculateFirdaria(ageYears, birthSect = 'day') {
  validateAge(ageYears);
  // Bonatti ordering: nodes follow the seven planets in either sect.
  const order = birthSect === 'day' ? ['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars', 'NorthNode', 'SouthNode']
    : ['Moon', 'Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'NorthNode', 'SouthNode'];
  const cycle = Math.floor(ageYears / 75) * 75;
  let start = cycle;
  for (const lord of order) {
    const endAge = start + FIRDARIA_DURATION[lord];
    if (ageYears < endAge) return { lord, years: start, endAge, type: 'firdaria' };
    start = endAge;
  }
  throw new Error('Firdaria interval unavailable');
}
export function calculateAnnualProfection(ageYears, ascSign) {
  validateAge(ageYears);
  if (!Number.isInteger(ascSign) || ascSign < 0 || ascSign > 11) throw new RangeError('Invalid Ascendant sign');
  const years = Math.floor(ageYears), sign = (ascSign + years) % 12;
  return { lord: DOMICILE_RULERS[sign], sign, years, endAge: years + 1, type: 'profection' };
}
const RELEASING_YEARS = [15, 8, 20, 25, 19, 20, 8, 15, 12, 27, 30, 12];
// Level 1 only, using 360-day Egyptian years. No fabricated subperiods or
// loosing-of-the-bond dates; Fortune and Spirit are calculated separately.
export function calculateZodiacalReleasing(ageYears, fortuneSign, spiritSign) {
  validateAge(ageYears);
  return [['Fortune', fortuneSign], ['Spirit', spiritSign]].map(([lot, firstSign]) => {
    if (!Number.isInteger(firstSign) || firstSign < 0 || firstSign > 11) throw new RangeError('Invalid Lot sign');
    const cycleYears = RELEASING_YEARS.reduce((sum, years) => sum + years, 0) * 360 / 365.2425;
    let start = Math.floor(ageYears / cycleYears) * cycleYears, sign = firstSign;
    for (let count = 0; count < 12; count++) {
      const duration = RELEASING_YEARS[sign] * 360 / 365.2425;
      if (ageYears < start + duration) return { lord: DOMICILE_RULERS[sign], sign, lot, level: 1,
        years: start, endAge: start + duration, type: 'zodiacalReleasing' };
      start += duration; sign = (sign + 1) % 12;
    }
    throw new RangeError('Age is beyond representable releasing precision');
  });
}
export function calculateAllTimeLords(ageYears, ascSign, moonSign, fortuneSign, spiritSign, sect) {
  return [calculateAnnualProfection(ageYears, ascSign), calculateFirdaria(ageYears, sect),
    ...calculateZodiacalReleasing(ageYears, fortuneSign, spiritSign)];
}
const MANSION_NAMES = ['Alnath', 'Albuth', 'Athoray', 'Aldebaran', 'Alhaqa', 'Alhana', 'Adhira', 'Annathra', 'Atarf', 'Aljabhah', 'Alzubrah', 'Alsarfah', 'Alawwa', 'Alsimak', 'Alghafr', 'Alzubana', 'Aliklil', 'Alqalb', 'Alshaula', 'Alnaam', 'Albaldah', 'Saad al-Dhabih', 'Saad Bula', 'Saad al-Suud', 'Saad al-Akhbiyah', 'Alfargh al-Muqaddam', 'Alfargh al-Muakhkhar', 'Alrisha'];
export const LUNAR_MANSIONS = MANSION_NAMES.map((name, index) => ({ name, index,
  startArcsec: index * ARCSECONDS_PER_CIRCLE / 28, endArcsec: (index + 1) * ARCSECONDS_PER_CIRCLE / 28,
  convention: 'Equal tropical mansions from 0° Aries; stellar mansions differ' }));
export function findLunarMansion(longitude) { return LUNAR_MANSIONS[Math.floor(normalizeArcsec(longitude) * 28 / ARCSECONDS_PER_CIRCLE)]; }
export function planetsInLunarMansions(planets) {
  const result = Object.fromEntries(LUNAR_MANSIONS.map(m => [m.index, []]));
  for (const p of planets) result[findLunarMansion(p.lon).index].push(p.name);
  return result;
}
// J2000 equatorial catalogue coordinates; positions are precessed/nutated to
// date through Astronomy Engine. Proper motion is omitted and disclosed.
export const FIXED_STARS = [
  { name: 'Regulus', ra: 10.13953, dec: 11.96722, magnitude: 1.35, nature: 'Mars/Jupiter' },
  { name: 'Spica', ra: 13.41988, dec: -11.16132, magnitude: 0.97, nature: 'Venus/Mars' },
  { name: 'Algol', ra: 3.13615, dec: 40.95565, magnitude: 2.12, nature: 'Saturn/Jupiter' },
  { name: 'Aldebaran', ra: 4.59868, dec: 16.50930, magnitude: 0.85, nature: 'Mars' },
  { name: 'Antares', ra: 16.49013, dec: -26.43194, magnitude: 0.96, nature: 'Mars/Jupiter' },
  { name: 'Fomalhaut', ra: 22.96085, dec: -29.62224, magnitude: 1.16, nature: 'Venus/Mercury' },
  { name: 'Sirius', ra: 6.75248, dec: -16.71612, magnitude: -1.46, nature: 'Jupiter/Mars' },
];
export function fixedStarsAt(date, astronomy = globalThis.Astronomy) {
  if (!astronomy) throw new Error('Astronomical ephemeris is unavailable');
  const time = astronomy.MakeTime(date);
  return FIXED_STARS.map(star => {
    const ra = star.ra * Math.PI / 12, dec = star.dec * Math.PI / 180;
    const v = new astronomy.Vector(Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec), time);
    return { ...star, longitudeArcsec: astronomy.Ecliptic(v).elon * 3600,
      approximate: true, note: 'J2000 catalogue precessed to date; proper motion omitted' };
  });
}
export function findFixedStarConjunctions(planets, orbArcsec = 3600, date = new Date('2000-01-01T12:00:00Z'), astronomy = globalThis.Astronomy) {
  if (!Number.isFinite(orbArcsec) || orbArcsec < 0) throw new RangeError('Invalid orb');
  const stars = fixedStarsAt(date, astronomy), result = [];
  for (const planet of planets) for (const star of stars) {
    const separationArcsec = angularSeparationArcsec(planet.lon, star.longitudeArcsec);
    if (separationArcsec <= orbArcsec) result.push({ planet: planet.name, star: star.name,
      separationArcsec, orbArcsec, approximate: star.approximate });
  }
  return result;
}
export const calculateEnhancedLunarPhase = calculateMoonPhase;
export const calculatePrenatalSyzygy = prenatalSyzygy;
if (typeof window !== 'undefined') window.Traditional = { CLASSICAL_PLANETS, TRADITIONAL_ASPECTS,
  nearestTraditionalAspect, nearestAspectWithTraditionalOrbs, checkAllHayz,
  calculateAlmuten, calculateLordOfGeniture, calculateAnnualProfection, calculateFirdaria,
  calculateZodiacalReleasing, checkAllSolarConditions, findAllMutualReceptions,
  findLunarMansion, findFixedStarConjunctions, calculatePrenatalSyzygy };
