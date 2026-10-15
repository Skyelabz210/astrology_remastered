function InterpreterSettings({ onConnected }) {
  const [key, setKey] = React.useState('');
  const provider = window.OpenRouter;
  const [models, setModels] = React.useState(() => provider.catalogue());
  const [model, setModel] = React.useState(() => provider.model());
  const [status, setStatus] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const connectionSeq = React.useRef(0), alive = React.useRef(true);
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; connectionSeq.current++; }; }, []);
  React.useEffect(() => provider.subscribe(() => {
    const state = provider.getState();
    setModel(state.model); setModels(provider.catalogue());
    setStatus(state.available ? 'Configured · ' + state.model + ' · authentication is checked when generating' : 'Disconnected');
  }), [provider]);
  async function connect() {
    const generation = ++connectionSeq.current;
    setBusy(true); setStatus('Checking free multimodal models…');
    try {
      const choices = await window.OpenRouter.models();
      if (!alive.current || generation !== connectionSeq.current) return;
      setModels(choices);
      const selected = choices.some(m => m.id === model) ? model : choices[0].id;
      setModel(selected); window.OpenRouter.configure(key, selected); setKey('');
      setStatus('Configured · ' + selected + ' · authentication is checked when generating'); if (onConnected) onConnected();
    } catch (e) { if (alive.current && generation === connectionSeq.current) setStatus(e.message); }
    finally { if (alive.current && generation === connectionSeq.current) setBusy(false); }
  }
  return <details className="interpreter-settings"><summary>Interpreter settings · OpenRouter</summary>
    <p>Use your OpenRouter key with a free, open-weight multimodal model. The key stays in memory until you close or reload this page. Free providers have usage limits.</p>
    <label>OpenRouter API key<input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} /></label>
    {models.length > 0 && <label>Free multimodal model<select value={model} disabled={busy} onChange={e => { setModel(e.target.value); if (window.OpenRouter.available()) window.OpenRouter.chooseModel(e.target.value); }}>{models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>}
    <button type="button" className="hdr-pill" disabled={busy || !key.trim()} onClick={connect}>{busy ? 'Connecting…' : 'Connect OpenRouter'}</button>
    <button type="button" className="hdr-pill" onClick={() => { connectionSeq.current++; window.OpenRouter.disconnect(); setKey(''); setBusy(false); setStatus('Disconnected'); }}>Disconnect</button>
    <p role="status">{status}</p>
    <p>Only enabling the AI checkbox sends your chart and reading context to OpenRouter and its selected provider. Your local reading is always available.</p>
  </details>;
}
Object.assign(window, { InterpreterSettings });
