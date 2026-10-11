import * as Astronomy from 'astronomy-engine';
import * as T from '../../src/astro/traditional.js';
export function run() {
  const rows = [], t = (name, ok, detail = '') => rows.push({ name, ok: !!ok, detail });
  for (const a of T.TRADITIONAL_ASPECTS) {
    t(`exact ${a.name}`, T.nearestTraditionalAspect(a.angleArcsec).name === a.name);
    t(`symmetric ${a.name}`, T.nearestTraditionalAspect(1296000 - a.angleArcsec).name === a.name);
    t(`no declination in longitude table ${a.name}`, !T.DECLINATION_ASPECTS.includes(a.name));
  }
  t('parallel same hemisphere', T.declinationAspects(12 * 3600, 12.5 * 3600)[0].name === 'Parallel');
  t('contra-parallel opposite hemispheres', T.declinationAspects(12 * 3600, -12.5 * 3600)[0].name === 'Contra-Parallel');
  t('longitude conjunction is not a parallel', T.nearestTraditionalAspect(0).name === 'Conjunction');
  t('Lilly moieties summed', T.nearestAspectWithTraditionalOrbs(100 * 3600, 'Sun', 'Moon').orbArcsec === 14.75 * 3600);
  t('outer planets have no Lilly orb', T.nearestAspectWithTraditionalOrbs(0, 'Uranus', 'Sun') === null);
  for (const [lon, speed, target, expected] of [[89, 1, 90, 'applying'], [91, 1, 90, 'separating'], [91, -1, 90, 'applying'], [89, -1, 90, 'separating'], [359, 1, 0, 'applying'], [1, -1, 0, 'applying'], [179, 1, 180, 'applying'], [90, 1, 90, 'exact'], [89, 0, 90, 'stationary']])
    t(`aspect phase ${lon}, ${speed}`, T.isApplying(lon * 3600, 0, speed * 3600, 0, target * 3600) === expected);
  t('Mars Venus domicile reception', T.checkMutualReception('Mars', 1, 'Venus', 0).type === 'domicile');
  t('Jupiter Venus exaltation reception', T.checkMutualReception('Jupiter', 11, 'Venus', 3).type === 'exaltation');
  t('Aquarius ruled by Saturn', T.DOMICILE_RULERS[10] === 'Saturn');
  t('Pisces ruled by Jupiter', T.DOMICILE_RULERS[11] === 'Jupiter');
  t('Cancer exalts Jupiter', T.EXALTATION_RULERS[3] === 'Jupiter');
  for (const [sep, expected] of [[0, 'cazimi'], [1020, 'cazimi'], [1021, 'combust'], [30600, 'combust'], [30601, 'underTheBeams'], [61200, 'underTheBeams'], [61201, 'free']])
    t(`solar boundary ${sep}`, T.checkSolarCondition(sep, 0, 'Mercury').condition === expected);
  for (let sign = 0; sign < 12; sign++) {
    t(`day hemisphere sign ${sign}`, T.determineSect(sign * 30 + 10, 0) === (sign >= 6 ? 'day' : 'night'));
    t(`sect wrap sign ${sign}`, T.determineSect(sign * 30 + 370, 360) === T.determineSect(sign * 30 + 10, 0));
    const p = T.calculateAnnualProfection(12 + sign, 0);
    t(`profection sign ${sign}`, p.sign === sign && p.lord === T.DOMICILE_RULERS[sign]);
    t(`domicile scoring sign ${sign}`, T.dignityScore(T.DOMICILE_RULERS[sign], (sign * 30 + 10) * 3600) >= 5);
    const almuten = T.calculateAlmuten([{ lon: (sign * 30 + 10) * 3600 }]);
    t(`almuten considers all rulers sign ${sign}`, almuten.score >= 5);
    t(`almuten excludes modern rulers sign ${sign}`, T.CLASSICAL_PLANETS.includes(almuten.planet));
  }
  t('day hayz requires masculine sign and diurnal planet above horizon', T.checkHayz('Jupiter', 250 * 3600, 270 * 3600, 0, 'day'));
  t('diurnal planet in feminine sign fails hayz', !T.checkHayz('Jupiter', 220 * 3600, 270 * 3600, 0, 'day'));
  t('out of sect planet fails hayz', !T.checkHayz('Mars', 250 * 3600, 270 * 3600, 0, 'day'));
  t('night hayz Moon above horizon in feminine sign', T.checkHayz('Moon', 220 * 3600, 10 * 3600, 0, 'night'));
  for (const [age, sect, lord, start, end] of [[0, 'day', 'Sun', 0, 10], [9.999, 'day', 'Sun', 0, 10], [10, 'day', 'Venus', 10, 18], [18, 'day', 'Mercury', 18, 31], [70, 'day', 'NorthNode', 70, 73], [73, 'day', 'SouthNode', 73, 75], [75, 'day', 'Sun', 75, 85], [0, 'night', 'Moon', 0, 9], [9, 'night', 'Saturn', 9, 20]]) {
    const f = T.calculateFirdaria(age, sect);
    t(`firdaria ${sect} age ${age}`, f.lord === lord && f.years === start && f.endAge === end);
  }
  const z = T.calculateZodiacalReleasing(0, 0, 3);
  t('releasing Fortune starts at Fortune', z[0].sign === 0 && z[0].lot === 'Fortune');
  t('releasing Spirit starts at Spirit', z[1].sign === 3 && z[1].lot === 'Spirit');
  t('releasing Egyptian 360-day years', Math.abs(z[0].endAge - 15 * 360 / 365.2425) < 1e-9);
  for (let i = 0; i < 28; i++) {
    const m = T.LUNAR_MANSIONS[i], middle = (m.startArcsec + m.endArcsec) / 2;
    t(`mansion midpoint ${i}`, T.findLunarMansion(middle).index === i);
    t(`mansion normalized midpoint ${i}`, T.findLunarMansion(middle - 1296000).index === i);
    t(`equal mansion width ${i}`, Math.abs(m.endArcsec - m.startArcsec - 1296000 / 28) < 1e-8);
    t(`continuous mansion boundaries ${i}`, i === 27 ? m.endArcsec === 1296000 : m.endArcsec === T.LUNAR_MANSIONS[i + 1].startArcsec);
  }
  t('15° belongs to second mansion', T.findLunarMansion(15 * 3600).index === 1);
  t('180° belongs to fifteenth mansion', T.findLunarMansion(180 * 3600).index === 14);
  const epoch = T.fixedStarsAt(new Date('2000-01-01T12:00:00Z'), Astronomy);
  const future = T.fixedStarsAt(new Date('2050-01-01T12:00:00Z'), Astronomy);
  // Common J2000 tropical catalogue positions; old commit had 5-15° errors.
  for (const [name, longitude] of [['Regulus', 149.83], ['Spica', 203.84], ['Algol', 56.16], ['Fomalhaut', 333.87], ['Sirius', 104.08]]) {
    const star = epoch.find(s => s.name === name);
    t(`J2000 catalogue longitude ${name}`, Math.abs(star.longitudeArcsec / 3600 - longitude) < .06);
    const advanced = future.find(s => s.name === name);
    t(`precession to 2050 ${name}`, advanced.longitudeArcsec - star.longitudeArcsec > .65 * 3600 && advanced.longitudeArcsec - star.longitudeArcsec < .75 * 3600);
  }
  t('star conjunction uses date', T.findFixedStarConjunctions([{ name: 'Sun', lon: future[0].longitudeArcsec }], 1, new Date('2050-01-01T12:00:00Z'), Astronomy)[0].star === 'Regulus');
  for (const f of [() => T.calculateAnnualProfection(-1, 0), () => T.calculateFirdaria(NaN), () => T.findLunarMansion(Infinity), () => T.checkAllSolarConditions([])]) {
    let threw = false; try { f(); } catch { threw = true; } t('invalid input rejected', threw);
  }
  return rows;
}
