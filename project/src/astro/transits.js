// Transit positions use floating point arcseconds. Discrete CRAM lanes use
// rounded integer arcseconds only and carry no physical resonance claim.
import { normalizeArcsec, angularSeparationArcsec, signedArcsec, jdToDate, dateToJd,
  ARCSECONDS_PER_DEGREE, ARCSECONDS_PER_CIRCLE } from './angles.js';
import { TRADITIONAL_ASPECTS, nearestTraditionalAspect, nearestAspectWithTraditionalOrbs, isApplying, aspectError } from './traditional.js';
export { TRADITIONAL_ASPECTS, normalizeArcsec, angularSeparationArcsec, jdToDate, dateToJd,
  ARCSECONDS_PER_DEGREE, ARCSECONDS_PER_CIRCLE };
export const CRAM_BASIS = [2, 3, 5, 7, 11, 13, 17, 19];
export const EPHEMERIS_PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
export function longitudeProvider(astronomy = globalThis.Astronomy) {
  if (!astronomy) throw new Error('Astronomical ephemeris is unavailable');
  // Memoization is scoped to one calculation so a live watcher cannot leak
  // an unbounded history. Many aspects share the same sampled positions.
  const cache = new Map();
  return (planet, jd) => {
    if (!EPHEMERIS_PLANETS.includes(planet)) throw new Error(`Unsupported ephemeris body: ${planet}`);
    const key = `${planet}:${jd}`;
    if (!cache.has(key)) cache.set(key, astronomy.Ecliptic(astronomy.GeoVector(astronomy.Body[planet], jdToDate(jd), true)).elon * 3600);
    return cache.get(key);
  };
}
export function positionsAt(jd, astronomy = globalThis.Astronomy, position = longitudeProvider(astronomy)) {
  return EPHEMERIS_PLANETS.map(name => {
    const lonArcsec = position(name, jd);
    const speedArcsecPerDay = signedArcsec(position(name, jd + 0.005) - position(name, jd - 0.005)) / 0.01;
    return { name, lonArcsec, speedArcsecPerDay, retrograde: speedArcsecPerDay < 0 };
  });
}
// Classical VOC: no future perfection to another classical planet before
// lunar sign ingress. Both bodies move; natal transit logic alone cannot do it.
export function calculateVoidOfCourse(jd, astronomy = globalThis.Astronomy) {
  const position = longitudeProvider(astronomy);
  const nextSign = normalizeArcsec((Math.floor(position('Moon', jd) / 108000) + 1) * 108000);
  const ingressJd = findExactTransit('Moon', nextSign, 0, jd, position, { horizonDays: 4, stepDays: .05 });
  if (ingressJd === null) throw new Error('Moon sign ingress could not be located');
  const perfections = [];
  for (const planet of ['Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']) {
    const relativePosition = (body, time) => position('Moon', time) - position(planet, time);
    for (const target of [0, 60, 90, 120, 180]) {
      const hitJd = findExactTransit('Moon', 0, target * 3600, jd + 1 / 86400, relativePosition,
        { horizonDays: Math.max(0, ingressJd - jd - 1 / 86400), stepDays: .05 });
      if (hitJd !== null && hitJd < ingressJd - 1 / 86400) perfections.push({ planet, angle: target, jd: hitJd });
    }
  }
  perfections.sort((a, b) => a.jd - b.jd);
  return { isVoc: perfections.length === 0, daysToNextSignChange: ingressJd - jd,
    ingressJd, perfections, approximate: false, convention: 'Classical seven planets, five Ptolemaic aspects before sign ingress' };
}
// Root search along actual geocentric longitude; both branches are supported,
// including retrograde returns. Only bracketed roots produce a date. The
// default 60-day window intentionally reports null when no hit is found.
export function findExactTransit(planet, natalLon, target, currentJd, position,
  { horizonDays = 60, stepDays = 0.5 } = {}) {
  if (!Number.isFinite(currentJd) || horizonDays < 0 || !Number.isFinite(horizonDays)
    || !Number.isFinite(stepDays) || stepDays <= 0) throw new RangeError('Invalid transit search interval');
  if (typeof position !== 'function') return null;
  const startError = aspectError(position(planet, currentJd), natalLon, target);
  if (Math.abs(startError) <= 1e-4) return currentJd;
  let best = null;
  for (const branch of new Set([target, -target])) {
    let left = currentJd, fLeft = signedArcsec(position(planet, left) - natalLon - branch);
    const end = currentJd + horizonDays;
    while (left < end) {
      let right = Math.min(left + stepDays, end);
      let fRight = signedArcsec(position(planet, right) - natalLon - branch);
      if (fLeft * fRight <= 0 && Math.abs(fRight - fLeft) < ARCSECONDS_PER_CIRCLE / 2) {
        let lo = left, hi = right, flo = fLeft;
        for (let i = 0; i < 48 && hi - lo > 1 / 86400; i++) {
          const mid = (lo + hi) / 2, fm = signedArcsec(position(planet, mid) - natalLon - branch);
          if (flo * fm <= 0) hi = mid;
          else { lo = mid; flo = fm; }
        }
        const hit = (lo + hi) / 2;
        if (best === null || hit < best) best = hit;
        break;
      }
      left = right; fLeft = fRight;
    }
  }
  return best;
}
export function calculateTransitToNatal(transitPositions, natalPositions,
  aspects = TRADITIONAL_ASPECTS, options = {}) {
  const result = [];
  for (const transit of transitPositions) for (const natal of natalPositions) {
    // Same-body transits are returns, and must not be discarded.
    const separationArcsec = angularSeparationArcsec(transit.lonArcsec, natal.lonArcsec);
    const aspect = options.orbMode === 'lilly'
      ? nearestAspectWithTraditionalOrbs(separationArcsec, transit.name, natal.name)
      : nearestTraditionalAspect(separationArcsec, aspects);
    if (!aspect) continue;
    const phase = isApplying(transit.lonArcsec, natal.lonArcsec, transit.speedArcsecPerDay, 0, aspect.angleArcsec);
    const exactHitJd = null;
    result.push({ transitPlanet: transit.name, natalPlanet: natal.name, aspect: aspect.name,
      targetArcsec: aspect.angleArcsec, orbArcsec: aspect.sepArcsec, allowedOrbArcsec: aspect.orbArcsec,
      exact: aspect.exact, applying: phase === 'applying', separating: phase === 'separating',
      stationary: phase === 'stationary', separationArcsec, exactHitJd,
      exactHitDate: exactHitJd === null ? null : jdToDate(exactHitJd) });
  }
  result.sort((a, b) => a.orbArcsec - b.orbArcsec);
  if (options.position && Number.isFinite(options.currentJd)) {
    for (const aspect of result.slice(0, options.maxHitSearches ?? 12)) {
      const natal = natalPositions.find(p => p.name === aspect.natalPlanet);
      aspect.exactHitJd = findExactTransit(aspect.transitPlanet, natal.lonArcsec, aspect.targetArcsec, options.currentJd, options.position, options);
      aspect.exactHitDate = aspect.exactHitJd === null ? null : jdToDate(aspect.exactHitJd);
    }
  }
  return result;
}
export function detectCramResonance(transitAspects, currentJd, toleranceArcsec = 0, maxOrbArcsec = 3600) {
  if (![toleranceArcsec, maxOrbArcsec].every(x => Number.isFinite(x) && x >= 0)) throw new RangeError('Invalid resonance tolerance');
  const timestamp = jdToDate(currentJd), events = [];
  for (const aspect of transitAspects) {
    if (aspect.orbArcsec > maxOrbArcsec) continue;
    const value = Math.round(normalizeArcsec(aspect.separationArcsec));
    for (const prime of CRAM_BASIS) {
      const residue = value % prime;
      if (Math.min(residue, prime - residue) <= toleranceArcsec) events.push({
        timestamp, jd: currentJd, transitPlanet: aspect.transitPlanet, natalPlanet: aspect.natalPlanet,
        lane: prime, residue, windingIndex: Math.floor(value / prime), valueArcsec: value,
        separationArcsec: aspect.separationArcsec, aspect: aspect.aspect });
    }
  }
  return events;
}
export function generateResonanceTimeline(sampleAspects, startJd, endJd, intervalDays = 1, toleranceArcsec = 0) {
  if (typeof sampleAspects !== 'function') throw new TypeError('Timeline requires an ephemeris sampling function');
  if (![startJd, endJd, intervalDays].every(Number.isFinite) || endJd < startJd || intervalDays <= 0
    || (endJd - startJd) / intervalDays > 10000) throw new RangeError('Invalid timeline interval');
  const result = [];
  for (let jd = startJd; jd <= endJd; jd += intervalDays) {
    const events = detectCramResonance(sampleAspects(jd), jd, toleranceArcsec);
    if (events.length) result.push({ date: jdToDate(jd), jd, events });
  }
  return result;
}
export function transitAspectsToTable(aspects) {
  return aspects.map(a => ({ ...a, orb: a.orbArcsec / 3600, separationDeg: a.separationArcsec / 3600 }));
}
export function liveSkyAt(natalPositions, date, astronomy = globalThis.Astronomy, options = {}) {
  const jd = dateToJd(date), position = longitudeProvider(astronomy), planets = positionsAt(jd, astronomy, position);
  const aspectsToNatal = calculateTransitToNatal(planets, natalPositions, options.aspects || TRADITIONAL_ASPECTS, {
    currentJd: jd, position, horizonDays: options.horizonDays ?? 60, orbMode: options.orbMode,
  });
  return { timestamp: date, jd, planets, aspectsToNatal, cramEvents: detectCramResonance(aspectsToNatal, jd) };
}
export function createLiveSkyWatcher(natalPositions, updateIntervalMs = 60000, options = {}) {
  if (!Number.isFinite(updateIntervalMs) || updateIntervalMs < 1) throw new RangeError('Invalid update interval');
  let timer = null, currentData = null;
  const update = () => {
    try {
      currentData = liveSkyAt(natalPositions, options.now ? options.now() : new Date(), options.astronomy, options);
      if (options.onUpdate) options.onUpdate(currentData);
    } catch (error) {
      currentData = null;
      if (options.onError) options.onError(error);
      else throw error;
    }
  };
  return { start() { if (timer !== null) return; update(); timer = globalThis.setInterval(update, updateIntervalMs); },
    stop() { if (timer !== null) globalThis.clearInterval(timer); timer = null; }, getCurrentData: () => currentData };
}
if (typeof window !== 'undefined') window.Transits = { liveSkyAt, calculateTransitToNatal, detectCramResonance,
  createLiveSkyWatcher, findExactTransit, longitudeProvider, positionsAt, calculateVoidOfCourse };
