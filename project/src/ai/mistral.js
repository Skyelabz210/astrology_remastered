// Provider credentials never enter reading settings, prompts, histories or exports.
// Optional persistence is explicit: browser storage is accessible to page scripts.
export const MISTRAL_MODELS = ['mistral-large-latest', 'codestral-latest', 'pixtral-large-latest'];
export const MISTRAL_KEY_STORAGE = 'resonance.mistral.byok.v1';
export function createMistral(fetcher = globalThis.fetch, storage = null) {
  let key = '', model = MISTRAL_MODELS[0], endpoint = '', consent = false, generation = 0;
  let tail = Promise.resolve();
  const listeners = new Set(), active = new Set();
  const readSaved = () => { try { return storage?.getItem(MISTRAL_KEY_STORAGE) || ''; } catch { return ''; } };
  key = readSaved();
  let snapshot;
  function changed() {
    generation++;
    for (const controller of active) controller.abort();
    snapshot = Object.freeze({ available: Boolean(key || endpoint), provider: 'Mistral', model, consent, generation });
    for (const listener of listeners) listener();
  }
  changed();
  return {
    available: () => snapshot.available, model: () => model, getState: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    configure(apiKey, selected = MISTRAL_MODELS[0], { proxy = '', remember = false } = {}) {
      if (!MISTRAL_MODELS.includes(selected)) throw new Error('Select a supported Mistral model.');
      // Same-origin paths only. A proxy must supply its own server-side key.
      if (proxy && (!/^\/(?!\/)[^?#]*$/.test(proxy) || proxy.includes('\\'))) throw new Error('Use a same-origin proxy path, for example /api/mistral.');
      const nextKey = String(apiKey || '').trim();
      if (!proxy && !nextKey) throw new Error('Enter a Mistral key or a same-origin proxy path.');
      if (proxy && nextKey) throw new Error('Use either a direct key or a proxy; keys are never sent to a proxy.');
      try {
        if (remember && nextKey) {
          if (!storage) throw new Error('Browser credential storage is unavailable.');
          storage.setItem(MISTRAL_KEY_STORAGE, nextKey);
        } else storage?.removeItem(MISTRAL_KEY_STORAGE);
      } catch { throw new Error('Could not update saved credentials. Disable Remember key or check browser storage.'); }
      key = nextKey; model = selected; endpoint = proxy; changed();
    },
    setConsent(value) { if (consent !== (value === true)) { consent = value === true; changed(); } },
    chooseModel(selected) { if(!MISTRAL_MODELS.includes(selected))throw new Error('Select a supported Mistral model.');if(model!==selected){model=selected;changed();} },
    disconnect() {
      key = ''; endpoint = ''; changed();
      try { storage?.removeItem(MISTRAL_KEY_STORAGE); }
      catch { throw new Error('Disconnected in memory, but the saved key could not be removed from this browser.'); }
    },
    complete(prompt, image = null, { schema = null } = {}) {
      const queued = generation, credential = key, selected = model, proxy = endpoint;
      const job = async () => {
        if (!consent || queued !== generation || !snapshot.available) throw new Error('Mistral permission or settings changed; request cancelled.');
        const controller = new AbortController(); active.add(controller);
        const timer = setTimeout(() => controller.abort(), 45000);
        try {
          const content = image && selected === 'pixtral-large-latest'
            ? [{ type: 'text', text: String(prompt) }, { type: 'image_url', image_url: { url: image } }] : String(prompt);
          const response = await fetcher(proxy || 'https://api.mistral.ai/v1/chat/completions', {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...(proxy ? {} : { Authorization: 'Bearer ' + credential }) },
            body: JSON.stringify({ model: selected, messages: [{ role: 'user', content }], temperature: 0.3, max_tokens: 2400,
              ...(schema ? {response_format:{type:'json_schema',json_schema:{name:'chart_reading',schema,strict:true}}} : {}) }), signal: controller.signal,
          });
          if (!response.ok) throw new Error(response.status === 401 ? 'Mistral rejected the key.' : response.status === 429 ? 'Mistral usage limit reached. Your local reading remains available.' : `Mistral request failed (${response.status}).`);
          const result = await response.json();
          if (!consent || queued !== generation) throw new Error('Mistral settings changed; response discarded.');
          const answer = result.choices?.[0]?.message?.content;
          if (typeof answer !== 'string' || !answer.trim()) throw new Error('Mistral returned no text.');
          return answer;
        } catch (error) {
          if (error.name === 'AbortError') throw new Error('Mistral request cancelled or timed out. Your local reading remains available.', { cause: error });
          throw error;
        } finally { clearTimeout(timer); active.delete(controller); }
      };
      const result = tail.then(job); tail = result.catch(() => {}); return result;
    },
  };
}

// A stable facade keeps provider switches reactive throughout the existing app.
export function createInterpreter(openrouter, mistral) {
  let selected = 'OpenRouter', generation = 0, snapshot, consent = false;
  const listeners = new Set();
  const current = () => selected === 'Mistral' ? mistral : openrouter;
  function changed() {
    generation++;
    snapshot = Object.freeze({ ...current().getState(), provider: selected, generation });
    for (const listener of listeners) listener();
  }
  for (const provider of [openrouter, mistral]) provider.subscribe(changed);
  changed();
  return {
    available: () => current().available(), model: () => selected + ':' + current().model(),
    provider: () => selected, getState: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    select(name) {
      if (!['OpenRouter','Mistral'].includes(name)) throw new Error('Unknown interpreter provider.');
      if (name !== selected) { current().setConsent(false); selected = name; current().setConsent(consent); changed(); }
    },
    setConsent(value) { consent = value === true; current().setConsent(consent); },
    complete: (prompt, image, options) => current().complete(prompt, image, options),
  };
}
if (typeof window !== 'undefined') {
  let storage = null; try { storage = window.localStorage; } catch { /* Memory-only mode remains available. */ }
  window.Mistral = createMistral(globalThis.fetch, storage);
  window.Interpreter = createInterpreter(window.OpenRouter, window.Mistral);
}
