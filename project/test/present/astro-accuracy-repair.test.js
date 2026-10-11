import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as Astronomy from 'astronomy-engine';
import * as AstroCore from '../../src/present/astro-core.js';
import * as Houses from '../../tools/ephemeris/houses.js';
import * as Transits from '../../src/astro/transits.js';
import { calculateTerminator, moonPhaseAt } from '../../src/astro/moonphase.js';
export function run() {
  const rows = [], t = (name, ok) => rows.push({ name, ok: !!ok });
  const sandbox = vm.createContext({ window: { Astronomy, Houses, Transits }, Astronomy, AstroCore, console, Date, Math });
  vm.runInContext(readFileSync(new URL('../../astro.jsx', import.meta.url), 'utf8'), sandbox);
  for (const dateISO of ['1980-10-21T21:31:00Z', '2000-01-01T12:00:00Z', '2024-04-08T18:21:00Z', '2026-10-11T12:00:00Z']) {
    const date = new Date(dateISO), jd = Transits.dateToJd(date);
    const chart = sandbox.window.computeNatal({ dateISO, lat: 35.1408, lng: -79.0058, houseSystem: 'whole', sect: 'auto' });
    const north = chart.planets.find(p => p.name === 'NorthNode'), south = chart.planets.find(p => p.name === 'SouthNode');
    t(`node speeds agree ${dateISO}`, north.speed === south.speed && north.speed < 0);
    t(`nodes antipodal ${dateISO}`, Math.abs(Transits.angularSeparationArcsec(north.lon * 3600, south.lon * 3600) - 648000) < 1e-8);
    t(`Chiron omitted ${dateISO}`, !chart.planets.some(p => p.name === 'Chiron'));
    t(`mean positions disclosed ${dateISO}`, chart.positionWarnings.length > 0 && north.positionSource === 'mean-element');
    t(`computed VOC ${dateISO}`, chart.voidOfCourse.approximate === false);
    const voc = chart.voidOfCourse;
    const pos = Transits.longitudeProvider(Astronomy);
    t(`ingress root ${dateISO}`, Math.abs((pos('Moon', voc.ingressJd) / 3600 / 30) - Math.round(pos('Moon', voc.ingressJd) / 3600 / 30)) < 1e-5);
    t(`VOC equals absence of future perfections ${dateISO}`, voc.isVoc === (voc.perfections.length === 0));
    for (const hit of voc.perfections) {
      t(`perfection precedes ingress ${hit.planet} ${dateISO}`, hit.jd > jd && hit.jd < voc.ingressJd);
      t(`moving-body aspect root ${hit.planet} ${dateISO}`, Math.abs(Transits.angularSeparationArcsec(pos('Moon', hit.jd), pos(hit.planet, hit.jd)) - hit.angle * 3600) < 1);
    }
    const moon = moonPhaseAt(date, Astronomy);
    t(`globe matches physical illumination ${dateISO}`, Math.abs(calculateTerminator(moon.shadingElongationArcsec).illuminationFraction - moon.illuminationFloat) < 1e-12);
    for (const body of ['Sun', 'Moon', 'Mercury']) {
      const position = chart.planets.find(p => p.name === body);
      const expected = Astronomy.EquatorFromVector(Astronomy.RotateVector(Astronomy.Rotation_EQJ_EQD(Astronomy.MakeTime(date)), Astronomy.GeoVector(Astronomy.Body[body], date, true))).dec;
      t(`equator of date declination ${body} ${dateISO}`, Math.abs(position.declination - expected) < 1e-10);
    }
  }
  t('known VOC sample 2026-10-11', Transits.calculateVoidOfCourse(Transits.dateToJd(new Date('2026-10-11T12:00:00Z')), Astronomy).isVoc);
  t('mean Lilith is apogee near J2000', Math.abs(sandbox.window.planetLongitude('Lilith', 2451545) - 263.35325) < .001);
  const withChiron = sandbox.window.computeNatal({ dateISO: '2000-01-01T12:00:00Z', lat: 0, lng: 0, houseSystem: 'whole', includeSyntheticBodies: true });
  t('opt-in Chiron marked synthetic', withChiron.planets.find(p => p.name === 'Chiron').positionSource === 'synthetic');
  t('opt-in Chiron warning', withChiron.positionWarnings.some(w => w.includes('Chiron')));
  const broken = vm.createContext({ window: { Astronomy: { ...Astronomy, GeoVector() { throw new Error('broken ephemeris'); } } }, AstroCore, console, Date, Math });
  vm.runInContext(readFileSync(new URL('../../astro.jsx', import.meta.url), 'utf8'), broken);
  let threw = false; try { broken.window.planetLongitude('Mars', 2451545); } catch { threw = true; }
  t('real ephemeris failure is surfaced', threw);
  return rows;
}
