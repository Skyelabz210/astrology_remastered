// test/present/elevenlabs.test.js — the ElevenLabs TTS provider.
//
// Every network call goes through an injected `fetchImpl` and every key
// read/write through an injected `storage`, so this suite exercises the
// SHIPPED functions end to end — URL construction, headers, request body,
// the resolution order, and the error mapping — without touching the real
// service or the real localStorage. That injection exists for this reason;
// see elevenlabs.js's header.
//
// What is deliberately NOT asserted: any specific ElevenLabs voice ID.
// "Nerissa" is a Voice Library voice whose ID is account-visible, which is
// exactly why the module resolves it by name at runtime. A pinned ID here
// would be a guess dressed up as a test.

import {
  ELEVEN_API_BASE,
  DEFAULT_VOICE_NAME,
  DEFAULT_MODEL_ID,
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
  resolveVoiceId,
  synthesize,
} from "../../elevenlabs.js";

/** In-memory stand-in for localStorage. */
function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    _map: map,
  };
}

/** A storage whose every access throws — private-mode Safari's behavior. */
function makeHostileStorage() {
  return {
    getItem() { throw new Error("SecurityError"); },
    setItem() { throw new Error("SecurityError"); },
    removeItem() { throw new Error("SecurityError"); },
  };
}

/** Scripted fetch: each entry is matched in order against the request URL. */
function makeFetch(routes) {
  const calls = [];
  const impl = async (url, init = {}) => {
    calls.push({ url, init });
    for (const r of routes) {
      if (url.includes(r.match)) return r.response(url, init);
    }
    return { ok: false, status: 500, json: async () => ({ detail: { message: "unrouted" } }) };
  };
  impl.calls = calls;
  return impl;
}

const jsonOk = (body) => ({ ok: true, status: 200, json: async () => body });
const jsonErr = (status, detail) => ({ ok: false, status, json: async () => ({ detail }) });

export async function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok, detail });

  // ── constants the rest of the app depends on ─────────────────────────
  t("the configured reading voice is Nerissa", DEFAULT_VOICE_NAME === "Nerissa");
  t("the default model is multilingual v2", DEFAULT_MODEL_ID === "eleven_multilingual_v2");
  t("the API base is the v1 endpoint", ELEVEN_API_BASE === "https://api.elevenlabs.io/v1");
  t("the key storage slot is namespaced", KEY_STORAGE_KEY.startsWith("resonance:"));

  // ── style → voice_settings ───────────────────────────────────────────
  {
    const jedi = voiceSettingsFor("jedi");
    t("a style maps to a complete voice_settings object",
      typeof jedi.stability === "number" && typeof jedi.similarity_boost === "number"
      && typeof jedi.style === "number" && jedi.use_speaker_boost === true
      && typeof jedi.speed === "number");
    t("every settings value is inside ElevenLabs' 0…1 range",
      [jedi.stability, jedi.similarity_boost, jedi.style].every(v => v >= 0 && v <= 1));

    // "ultimate power" asks SpeechSynthesis for rate 0.62; ElevenLabs' floor
    // is 0.7, so it must LAND on the floor rather than being sent through
    // and refused as a 422.
    const ultimate = voiceSettingsFor("ultimate");
    t("the 0.62 rate of 'ultimate' clamps up to the 0.7 floor",
      ultimate.speed === SPEED_RANGE[0], `speed ${ultimate.speed}`);
    t("an over-fast rate clamps down to the 1.2 ceiling",
      voiceSettingsFor("measured", 3).speed === SPEED_RANGE[1]);
    t("an explicit rate overrides the preset's own",
      voiceSettingsFor("jedi", 1.1).speed === 1.1);

    // The deeper presets trade stability down and style up — that is how
    // the menace survives ElevenLabs having no pitch control.
    t("deeper styles are less stable and more stylised",
      voiceSettingsFor("sith").stability < voiceSettingsFor("measured").stability
      && voiceSettingsFor("sith").style > voiceSettingsFor("measured").style);
    t("an unknown style falls back to the jedi preset",
      JSON.stringify(voiceSettingsFor("nonsense")) === JSON.stringify(voiceSettingsFor("jedi")));
  }

  // ── key storage ──────────────────────────────────────────────────────
  {
    const s = makeStorage();
    t("no key configured to start", readKey(s) === "" && isConfigured(s) === false);
    t("a key round-trips", writeKey(s, "sk_test_1234567890") && readKey(s) === "sk_test_1234567890");
    t("a stored key reads as configured", isConfigured(s) === true);
    t("surrounding whitespace is trimmed", writeKey(s, "  sk_pad  ") && readKey(s) === "sk_pad");
    t("an empty write clears the key", writeKey(s, "") && readKey(s) === "" && isConfigured(s) === false);

    const hostile = makeHostileStorage();
    t("a throwing storage reads as 'no key' instead of crashing",
      readKey(hostile) === "" && isConfigured(hostile) === false);
    t("a throwing storage reports the failed write rather than throwing",
      writeKey(hostile, "sk_x") === false);
  }

  // ── masking ──────────────────────────────────────────────────────────
  {
    const masked = maskKey("sk_abcdefghijklmnop");
    t("a masked key keeps only its head and tail",
      masked.startsWith("sk_a") && masked.endsWith("mnop") && masked.includes("•"), masked);
    t("a masked key never contains the middle of the secret",
      !maskKey("sk_abcdefghijklmnop").includes("defghijkl"));
    t("a short key is masked entirely", maskKey("abc") === "•••");
    t("no key masks to the empty string", maskKey("") === "" && maskKey(null) === "");
  }

  // ── voice-id cache ───────────────────────────────────────────────────
  {
    const s = makeStorage();
    t("an unresolved name has no cached id", readCachedVoiceId(s, "Nerissa") === "");
    writeCachedVoiceId(s, "Nerissa", "vid_123");
    t("a resolved id is cached under its name", readCachedVoiceId(s, "Nerissa") === "vid_123");
    t("the cache lookup is case-insensitive", readCachedVoiceId(s, "nerissa") === "vid_123");
    writeCachedVoiceId(s, "Nerissa", "");
    t("an empty write evicts the cached id", readCachedVoiceId(s, "Nerissa") === "");
  }

  // ── name matching ────────────────────────────────────────────────────
  {
    const catalogue = [
      { voice_id: "v1", name: "Sarah - Mature, Reassuring, Confident" },
      { voice_id: "v2", name: "Nerissa" },
      { voice_id: "v3", name: "Bella - Professional, Bright, Warm" },
    ];
    t("an exact name wins", matchVoiceByName(catalogue, "Nerissa").voice_id === "v2");
    t("matching ignores case", matchVoiceByName(catalogue, "nerissa").voice_id === "v2");
    t("a descriptive suffix still matches the bare name",
      matchVoiceByName(catalogue, "Sarah").voice_id === "v1");
    t("an exact match beats a prefix match", matchVoiceByName(
      [{ voice_id: "pre", name: "Nerissa - Warm Narrator" }, { voice_id: "exact", name: "Nerissa" }],
      "Nerissa").voice_id === "exact");
    t("a whole-word match anywhere in the name is accepted",
      matchVoiceByName([{ voice_id: "w", name: "Deep Nerissa Read" }], "Nerissa").voice_id === "w");
    // The reason the word boundary is required rather than a bare
    // `includes`: a voice merely CONTAINING the letters must not match.
    t("a substring inside another word does NOT match",
      matchVoiceByName([{ voice_id: "x", name: "Nerissabelle" }], "Nerissa") === null);
    t("no match returns null", matchVoiceByName(catalogue, "Nobody") === null);
    t("an empty name matches nothing", matchVoiceByName(catalogue, "") === null);
    t("a junk catalogue matches nothing",
      matchVoiceByName(null, "Nerissa") === null
      && matchVoiceByName([null, {}], "Nerissa") === null);
  }

  // ── listVoices transport ─────────────────────────────────────────────
  {
    const fetchImpl = makeFetch([
      { match: "/voices", response: () => jsonOk({ voices: [{ voice_id: "v2", name: "Nerissa" }] }) },
    ]);
    const voices = await listVoices({ apiKey: "sk_k", fetchImpl });
    t("listVoices returns the voices array", voices.length === 1 && voices[0].name === "Nerissa");
    t("listVoices calls the /v1/voices endpoint",
      fetchImpl.calls[0].url === `${ELEVEN_API_BASE}/voices`, fetchImpl.calls[0].url);
    t("listVoices sends the key as xi-api-key",
      fetchImpl.calls[0].init.headers["xi-api-key"] === "sk_k");
    t("listVoices is a GET", fetchImpl.calls[0].init.method === "GET");
  }
  {
    const fetchImpl = makeFetch([{ match: "/voices", response: () => jsonOk({}) }]);
    t("a payload with no voices array degrades to empty",
      (await listVoices({ apiKey: "k", fetchImpl })).length === 0);
  }

  // ── resolveVoiceId: the resolution order ─────────────────────────────
  {
    const storage = makeStorage();
    const fetchImpl = makeFetch([]);
    const r = await resolveVoiceId({ apiKey: "k", voiceId: "  vid_override  ", storage, fetchImpl });
    t("an explicit voice ID short-circuits every lookup",
      r.voiceId === "vid_override" && r.source === "override" && fetchImpl.calls.length === 0);
  }
  {
    const storage = makeStorage({ "resonance:elevenlabs-voice:nerissa": "vid_cached" });
    const fetchImpl = makeFetch([]);
    const r = await resolveVoiceId({ apiKey: "k", storage, fetchImpl });
    t("a cached id is used without a network call",
      r.voiceId === "vid_cached" && r.source === "cache" && fetchImpl.calls.length === 0);
  }
  {
    const storage = makeStorage({ "resonance:elevenlabs-voice:nerissa": "vid_stale" });
    const fetchImpl = makeFetch([
      { match: "/voices", response: () => jsonOk({ voices: [{ voice_id: "vid_fresh", name: "Nerissa" }] }) },
    ]);
    const r = await resolveVoiceId({ apiKey: "k", storage, fetchImpl, force: true });
    t("force:true bypasses the cache and re-resolves",
      r.voiceId === "vid_fresh" && r.source === "account", `${r.voiceId} ${r.source}`);
    t("the refreshed id replaces the cached one",
      readCachedVoiceId(storage, "Nerissa") === "vid_fresh");
  }
  {
    // Not in the account's own list, but present in the public library.
    const storage = makeStorage();
    const fetchImpl = makeFetch([
      { match: "/shared-voices", response: () => jsonOk({ voices: [{ voice_id: "vid_lib", name: "Nerissa", public_owner_id: "owner1" }] }) },
      { match: "/voices", response: () => jsonOk({ voices: [{ voice_id: "other", name: "Bill" }] }) },
    ]);
    const r = await resolveVoiceId({ apiKey: "k", storage, fetchImpl });
    t("a Voice Library hit resolves", r.voiceId === "vid_lib" && r.source === "library");
    t("a library hit is flagged as possibly needing to be added to the account",
      r.needsAdd === true && r.publicOwnerId === "owner1");
    t("the account list is tried before the library",
      fetchImpl.calls[0].url.includes("/voices") && !fetchImpl.calls[0].url.includes("shared"));
    t("the library search passes the name as a search filter",
      fetchImpl.calls[1].url.includes("search=Nerissa"), fetchImpl.calls[1].url);
  }
  {
    const fetchImpl = makeFetch([
      { match: "/shared-voices", response: () => jsonOk({ voices: [] }) },
      { match: "/voices", response: () => jsonOk({ voices: [] }) },
    ]);
    let err = null;
    try { await resolveVoiceId({ apiKey: "k", storage: makeStorage(), fetchImpl }); }
    catch (e) { err = e; }
    t("a genuinely absent voice raises voice_not_found",
      err instanceof ElevenLabsError && err.code === "voice_not_found", err && err.message);
    t("the not-found message tells the reader what to do",
      !!err && /Voice Library|voice ID/.test(err.message), err && err.message);
  }
  {
    // The library search 401ing (unauthenticated filters) must surface as
    // "voice not found", not as the search's own auth error.
    const fetchImpl = makeFetch([
      { match: "/shared-voices", response: () => jsonErr(401, { message: "You must be logged in to use filters.", status: "not_logged_in" }) },
      { match: "/voices", response: () => jsonOk({ voices: [] }) },
    ]);
    let err = null;
    try { await resolveVoiceId({ apiKey: "k", storage: makeStorage(), fetchImpl }); }
    catch (e) { err = e; }
    t("a failed library search still reports voice_not_found",
      err instanceof ElevenLabsError && err.code === "voice_not_found", err && err.code);
  }
  {
    let err = null;
    try { await resolveVoiceId({ apiKey: "", storage: makeStorage(), fetchImpl: makeFetch([]) }); }
    catch (e) { err = e; }
    t("no key raises no_key before any request",
      err instanceof ElevenLabsError && err.code === "no_key", err && err.code);
  }
  {
    const fetchImpl = makeFetch([
      { match: "/voices", response: () => jsonErr(401, { message: "Invalid API key", status: "invalid_api_key" }) },
    ]);
    let err = null;
    try { await resolveVoiceId({ apiKey: "bad", storage: makeStorage(), fetchImpl }); }
    catch (e) { err = e; }
    t("a rejected key surfaces the API's own message",
      err instanceof ElevenLabsError && err.status === 401 && /Invalid API key/.test(err.message),
      err && err.message);
  }

  {
    // Two callers wanting the same voice at the same instant must share one
    // round trip — the real browser run made /v1/voices twice on the first
    // reading before this was deduped.
    const fetchImpl = makeFetch([
      { match: "/voices", response: async () => {
        await new Promise(r => setTimeout(r, 10));
        return jsonOk({ voices: [{ voice_id: "vid_shared", name: "Nerissa" }] });
      } },
    ]);
    const storage = makeStorage();
    const [a, b] = await Promise.all([
      resolveVoiceId({ apiKey: "k", storage, fetchImpl }),
      resolveVoiceId({ apiKey: "k", storage, fetchImpl }),
    ]);
    t("concurrent lookups of the same voice share one request",
      fetchImpl.calls.length === 1, `${fetchImpl.calls.length} requests`);
    t("both concurrent callers get the same answer",
      a.voiceId === "vid_shared" && b.voiceId === "vid_shared");
    // And the sharing must not outlive the request: a later call still works.
    const later = await resolveVoiceId({ apiKey: "k", storage, fetchImpl });
    t("a later lookup still resolves (the in-flight entry was released)",
      later.voiceId === "vid_shared" && later.source === "cache", later.source);
  }
  {
    // A shared failure must reject BOTH callers, not leave one hanging.
    const fetchImpl = makeFetch([
      { match: "/shared-voices", response: () => jsonOk({ voices: [] }) },
      { match: "/voices", response: () => jsonOk({ voices: [] }) },
    ]);
    const results = await Promise.allSettled([
      resolveVoiceId({ apiKey: "k", storage: makeStorage(), fetchImpl }),
      resolveVoiceId({ apiKey: "k", storage: makeStorage(), fetchImpl }),
    ]);
    t("a shared failed lookup rejects both callers",
      results.every(r => r.status === "rejected" && r.reason.code === "voice_not_found"),
      JSON.stringify(results.map(r => r.status)));
  }

  // ── synthesize ───────────────────────────────────────────────────────
  {
    const audio = new Uint8Array([0x49, 0x44, 0x33]).buffer; // "ID3"
    const fetchImpl = makeFetch([
      { match: "/text-to-speech/", response: () => ({ ok: true, status: 200, arrayBuffer: async () => audio }) },
    ]);
    const out = await synthesize({
      apiKey: "sk_k", voiceId: "vid_1", text: "The Moon is just past full.",
      voiceSettings: voiceSettingsFor("jedi"), fetchImpl,
    });
    const call = fetchImpl.calls[0];
    const body = JSON.parse(call.init.body);
    t("synthesize returns the audio bytes", out === audio);
    t("it POSTs to the voice's text-to-speech endpoint",
      call.init.method === "POST" && call.url.startsWith(`${ELEVEN_API_BASE}/text-to-speech/vid_1`), call.url);
    t("it requests a concrete output format", call.url.includes("output_format=mp3_44100_128"));
    t("it authenticates with xi-api-key", call.init.headers["xi-api-key"] === "sk_k");
    t("it asks for audio/mpeg", call.init.headers["Accept"] === "audio/mpeg");
    t("the body carries the text, model and settings",
      body.text === "The Moon is just past full."
      && body.model_id === DEFAULT_MODEL_ID
      && body.voice_settings.speed === voiceSettingsFor("jedi").speed,
      JSON.stringify(body));
  }
  {
    // A voice ID is interpolated into the path, so it must be escaped —
    // otherwise a stray character in a pasted ID silently rewrites the URL.
    const fetchImpl = makeFetch([
      { match: "/text-to-speech/", response: () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0) }) },
    ]);
    await synthesize({ apiKey: "k", voiceId: "v/../models?x=1", text: "x", fetchImpl });
    t("the voice ID is URL-escaped into the path",
      fetchImpl.calls[0].url.includes("v%2F..%2Fmodels%3Fx%3D1"), fetchImpl.calls[0].url);
  }
  {
    const fetchImpl = makeFetch([
      { match: "/text-to-speech/", response: () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(0) }) },
    ]);
    await synthesize({ apiKey: "k", voiceId: "v", text: "x", modelId: "eleven_flash_v2_5", fetchImpl });
    t("an explicit model overrides the default",
      JSON.parse(fetchImpl.calls[0].init.body).model_id === "eleven_flash_v2_5");
  }
  {
    const guard = async (args) => {
      try { await synthesize(args); return null; } catch (e) { return e; }
    };
    const noKey = await guard({ voiceId: "v", text: "x", fetchImpl: makeFetch([]) });
    t("synthesize refuses without a key", noKey && noKey.code === "no_key");
    const noVoice = await guard({ apiKey: "k", text: "x", fetchImpl: makeFetch([]) });
    t("synthesize refuses without a voice id", noVoice && noVoice.code === "no_voice");
    const noText = await guard({ apiKey: "k", voiceId: "v", text: "   ", fetchImpl: makeFetch([]) });
    t("synthesize refuses empty text", noText && noText.code === "empty_text");
  }
  {
    const fetchImpl = makeFetch([
      { match: "/text-to-speech/", response: () => jsonErr(429, { message: "Quota exceeded", status: "quota_exceeded" }) },
    ]);
    let err = null;
    try { await synthesize({ apiKey: "k", voiceId: "v", text: "x", fetchImpl }); } catch (e) { err = e; }
    t("a 429 is reported as retryable", err instanceof ElevenLabsError && err.retryable === true);
    t("a 429 keeps the API's own message", /Quota exceeded/.test(err.message), err.message);
  }
  {
    // A non-JSON error body (an HTML gateway page) must still produce a
    // usable message rather than an unhandled parse failure.
    const fetchImpl = makeFetch([
      { match: "/text-to-speech/", response: () => ({ ok: false, status: 502, json: async () => { throw new Error("not json"); } }) },
    ]);
    let err = null;
    try { await synthesize({ apiKey: "k", voiceId: "v", text: "x", fetchImpl }); } catch (e) { err = e; }
    t("a non-JSON failure still yields a readable error",
      err instanceof ElevenLabsError && err.status === 502 && err.message.includes("502"), err && err.message);
    t("a 5xx is reported as retryable", err.retryable === true);
  }

  return rows;
}
