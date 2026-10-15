import { behavioralProfile } from './behavioral-profile.js';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const owner = birth => JSON.stringify([new Date(birth.dateISO).toISOString(),birth.lat,birth.lng]);
export function buildSouvenir(chart, context = null, avatar = null, generated = null) {
  if (!chart?.birth) throw new Error('A personal chart is required.');
  if (context?.input?.birth && owner(context.input.birth) !== owner(chart.birth)) throw new Error('The keepsake context belongs to another birth record.');
  if (avatar && avatar.ownerKey !== owner(chart.birth)) throw new Error('The keepsake avatar belongs to another birth record.');
  const local = behavioralProfile(chart,context);
  return { schema: 'celestial-souvenir-v1', owner: owner(chart.birth), subject: chart.birth.subjectName || 'Your chart',
    birth: { dateISO: chart.birth.dateISO, lat: chart.birth.lat, lng: chart.birth.lng, placeLabel: chart.birth.placeLabel || '' },
    at: context?.at || chart.birth.dateISO,
    dedication: `For ${chart.birth.subjectName || 'you'}: a record of the sky, the choices you describe, and the person you continue to become.`,
    sections: local.sections.map(s=>({ title:s.title, anchor:s.anchor.text, text:s.tension.text, observation:s.falsifier.text, trajectory:[s.trajectory.text,s.directions?.text].filter(Boolean).join(' ') })),
    chapters: (context?.input?.chapters || []).map(ch=>({ place:ch.placeKey || ch.placeLabel || '', from:ch.startISO || '', until:ch.endISO || '', approximate:ch.approximate === true })),
    reports: avatar ? { preferences: { ...avatar.preferences }, observations: (avatar.history || []).slice(-20).map(r=>({at:r.at,domain:r.domain,note:r.note,agreement:r.agreement,rating:r.rating})) } : null,
    generated: generated ? { title:generated.title, sections:generated.sections.map(s=>({title:s.title,text:s.text,citations:[...s.citations]})) } : null,
    limitation: local.limitation + ' This is a commemorative calculation snapshot, not a credential or proof of psychological traits. User reports are authored by the reader; generated passages are labeled.' };
}
export function souvenirMarkdown(value) {
  return [`# ${value.subject} · Celestial souvenir`,value.dedication,`Birth: ${value.birth.dateISO} · ${value.birth.placeLabel}`,`Reading: ${value.at}`,
    ...value.sections.map(s=>`## ${s.title}\n${s.anchor}\n\n${s.text}\n\n${s.trajectory}\n\n${s.observation}`),
    '## Life chapters',...value.chapters.map(ch=>`${ch.place}: ${ch.from} → ${ch.until || 'present'}${ch.approximate?' (approximate)':''}`),
    ...(value.reports ? ['## Your reported experience',...Object.entries(value.reports.preferences).filter(([,v])=>v).map(([k,v])=>`${k}: ${v}`),...value.reports.observations.map(r=>`${r.at} · ${r.domain}: ${r.note || r.agreement || ''}`)] : []),
    ...(value.generated ? ['## AI interpretation',value.generated.title,...value.generated.sections.map(s=>`${s.title}\n${s.text}\nSources: ${s.citations.join(', ')}`)] : []),value.limitation].join('\n\n');
}
export function souvenirHtml(value) {
  const sections = value.sections.map(s=>`<section><h2>${escape(s.title)}</h2><p class="anchor">${escape(s.anchor)}</p><p>${escape(s.text)}</p><details><summary>Trajectory and reflection</summary><p>${escape(s.trajectory)}</p><p>${escape(s.observation)}</p></details></section>`).join('');
  const chapters = value.chapters.map(ch=>`<li>${escape(ch.place)} · ${escape(ch.from)} → ${escape(ch.until || 'present')}${ch.approximate?' (approximate)':''}</li>`).join('');
  const reports = value.reports ? `<h2>Your reported experience</h2>${Object.entries(value.reports.preferences).filter(([,v])=>v).map(([k,v])=>`<p><strong>${escape(k)}</strong>: ${escape(v)}</p>`).join('')}${value.reports.observations.map(r=>`<p>${escape(r.at)} · ${escape(r.domain)}: ${escape(r.note || r.agreement || '')}</p>`).join('')}` : '';
  const generated = value.generated ? `<h2>AI interpretation · ${escape(value.generated.title)}</h2>${value.generated.sections.map(s=>`<section><h3>${escape(s.title)}</h3><p>${escape(s.text)}</p><small>Sources: ${escape(s.citations.join(', '))}</small></section>`).join('')}` : '';
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>${escape(value.subject)} · Celestial souvenir</title><style>body{font:18px/1.65 Georgia,serif;background:#f7f3e8;color:#28313c;max-width:850px;margin:auto;padding:32px}h1,h2{line-height:1.2}.anchor,small{font-family:system-ui,sans-serif}section{margin:30px 0;border-top:1px solid #a8a091;padding-top:12px}p{white-space:pre-wrap;overflow-wrap:anywhere}summary{cursor:pointer}@media print{body{padding:0;background:white}section{break-inside:avoid}details>*{display:block}}</style><h1>${escape(value.subject)}<br>Celestial souvenir</h1><p>${escape(value.dedication)}</p><p>Birth: ${escape(value.birth.dateISO)} · ${escape(value.birth.placeLabel)}<br>Reading: ${escape(value.at)}</p>${sections}<h2>Life chapters</h2><ul>${chapters || '<li>No residence chapters supplied.</li>'}</ul>${reports}${generated}<footer><p>${escape(value.limitation)}</p></footer></html>`;
}
if (typeof window !== 'undefined') window.Souvenir = { buildSouvenir, souvenirMarkdown, souvenirHtml };
