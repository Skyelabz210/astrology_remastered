// voice.jsx — voice narration for the reading.
//
// TWO PROVIDERS, one API.
//
//   · elevenlabs — the app's configured reading voice, ElevenLabs "Nerissa"
//     (elevenlabs.js). Real TTS: the reading text is POSTed to
//     api.elevenlabs.io with the reader's own API key and the returned MP3
//     is played through a single shared <audio> element. This is the
//     DEFAULT provider; it is only actually reachable once a key has been
//     entered, so a fresh browser silently runs on the fallback below until
//     one is.
//
//   · browser — SpeechSynthesis, the previous and still the fallback path.
//     Used whenever ElevenLabs cannot serve: no key, no network, a refused
//     request, or the reader picking a system voice explicitly. Narration
//     never goes silent just because a network call failed.
//
// GESTURE / AUTOPLAY, which is why the odd-looking prime()/retrigger() pair
// exists and why both providers need it:
//
//   SpeechSynthesis.speak() is only reliably allowed synchronously inside a
//   user gesture handler (click, keydown, touch). A call from a useEffect —
//   even after a prior gesture — is treated as autoplay and silently
//   dropped or raises "not-allowed".
//
//   Media playback has the same shape of restriction: an <audio> element
//   that has never been played inside a gesture can be refused later. An
//   ElevenLabs request is inherently asynchronous (synthesis takes a second
//   or two), so its play() can NEVER be inside the gesture — the standard
//   fix, used here, is to unlock ONE shared element by playing a silent
//   clip during the gesture and then reuse that same element for every
//   later utterance.
//
// So:
//   1. prime() — gesture-unlock without speaking (unlocks BOTH engines).
//   2. retrigger() — call directly inside onClick to speak the current text.
//   3. Auto-speak when text changes, once the engines have been primed.
//   4. Until a gesture has primed them, the auto-speak effect reports
//      `blocked` and the UI shows "tap to enable" rather than a dead button.
//      That matters more than it used to: DEFAULT_SETTINGS.voiceOn now ships
//      TRUE, so the first reading on a fresh page always reaches the
//      auto-speak effect with no gesture behind it yet.

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

// ──────────────────────────────────────────────────────────────────────
// provider selection
// ──────────────────────────────────────────────────────────────────────

const VOICE_PROVIDER_ELEVEN  = "elevenlabs";
const VOICE_PROVIDER_BROWSER = "browser";
const DEFAULT_VOICE_PROVIDER = VOICE_PROVIDER_ELEVEN;

// elevenlabs.js publishes window.ElevenLabs. It is a separate <script
// type="module">, so a page that omits the tag (or a Node test rig running
// this file in isolation) simply has no provider — every helper below
// degrades to the browser path instead of throwing.
function elevenModule() {
  return (typeof window !== "undefined" && window.ElevenLabs) ? window.ElevenLabs : null;
}

/** True when ElevenLabs is loaded AND a key is stored — i.e. it can be tried. */
function elevenReady() {
  const EL = elevenModule();
  if (!EL) return false;
  try { return EL.isConfigured(); } catch { return false; }
}

/**
 * Which provider a request will actually use. A requested provider is only
 * honored if it can serve; "elevenlabs" without a key silently becomes
 * "browser" so narration still happens (the tweaks panel is where the
 * reader is told why, not the middle of a reading).
 */
function resolveProvider(requested) {
  const want = requested || DEFAULT_VOICE_PROVIDER;
  if (want === VOICE_PROVIDER_ELEVEN && elevenReady()) return VOICE_PROVIDER_ELEVEN;
  return VOICE_PROVIDER_BROWSER;
}

// ──────────────────────────────────────────────────────────────────────
// shared <audio> element — one per document, unlocked once by prime()
// ──────────────────────────────────────────────────────────────────────

// 44-byte zero-sample WAV: the shortest thing a browser will accept as
// playable media. Played inside the user gesture to unlock the element.
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

const __eleven = {
  audio: null,        // the one unlocked HTMLAudioElement
  url: null,          // object URL currently loaded into it
  cache: new Map(),   // request key -> object URL
  seq: 0,             // request generation, so a stale synth can't play late
};

const ELEVEN_CACHE_MAX = 24;

function elevenAudioElement() {
  if (typeof window === "undefined" || typeof window.Audio !== "function") return null;
  if (!__eleven.audio) {
    const a = new window.Audio();
    a.preload = "auto";
    __eleven.audio = a;
  }
  return __eleven.audio;
}

/** Unlock the shared element. MUST run inside a user gesture to be useful. */
function primeElevenAudio() {
  const a = elevenAudioElement();
  if (!a) return;
  try {
    a.src = SILENT_WAV;
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch { /* unlock is best-effort; a refused silent clip is not an error */ }
}

function cacheKeyFor(text, voiceId, modelId, settings) {
  return [voiceId, modelId, settings.speed, settings.stability, settings.style, text].join("|");
}

function putCached(key, url) {
  __eleven.cache.set(key, url);
  while (__eleven.cache.size > ELEVEN_CACHE_MAX) {
    const oldest = __eleven.cache.keys().next().value;
    const stale = __eleven.cache.get(oldest);
    __eleven.cache.delete(oldest);
    try { window.URL.revokeObjectURL(stale); } catch { /* already revoked */ }
  }
}

/** Stop ElevenLabs playback (leaves the element unlocked and reusable). */
function stopEleven() {
  __eleven.seq += 1;
  const a = __eleven.audio;
  if (!a) return;
  try { a.pause(); a.currentTime = 0; } catch { /* not yet playable */ }
}

/**
 * Speak `text` through ElevenLabs. Async by nature — synthesis first, then
 * playback on the pre-unlocked element.
 *
 * Returns a promise resolving to the provider that actually spoke, so a
 * caller can report "fell back to the browser voice" honestly. Any failure
 * (no key, unresolvable voice, refused request, network down, blocked
 * playback) routes to SpeechSynthesis rather than leaving the reading mute,
 * unless `fallback: false`.
 */
async function speakEleven(text, opts = {}) {
  const {
    style = "jedi", voiceName, elevenVoiceId = "", elevenModel,
    rate, fallback = true, onStatus,
  } = opts;
  const EL = elevenModule();
  const preset = STYLE_PRESETS[style] || STYLE_PRESETS.jedi;
  const effText = preset.power ? applyPower(text) : text;
  const say = (state, message) => { if (typeof onStatus === "function") onStatus({ state, message }); };

  const generation = ++__eleven.seq;
  const isStale = () => generation !== __eleven.seq;

  try {
    if (!EL) throw new Error("ElevenLabs module not loaded");
    const apiKey = EL.readKey();
    const settings = EL.voiceSettingsFor(style, rate ?? preset.rate);
    const modelId = elevenModel || EL.DEFAULT_MODEL_ID;

    say("resolving", "resolving voice…");
    const resolved = await EL.resolveVoiceId({
      apiKey,
      name: voiceName || EL.DEFAULT_VOICE_NAME,
      voiceId: elevenVoiceId,
    });
    if (isStale()) return null;

    const key = cacheKeyFor(effText, resolved.voiceId, modelId, settings);
    let url = __eleven.cache.get(key);
    if (!url) {
      say("synthesizing", `synthesizing with ${resolved.name || voiceName}…`);
      const buf = await EL.synthesize({
        apiKey,
        voiceId: resolved.voiceId,
        text: effText,
        modelId,
        voiceSettings: settings,
      });
      if (isStale()) return null;
      url = window.URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }));
      putCached(key, url);
    }

    const a = elevenAudioElement();
    if (!a) throw new Error("no audio element available");
    // A second reading must not overlap the first; the element is shared.
    try { a.pause(); } catch { /* nothing playing */ }
    a.src = url;
    __eleven.url = url;
    await a.play();
    if (isStale()) { try { a.pause(); } catch { /* already stopped */ } return null; }
    say("speaking", "");
    return VOICE_PROVIDER_ELEVEN;
  } catch (err) {
    if (isStale()) return null;
    const raw = (err && err.message) || "ElevenLabs narration unavailable";
    // The API's own messages arrive both with and without terminal
    // punctuation ("Invalid API key" vs "Quota exceeded."), and this is
    // rendered as a sentence to the reader — normalise before appending.
    const message = /[.!?]$/.test(raw) ? raw : `${raw}.`;
    if (!fallback) { say("error", message); throw err; }
    say("fallback", `${message} Using the browser voice.`);
    speakBrowser(text, opts);
    return VOICE_PROVIDER_BROWSER;
  }
}

// ──────────────────────────────────────────────────────────────────────
// SpeechSynthesis (fallback provider)
// ──────────────────────────────────────────────────────────────────────

function listVoices() {
  if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") return [];
  return [...(window.speechSynthesis.getVoices() || [])].sort((a,b) => rankVoice(b) - rankVoice(a));
}

/**
 * Pick the SpeechSynthesis voice to use.
 *
 * The configured reading voice is an ElevenLabs voice name ("Nerissa") that
 * no operating system ships, so on this fallback path the lookup MUST miss.
 * It falls through to the best-ranked system voice rather than to `null`:
 * leaving the utterance's voice unset hands it to whatever the browser's
 * default happens to be, which is precisely the ranking this file exists to
 * improve on.
 */
function pickBrowserVoice(voices, voiceName) {
  if (!voices || !voices.length) return null;
  if (voiceName) {
    const named = voices.find(v => v.name === voiceName);
    if (named) return named;
  }
  return voices[0];
}

// ── iOS-safe queueing ─────────────────────────────────────────────────
//
// Two facts about SpeechSynthesis on iOS Safari shape everything below:
//
//   1. speak() only counts as gesture-authorised when SOME utterance has
//      been spoken inside a real gesture. prime() below speaks a muted,
//      blank utterance for exactly that reason.
//   2. A bulk-queued backlog is unreliable: iOS is prone to speaking the
//      first utterance and dropping the rest, and a dropped utterance
//      fires no onend — which left "the voice reader doesn't work" as the
//      visible symptom and a narration stuck mid-deck as the silent one.
//
// So utterances are fed to the engine ONE AT A TIME, each queued from the
// previous one's onend. onerror advances too: one refused sentence must
// not end the reading. Any onstart/onend/onerror a caller pre-set on an
// utterance still runs — the chain wraps rather than replaces them.
function speakChain(utterances, { isCancelled, onDone } = {}) {
  let i = 0;
  const step = () => {
    if (isCancelled && isCancelled()) return;
    if (i >= utterances.length) { if (onDone) onDone(); return; }
    const u = utterances[i++];
    const prevEnd = u.onend, prevErr = u.onerror;
    u.onend  = (e) => { if (prevEnd) { try { prevEnd(e); } catch {} } step(); };
    u.onerror = (e) => { if (prevErr) { try { prevErr(e); } catch {} } step(); };
    try { window.speechSynthesis.speak(u); } catch { step(); }
  };
  step();
}

// Gesture-unlock for SpeechSynthesis: speak a muted, blank utterance while
// the gesture is live. Inaudible, but it registers the gesture with the
// engine so asynchronous speak() calls that follow (the auto-speak effect,
// an ElevenLabs failure falling back mid-narration) are not silently
// dropped as autoplay. (Corrected: prime() documented itself as unlocking
// BOTH engines but only unlocked the shared <audio> element — the browser
// voice was never gesture-registered, which is why it sat mute on iOS.)
function primeBrowserSpeech() {
  if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") return;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch { /* unlock is best-effort */ }
}

// Speak text through SpeechSynthesis — must be called inside a synchronous
// user-gesture handler.
function speakBrowser(text, { style = "jedi", voiceName, rate, pitch } = {}) {
  if (!text || typeof window === "undefined" || typeof window.speechSynthesis === "undefined") return;
  const preset = STYLE_PRESETS[style] || STYLE_PRESETS.jedi;
  const effRate  = rate  ?? preset.rate;
  const effPitch = pitch ?? preset.pitch;
  const effText  = preset.power ? applyPower(text) : text;
  const voices   = listVoices();
  const chosen   = pickBrowserVoice(voices, voiceName);

  try { window.speechSynthesis.cancel(); } catch {}

  const sentences = effText.replace(/\s+/g, " ")
    .match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [effText];

  speakChain(sentences.map((s) => {
    const u = new SpeechSynthesisUtterance(s.trim());
    u.rate = effRate; u.pitch = effPitch; u.volume = 1;
    if (chosen) { u.voice = chosen; u.lang = chosen.lang; }
    return u;
  }));
}

// ──────────────────────────────────────────────────────────────────────
// public speak / stop
// ──────────────────────────────────────────────────────────────────────

/**
 * Speak text with whichever provider is configured and able.
 *
 * Synchronous for the browser provider (so it keeps satisfying the gesture
 * requirement when called straight from an onClick); for ElevenLabs it
 * kicks off the async path and returns immediately — the shared <audio>
 * element having been unlocked by prime()/retrigger() in the same gesture.
 */
function speakNow(text, opts = {}) {
  if (!text) return;
  const provider = resolveProvider(opts.provider);
  if (provider === VOICE_PROVIDER_ELEVEN) {
    stopBrowserSpeech();
    speakEleven(text, opts).catch(() => {});
    return;
  }
  stopEleven();
  speakBrowser(text, opts);
}

function stopBrowserSpeech() {
  try {
    if (typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined") {
      window.speechSynthesis.cancel();
    }
  } catch {}
}

/** Stop narration on both providers. */
function stopSpeech() {
  stopBrowserSpeech();
  stopEleven();
}

// ──────────────────────────────────────────────────────────────────────
// continuous narration — the whole chart as one piece
// ──────────────────────────────────────────────────────────────────────
//
// The card-at-a-time path above speaks one reading and stops. This one
// takes narrative.jsx's segmented chart narrative and plays it end to end,
// reporting which segment the voice has actually REACHED so the deck can
// follow it rather than run on a parallel timer.
//
// How "reached" is known differs by provider, and neither is a guess:
//   · ElevenLabs — character-level timestamps from the with-timestamps
//     endpoint turn each segment's character range into a start time, and a
//     `timeupdate` listener on the audio element compares playback position
//     against them. Using the element's own clock (rather than setTimeout)
//     means pausing, resuming and seeking all keep the deck in sync for
//     free. Where a model returns no alignment, the same ranges are scaled
//     against the clip's measured duration instead.
//   · SpeechSynthesis — one utterance per segment, chained; the segment is
//     reported from that utterance's own `onstart`, which is exact.
//
// Long narratives are split into request-sized chunks at SEGMENT
// boundaries (never mid-sentence — a chunk edge is audible), and the next
// chunk is synthesized while the current one plays, so the seam between
// them is the length of a network round trip that already happened.

const __narration = { seq: 0, cache: new Map() };
const NARRATION_CACHE_MAX = 8;

function narrationCacheKey(text, voiceId, modelId, settings) {
  return [voiceId, modelId, settings.speed, settings.stability, settings.style, text.length, text.slice(0, 120)].join("|");
}

/** Synthesize one chunk and work out when each of its segments is spoken. */
async function renderNarrationChunk(chunk, ctx) {
  const key = narrationCacheKey(chunk.text, ctx.voiceId, ctx.modelId, ctx.settings);
  const cached = __narration.cache.get(key);
  if (cached) return { ...cached, timings: cached.timings || segmentTimingsFromAlignmentSafe(chunk, cached.alignment) };

  let audio, alignment = null;
  try {
    const out = await ctx.EL.synthesizeWithTimestamps({
      apiKey: ctx.apiKey, voiceId: ctx.voiceId, text: chunk.text,
      modelId: ctx.modelId, voiceSettings: ctx.settings,
    });
    audio = out.audio;
    alignment = out.normalizedAlignment || out.alignment;
  } catch (err) {
    // A model or plan without the timestamps endpoint must not cost the
    // whole narration — fall back to plain synthesis and time the segments
    // against the clip's duration instead.
    if (err && (err.code === "no_key" || err.code === "no_voice")) throw err;
    audio = await ctx.EL.synthesize({
      apiKey: ctx.apiKey, voiceId: ctx.voiceId, text: chunk.text,
      modelId: ctx.modelId, voiceSettings: ctx.settings,
    });
  }
  const url = window.URL.createObjectURL(new Blob([audio], { type: "audio/mpeg" }));
  const entry = { url, alignment, timings: segmentTimingsFromAlignmentSafe(chunk, alignment) };
  __narration.cache.set(key, entry);
  while (__narration.cache.size > NARRATION_CACHE_MAX) {
    const oldest = __narration.cache.keys().next().value;
    const stale = __narration.cache.get(oldest);
    __narration.cache.delete(oldest);
    try { window.URL.revokeObjectURL(stale.url); } catch { /* already revoked */ }
  }
  return entry;
}

function segmentTimingsFromAlignmentSafe(chunk, alignment) {
  if (!alignment || typeof segmentTimingsFromAlignment !== "function") return null;
  try { return segmentTimingsFromAlignment(chunk, alignment); } catch { return null; }
}

/** Play one rendered chunk, reporting segments as the voice reaches them. */
function playNarrationChunk(chunk, entry, ctx) {
  return new Promise((resolve, reject) => {
    const a = elevenAudioElement();
    if (!a) { reject(new Error("no audio element available")); return; }
    let timings = entry.timings;
    let announced = -1;

    const announce = () => {
      if (!timings || !timings.length) return;
      const now = a.currentTime + 0.06;   // a beat of lead so the card is up as the words land
      let hit = -1;
      for (let i = 0; i < timings.length; i++) {
        if (now >= timings[i].startSec) hit = i; else break;
      }
      if (hit >= 0 && hit !== announced) {
        announced = hit;
        if (ctx.onSegment) ctx.onSegment(timings[hit]);
      }
    };
    const onMeta = () => {
      // No alignment came back: scale the character ranges against the
      // clip's real duration, which is only knowable once metadata loads.
      if (!timings && typeof segmentTimingsFromDuration === "function") {
        timings = segmentTimingsFromDuration(chunk, a.duration);
      }
      announce();
    };
    const cleanup = () => {
      a.removeEventListener("timeupdate", announce);
      a.removeEventListener("loadedmetadata", onMeta);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onError);
    };
    const onEnded = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("narration playback failed")); };

    a.addEventListener("timeupdate", announce);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onError);

    try { a.pause(); } catch { /* nothing playing */ }
    a.src = entry.url;
    const started = a.play();
    if (started && typeof started.then === "function") {
      started.then(() => { if (ctx.onStatus) ctx.onStatus({ state: "speaking", message: "" }); announce(); },
        (err) => { cleanup(); reject(err); });
    } else {
      announce();
    }
  });
}

async function speakNarrativeEleven(narrative, opts, state) {
  const EL = elevenModule();
  if (!EL) throw new Error("ElevenLabs module not loaded");
  const style = opts.style || "jedi";
  const preset = STYLE_PRESETS[style] || STYLE_PRESETS.jedi;
  const apiKey = EL.readKey();
  const settings = EL.voiceSettingsFor(style, opts.rate ?? preset.rate);
  const modelId = opts.elevenModel || EL.DEFAULT_MODEL_ID;
  const say = (s, message) => { if (opts.onStatus) opts.onStatus({ state: s, message }); };

  say("resolving", "resolving voice…");
  const resolved = await EL.resolveVoiceId({
    apiKey,
    name: opts.voiceName || EL.DEFAULT_VOICE_NAME,
    voiceId: opts.elevenVoiceId || "",
  });
  if (state.cancelled) return null;

  const maxChars = (typeof NARRATIVE_MAX_CHARS === "number") ? NARRATIVE_MAX_CHARS : 4500;
  const chunks = chunkNarrative(narrative.segments, maxChars);
  const ctx = {
    EL, apiKey, settings, modelId, voiceId: resolved.voiceId,
    onSegment: opts.onSegment, onStatus: opts.onStatus,
  };

  say("synthesizing", `synthesizing the reading with ${resolved.name || opts.voiceName}…`);
  let pending = renderNarrationChunk(chunks[0], ctx);
  for (let i = 0; i < chunks.length; i++) {
    const entry = await pending;
    if (state.cancelled) return null;
    // Start the NEXT chunk rendering before playing this one, so the seam
    // between them costs nothing.
    pending = (i + 1 < chunks.length) ? renderNarrationChunk(chunks[i + 1], ctx) : null;
    await playNarrationChunk(chunks[i], entry, ctx);
    if (state.cancelled) return null;
  }
  say("idle", "");
  if (opts.onEnd) opts.onEnd();
  return VOICE_PROVIDER_ELEVEN;
}

function speakNarrativeBrowser(narrative, opts, state) {
  if (typeof window === "undefined" || typeof window.speechSynthesis === "undefined") return null;
  const style = opts.style || "jedi";
  const preset = STYLE_PRESETS[style] || STYLE_PRESETS.jedi;
  const voices = listVoices();
  const chosen = pickBrowserVoice(voices, opts.voiceName);
  try { window.speechSynthesis.cancel(); } catch {}

  const utterances = narrative.segments.map((seg, i) => {
    const effText = preset.power ? applyPower(seg.text) : seg.text;
    const u = new SpeechSynthesisUtterance(effText);
    u.rate = preset.rate; u.pitch = preset.pitch; u.volume = 1;
    if (chosen) { u.voice = chosen; u.lang = chosen.lang; }
    u.onstart = () => {
      if (state.cancelled) return;
      if (opts.onSegment) opts.onSegment({ index: seg.index, cardIdx: seg.cardIdx });
      if (i === 0 && opts.onStatus) opts.onStatus({ state: "speaking", message: "" });
    };
    return u;
  });
  speakChain(utterances, {
    isCancelled: () => state.cancelled,
    onDone: () => { if (!state.cancelled && opts.onEnd) opts.onEnd(); },
  });
  return VOICE_PROVIDER_BROWSER;
}

/**
 * Play a whole chart narrative, start to finish.
 *
 * `narrative` is narrative.jsx's `{ text, segments }`. `opts.onSegment` is
 * called with `{ index, cardIdx }` each time the voice reaches a new
 * segment — that is the hook the deck follows. Returns a handle with
 * `stop()`; call it from a click handler, having primed the engines in the
 * same gesture, exactly as with speakNow().
 *
 * As everywhere else here, an ElevenLabs failure falls back to the browser
 * engine rather than going silent — the fallback narrates the same segments
 * in the same order, so the deck still follows.
 */
function speakNarrative(narrative, opts = {}) {
  if (!narrative || !narrative.segments || !narrative.segments.length) return null;
  const state = { cancelled: false };
  const provider = resolveProvider(opts.provider);
  __narration.seq += 1;
  const generation = __narration.seq;
  const guard = () => { state.cancelled = state.cancelled || generation !== __narration.seq; return state.cancelled; };

  const handle = {
    provider,
    stop() {
      state.cancelled = true;
      stopSpeech();
    },
    /**
     * Hold the reading where it is. Both engines resume from the same
     * point — the audio element from its own clock, SpeechSynthesis from
     * the middle of the current utterance — so pausing does not cost the
     * listener the sign they were on, and the deck stays where the voice
     * stopped rather than continuing without it.
     */
    pause() {
      const a = __eleven.audio;
      if (a) { try { a.pause(); } catch { /* not playing */ } }
      try {
        if (typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined") {
          window.speechSynthesis.pause();
        }
      } catch {}
    },
    resume() {
      const a = __eleven.audio;
      if (a && a.src && a.src !== SILENT_WAV) {
        try { const p = a.play(); if (p && p.catch) p.catch(() => {}); } catch { /* not resumable */ }
      }
      try {
        if (typeof window !== "undefined" && typeof window.speechSynthesis !== "undefined") {
          window.speechSynthesis.resume();
        }
      } catch {}
    },
  };

  if (provider === VOICE_PROVIDER_ELEVEN) {
    stopBrowserSpeech();
    speakNarrativeEleven(narrative, opts, state).catch((err) => {
      if (guard()) return;
      const raw = (err && err.message) || "ElevenLabs narration unavailable";
      const message = /[.!?]$/.test(raw) ? raw : `${raw}.`;
      if (opts.onStatus) opts.onStatus({ state: "fallback", message: `${message} Using the browser voice.` });
      handle.provider = speakNarrativeBrowser(narrative, opts, state) || VOICE_PROVIDER_BROWSER;
    });
    return handle;
  }
  stopEleven();
  speakNarrativeBrowser(narrative, opts, state);
  return handle;
}

// ──────────────────────────────────────────────────────────────────────
// useVoice
// ──────────────────────────────────────────────────────────────────────

function useVoice({ text, enabled, style, voiceName, playing, provider, elevenVoiceId, elevenModel }) {
  const preset   = STYLE_PRESETS[style] || STYLE_PRESETS.jedi;
  const hasSpeechSynthesis = typeof window !== "undefined" && "speechSynthesis" in window;
  // "supported" means SOME provider can narrate — ElevenLabs alone is
  // enough on a browser without SpeechSynthesis at all.
  const supported = hasSpeechSynthesis || elevenReady();
  const [speaking,  setSpeaking]  = React.useState(false);
  const [blocked,   setBlocked]   = React.useState(false);
  const [status,    setStatus]    = React.useState({ state: "idle", message: "" });
  // primedRef: true once the user has triggered at least one gesture-based speak
  const primedRef = React.useRef(false);
  const voicesRef = React.useRef([]);

  const activeProvider = resolveProvider(provider);
  const speakOpts = { style, voiceName, provider, elevenVoiceId, elevenModel };

  // Load voices into ref
  React.useEffect(() => {
    if (!hasSpeechSynthesis) return;
    const refresh = () => { voicesRef.current = listVoices(); };
    refresh();
    window.speechSynthesis.onvoiceschanged = refresh;
    return () => { try { window.speechSynthesis.onvoiceschanged = null; } catch {} };
  }, [hasSpeechSynthesis]);

  // Auto-speak when text changes — only works reliably after engine is primed.
  React.useEffect(() => {
    if (!supported || !enabled || !playing || !text) return;
    if (!primedRef.current) {
      // Engine not yet primed by a gesture — show "tap to enable" instead.
      setBlocked(true);
      return;
    }
    setBlocked(false);

    if (activeProvider === VOICE_PROVIDER_ELEVEN) {
      stopBrowserSpeech();
      // `speaking` starts FALSE here and is raised by the "speaking" status,
      // which speakEleven emits only once playback has actually begun.
      // Raising it up front was wrong twice over: an ElevenLabs request
      // spends a second or two in synthesis before any sound, and
      // speakEleven pauses the shared element before loading the new clip —
      // a `pause` listener installed here therefore fired on OUR OWN pause
      // and cleared the flag a moment before playback started. Only `ended`
      // is listened to now; every other way a reading stops (a stop, a new
      // card, a failure) already runs through this effect's cleanup or the
      // error status below.
      setSpeaking(false);
      const a = elevenAudioElement();
      const onEnd = () => setSpeaking(false);
      if (a) a.addEventListener("ended", onEnd);
      speakEleven(text, {
        ...speakOpts,
        onStatus: (s) => {
          setStatus(s);
          if (s.state === "speaking") setSpeaking(true);
          else if (s.state === "error" || s.state === "fallback") setSpeaking(false);
        },
      }).catch(() => setSpeaking(false));
      return () => {
        if (a) a.removeEventListener("ended", onEnd);
        setSpeaking(false);
        stopEleven();
      };
    }

    stopEleven();
    const voices  = voicesRef.current;
    const chosen  = pickBrowserVoice(voices, voiceName);
    const effText = preset.power ? applyPower(text) : text;
    const sentences = effText.replace(/\s+/g, " ")
      .match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) || [effText];
    try { window.speechSynthesis.cancel(); } catch {}
    let cancelled = false;
    speakChain(sentences.map((s, i) => {
      const u = new SpeechSynthesisUtterance(s.trim());
      u.rate = preset.rate; u.pitch = preset.pitch; u.volume = 1;
      if (chosen) { u.voice = chosen; u.lang = chosen.lang; }
      if (i === 0) u.onstart = () => { if (!cancelled) setSpeaking(true); };
      u.onerror = (e) => {
        if (cancelled) return;
        setSpeaking(false);
        if (e && e.error === "not-allowed") { setBlocked(true); primedRef.current = false; }
      };
      return u;
    }), {
      isCancelled: () => cancelled,
      onDone: () => { if (!cancelled) setSpeaking(false); },
    });
    return () => { cancelled = true; try { window.speechSynthesis.cancel(); } catch {} };
  }, [supported, text, enabled, playing, style, voiceName, activeProvider, elevenVoiceId, elevenModel]);

  // Pause/resume. SpeechSynthesis has its own pause()/resume(); the shared
  // <audio> element is paused/played directly — same intent, different API.
  React.useEffect(() => {
    if (!supported || !enabled) return;
    if (activeProvider === VOICE_PROVIDER_ELEVEN) {
      const a = __eleven.audio;
      if (!a) return;
      try {
        if (!playing) a.pause();
        else if (a.src && a.src !== SILENT_WAV) { const p = a.play(); if (p && p.catch) p.catch(() => {}); }
      } catch { /* element not in a resumable state */ }
      return;
    }
    if (!hasSpeechSynthesis) return;
    if (!playing) { try { window.speechSynthesis.pause(); } catch {} }
    else          { try { window.speechSynthesis.resume(); } catch {} }
  }, [playing, supported, enabled, activeProvider, hasSpeechSynthesis]);

  // retrigger: call this INSIDE a click/tap handler to speak the current text.
  // This satisfies the gesture requirement and primes the engine.
  const retrigger = React.useCallback((currentText) => {
    if (!supported) return;
    primedRef.current = true;
    setBlocked(false);
    primeElevenAudio();
    speakNow(currentText || text, {
      ...speakOpts,
      rate: preset.rate,
      pitch: preset.pitch,
      onStatus: (s) => {
        setStatus(s);
        if (s.state === "speaking") setSpeaking(true);
        else if (s.state === "error" || s.state === "fallback") setSpeaking(false);
      },
    });
    // SpeechSynthesis speaks synchronously from this gesture, so it is
    // already speaking by the time this returns. ElevenLabs is not — it
    // reports "speaking" through onStatus above once playback begins, and
    // claiming it here would light the indicator through a second or two of
    // silent synthesis. Either way the flag is cleared by the utterance's
    // onend / the audio element's `ended`.
    if (resolveProvider(provider) === VOICE_PROVIDER_BROWSER) setSpeaking(true);
  }, [text, style, voiceName, provider, elevenVoiceId, elevenModel, preset.rate, preset.pitch, supported]);

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
  //
  // It unlocks BOTH engines, because which one speaks later can change
  // between this gesture and that speak() (a key entered mid-session, an
  // ElevenLabs request that falls back to SpeechSynthesis).
  const prime = React.useCallback(() => {
    if (!supported) return;
    primedRef.current = true;
    setBlocked(false);
    primeElevenAudio();
    primeBrowserSpeech();
  }, [supported]);

  return { supported, speaking, blocked, retrigger, prime, provider: activeProvider, status };
}

Object.assign(window, {
  useVoice, listVoices, speakNow, stopSpeech, STYLE_PRESETS,
  speakChain, primeBrowserSpeech,
  speakNarrative, speakNarrativeEleven, speakNarrativeBrowser,
  speakEleven, speakBrowser, resolveProvider, elevenReady, primeElevenAudio,
  VOICE_PROVIDER_ELEVEN, VOICE_PROVIDER_BROWSER, DEFAULT_VOICE_PROVIDER,
});
