// elevenlabs.js — ElevenLabs text-to-speech provider for the reading voice.
//
// Dual-environment module, same pattern as validate.js / tzresolve.js /
// eclipses.js: `export`ed for Node (test/present/elevenlabs.test.js imports
// it directly) and published as `window.ElevenLabs` for the
// Babel-standalone `.jsx` pages. Load it as
// `<script type="module" src="elevenlabs.js"></script>` before voice.jsx.
//
// WHY THIS EXISTS: voice.jsx narrates through the browser's SpeechSynthesis
// API, whose voice list is whatever the operating system happens to ship.
// The app's configured reading voice is ElevenLabs' "Nerissa", which no OS
// ships — so the narration path needs a real TTS provider. voice.jsx keeps
// SpeechSynthesis as the fallback for every case this provider can't serve
// (no API key, offline, request refused), so turning voice on never goes
// silent just because a network call failed.
//
// EGRESS, stated plainly because the app's privacy note has to match the
// code: when this provider is active, the text of the reading and the
// user's own ElevenLabs API key are sent to api.elevenlabs.io over HTTPS.
// Nothing else goes with it — no birth data, no chart, no placements. The
// key is read from browser localStorage (or an injected `storage`), is
// never written into the settings object, and therefore never reaches the
// tweaks-panel's `__edit_mode_set_keys` postMessage that persists settings
// back into the page source. Narration is ON by default, but this provider
// is not reachable until a key has been entered by hand — until then
// voice.jsx narrates through the browser's own offline engine and no
// request is made at all.
//
// DEPENDENCY INJECTION: `fetchImpl` and `storage` are parameters, not
// globals, so the test suite drives the real code with a stub transport
// instead of asserting on a copy of it.

export const ELEVEN_API_BASE = "https://api.elevenlabs.io/v1";

/**
 * The app's configured reading voice. Resolved to an ElevenLabs voice ID at
 * runtime by NAME rather than hard-coded: "Nerissa" is a Voice Library
 * voice, not one of the ~21 premade voices the API serves unauthenticated,
 * so its ID is account-visible — a literal baked in here would be a guess,
 * and a wrong ID fails as a 404 at the worst possible moment. resolveVoiceId()
 * below looks it up against the caller's own key and caches the result.
 */
export const DEFAULT_VOICE_NAME = "Nerissa";

/**
 * eleven_multilingual_v2 — the quality-first workhorse model, available on
 * every paid tier and the one ElevenLabs' own docs recommend where latency
 * is not the constraint. It is not: this app synthesizes a whole card
 * reading before playback, not a live conversational turn. Overridable via
 * the `modelId` option / the "TTS model" tweak.
 */
export const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

/** 128 kbit MP3 at 44.1 kHz — the highest-quality format available on every tier. */
export const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128";

/** localStorage keys. Namespaced so they can't collide with the tweaks JSON. */
export const KEY_STORAGE_KEY = "resonance:elevenlabs-key";
export const VOICE_CACHE_PREFIX = "resonance:elevenlabs-voice:";

/** ElevenLabs clamps playback speed to this range; requests outside it are refused. */
export const SPEED_RANGE = [0.7, 1.2];

export class ElevenLabsError extends Error {
  constructor(message, { status = 0, code = "error", retryable = false } = {}) {
    super(message);
    this.name = "ElevenLabsError";
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function clamp(x, lo, hi) { return Math.min(hi, Math.max(lo, x)); }

/**
 * Map one of voice.jsx's STYLE_PRESETS onto ElevenLabs voice_settings.
 *
 * The two engines do not expose the same knobs, and this is where that
 * mismatch is handled honestly rather than silently:
 *   · rate  → `speed`, clamped to SPEED_RANGE. The "ultimate power" preset
 *             asks SpeechSynthesis for 0.62; ElevenLabs' floor is 0.7, so it
 *             lands there — slower than that is not available, not ignored.
 *   · pitch → nothing. ElevenLabs has no pitch control; a preset's menace
 *             comes from the voice and from `style`, so the deeper presets
 *             trade stability down and style up instead of pitching down.
 *   · power (the dragged-s text transform) is left to voice.jsx — it is a
 *             text rewrite, applied identically whichever provider speaks.
 */
export function voiceSettingsFor(style, presetRate) {
  const table = {
    measured: { stability: 0.55, style: 0.10, similarity_boost: 0.80, rate: 0.95 },
    jedi:     { stability: 0.45, style: 0.35, similarity_boost: 0.85, rate: 0.85 },
    sith:     { stability: 0.35, style: 0.60, similarity_boost: 0.90, rate: 0.75 },
    ultimate: { stability: 0.30, style: 0.75, similarity_boost: 0.90, rate: 0.62 },
  };
  const p = table[style] || table.jedi;
  const rate = typeof presetRate === "number" ? presetRate : p.rate;
  return {
    stability: p.stability,
    similarity_boost: p.similarity_boost,
    style: p.style,
    use_speaker_boost: true,
    speed: clamp(rate, SPEED_RANGE[0], SPEED_RANGE[1]),
  };
}

// ──────────────────────────────────────────────────────────────────────
// key storage
// ──────────────────────────────────────────────────────────────────────

function safeStorage(storage) {
  if (storage) return storage;
  // Private-mode Safari throws on the localStorage GETTER itself, not just
  // on setItem — so this whole access is guarded, not only the calls below.
  try {
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
  } catch { /* storage unavailable — treated as "no key configured" */ }
  return null;
}

/** The stored API key, or "" when none is configured / storage is unavailable. */
export function readKey(storage) {
  const s = safeStorage(storage);
  if (!s) return "";
  try { return (s.getItem(KEY_STORAGE_KEY) || "").trim(); } catch { return ""; }
}

/** Store (or, with an empty value, clear) the API key. Returns whether it stuck. */
export function writeKey(storage, key) {
  const s = safeStorage(storage);
  if (!s) return false;
  try {
    const v = (key || "").trim();
    if (v) s.setItem(KEY_STORAGE_KEY, v);
    else s.removeItem(KEY_STORAGE_KEY);
    return true;
  } catch { return false; }
}

/** True when a key is present — i.e. this provider can be tried at all. */
export function isConfigured(storage) { return readKey(storage).length > 0; }

/**
 * Never render a key in full. The tweaks panel shows this instead, so a
 * screenshot or a shared screen doesn't leak the secret while still letting
 * the owner confirm WHICH key is loaded.
 */
export function maskKey(key) {
  const k = (key || "").trim();
  if (!k) return "";
  if (k.length <= 8) return "•".repeat(k.length);
  return `${k.slice(0, 4)}${"•".repeat(Math.max(4, k.length - 8))}${k.slice(-4)}`;
}

function cacheKeyFor(name) { return VOICE_CACHE_PREFIX + String(name || "").toLowerCase(); }

export function readCachedVoiceId(storage, name) {
  const s = safeStorage(storage);
  if (!s) return "";
  try { return (s.getItem(cacheKeyFor(name)) || "").trim(); } catch { return ""; }
}

export function writeCachedVoiceId(storage, name, voiceId) {
  const s = safeStorage(storage);
  if (!s) return false;
  try {
    if (voiceId) s.setItem(cacheKeyFor(name), voiceId);
    else s.removeItem(cacheKeyFor(name));
    return true;
  } catch { return false; }
}

// ──────────────────────────────────────────────────────────────────────
// transport
// ──────────────────────────────────────────────────────────────────────

function pickFetch(fetchImpl) {
  if (fetchImpl) return fetchImpl;
  if (typeof fetch === "function") return fetch;
  throw new ElevenLabsError("no fetch implementation available", { code: "no_transport" });
}

/**
 * Turn a failed response into a message a reader can act on. The API's own
 * `detail.message` is preferred when present — it is more specific than
 * anything guessable from the status alone — with a status-derived fallback
 * so a bare 500 still says something useful.
 */
async function failureFrom(res) {
  let detail = null;
  try {
    const body = await res.json();
    detail = body && body.detail;
  } catch { /* non-JSON error body — fall through to the status text */ }
  const apiMessage = detail && (typeof detail === "string" ? detail : detail.message);
  const code = (detail && detail.status) || (detail && detail.code) || `http_${res.status}`;
  const byStatus = {
    401: "ElevenLabs rejected the API key. Check it in the voice settings.",
    403: "This ElevenLabs key is not permitted to use that voice or model.",
    404: "That ElevenLabs voice ID no longer exists — re-resolve the voice.",
    422: "ElevenLabs refused the request parameters.",
    429: "ElevenLabs rate limit or quota reached — narration will fall back to the browser voice.",
  };
  return new ElevenLabsError(
    apiMessage || byStatus[res.status] || `ElevenLabs request failed (HTTP ${res.status}).`,
    { status: res.status, code, retryable: res.status === 429 || res.status >= 500 },
  );
}

/** GET /v1/voices — the voices this key can use, including added library voices. */
export async function listVoices({ apiKey, fetchImpl, signal } = {}) {
  const doFetch = pickFetch(fetchImpl);
  const res = await doFetch(`${ELEVEN_API_BASE}/voices`, {
    method: "GET",
    headers: apiKey ? { "xi-api-key": apiKey } : {},
    signal,
  });
  if (!res.ok) throw await failureFrom(res);
  const body = await res.json();
  return Array.isArray(body && body.voices) ? body.voices : [];
}

/**
 * Find a voice by name in a /v1/voices payload.
 *
 * Matching is deliberately layered, because ElevenLabs voice names are not
 * bare first names in practice — the premade list ships entries like
 * "Sarah - Mature, Reassuring, Confident". So: exact (case-insensitive)
 * first, then "<name> - …"/"<name> (…)" prefix, then a whole-word match
 * anywhere in the name. A substring test alone would let "Nerissa" match a
 * voice merely described with the word, which is why the word boundary is
 * required rather than `includes`.
 */
export function matchVoiceByName(voices, name) {
  const want = String(name || "").trim().toLowerCase();
  if (!want) return null;
  const list = Array.isArray(voices) ? voices.filter((v) => v && v.name) : [];
  const exact = list.find((v) => v.name.trim().toLowerCase() === want);
  if (exact) return exact;
  const prefixed = list.find((v) => {
    const n = v.name.trim().toLowerCase();
    return n.startsWith(`${want} -`) || n.startsWith(`${want} –`) || n.startsWith(`${want} (`);
  });
  if (prefixed) return prefixed;
  const wordRe = new RegExp(`(^|[^a-z0-9])${want.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i");
  return list.find((v) => wordRe.test(v.name)) || null;
}

/**
 * GET /v1/shared-voices — the public Voice Library. Only reachable with a
 * logged-in key (unauthenticated it answers 401 "You must be logged in to
 * use filters"), which is exactly why this is the SECOND place resolveVoiceId
 * looks: a voice already added to the caller's own library is both cheaper
 * to find and guaranteed usable.
 */
export async function searchSharedVoices({ apiKey, name, fetchImpl, signal, pageSize = 10 } = {}) {
  const doFetch = pickFetch(fetchImpl);
  const url = `${ELEVEN_API_BASE}/shared-voices?search=${encodeURIComponent(name)}&page_size=${pageSize}`;
  const res = await doFetch(url, {
    method: "GET",
    headers: apiKey ? { "xi-api-key": apiKey } : {},
    signal,
  });
  if (!res.ok) throw await failureFrom(res);
  const body = await res.json();
  return Array.isArray(body && body.voices) ? body.voices : [];
}

/**
 * Resolve a voice NAME to an ElevenLabs voice ID.
 *
 * Order, cheapest and most reliable first:
 *   1. an explicit `voiceId` override — the escape hatch when a reader
 *      wants a specific voice this lookup would never pick;
 *   2. the cached ID for this name in storage (skipped with `force`);
 *   3. the caller's own /v1/voices list;
 *   4. the public Voice Library.
 *
 * A library hit is reported with `source: "library"` and `needsAdd: true`:
 * a voice that is not in the account's own list may still need to be added
 * to it before TTS will accept the ID, and the UI says so rather than
 * letting the reader watch an unexplained 403 later.
 */
export async function resolveVoiceId(options = {}) {
  const { name = DEFAULT_VOICE_NAME, voiceId = "", storage, force = false } = options;
  if (voiceId && voiceId.trim()) {
    return { voiceId: voiceId.trim(), name, source: "override", needsAdd: false };
  }
  if (!force) {
    const cached = readCachedVoiceId(storage, name);
    if (cached) return { voiceId: cached, name, source: "cache", needsAdd: false };
  }
  // Two callers can want the same voice at the same instant — on the first
  // reading, the click handler that primes the engine and the auto-speak
  // effect it unblocks both reach for it, and with no cache written yet
  // that is two identical round trips (observed in a real browser run).
  // Share the in-flight lookup instead; the entry is dropped as soon as it
  // settles, so a later call resolves normally.
  const inFlightKey = `${name}\u0000${force ? "force" : ""}`;
  const pending = __resolveInFlight.get(inFlightKey);
  if (pending) return pending;
  const run = resolveVoiceIdUncached(options).finally(() => {
    __resolveInFlight.delete(inFlightKey);
  });
  __resolveInFlight.set(inFlightKey, run);
  return run;
}

const __resolveInFlight = new Map();

async function resolveVoiceIdUncached({
  apiKey,
  name = DEFAULT_VOICE_NAME,
  storage,
  fetchImpl,
  signal,
} = {}) {
  if (!apiKey) {
    throw new ElevenLabsError(
      "No ElevenLabs API key configured — add one to use the ElevenLabs voice.",
      { code: "no_key" },
    );
  }

  const own = await listVoices({ apiKey, fetchImpl, signal });
  const mine = matchVoiceByName(own, name);
  if (mine) {
    writeCachedVoiceId(storage, name, mine.voice_id);
    return { voiceId: mine.voice_id, name: mine.name, source: "account", needsAdd: false };
  }

  let shared = [];
  try {
    shared = await searchSharedVoices({ apiKey, name, fetchImpl, signal });
  } catch (e) {
    // The library search is the fallback path, not the answer — a failure
    // here should report "voice not found", not the search's own error.
    if (!(e instanceof ElevenLabsError)) throw e;
  }
  const found = matchVoiceByName(shared, name);
  if (found) {
    writeCachedVoiceId(storage, name, found.voice_id);
    return {
      voiceId: found.voice_id,
      name: found.name,
      source: "library",
      needsAdd: true,
      publicOwnerId: found.public_owner_id || null,
    };
  }

  throw new ElevenLabsError(
    `No ElevenLabs voice named "${name}" is available to this key. Add it from the Voice Library, or paste its voice ID directly.`,
    { code: "voice_not_found", status: 404 },
  );
}

/**
 * POST /v1/text-to-speech/{voiceId} — returns the spoken audio as an
 * ArrayBuffer of MP3. The caller owns playback (voice.jsx turns this into a
 * Blob URL for an <audio> element) so this module stays free of DOM
 * dependencies and can be tested under Node.
 */
export async function synthesize({
  apiKey,
  voiceId,
  text,
  modelId = DEFAULT_MODEL_ID,
  outputFormat = DEFAULT_OUTPUT_FORMAT,
  voiceSettings,
  fetchImpl,
  signal,
} = {}) {
  if (!apiKey) throw new ElevenLabsError("No ElevenLabs API key configured.", { code: "no_key" });
  if (!voiceId) throw new ElevenLabsError("No ElevenLabs voice ID resolved.", { code: "no_voice" });
  const body = String(text || "").trim();
  if (!body) throw new ElevenLabsError("Nothing to speak.", { code: "empty_text" });

  const doFetch = pickFetch(fetchImpl);
  const url = `${ELEVEN_API_BASE}/text-to-speech/${encodeURIComponent(voiceId)}?output_format=${encodeURIComponent(outputFormat)}`;
  const res = await doFetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "audio/mpeg",
    },
    body: JSON.stringify({
      text: body,
      model_id: modelId,
      voice_settings: voiceSettings || voiceSettingsFor("jedi"),
    }),
    signal,
  });
  if (!res.ok) throw await failureFrom(res);
  return await res.arrayBuffer();
}

/**
 * Decode base64 without assuming which runtime we are in: browsers have
 * `atob`, Node has `Buffer`. The with-timestamps endpoint returns audio as
 * base64 inside JSON (it has to — the alignment travels in the same
 * response), so this is the only place the two have to be bridged.
 */
function base64ToArrayBuffer(b64) {
  if (typeof atob === "function") {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  if (typeof Buffer !== "undefined") {
    const buf = Buffer.from(b64, "base64");
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }
  throw new ElevenLabsError("no base64 decoder available", { code: "no_decoder" });
}

/**
 * POST /v1/text-to-speech/{voiceId}/with-timestamps — the same synthesis as
 * `synthesize()`, plus per-character timing.
 *
 * This is what makes a whole-chart reading playable rather than a stack of
 * separate clips: `alignment.character_start_times_seconds` gives the time
 * at which each character of the submitted text is spoken, so a caller
 * holding character ranges for each section (narrative.jsx's segments) can
 * follow the voice exactly — advancing the deck when the narration actually
 * reaches that sign, not when a timer guesses it has.
 *
 * Returns `{ audio: ArrayBuffer, alignment, normalizedAlignment }`.
 * `alignment` can legitimately be absent on some models; callers must have
 * a duration-based fallback rather than assuming it is there.
 */
export async function synthesizeWithTimestamps({
  apiKey,
  voiceId,
  text,
  modelId = DEFAULT_MODEL_ID,
  outputFormat = DEFAULT_OUTPUT_FORMAT,
  voiceSettings,
  fetchImpl,
  signal,
} = {}) {
  if (!apiKey) throw new ElevenLabsError("No ElevenLabs API key configured.", { code: "no_key" });
  if (!voiceId) throw new ElevenLabsError("No ElevenLabs voice ID resolved.", { code: "no_voice" });
  const body = String(text || "").trim();
  if (!body) throw new ElevenLabsError("Nothing to speak.", { code: "empty_text" });

  const doFetch = pickFetch(fetchImpl);
  const url = `${ELEVEN_API_BASE}/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps`
    + `?output_format=${encodeURIComponent(outputFormat)}`;
  const res = await doFetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      text: body,
      model_id: modelId,
      voice_settings: voiceSettings || voiceSettingsFor("jedi"),
    }),
    signal,
  });
  if (!res.ok) throw await failureFrom(res);
  const payload = await res.json();
  const b64 = payload && (payload.audio_base64 || payload.audioBase64);
  if (!b64) throw new ElevenLabsError("ElevenLabs returned no audio.", { code: "no_audio" });
  return {
    audio: base64ToArrayBuffer(b64),
    alignment: (payload && payload.alignment) || null,
    normalizedAlignment: (payload && payload.normalized_alignment) || null,
  };
}

// Browser publication — see this file's header for the load-order contract.
if (typeof window !== "undefined") {
  window.ElevenLabs = {
    ELEVEN_API_BASE,
    DEFAULT_VOICE_NAME,
    DEFAULT_MODEL_ID,
    DEFAULT_OUTPUT_FORMAT,
    KEY_STORAGE_KEY,
    SPEED_RANGE,
    ElevenLabsError,
    voiceSettingsFor,
    readKey,
    writeKey,
    isConfigured,
    maskKey,
    readCachedVoiceId,
    writeCachedVoiceId,
    listVoices,
    matchVoiceByName,
    searchSharedVoices,
    resolveVoiceId,
    synthesize,
    synthesizeWithTimestamps,
  };
}
