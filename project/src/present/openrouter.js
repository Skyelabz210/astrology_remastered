// Free, open-weight vision models are selected from the live catalogue.
// Credentials stay in memory; chart exports never inspect this closure.
export function freeVisionModels(models) {
  return (Array.isArray(models) ? models : []).filter(m =>
    m && typeof m.id === 'string' && /(?:qwen|gemma|llama|mistral|nemotron|molmo|deepseek)/i.test(m.id) &&
    m.id.endsWith(':free') && m.pricing?.prompt != null && m.pricing?.completion != null && m.pricing.prompt !== '' && m.pricing.completion !== '' && Number(m.pricing.prompt) === 0 &&
    Number(m.pricing?.completion) === 0 &&
    m.architecture?.input_modalities?.includes('image') &&
    m.architecture?.output_modalities?.includes('text'));
}
export function createOpenRouter(fetcher = globalThis.fetch) {
  let apiKey = '', model = '', catalogue = [];
  let tail = Promise.resolve(), consent = true, generation = 0;
  const listeners = new Set(), activeRequests = new Set();
  let snapshot = Object.freeze({ available: false, model, consent, generation });
  function changed() {
    generation++;
    for (const controller of activeRequests) controller.abort();
    snapshot = Object.freeze({ available: Boolean(apiKey && model), model, consent, generation });
    for (const listener of listeners) listener();
  }
  async function request(path, options = {}) {
    const controller = new AbortController();
    const scoped = path === 'chat/completions';
    if (scoped) activeRequests.add(controller);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 45000);
    try {
      const response = await fetcher('https://openrouter.ai/api/v1/' + path,
        { ...options, signal: controller.signal });
      if (!response.ok) throw new Error(response.status === 429
        ? 'OpenRouter free-model limit reached. Your local reading remains available; try again later.'
        : response.status === 401 ? 'OpenRouter rejected the API key. Check it in interpreter settings.'
        : `OpenRouter request failed (${response.status}). Your local reading remains available.`);
      return await response.json();
    } catch (e) {
      if (e.name === 'AbortError') throw new Error(timedOut
        ? 'OpenRouter timed out. Your local reading remains available.'
        : 'Interpreter permission or settings changed; request cancelled.', { cause: e });
      throw e;
    } finally { clearTimeout(timer); activeRequests.delete(controller); }
  }
  return {
    available: () => Boolean(apiKey && model),
    model: () => model,
    getState: () => snapshot,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    catalogue: () => catalogue.map(m => ({ id: m.id, name: m.name || m.id })),
    async models() {
      catalogue = freeVisionModels((await request('models')).data);
      if (!catalogue.length) throw new Error('No free open-weight multimodal model is currently available on OpenRouter.');
      return catalogue.map(m => ({ id: m.id, name: m.name || m.id }));
    },
    configure(key, id) {
      if (!catalogue.some(m => m.id === id)) throw new Error('Select a verified free multimodal model first.');
      const nextKey = String(key || '').trim();
      if (!nextKey) throw new Error('Enter your OpenRouter API key. Free models also require a key.');
      if (apiKey !== nextKey || model !== id) { apiKey = nextKey; model = id; changed(); }
    },
    chooseModel(id) { if (!catalogue.some(m => m.id === id)) throw new Error('Select a verified free multimodal model.'); if (model !== id) { model = id; changed(); } },
    setConsent(enabled) { if (consent !== (enabled === true)) { consent = enabled === true; changed(); } },
    disconnect() { apiKey = ''; model = ''; changed(); },
    complete(prompt, image = null) {
      // Capture the account and model when queued, never silently switch owners.
      const key = apiKey, selected = model, queuedGeneration = generation;
      const job = async () => {
        if (!consent || queuedGeneration !== generation) throw new Error('AI permission changed; queued request cancelled.');
        if (!key || !selected) throw new Error('Connect OpenRouter in interpreter settings first.');
        if (key !== apiKey || selected !== model) throw new Error('Interpreter settings changed; request cancelled.');
        const content = image ? [{ type: 'text', text: String(prompt) },
          { type: 'image_url', image_url: { url: image } }] : String(prompt);
        const data = await request('chat/completions', { method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
          body: JSON.stringify({ model: selected, messages: [{ role: 'user', content }],
            temperature: 0.3, max_tokens: 1800, provider: { max_price: { prompt: 0, completion: 0 } } }) });
        if (!consent || queuedGeneration !== generation || key !== apiKey || selected !== model) throw new Error('Interpreter permission or settings changed; response discarded.');
        const text = data.choices?.[0]?.message?.content;
        if (typeof text !== 'string' || !text.trim()) throw new Error('OpenRouter returned an empty reading. Try again.');
        return text;
      };
      const result = tail.then(job); tail = result.catch(() => {}); return result;
    },
  };
}
if (typeof window !== 'undefined') { window.OpenRouter = createOpenRouter(); window.OpenRouter.setConsent(false); }
