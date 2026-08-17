// voice.jsx — voice narration via the browser's Speech Synthesis API.
//
// Root cause of silence in most browsers:
//   SpeechSynthesis.speak() is ONLY allowed synchronously inside a user
//   gesture handler (click, keydown, touch). Any call from a useEffect —
//   even after a prior gesture — is treated as autoplay and silently
//   dropped or raises "not-allowed".
//
// Solution:
//   1. Default voiceOn = false. The user explicitly clicks the voice
//      button, which IS a gesture; we speak immediately inside that handler.
//   2. Expose retrigger() — call it directly inside onClick so the speak()
//      call is synchronous with the gesture.
//   3. Auto-speak when text changes (for subsequent cards after the first
//      user-gesture has primed the engine).
//   4. Keep the "tap to enable" fallback for browsers that are extra strict.

const VOICE_PREF_KEYWORDS = [
  "Samantha","Karen","Moira","Tessa","Daniel","Serena",
  "Aria","Jenny","Guy","Davis","Sara",
  "Google US English","Google UK English",
];

function rankVoice(v) {
  let score = 0;
  if (!v.lang.startsWith("en")) score -= 30;
  if (v.lang === "en-US") score += 5;
  if (v.localService) score += 3;
  for (let i = 0; i < VOICE_PREF_KEYWORDS.length; i++) {
    if (v.name.includes(VOICE_PREF_KEYWORDS[i])) score += 30 - i;
  }
  if (/premium|enhanced|neural|natural/i.test(v.name)) score += 20;
  return score;
}

const POWER_WORD_TRANSFORMS = [
  [/\bSaturn\b/gi,     "Sssaturn"],
  [/\bSun\b/g,         "Sssun"],
  [/\bsign\b/gi,       "ssign"],
  [/\bsect\b/gi,       "sssect"],
  [/\bshadow\b/gi,     "shhhadow"],
  [/\bsubstrate\b/gi,  "sssubstrate"],
  [/\bSagittarius\b/gi,"Sssagittariusss"],
  [/\bScorpio\b/gi,    "Sscorpio"],
  [/\bdignity\b/gi,    "dddignity"],
  [/\bdomicile\b/gi,   "dddomicile"],
  [/\bdetriment\b/gi,  "dddetriment"],
  [/\bzodiac\b/gi,     "zzzodiac"],
];

function applyPower(text) {
  let s = text;
  for (const [re, rep] of POWER_WORD_TRANSFORMS) s = s.replace(re, rep);
  s = s.replace(/(^|\.\s+|!\s+|\?\s+)([SsDdZz])/g, (m, p, ch) => p + ch + ch + ch);
  return s;
}

const STYLE_PRESETS = {
  measured: { rate: 0.95, pitch: 1.00, power: false },
  jedi:     { rate: 0.85, pitch: 0.95, power: false },
  sith:     { rate: 0.75, pitch: 0.88, power: true  },
  ultimate: { rate: 0.62, pitch: 0.78, power: true  },
};

function listVoices() {
  if (typeof window.speechSynthesis === "undefined") return [];
  return [...(window.speechSynthesis.getVoices() || [])].sort((a,b) => rankVoice(b) - rankVoice(a));
}

// Speak text directly — must be called inside a synchronous user-gesture handler.
function speakNow(text, { style = "jedi", voiceName, rate, pitch } = {}) {
  if (!text || typeof window.speechSynthesis === "undefined") return;
  const preset = STYLE_PRESETS[style] || STYLE_PRESETS.jedi;
  const effRate  = rate  ?? preset.rate;
  const effPitch = pitch ?? preset.pitch;
  const effText  = preset.power ? applyPower(text) : text;
  const voices   = listVoices();
  const chosen   = voiceName ? voices.find(v => v.name === voiceName) : voices[0] || null;

  try { window.speechSynthesis.cancel(); } catch {}

  const sentences = effText.replace(/\s+/g, " ")
    .match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [effText];

  sentences.forEach((s) => {
    const u = new SpeechSynthesisUtterance(s.trim());
    u.rate = effRate; u.pitch = effPitch; u.volume = 1;
    if (chosen) { u.voice = chosen; u.lang = chosen.lang; }
    try { window.speechSynthesis.speak(u); } catch {}
  });
}

function stopSpeech() {
  try { if (typeof window.speechSynthesis !== "undefined") window.speechSynthesis.cancel(); } catch {}
}

function useVoice({ text, enabled, style, voiceName, playing }) {
  const preset   = STYLE_PRESETS[style] || STYLE_PRESETS.jedi;
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [speaking,  setSpeaking]  = React.useState(false);
  const [blocked,   setBlocked]   = React.useState(false);
  // primedRef: true once the user has triggered at least one gesture-based speak
  const primedRef = React.useRef(false);
  const voicesRef = React.useRef([]);

  // Load voices into ref
  React.useEffect(() => {
    if (!supported) return;
    const refresh = () => { voicesRef.current = listVoices(); };
    refresh();
    window.speechSynthesis.onvoiceschanged = refresh;
    return () => { try { window.speechSynthesis.onvoiceschanged = null; } catch {} };
  }, [supported]);

  // Auto-speak when text changes — only works reliably after engine is primed.
  React.useEffect(() => {
    if (!supported || !enabled || !playing || !text) return;
    if (!primedRef.current) {
      // Engine not yet primed by a gesture — show "tap to enable" instead.
      setBlocked(true);
      return;
    }
    setBlocked(false);
    const voices  = voicesRef.current;
    const chosen  = voiceName ? voices.find(v => v.name === voiceName) : (voices[0] || null);
    const effText = preset.power ? applyPower(text) : text;
    const sentences = effText.replace(/\s+/g, " ")
      .match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [effText];
    try { window.speechSynthesis.cancel(); } catch {}
    sentences.forEach((s, i) => {
      const u = new SpeechSynthesisUtterance(s.trim());
      u.rate = preset.rate; u.pitch = preset.pitch; u.volume = 1;
      if (chosen) { u.voice = chosen; u.lang = chosen.lang; }
      if (i === 0) u.onstart = () => setSpeaking(true);
      if (i === sentences.length - 1) u.onend = () => setSpeaking(false);
      u.onerror = (e) => {
        setSpeaking(false);
        if (e && e.error === "not-allowed") { setBlocked(true); primedRef.current = false; }
      };
      try { window.speechSynthesis.speak(u); } catch {}
    });
    return () => { try { window.speechSynthesis.cancel(); } catch {} };
  }, [supported, text, enabled, playing, style, voiceName]);

  // Pause/resume
  React.useEffect(() => {
    if (!supported || !enabled) return;
    if (!playing) { try { window.speechSynthesis.pause(); } catch {} }
    else          { try { window.speechSynthesis.resume(); } catch {} }
  }, [playing, supported, enabled]);

  // retrigger: call this INSIDE a click/tap handler to speak the current text.
  // This satisfies the gesture requirement and primes the engine.
  const retrigger = React.useCallback((currentText) => {
    if (!supported) return;
    primedRef.current = true;
    setBlocked(false);
    speakNow(currentText || text, { style, voiceName, rate: preset.rate, pitch: preset.pitch });
    setSpeaking(true);
    // speaking state will be cleared by utterance onend
  }, [text, style, voiceName, preset.rate, preset.pitch, supported]);

  // prime: the same gesture-unlock retrigger() does, WITHOUT speaking.
  // session.jsx calls this from click handlers that need to satisfy the
  // browser's gesture requirement now so a LATER async speak() call (e.g.
  // the auto-speak effect above, once `text` arrives) is not silently
  // blocked — retrigger() conflates that with "and speak this text right
  // now," which is wrong for a handler that decides separately whether to
  // speak immediately. Was previously called as a bare `primeSpeech()`
  // with no such export existing anywhere in the file, a ReferenceError
  // waiting to fire the first time a voice control was actually clicked —
  // see docs/COMPLETION_AUDIT.md's completion follow-up.
  const prime = React.useCallback(() => {
    if (!supported) return;
    primedRef.current = true;
    setBlocked(false);
  }, [supported]);

  return { supported, speaking, blocked, retrigger, prime };
}

Object.assign(window, { useVoice, listVoices, speakNow, stopSpeech, STYLE_PRESETS });
