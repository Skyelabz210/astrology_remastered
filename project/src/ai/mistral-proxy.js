// Optional Edge/server adapter. The host MUST authenticate and rate-limit the
// reader in authorize(); rejecting by default prevents an open paid API relay.
import { MISTRAL_MODELS } from './mistral.js';
import { READING_SCHEMA } from './reading-schema.js';
export function createMistralProxy({ authorize, getKey, fetcher = globalThis.fetch }) {
  return async request => {
    const reply = (status,message) => new Response(JSON.stringify({error:message}),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
    if (request.method !== 'POST') return reply(405,'POST required');
    if (typeof authorize !== 'function' || !(await authorize(request))) return reply(403,'Authenticated, rate-limited access required');
    if (Number(request.headers.get('content-length') || 0) > 200000) return reply(413,'Request too large');
    const raw = await request.text();
    if (raw.length > 200000) return reply(413,'Request too large');
    let value; try { value = JSON.parse(raw); } catch { return reply(400,'JSON required'); }
    const content=value.messages?.[0]?.content;
    const textContent=typeof content==='string' && content.length<=160000;
    const imageContent=value.model==='pixtral-large-latest' && Array.isArray(content) && content.length===2 && content[0]?.type==='text' && typeof content[0].text==='string' && content[0].text.length<=120000 && content[1]?.type==='image_url' && typeof content[1].image_url?.url==='string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(content[1].image_url.url);
    if (!MISTRAL_MODELS.includes(value.model) || !Array.isArray(value.messages) || value.messages.length !== 1 || value.messages[0].role !== 'user' || (!textContent && !imageContent)) return reply(400,'Unsupported completion request');
    const key = typeof getKey === 'function' ? await getKey() : '';
    if (!key) return reply(503,'Server provider is not configured');
    const controller = new AbortController(), timer = setTimeout(()=>controller.abort(),45000);
    try {
      const upstream = await fetcher('https://api.mistral.ai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},
        body:JSON.stringify({model:value.model,messages:[{role:'user',content}],temperature:0.3,max_tokens:2400,
          ...(value.response_format ? {response_format:{type:'json_schema',json_schema:{name:'chart_reading',schema:READING_SCHEMA,strict:true}}} : {})}),signal:controller.signal});
      if (!upstream.ok) return reply(upstream.status,'Provider request failed');
      const data = await upstream.json();
      return new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
    } catch { return reply(502,'Provider unavailable'); } finally {clearTimeout(timer);}
  };
}
