function InterpreterSettings({ onConnected }) {
  const [key, setKey] = React.useState('');
  const [models, setModels] = React.useState([]);
  const [model, setModel] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  async function connect() {
    setBusy(true); setStatus('Checking free multimodal models…');
    try {
      const choices = await window.OpenRouter.models(); setModels(choices);
      const selected = choices.some(m => m.id === model) ? model : choices[0].id;
      setModel(selected); window.OpenRouter.configure(key, selected); setKey('');
      setStatus('Connected · ' + selected); if (onConnected) onConnected();
    } catch (e) { setStatus(e.message); } finally { setBusy(false); }
  }
  return <details className="interpreter-settings"><summary>Interpreter settings · OpenRouter</summary>
    <p>Use your OpenRouter key with a free, open-weight multimodal model. The key stays in memory until you close or reload this page. Free providers have usage limits.</p>
    <label>OpenRouter API key<input type="password" autoComplete="off" value={key} onChange={e => setKey(e.target.value)} /></label>
    {models.length > 0 && <label>Free multimodal model<select value={model} onChange={e => { setModel(e.target.value); if (window.OpenRouter.available()) { window.OpenRouter.chooseModel(e.target.value); setStatus("Connected · " + e.target.value); } }}>{models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>}
    <button type="button" className="hdr-pill" disabled={busy || !key.trim()} onClick={connect}>{busy ? 'Connecting…' : 'Connect OpenRouter'}</button>
    <button type="button" className="hdr-pill" onClick={() => { window.OpenRouter.disconnect(); setStatus('Disconnected'); }}>Disconnect</button>
    <p role="status">{status}</p>
    <p>Only enabling the AI checkbox sends your chart and reading context to OpenRouter and its selected provider. Your local reading is always available.</p>
  </details>;
}
Object.assign(window, { InterpreterSettings });
