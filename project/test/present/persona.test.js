import * as P from '../../src/astro/persona.js';
export function run() {
  const rows = [], t = (name, ok) => rows.push({ name, ok: !!ok });
  const birth = { dateISO: '1980-10-21T21:31:00Z', lat: 35.1408, lng: -79.0058, tz: 'America/New_York', subjectName: 'You' };
  t('valid saved chart', P.validatePersonaChart(birth) !== null);
  for (const invalid of [null, [], { ...birth, dateISO: 'bad' }, { ...birth, lat: 91 }, { ...birth, lng: NaN }, { ...birth, tz: 'bad/zone' }]) t('invalid chart rejected', P.validatePersonaChart(invalid) === null);
  for (const malformed of ['null', '{}', 'garbage', '42']) t('malformed storage recovers', P.loadPersonaCharts({ getItem: () => malformed }).length === 0);
  t('storage filters invalid rows', P.loadPersonaCharts({ getItem: () => JSON.stringify([null, birth]) }).length === 1);
  t('blocked storage recovers', P.loadPersonaCharts({ getItem() { throw new Error('blocked'); } }).length === 0);
  t('save failure reported', !P.savePersonaCharts({ setItem() { throw new Error('blocked'); } }, []));
  t('save success reported', P.savePersonaCharts({ setItem() {} }, [birth]));
  t('birthday before instant', P.completedAge(new Date(birth.dateISO), new Date('2026-10-21T21:30:59Z'), birth.tz) === 45);
  t('birthday at instant', P.completedAge(new Date(birth.dateISO), new Date('2026-10-21T21:31:00Z'), birth.tz) === 46);
  t('future birth no age', P.completedAge(new Date(birth.dateISO), new Date('1979-01-01Z')) === null);
  const chart = { birth, isDayChart: true, asc: 0, ascSignIdx: 0, timeUnknown: true,
    planets: [{ name: 'Sun', lon: 10 }, { name: 'Moon', lon: 40 }, { name: 'Mercury', lon: 70 }, { name: 'Venus', lon: 100 }, { name: 'Mars', lon: 130 }, { name: 'Jupiter', lon: 160 }, { name: 'Saturn', lon: 190 }] };
  const persona = P.personaForChart(chart, new Date('2026-10-11Z'));
  t('unknown time suppresses profection', persona.profection === null);
  t('unknown time suppresses firdaria', persona.firdaria === null);
  t('element ties retained', persona.dominantElement === 'Fire / Earth / Air');
  const narration = P.dailyPersonaNarration(chart, persona, [{ transitPlanet: 'Saturn', natalPlanet: 'Sun', aspect: 'Opposition', orbArcsec: 360, applying: true }]);
  t('reading uses actual aspects', narration.includes('Saturn opposition natal Sun') && narration.includes('0.10°'));
  t('reading no fabricated Moon trine', !narration.includes('Moon forming a trine'));
  return rows;
}
