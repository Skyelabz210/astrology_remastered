import { dignityFor, termRuler, faceRuler } from './astro-core.js';
import { findExactTransit, longitudeProvider } from '../astro/transits.js';
import { checkSolarCondition } from '../astro/traditional.js';
const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const THEMES = ['initiative and direct engagement','steadiness and tangible security','curiosity and exchanging perspectives','care and emotional belonging','creative expression and recognition','discernment and practical improvement','reciprocity and weighing competing needs','depth and careful trust','exploration and wider meaning','structure and patient achievement','independence and shared ideals','imagination and sensitivity'];
const DOMAINS = [['Sun','Motivation and identity'],['Moon','Emotional needs'],['Mercury','Thinking and communication'],['Venus','Connection and values'],['Mars','Action and conflict']];
const QUESTIONS = { Sun: 'a goal you choose', Moon: 'what helps you settle', Mercury: 'how you explain a decision', Venus: 'a preference you express', Mars: 'how you act on a disagreement' };
const HOUSE_TOPICS = [null,'identity and self-presentation','resources and priorities','communication and everyday learning','home and foundations','creative work and enjoyment','daily work and routines','partnership and agreements','shared resources and obligations','study, travel and beliefs','public work and responsibility','friendships and shared aims','privacy and reflection'];
const CLASSICAL = ['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn'];
const MAJOR = [['Conjunction',0],['Sextile',60],['Square',90],['Trine',120],['Opposition',180]];
const wrap = value => ((value % 360) + 360) % 360;
function dms(arcsec) {
  const a = Math.round(Math.abs(arcsec));
  return `${Math.floor(a / 3600)}°${String(Math.floor(a % 3600 / 60)).padStart(2,'0')}′${String(a % 60).padStart(2,'0')}″`;
}
function placement(planet) {
  if (Number.isFinite(planet.lon)) {
    const lon = wrap(planet.lon), arcsec = Math.round(lon * 3600) % 1296000;
    // Round the whole circle before splitting sign/degree, including 29°59′60″.
    const sign = SIGNS[Math.floor(lon / 30)];
    const roundedSign = SIGNS[Math.floor(arcsec / 108000)];
    const degreeText = roundedSign === sign ? dms(arcsec % 108000) : `${(lon % 30).toFixed(8)}°`;
    return { lon, arcsec, sign, degreeText, text: `${planet.name} at ${degreeText} ${sign}${roundedSign !== sign ? ' (near a sign boundary; unrounded sign retained)' : ''}` };
  }
  const sign = SIGNS[planet.sign];
  return { lon: null, arcsec: null, sign, degreeText: null, text: `${planet.name} in ${sign} (degree unavailable)` };
}

// Same ephemeris, frozen reading instant and bounded root-search convention as
// the Persona inspector. These are chart contacts, never event predictions.
export function behavioralTrajectories(chart, jd, astronomy) {
  const at = Number.isFinite(jd) ? new Date((jd - 2440587.5) * 86400000).toISOString() : null;
  const scope = 'Next bracketed Ptolemaic contacts from seven classical transiting planets to Sun, Moon, Mercury, Venus and Mars within 60 days';
  const result = { status: 'unavailable', at, horizonDays: 60, scope, byBody: {} };
  if (chart?.timeUnknown) return { ...result, message: 'Birth time is unknown; exact natal-degree contact dates are withheld.' };
  if (!astronomy || !Number.isFinite(jd)) return { ...result, message: 'Real ephemeris or reading instant is unavailable.' };
  const position = longitudeProvider(astronomy);
  for (const [body] of DOMAINS) {
    const natal = chart.planets.find(p => p.name === body);
    if (!natal || !Number.isFinite(natal.lon)) continue;
    const hits = [];
    for (const transitPlanet of CLASSICAL) for (const [aspect, angle] of MAJOR) {
      const exactHitJd = findExactTransit(transitPlanet, natal.lon * 3600, angle * 3600, jd, position, { horizonDays: 60, stepDays: 0.5 });
      if (exactHitJd === null) continue;
      const delta = wrap(position(transitPlanet, jd) / 3600 - natal.lon);
      hits.push({ transitPlanet, natalPlanet: body, aspect, angle, exactHitJd,
        exactHitDate: new Date((exactHitJd - 2440587.5) * 86400000).toISOString(),
        orbArcsec: Math.abs(Math.min(delta, 360 - delta) - angle) * 3600 });
    }
    result.byBody[body] = hits.sort((a,b) => a.exactHitJd - b.exactHitJd).slice(0,3);
  }
  result.status = 'ready';
  return result;
}

export function chartEvidenceForBody(chart, body, context = chart?.readingContext) {
  const planet = chart?.planets?.find(p => p.name === body);
  if (!planet || (!Number.isFinite(planet.lon) && !(Number.isInteger(planet.sign) && planet.sign >= 0 && planet.sign < 12))) return null;
  const anchor = placement(planet), signIndex = Number.isFinite(planet.lon) ? Math.floor(wrap(planet.lon) / 30) : planet.sign;
  anchor.house = !chart.timeUnknown && Number.isInteger(planet.house) && planet.house >= 1 && planet.house <= 12 ? planet.house : null;
  anchor.houseSystem = anchor.house ? chart.houseSystemActual || chart.birth?.houseSystem || 'unspecified' : null;
  anchor.text += anchor.house ? `, house ${anchor.house} (${anchor.houseSystem})` : chart.timeUnknown ? '; house withheld because birth time is unknown' : '; house unavailable';
  const sun = chart.planets.find(p => p.name === 'Sun');
  const solar = body !== 'Sun' && Number.isFinite(planet.lon) && Number.isFinite(sun?.lon) && CLASSICAL.includes(body)
    ? checkSolarCondition(planet.lon * 3600, sun.lon * 3600, body) : null;
  const conditions = { dignity: dignityFor(body,signIndex),
    term: Number.isFinite(planet.lon) ? termRuler(signIndex,wrap(planet.lon) % 30) : null,
    face: Number.isFinite(planet.lon) ? faceRuler(signIndex,wrap(planet.lon) % 30) : null,
    retrograde: Number.isFinite(planet.speed) ? planet.speed < 0 : planet.retrograde === true,
    solar, sect: chart.timeUnknown || typeof chart.isDayChart !== 'boolean' ? null : chart.isDayChart ? 'day' : 'night' };
  const aspects = (chart.aspectGrid || []).filter(a => a.a === body || a.b === body).flatMap(a => {
    const other = a.a === body ? a.b : a.a, peer = chart.planets.find(p => p.name === other);
    if (!peer || !Number.isFinite(a.orb) || !Number.isFinite(a.angle)) return [];
    const card = (chart.cards || []).find(c => c.principal?.name === other);
    return [{ other, aspect: a.aspect, angle: a.angle, orb: a.orb, orbText: dms(a.orb * 3600),
      phase: a.phase || 'unavailable', peerSource: placement(peer).text, cardIdx: Number.isInteger(card?.idx) ? card.idx : null }];
  }).sort((a,b) => a.orb - b.orb);
  const facts = [anchor.text, `Essential dignity: ${conditions.dignity.kind}; house placement does not change essential dignity.`];
  if (conditions.term) facts.push(`Egyptian bound ruler ${conditions.term}; face ruler ${conditions.face}.`);
  if (Number.isFinite(planet.speed)) facts.push(`${conditions.retrograde ? 'Retrograde' : 'Direct'} motion, ${planet.speed.toFixed(6)} degrees/day at birth.`);
  if (solar) facts.push(`Solar condition: ${solar.condition}; separation ${dms(solar.separationArcsec)}.`);
  if (conditions.sect) facts.push(`Chart sect: ${conditions.sect}${chart.birth?.sect && chart.birth.sect !== 'auto' ? ' (selected override)' : ''}.`);
  for (const aspect of aspects) facts.push(`${body} ${aspect.aspect.toLowerCase()} ${aspect.peerSource}; orb ${aspect.orbText}; ${aspect.phase}.`);
  const hard = aspects.find(a => ['Square','Opposition'].includes(a.aspect));
  const topic = anchor.house ? HOUSE_TOPICS[anchor.house] : 'situations you choose to observe';
  const conditionFact = ['detriment','fall'].includes(conditions.dignity.kind) ? `${body} is in ${conditions.dignity.kind}.` : `${body} has ${conditions.dignity.kind} essential dignity.`;
  const interpretation = hard ? `In traditional interpretation, ${body}–${hard.other} ${hard.aspect.toLowerCase()} can frame a tension between ${THEMES[signIndex]} and the concerns associated with ${hard.other}. Compare that possibility with your experience of ${topic}.`
    : `Traditionally, ${THEMES[signIndex]} is one lens for ${topic}. The computed ${conditions.dignity.kind} condition and ${aspects.length} natal contacts provide context; they do not measure your behavior.`;
  const tension = { facts: [conditionFact, ...(hard ? [`${body} ${hard.aspect.toLowerCase()} ${hard.other}, orb ${hard.orbText}, ${hard.phase}.`] : [])], interpretation, text: conditionFact + ' ' + interpretation };
  const computed = context?.evidence?.behavioralTrajectories;
  const timeline = computed?.value || (computed?.byBody ? computed : null);
  const searched = timeline?.status === 'ready' && Object.hasOwn(timeline.byBody || {}, body);
  const hits = !chart.timeUnknown && searched ? timeline.byBody[body] : [];
  const trajectory = { status: chart.timeUnknown || !searched ? 'unavailable' : 'ready', at: timeline?.at || context?.at || null,
    horizonDays: timeline?.horizonDays || 60, scope: timeline?.scope || 'No transit search was supplied.', hits,
    text: hits.length ? hits.map(h => `Transiting ${h.transitPlanet} ${h.aspect.toLowerCase()} natal ${body} reaches its next located exact crossing at ${h.exactHitDate}.`).join(' ') + ' Numerical dates are estimates; these contacts do not predict events.'
      : chart.timeUnknown ? 'Exact natal-degree transit dates are withheld because birth time is unknown.'
        : searched ? 'No crossing was located in this 60-day search; this does not establish that no later contact occurs.'
          : timeline?.message || computed?.message || 'This placement was not searched; no transit date is inferred.' };
  const hypothesis = `Consider whether ${QUESTIONS[body] || `your expression of ${body}`} shows ${THEMES[signIndex]} in ${topic}${hard ? ` while balancing the ${hard.other} concerns named above` : ''}.`;
  const falsifier = { hypothesis, protocol: 'For seven days, record a concrete example and a counterexample before rereading this interpretation. Compare with what you normally do; a dated contact is an observation window, not a promised change.',
    counterexample: 'If the proposed pattern does not recur, or another explanation fits better, set this interpretation aside. This tests its usefulness to you, not the astronomical calculation.', text: '' };
  falsifier.text = `${falsifier.hypothesis} ${falsifier.protocol} ${falsifier.counterexample}`;
  const resonance = aspects.map(a => {
    const peer = placement(chart.planets.find(p => p.name === a.other));
    let separationArcsec = null, lanes = [];
    if (anchor.arcsec !== null && peer.arcsec !== null) {
      const delta = BigInt(Math.abs(anchor.arcsec - peer.arcsec));
      const distance = delta <= 648000n ? delta : 1296000n - delta;
      separationArcsec = String(distance);
      lanes = [2,3,5,7,11,13,17,19].map(prime => ({ prime, residue: String(distance % BigInt(prime)) }));
    }
    return { body: a.other, cardIdx: a.cardIdx, aspect: a.aspect, orbText: a.orbText, phase: a.phase, separationArcsec, lanes,
      text: `${body} links to ${a.other} through a natal ${a.aspect.toLowerCase()}, orb ${a.orbText}, ${a.phase}.` };
  });
  const arc = context?.evidence?.solarArc;
  const directionData = arc?.status === 'ready' && arc.value?.status === 'ready' ? arc.value : null;
  const sameDirectionOwner = directionData?.input?.birth && chart.birth
    && JSON.stringify([new Date(directionData.input.birth.dateISO).toISOString(), directionData.input.birth.lat, directionData.input.birth.lng])
      === JSON.stringify([new Date(chart.birth.dateISO).toISOString(), chart.birth.lat, chart.birth.lng]);
  const directionPoint = !chart.timeUnknown && sameDirectionOwner ? directionData.planets.find(p => p.name === body) : null;
  const directions = directionPoint ? { method: directionData.method, at: directionData.input.targetAt, arcArcsec: directionData.arcArcsec,
    point: directionPoint, contacts: directionData.contacts.filter(c => c.natalBody === body),
    text: `The ${directionData.method === 'true' ? 'true progressed-Sun' : 'Naibod'} solar-arc construction advances this natal point by ${dms(Number(directionData.arcArcsec))} at ${directionData.input.targetAt}. It supplies a separate reflection layer; it is neither natal placement nor today's sky. Compare its contacts in Solar-arc directions with your dated observations; a mismatch is useful feedback.` } : null;
  const living = context?.evidence?.livingProfile?.value;
  const expectedOwner = chart.birth && JSON.stringify([new Date(chart.birth.dateISO).toISOString(), chart.birth.lat, chart.birth.lng]);
  const reported = living?.ownerKey === expectedOwner ? living.domains?.find(d => d.body === body) : null;
  const latest = reported?.history?.at(-1) || (reported ? living.history?.filter(entry => entry.domain === body).at(-1) : null) || null;
  const feedback = reported ? { source: 'self-reported', count: reported.count || 0, agreement: reported.agreement,
    latest, goal: living.preferences?.goals || '', text: '' } : null;
  if (feedback) {
    const counts = feedback.agreement || {};
    feedback.text = `Your avatar includes ${feedback.count} observations for this domain. Reading feedback: ${counts.fits || 0} fits, ${counts.mixed || 0} partly fits, ${counts['does-not-fit'] || 0} does not fit.`;
    if (latest?.note) feedback.text += ` You reported: “${latest.note}”.`;
    if (feedback.goal) feedback.text += ` Your stated goal: ${feedback.goal}.`;
    feedback.text += ' Your reports personalize the reflection; they do not change the astronomical facts.';
    if (feedback.goal) falsifier.text += ` Relate this exercise to your stated goal: ${feedback.goal}.`;
  }
  return { body, anchor, conditions, aspects, tension, trajectory, falsifier, resonance, facts, feedback, directions,
    text: [facts.join(' '), 'Interpretive tension: ' + tension.interpretation, 'Transit trajectory: ' + trajectory.text, 'Check against experience: ' + falsifier.text,
      resonance.length ? 'Connected placements: ' + resonance.map(r => r.text).join(' ') : 'No natal aspect links were supplied.', directions?.text || '', feedback?.text || ''].filter(Boolean).join('\n') };
}

export function behavioralProfile(chart, context = chart?.readingContext) {
  if (!chart?.birth || !Array.isArray(chart.planets)) throw new Error('A computed natal chart is required.');
  const sections = DOMAINS.map(([body,title]) => {
    const evidence = chartEvidenceForBody(chart,body,context); if (!evidence) return null;
    return { ...evidence, title, source: `${body} in ${evidence.anchor.sign}`,
      uncertainty: chart.timeUnknown ? 'Birth time is unknown. Degrees use the assumed birth time; the Moon placement can change during the birth day. Houses, sect and exact natal-degree timing are withheld.' : null };
  }).filter(Boolean);
  return { version: 2, ownerBirth: { ...chart.birth }, source: 'computed chart with explicitly symbolic interpretation',
    readingAt: context?.at || null, sections,
    text: sections.map(s => `${s.title}\n${s.text}${s.uncertainty ? '\n' + s.uncertainty : ''}`).join('\n\n'),
    limitation: 'This is an astrological reflection for self-observation, not a measured personality assessment or a diagnosis. Displayed degrees are rounded to the nearest arcsecond; that display precision does not establish astronomical or birth-time accuracy. Integer relationship lanes are experimental mathematical correspondences.' };
}
if (typeof window !== 'undefined') window.BehavioralProfile = { behavioralProfile, chartEvidenceForBody, behavioralTrajectories };
