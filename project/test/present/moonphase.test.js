// Executable with the repository's native runner; no undeclared framework.
import * as Astronomy from 'astronomy-engine';
import { calculateMoonPhase, moonPhaseAt, prenatalSyzygy, getPhaseName,
  isWaxing, calculateExactIllumination, fractionToFloat, calculateLunarDay,
  calculateTerminator, createMoonShadingFunction } from '../../src/astro/moonphase.js';
import { dateToJd } from '../../src/astro/angles.js';
export function run() {
  const rows = [], t = (name, ok, detail = '') => rows.push({ name, ok: !!ok, detail });
  const phases = ['New', 'Waxing Crescent', 'First Quarter', 'Waxing Gibbous', 'Full', 'Waning Gibbous', 'Last Quarter', 'Waning Crescent'];
  for (let i = 0; i < 8; i++) {
    const deg = i * 45;
    t(`phase at ${deg}°`, getPhaseName(deg) === phases[i]);
    t(`normalized phase at ${deg - 720}°`, getPhaseName(deg - 720) === phases[i]);
    t(`waxing at ${deg - 360}°`, isWaxing(deg - 360) === (i < 4));
    const p = calculateMoonPhase(350 * 3600, (350 + deg) * 3600);
    t(`directed elongation at ${deg}°`, Math.abs(p.elongationDeg - deg) < 1e-9);
    t(`BigInt fraction in [0,1] at ${deg}°`, p.illumination.numerator >= 0n && p.illumination.numerator <= p.illumination.denominator);
  }
  t('New centered across 360°', getPhaseName(359) === 'New');
  t('first-quarter boundary', getPhaseName(67.5) === 'First Quarter' && getPhaseName(67.49) === 'Waxing Crescent');
  t('Full centered at opposition', getPhaseName(180) === 'Full');
  t('last-quarter boundary', getPhaseName(247.5) === 'Last Quarter');
  t('waning New sector stays waning', calculateMoonPhase(0, 350 * 3600).waxing === false);
  for (const [deg, expected] of [[0, 0], [90, .5], [180, 1], [270, .5], [360, 0]]) {
    const f = calculateExactIllumination(deg * 3600);
    t(`cardinal illumination ${deg}`, Math.abs(fractionToFloat(f.numerator, f.denominator) - expected) < 1e-12);
  }
  t('age uses actual elapsed time', calculateLunarDay(0, 2451545, 2451548.25) === 3.25);
  t('negative elongation age normalized', calculateLunarDay(-90 * 3600) > 22);
  let threw = false;
  try { calculateMoonPhase(NaN, 0); } catch { threw = true; }
  t('nonfinite phase rejected', threw);
  t('origin shading is finite and dark', createMoonShadingFunction(0)(0, 0, 0) === 0);
  for (const [deg, center, right, left] of [[0, false, false, false], [90, false, true, false], [180, true, true, true], [270, true, false, true]]) {
    const light = calculateTerminator(deg * 3600);
    // At quarter the center sits on the terminator; test off-center instead.
    if (deg === 0 || deg === 180) t(`disk center lighting ${deg}`, light.isIlluminated(0, 0, 1) === center);
    t(`right lighting ${deg}`, light.isIlluminated(.5, 0, Math.sqrt(.75)) === right);
    t(`left lighting ${deg}`, light.isIlluminated(-.5, 0, Math.sqrt(.75)) === left);
  }
  for (let deg = 0; deg < 360; deg += 15) {
    const light = calculateTerminator(deg * 3600);
    let total = 0, lit = 0;
    // Equal projected area pixels verify the geometry independently of the
    // surface sampling used by the renderer.
    for (let x = -0.99; x < 1; x += .025) for (let y = -0.99; y < 1; y += .025) {
      if (x*x + y*y >= 1) continue;
      total++; if (light.isIlluminated(x, y, Math.sqrt(1-x*x-y*y))) lit++;
    }
    t(`projected lit area matches phase ${deg}°`, Math.abs(lit / total - light.illuminationFraction) < .012);
  }
  for (const [iso, expectedPhase, illumination] of [
    ['2024-04-08T18:21:00Z', 'New', 0], ['2024-03-25T07:00:00Z', 'Full', 1],
  ]) {
    const p = moonPhaseAt(new Date(iso), Astronomy);
    t(`published phase ${iso}`, p.phase === expectedPhase);
    t(`illumination near syzygy ${iso}`, Math.abs(p.illuminationFloat - illumination) < .001);
    t(`positive next event times ${iso}`, p.nextFullMoonDays >= 0 && p.nextNewMoonDays >= 0);
  }
  for (let month = 0; month < 12; month++) {
    const date = new Date(Date.UTC(2026, month, 11, 12)), p = moonPhaseAt(date, Astronomy);
    const previous = Astronomy.SearchMoonPhase(0, date, -40);
    t(`actual lunar age month ${month}`, Math.abs(p.lunarDay - (date - previous.date) / 86400000) < 1e-8);
    t(`waxing/waning from engine month ${month}`, p.waxing === (Astronomy.MoonPhase(date) < 180));
    t(`physical illumination month ${month}`, p.illuminationFloat === Astronomy.Illumination(Astronomy.Body.Moon, date).phase_fraction);
    const syzygy = prenatalSyzygy(dateToJd(date), Astronomy);
    t(`prenatal syzygy precedes birth month ${month}`, syzygy.daysBeforeBirth >= 0 && syzygy.daysBeforeBirth < 16);
    t(`prenatal syzygy solved month ${month}`, Math.abs(((Astronomy.MoonPhase(new Date((syzygy.jd - 2440587.5) * 86400000)) - (syzygy.type === 'fullMoon' ? 180 : 0) + 540) % 360) - 180) < .01);
  }
  return rows;
}
