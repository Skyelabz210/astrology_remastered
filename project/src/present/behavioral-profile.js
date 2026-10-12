const SIGNS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const ELEMENTS = ['Fire','Earth','Air','Water'];
const STYLE = {
  Fire: 'Experiment with a small action before committing. Notice when enthusiasm needs a pause.',
  Earth: 'Make expectations concrete and build a repeatable routine. Leave room for a useful change of plan.',
  Air: 'Compare perspectives and say what you are thinking. Check whether discussion needs a clear next step.',
  Water: 'Name the feeling before choosing a response. Check your impressions against what the other person actually said.',
};
const SIGN_THEMES = ['initiative and direct engagement','steadiness and tangible security','curiosity and exchanging perspectives','care and emotional belonging','creative expression and recognition','discernment and practical improvement','reciprocity and weighing competing needs','depth and careful trust','exploration and wider meaning','structure and patient achievement','independence and shared ideals','imagination and sensitivity'];
const DOMAIN_PROMPTS = { Sun: 'Ask which goals you would still choose without outside approval.', Moon: 'Notice what helps you settle after a demanding day.', Mercury: 'Before replying, check that you and the other person mean the same thing.', Venus: 'Say what you value and ask what connection means to the other person.', Mars: 'Separate the issue you want to solve from the impulse to win the argument.' };
const DOMAINS = [['Sun','Motivation and identity'],['Moon','Emotional needs'],['Mercury','Thinking and communication'],['Venus','Connection and values'],['Mars','Action and conflict']];
export function behavioralProfile(chart) {
  if (!chart?.birth || !Array.isArray(chart.planets)) throw new Error('A computed natal chart is required.');
  const sections = DOMAINS.map(([body, title]) => {
    const planet = chart.planets.find(p => p.name === body);
    if (!planet || !Number.isInteger(planet.sign) || planet.sign < 0 || planet.sign > 11) return null;
    const sign = SIGNS[planet.sign], element = ELEMENTS[planet.sign % 4];
    const source = `${body} in ${sign}`;
    return { title, body, source, text: `${source} is traditionally associated with ${SIGN_THEMES[planet.sign]}. ${STYLE[element]} ${DOMAIN_PROMPTS[body]}`,
      uncertainty: body === 'Moon' && chart.timeUnknown ? 'The Moon placement uses the assumed birth time and can change during the birth day.' : null };
  }).filter(Boolean);
  return { version: 1, ownerBirth: { ...chart.birth }, source: 'local astrological reflection',
    sections, text: sections.map(s => `${s.title}\n${s.text}${s.uncertainty ? '\n' + s.uncertainty : ''}`).join('\n\n'),
    limitation: 'This is an astrological reflection for self-observation, not a measured personality assessment or a diagnosis.' };
}
if (typeof window !== 'undefined') window.BehavioralProfile = { behavioralProfile };
