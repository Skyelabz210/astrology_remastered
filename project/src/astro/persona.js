import { calculateAlmuten, calculateAnnualProfection, calculateFirdaria,
  CLASSICAL_PLANETS, findLunarMansion, checkAllSolarConditions, findAllMutualReceptions,
  findFixedStarConjunctions, calculatePrenatalSyzygy, calculateZodiacalReleasing } from './traditional.js';
import { dateToJd } from './angles.js';
export function validatePersonaChart(value) {
  if (!value || typeof value !== 'object' || typeof value.dateISO !== 'string'
    || !Number.isFinite(new Date(value.dateISO).getTime()) || !Number.isFinite(value.lat)
    || Math.abs(value.lat) > 90 || !Number.isFinite(value.lng) || Math.abs(value.lng) > 180) return null;
  const chart = { dateISO: value.dateISO, lat: value.lat, lng: value.lng,
    subjectName: typeof value.subjectName === 'string' ? value.subjectName.slice(0, 80) : 'Chart',
    placeLabel: typeof value.placeLabel === 'string' ? value.placeLabel.slice(0, 160) : 'Saved location',
    timeUnknown: !!value.timeUnknown, tz: typeof value.tz === 'string' ? value.tz : 'UTC' };
  try { new Intl.DateTimeFormat('en', { timeZone: chart.tz }).format(new Date()); }
  catch { return null; }
  return chart;
}
export function loadPersonaCharts(storage) {
  try {
    storage = storage || globalThis.localStorage;
    const data = JSON.parse(storage.getItem('personaCharts') || '[]');
    return Array.isArray(data) ? data.map(validatePersonaChart).filter(Boolean).slice(0, 100) : [];
  } catch { return []; }
}
export function savePersonaCharts(storage, charts) {
  try { storage = storage || globalThis.localStorage; storage.setItem('personaCharts', JSON.stringify(charts)); return true; }
  catch { return false; }
}
function calendarParts(date, tz) {
  const parts = new Intl.DateTimeFormat('en', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(date);
  return Object.fromEntries(parts.filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}
export function completedAge(birthDate, now, tz = 'UTC') {
  if (now < birthDate) return null;
  const b = calendarParts(birthDate, tz), n = calendarParts(now, tz);
  const before = ['month', 'day', 'hour', 'minute', 'second'].reduce((state, key) => state || Math.sign(n[key] - b[key]), 0) < 0;
  return n.year - b.year - (before ? 1 : 0);
}
export function personaForChart(chart, now, astronomy = globalThis.Astronomy) {
  const planets = chart.planets.filter(p => CLASSICAL_PLANETS.includes(p.name));
  const elementCounts = { Fire: 0, Earth: 0, Air: 0, Water: 0 }, modalityCounts = { Cardinal: 0, Fixed: 0, Mutable: 0 };
  for (const planet of planets) {
    const sign = Math.floor(planet.lon / 30);
    elementCounts[['Fire', 'Earth', 'Air', 'Water'][sign % 4]]++;
    modalityCounts[['Cardinal', 'Fixed', 'Mutable'][sign % 3]]++;
  }
  const dominant = counts => {
    const top = Math.max(...Object.values(counts));
    return Object.keys(counts).filter(key => counts[key] === top).join(' / ');
  };
  const birth = new Date(chart.birth.dateISO), age = completedAge(birth, now, chart.birth.tz || 'UTC');
  const sect = chart.isDayChart ? 'day' : 'night';
  const points = planets.filter(p => p.name === 'Sun' || p.name === 'Moon').map(p => ({ lon: p.lon * 3600 }));
  if (!chart.timeUnknown) points.push({ lon: chart.asc * 3600 });
  return { dominantElement: dominant(elementCounts), dominantModality: dominant(modalityCounts), sect,
    almuten: chart.timeUnknown ? null : calculateAlmuten(points, sect), almutenPoints: chart.timeUnknown ? 'Sun and Moon' : 'Sun, Moon and Ascendant',
    profection: chart.timeUnknown || age === null ? null : calculateAnnualProfection(age, chart.ascSignIdx),
    firdaria: chart.timeUnknown || age === null ? null : calculateFirdaria((dateToJd(now) - dateToJd(birth)) / 365.2425, sect),
    mansion: findLunarMansion(planets.find(p => p.name === 'Moon').lon * 3600),
    receptions: findAllMutualReceptions(planets.map(p => ({ name: p.name, lon: p.lon * 3600 }))),
    syzygy: astronomy ? calculatePrenatalSyzygy(dateToJd(birth), astronomy) : null,
    fixedStars: astronomy ? findFixedStarConjunctions(planets.map(p => ({ name: p.name, lon: p.lon * 3600 })), 3600, birth, astronomy) : [],
    releasing: chart.timeUnknown || age === null || !chart.lots || !chart.lots.find(l => l.name === 'Fortune') || !chart.lots.find(l => l.name === 'Spirit') ? [] : calculateZodiacalReleasing(
      (now - birth) / 86400000 / 365.2425,
      chart.lots.find(l => l.name === 'Fortune').sign, chart.lots.find(l => l.name === 'Spirit').sign),
    solarConditions: checkAllSolarConditions(planets.map(p => ({ name: p.name, lon: p.lon * 3600 }))) };
}
export function dailyPersonaNarration(chart, persona, aspects) {
  const lines = [`${chart.birth.subjectName || 'Your chart'}: ${persona.dominantElement} is the most represented element among the seven classical planets; the leading modality is ${persona.dominantModality}.`];
  if (persona.profection) lines.push(`The annual profection lord is ${persona.profection.lord}.`);
  if (chart.timeUnknown) lines.push('Birth time is unknown; angles, houses and sect-dependent time lords are omitted.');
  lines.push('The closest current transit aspects are:');
  for (const a of aspects.slice(0, 5)) lines.push(`${a.transitPlanet} ${a.aspect.toLowerCase()} natal ${a.natalPlanet}, orb ${(a.orbArcsec / 3600).toFixed(2)}°, ${a.exact ? 'exact within one arcsecond' : a.applying ? 'applying' : a.separating ? 'separating' : 'stationary'}.`);
  if (!aspects.length) lines.push('No aspects fall within the configured orbs.');
  lines.push('Astrological interpretations are symbolic; these positions do not establish predictions about events.');
  return lines.join(' ');
}
if (typeof window !== 'undefined') window.PersonaModel = { loadPersonaCharts, savePersonaCharts,
  validatePersonaChart, personaForChart, dailyPersonaNarration };
