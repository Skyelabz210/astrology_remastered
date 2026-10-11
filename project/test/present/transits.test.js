import * as Astronomy from 'astronomy-engine';
import * as T from '../../src/astro/transits.js';
import { signedArcsec } from '../../src/astro/angles.js';
export function run() {
  const rows = [], t = (name, ok) => rows.push({ name, ok: !!ok });
  const jd = 2460000.5, natal = [{ name: 'Sun', lonArcsec: 0 }];
  for (const [deg, speed, applying, separating] of [[89, 1, true, false], [91, -1, true, false], [91, 1, false, true], [89, -1, false, true], [359, 1, true, false], [1, -1, true, false], [90, 0, false, false]]) {
    const a = T.calculateTransitToNatal([{ name: 'Mars', lonArcsec: deg * 3600, speedArcsecPerDay: speed * 3600 }], natal)[0];
    t(`phase ${deg} speed ${speed}`, a.applying === applying && a.separating === separating);
    t(`actual orb ${deg}`, a.orbArcsec === (deg === 90 ? 0 : 3600));
    t(`no fabricated date ${deg}`, a.exactHitDate === null && a.exactHitJd === null);
  }
  const returned = T.calculateTransitToNatal([{ name: 'Sun', lonArcsec: 0, speedArcsecPerDay: 3600 }], natal);
  t('same-body return retained', returned.length === 1 && returned[0].exact);
  for (const aspect of T.TRADITIONAL_ASPECTS) {
    const a = T.calculateTransitToNatal([{ name: 'Mars', lonArcsec: aspect.angleArcsec, speedArcsecPerDay: 100 }], natal)[0];
    t(`exact ${aspect.name}`, a.exact && a.orbArcsec < 1e-8);
  }
  for (const [start, speed, target, days] of [[89, 1, 90, 1], [91, -1, 90, 1], [359, 1, 0, 1], [1, -1, 0, 1], [179, 1, 180, 1], [269, 1, 90, 1], [0, 1, 0, 0]]) {
    const position = (planet, time) => (start + speed * (time - jd)) * 3600;
    const hit = T.findExactTransit('Mars', 0, target * 3600, jd, position, { horizonDays: 2 });
    t(`root branch ${start}`, hit !== null && Math.abs(hit - jd - days) < 1 / 86400);
    t(`root residual ${start}`, Math.abs(T.angularSeparationArcsec(position('Mars', hit), 0) - target * 3600) < .05);
  }
  const turning = (planet, time) => (89 + 2 * (time - jd) - .5 * (time - jd) ** 2) * 3600;
  const loopHit = T.findExactTransit('Mars', 0, 90 * 3600, jd + 2, turning, { horizonDays: 3 });
  t('retrograde return after station', Math.abs(loopHit - jd - (2 + Math.sqrt(2))) < 1 / 86400);
  t('no hit outside window', T.findExactTransit('Mars', 0, 90 * 3600, jd, () => 85 * 3600, { horizonDays: 2 }) === null);
  t('wrap discontinuity is not a root', T.findExactTransit('Mars', 0, 0, jd, (p, time) => (179 + time - jd) * 3600, { horizonDays: 3 }) === null);
  const transits = [{ transitPlanet: 'Mars', natalPlanet: 'Sun', aspect: 'Square', separationArcsec: 323, orbArcsec: 1 }];
  const events = T.detectCramResonance(transits, jd);
  t('prime lane identifiers', events.length === 2 && events.every(e => [17, 19].includes(e.lane)));
  t('timestamp from JD', events.every(e => e.timestamp.getTime() === T.jdToDate(jd).getTime()));
  for (const e of events) t(`lane ${e.lane} integer reconstruction`, e.windingIndex * e.lane + e.residue === e.valueArcsec);
  t('orb gate', T.detectCramResonance([{ ...transits[0], orbArcsec: 3601 }], jd).length === 0);
  const timeline = T.generateResonanceTimeline(time => [{ ...transits[0], separationArcsec: 323 + 2 * (time - jd) }], jd, jd + 2);
  t('timeline samples every date', timeline.length === 3);
  t('timeline recalculates lanes', timeline[0].events[0].lane !== timeline[1].events[0].lane);
  for (const f of [() => T.generateResonanceTimeline(transits, jd, jd + 2), () => T.generateResonanceTimeline(() => [], jd, jd + 2, 0), () => T.findExactTransit('Mars', 0, 0, jd, () => 0, { stepDays: 0 })]) {
    let threw = false; try { f(); } catch { threw = true; } t('invalid search rejected', threw);
  }
  const date = new Date('2026-10-11T12:00:00Z'), currentJd = T.dateToJd(date), position = T.longitudeProvider(Astronomy);
  for (const planet of T.positionsAt(currentJd, Astronomy, position)) {
    const real = Astronomy.Ecliptic(Astronomy.GeoVector(Astronomy.Body[planet.name], date, true)).elon;
    t(`real longitude ${planet.name}`, Math.abs(real * 3600 - planet.lonArcsec) < 1e-8);
    t(`finite speed ${planet.name}`, Number.isFinite(planet.speedArcsecPerDay));
  }
  const start = T.dateToJd(new Date('2024-03-19T00:00:00Z'));
  const ingress = T.findExactTransit('Sun', 0, 0, start, T.longitudeProvider(Astronomy), { horizonDays: 3 });
  t('published March equinox within 3 minutes', Math.abs(T.jdToDate(ingress) - new Date('2024-03-20T03:06:00Z')) < 180000);
  t('equinox residual below arcsecond', Math.abs(signedArcsec(T.longitudeProvider(Astronomy)('Sun', ingress))) < 1);
  let count = 0;
  const watcher = T.createLiveSkyWatcher(natal, 1000000, { astronomy: Astronomy, now: () => date, horizonDays: 0, onUpdate: () => count++ });
  watcher.start(); watcher.start();
  t('watcher immediate update and idempotent start', count === 1 && watcher.getCurrentData().jd === currentJd);
  watcher.stop(); watcher.stop();
  t('watcher stop retains last snapshot', watcher.getCurrentData() !== null);
  return rows;
}
