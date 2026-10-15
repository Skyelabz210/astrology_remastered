import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import * as Astronomy from 'astronomy-engine';
import * as AstroCore from '../../src/present/astro-core.js';
import * as Houses from '../../tools/ephemeris/houses.js';
import * as Transits from '../../src/astro/transits.js';
import { gastDeg, meanObliquityDeg, ttFromUtc } from '../../tools/ephemeris/timescale.js';
const source = readFileSync(new URL('../../astro.jsx', import.meta.url), 'utf8');
function sandbox(houses = Houses) {
  const sb = { Astronomy, AstroCore, Houses: houses, Transits, Date, Math, console };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(source, sb);
  return sb;
}
function permutations(list) {
  if (!list.length) return [[]];
  return list.flatMap((x, i) => permutations(list.filter((_, j) => i !== j)).map(rest => [x, ...rest]));
}
function aspectGrid(planets) {
  const aspects = [];
  for (let i = 0; i < planets.length; i++) for (let j = i + 1; j < planets.length; j++) {
    const a = AstroCore.nearestAspect(planets[i].lon - planets[j].lon);
    if (a) aspects.push({ a: planets[i].name, b: planets[j].name, aspect: a.name });
  }
  return aspects;
}
export function run() {
  const rows = [], t = (name, ok, detail = '') => rows.push({ name, ok: !!ok, detail });
  const sb = sandbox();
  const birth = { dateISO: '2026-10-12T15:00:00Z', lat: 69.65, lng: 18.96, sect: 'auto', houseSystem: 'whole' };
  for (const lat of [69.65, 78.22, -69.65, -77.84]) for (let hour = 0; hour < 24; hour += 2) {
    const dateISO = `2026-10-12T${String(hour).padStart(2, '0')}:00:00Z`, date = new Date(dateISO);
    const chart = sb.computeNatal({ ...birth, dateISO, lat });
    const rad = chart.asc * Math.PI / 180;
    const ecliptic = new Astronomy.Vector(Math.cos(rad), Math.sin(rad), 0, Astronomy.MakeTime(date));
    const eq = Astronomy.EquatorFromVector(Astronomy.RotateVector(Astronomy.Rotation_ECT_EQD(date), ecliptic));
    const obs = new Astronomy.Observer(lat, birth.lng, 0);
    const horizon = Astronomy.Horizon(date, obs, eq.ra, eq.dec);
    t(`polar ASC on eastern horizon ${lat} ${hour}`, Math.abs(horizon.altitude) < .02 && horizon.azimuth < 180,
      JSON.stringify(horizon));
    const sun = Astronomy.Equator(Astronomy.Body.Sun, date, obs, true, true);
    const solarAltitude = Astronomy.Horizon(date, obs, sun.ra, sun.dec).altitude;
    t(`polar sect follows physical Sun ${lat} ${hour}`, chart.isDayChart === (solarAltitude > 0));
    t(`polar chart records convention and actual source ${lat} ${hour}`,
      chart.anglesMode === 'REAL' && chart.angleConvention.includes('Eastern') && chart.positionWarnings.some(w => w.includes('Polar chart')));
  }
  const corrected = sb.computeNatal(birth);
  t('previous western-horizon regression now gives Aries rising', corrected.asc > 27 && corrected.asc < 29);
  t('polar auto sect does not invert with corrected ASC', corrected.isDayChart);
  t('explicit sect overrides physical solar hemisphere', sb.computeNatal({ ...birth, sect: 'night' }).isDayChart === false);
  const quadrant = sb.computeNatal({ ...birth, houseSystem: 'placidus' });
  t('polar quadrant fallback is recorded in the chart', quadrant.houseSystemActual === 'whole' && quadrant.positionWarnings.some(w => w.includes('Requested placidus')));
  const porphyry = sb.computeNatal({ ...birth, houseSystem: 'porphyry' });
  const cuspArcs = porphyry.houseCusps.map((x, i, cusps) => AstroCore.mod360(cusps[(i + 1) % 12] - x));
  t('polar Porphyry cusps partition the circle once', porphyry.houseSystemActual === 'porphyry' &&
    Math.abs(cuspArcs.reduce((a, b) => a + b, 0) - 360) < 1e-9);
  for (const houseSystem of ['equal', 'meridian', 'morinus']) {
    const chart = sb.computeNatal({ ...birth, houseSystem });
    t(`defined polar ${houseSystem} keeps its actual system`, chart.houseSystemActual === houseSystem && chart.anglesMode === 'REAL');
  }
  const legacy = sandbox({ ...Houses, ascMcFromDate(date, lat, lng) {
    if (Math.abs(lat) > 66.56) throw new Houses.PolarLatitudeError(lat);
    return Houses.ascMcFromDate(date, lat, lng);
  } });
  const fallback = legacy.computeNatal(birth);
  t('legacy polar refusal is disclosed per chart despite loaded solver', fallback.anglesMode === 'APPROX' && fallback.positionWarnings.some(w => w.includes('did not supply')));
  t('approximate fallback selects eastern antipode too', Math.abs(fallback.asc - corrected.asc) < .02);
  for (const lat of [-90, 90]) {
    let error; try { sb.computeNatal({ ...birth, lat }); } catch (e) { error = e; }
    t(`geographic pole ${lat} does not fabricate a rising ASC`, error instanceof RangeError && error.message.includes('undefined'));
  }
  const jdUt = 2451545, jdTt = ttFromUtc(jdUt);
  let degenerate;
  try { Houses.ascMc(jdUt, jdTt, 90 - meanObliquityDeg(jdTt), 270 - gastDeg(jdUt, jdTt)); }
  catch (error) { degenerate = error; }
  t('coincident horizon and ecliptic refuse an arbitrary angle', degenerate instanceof RangeError && degenerate.message.includes('coincide'));
  for (const dateISO of ['1900-01-01T12:00:00Z', '1980-10-21T21:31:00Z', '2000-01-01T12:00:00Z', '2026-04-01T12:00:00Z', '2050-01-01T12:00:00Z']) {
    const chart = sb.computeNatal({ ...birth, dateISO, lat: 35.1408, lng: -79.0058 });
    for (const name of ['Lilith', 'NorthNode', 'SouthNode']) {
      const body = chart.planets.find(p => p.name === name);
      t(`mean-element motion agrees with derivative ${name} ${dateISO}`, body.retrograde === (body.speed < 0));
    }
  }
  const names = ['Mars', 'Jupiter', 'Saturn', 'Uranus'];
  for (const lons of [[0, 90, 180, 270], [.5, 90.4, 179.7, 269.6]]) {
    const planets = names.map((name, i) => ({ name, lon: lons[i] })), grid = aspectGrid(planets);
    for (const ordered of permutations(planets))
      t(`Grand Cross is independent of body order ${lons[0]} ${ordered.map(p => p.name).join('/')}`,
        AstroCore.detectPatterns(grid, ordered).filter(p => p.kind === 'Grand Cross').length === 1);
    t(`incomplete cross does not qualify ${lons[0]}`, !AstroCore.detectPatterns(grid.slice(1), planets).some(p => p.kind === 'Grand Cross'));
  }
  for (const ascDeg of [0, .0001, 359.9998, 359.9999]) {
    const exact = sandbox({ ...Houses, ascMcFromDate() { return { ascDeg, mcDeg: 270 }; } });
    const chart = exact.computeNatal({ ...birth, lat: 0 });
    const quantized = Math.round(ascDeg * 3600) % 1296000;
    t(`ASC lane uses circular arcsecond quantization ${ascDeg}`, chart.ascR11 === quantized % 11);
  }
  return rows;
}
