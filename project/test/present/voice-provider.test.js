// test/present/voice-provider.test.js — voice.jsx's two-provider layer.
//
// The behavior under test is the one a reader actually notices: narration
// must never go silent. ElevenLabs is the configured provider, but it can
// fail in half a dozen ordinary ways (module not loaded, no key, network
// down, request refused, playback blocked), and every one of those has to
// land on the browser's SpeechSynthesis instead of on nothing.
//
// Same rig as voice-prime.test.js (see its header for why a hand-rolled
// hook rig rather than a React renderer): voice.jsx is evaluated in a
// node:vm sandbox with a minimal `window`, so the REAL functions run
// against stub engines whose calls are recorded.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const voiceSrc = readFileSync(join(ROOT, "voice.jsx"), "utf8");

/**
 * Build a sandbox running voice.jsx.
 *
 * `eleven` (optional) is the window.ElevenLabs stand-in; omitting it is the
 * "elevenlabs.js not on this page" case. `voices` seeds the SpeechSynthesis
 * voice list.
 */
function makeSandbox({ eleven = null, voices = [], audioFails = false } = {}) {
  const calls = { speak: [], cancel: 0, audioPlay: 0, audioSrc: [], pause: 0, synthesize: [] };
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.React = {
    useState: (init) => [typeof init === "function" ? init() : init, () => {}],
    useRef: (init) => ({ current: init }),
    useEffect: (fn) => fn(),
    useCallback: (fn) => fn,
  };
  sandbox.speechSynthesis = {
    cancel: () => { calls.cancel++; },
    speak: (u) => { calls.speak.push(u); },
    pause: () => {},
    resume: () => {},
    getVoices: () => voices,
    onvoiceschanged: null,
  };
  sandbox.SpeechSynthesisUtterance = function (text) { this.text = text; };
  sandbox.Audio = function () {
    calls.audioCreated = true;
    return {
      set src(v) { calls.audioSrc.push(v); },
      get src() { return calls.audioSrc[calls.audioSrc.length - 1]; },
      play: () => { calls.audioPlay++; return audioFails ? Promise.reject(new Error("NotAllowedError")) : Promise.resolve(); },
      pause: () => { calls.pause++; },
      addEventListener: () => {},
      removeEventListener: () => {},
      currentTime: 0,
    };
  };
  sandbox.Blob = function (parts, opts) { this.parts = parts; this.type = opts && opts.type; };
  sandbox.URL = {
    createObjectURL: () => `blob:stub-${calls.synthesize.length}`,
    revokeObjectURL: () => {},
  };
  if (eleven) sandbox.ElevenLabs = eleven(calls);
  vm.createContext(sandbox);
  vm.runInContext(voiceSrc, sandbox, { filename: "voice.jsx" });
  return { sandbox, calls };
}

/** A working ElevenLabs stand-in. */
const workingEleven = (calls) => ({
  DEFAULT_VOICE_NAME: "Nerissa",
  DEFAULT_MODEL_ID: "eleven_multilingual_v2",
  isConfigured: () => true,
  readKey: () => "sk_stub",
  voiceSettingsFor: (style, rate) => ({ stability: 0.45, similarity_boost: 0.85, style: 0.35, use_speaker_boost: true, speed: rate || 0.85 }),
  resolveVoiceId: async ({ name }) => ({ voiceId: "vid_nerissa", name, source: "account", needsAdd: false }),
  synthesize: async (args) => { calls.synthesize.push(args); return new ArrayBuffer(8); },
});

const tick = () => new Promise((r) => setTimeout(r, 0));

export async function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok, detail });

  // ── provider resolution ──────────────────────────────────────────────
  {
    const { sandbox } = makeSandbox();  // no ElevenLabs module at all
    t("the configured default provider is ElevenLabs",
      sandbox.DEFAULT_VOICE_PROVIDER === "elevenlabs");
    t("without elevenlabs.js loaded, requests resolve to the browser voice",
      sandbox.resolveProvider("elevenlabs") === "browser");
    t("elevenReady() is false with no module", sandbox.elevenReady() === false);
    t("an explicit browser request stays on the browser",
      sandbox.resolveProvider("browser") === "browser");
  }
  {
    const { sandbox } = makeSandbox({ eleven: () => ({ isConfigured: () => false }) });
    t("elevenlabs.js loaded but no key stored still resolves to the browser",
      sandbox.resolveProvider("elevenlabs") === "browser");
  }
  {
    const { sandbox } = makeSandbox({ eleven: workingEleven });
    t("module loaded and key stored resolves to ElevenLabs",
      sandbox.resolveProvider("elevenlabs") === "elevenlabs");
    t("an unspecified provider defaults to ElevenLabs when it can serve",
      sandbox.resolveProvider(undefined) === "elevenlabs");
    t("an explicit browser choice is still honored",
      sandbox.resolveProvider("browser") === "browser");
  }
  {
    // isConfigured() throwing (a private-mode storage error surfacing
    // through the module) must not take the whole narration down.
    const { sandbox } = makeSandbox({ eleven: () => ({ isConfigured: () => { throw new Error("SecurityError"); } }) });
    t("a throwing isConfigured() degrades to the browser voice",
      sandbox.resolveProvider("elevenlabs") === "browser");
  }

  // ── the ElevenLabs path ──────────────────────────────────────────────
  {
    const { sandbox, calls } = makeSandbox({ eleven: workingEleven });
    const used = await sandbox.speakEleven("The Moon is just past full.", { style: "jedi" });
    t("ElevenLabs speaks when it can", used === "elevenlabs", String(used));
    t("it synthesized exactly once", calls.synthesize.length === 1);
    t("it synthesized the reading text",
      calls.synthesize[0].text === "The Moon is just past full.", calls.synthesize[0].text);
    t("it used the resolved voice id", calls.synthesize[0].voiceId === "vid_nerissa");
    t("it played the synthesized audio, not the silent unlock clip",
      calls.audioPlay === 1 && String(calls.audioSrc[calls.audioSrc.length - 1]).startsWith("blob:"));
    t("it did NOT also speak through SpeechSynthesis", calls.speak.length === 0);
  }
  {
    // The power-word transform is a TEXT rewrite and must reach ElevenLabs
    // too — it is not a SpeechSynthesis-only effect.
    const { sandbox, calls } = makeSandbox({ eleven: workingEleven });
    await sandbox.speakEleven("Saturn in shadow.", { style: "ultimate" });
    t("the 'ultimate' style's dragged consonants reach ElevenLabs",
      /Sssaturn/.test(calls.synthesize[0].text), calls.synthesize[0].text);
  }
  {
    // Same text twice must hit the cache rather than paying for a second
    // synthesis of identical audio.
    const { sandbox, calls } = makeSandbox({ eleven: workingEleven });
    await sandbox.speakEleven("Repeat me.", { style: "jedi" });
    await sandbox.speakEleven("Repeat me.", { style: "jedi" });
    t("identical text is synthesized once and replayed from cache",
      calls.synthesize.length === 1, `${calls.synthesize.length} synthesis calls`);
  }
  {
    const { sandbox, calls } = makeSandbox({ eleven: workingEleven });
    await sandbox.speakEleven("Same words.", { style: "jedi" });
    await sandbox.speakEleven("Same words.", { style: "sith" });
    t("a different style is a different cache entry", calls.synthesize.length === 2);
  }

  // ── every failure mode falls back, none goes silent ──────────────────
  const failureCases = [
    ["no key stored", () => ({ isConfigured: () => true, readKey: () => "", DEFAULT_VOICE_NAME: "Nerissa", DEFAULT_MODEL_ID: "m",
      voiceSettingsFor: () => ({}), resolveVoiceId: async () => { throw new Error("No ElevenLabs API key configured."); } })],
    ["voice cannot be resolved", (calls) => ({ ...workingEleven(calls),
      resolveVoiceId: async () => { throw new Error('No ElevenLabs voice named "Nerissa" is available to this key.'); } })],
    ["synthesis refused", (calls) => ({ ...workingEleven(calls),
      synthesize: async () => { throw new Error("ElevenLabs rejected the API key."); } })],
    ["network down", (calls) => ({ ...workingEleven(calls),
      synthesize: async () => { throw new TypeError("Failed to fetch"); } })],
  ];
  for (const [label, eleven] of failureCases) {
    const { sandbox, calls } = makeSandbox({ eleven });
    const statuses = [];
    const used = await sandbox.speakEleven("A reading that must be heard.", {
      style: "jedi", onStatus: (s) => statuses.push(s),
    });
    t(`fallback: ${label} → the browser voice speaks`,
      used === "browser" && calls.speak.length > 0,
      `used=${used} utterances=${calls.speak.length}`);
    t(`fallback: ${label} → the reason is reported, not swallowed`,
      statuses.some(s => s.state === "fallback" && /browser voice/i.test(s.message)),
      JSON.stringify(statuses));
  }
  {
    // Playback itself being refused (autoplay policy) is the same story.
    const { sandbox, calls } = makeSandbox({ eleven: workingEleven, audioFails: true });
    const used = await sandbox.speakEleven("Blocked playback.", { style: "jedi" });
    t("fallback: blocked audio playback → the browser voice speaks",
      used === "browser" && calls.speak.length > 0, `used=${used}`);
  }
  {
    const { sandbox, calls } = makeSandbox({ eleven: (c) => ({ ...workingEleven(c),
      synthesize: async () => { throw new Error("boom"); } }) });
    let threw = null;
    try { await sandbox.speakEleven("x", { fallback: false }); } catch (e) { threw = e; }
    t("fallback:false surfaces the error instead of quietly degrading",
      threw !== null && calls.speak.length === 0, threw && threw.message);
  }

  // ── speakNow dispatch ────────────────────────────────────────────────
  {
    const { sandbox, calls } = makeSandbox();  // browser-only
    sandbox.speakNow("Spoken locally.", { style: "jedi", provider: "elevenlabs" });
    t("speakNow with no ElevenLabs available speaks through the browser synchronously",
      calls.speak.length > 0, `${calls.speak.length} utterances`);
  }
  {
    const { sandbox, calls } = makeSandbox({ eleven: workingEleven });
    sandbox.speakNow("Spoken by Nerissa.", { style: "jedi", provider: "elevenlabs" });
    await tick(); await tick();
    t("speakNow routes to ElevenLabs when it can serve",
      calls.synthesize.length === 1 && calls.speak.length === 0,
      `synth=${calls.synthesize.length} speak=${calls.speak.length}`);
  }
  {
    const { sandbox, calls } = makeSandbox({ eleven: workingEleven });
    sandbox.speakNow("", { provider: "elevenlabs" });
    t("empty text speaks nothing at all",
      calls.synthesize.length === 0 && calls.speak.length === 0);
  }

  // ── stop must silence BOTH engines ───────────────────────────────────
  {
    const { sandbox, calls } = makeSandbox({ eleven: workingEleven });
    await sandbox.speakEleven("Something long.", { style: "jedi" });
    const cancelsBefore = calls.cancel;
    sandbox.stopSpeech();
    t("stopSpeech cancels SpeechSynthesis", calls.cancel > cancelsBefore);
    t("stopSpeech also pauses the ElevenLabs audio element", calls.pause > 0);
  }

  // ── gesture priming ──────────────────────────────────────────────────
  {
    const { sandbox, calls } = makeSandbox({ eleven: workingEleven });
    const voice = sandbox.useVoice({ text: "hello", enabled: true, style: "jedi", provider: "elevenlabs", playing: true });
    voice.prime();
    t("prime() unlocks the audio element with a silent clip",
      calls.audioPlay > 0 && calls.audioSrc.some(s => String(s).startsWith("data:audio/wav")),
      JSON.stringify(calls.audioSrc));
    t("prime() still does not speak anything",
      calls.speak.length === 0 && calls.synthesize.length === 0);
    t("useVoice reports which provider is active", voice.provider === "elevenlabs");
    t("useVoice still exposes the original hook shape",
      typeof voice.retrigger === "function" && "supported" in voice
      && "speaking" in voice && "blocked" in voice);
    t("useVoice exposes a provider status for the UI",
      !!voice.status && typeof voice.status.state === "string");
  }
  {
    // ElevenLabs alone is enough to count as supported, even on a browser
    // with no SpeechSynthesis at all.
    const sandbox = {};
    sandbox.window = sandbox;
    sandbox.React = {
      useState: (init) => [typeof init === "function" ? init() : init, () => {}],
      useRef: (init) => ({ current: init }),
      useEffect: (fn) => fn(),
      useCallback: (fn) => fn,
    };
    sandbox.Audio = function () {
      return { play: () => Promise.resolve(), pause: () => {}, addEventListener: () => {}, removeEventListener: () => {}, currentTime: 0 };
    };
    sandbox.ElevenLabs = workingEleven({ synthesize: [] });
    vm.createContext(sandbox);
    vm.runInContext(voiceSrc, sandbox, { filename: "voice.jsx" });
    const voice = sandbox.useVoice({ text: "x", enabled: true, style: "jedi", provider: "elevenlabs", playing: true });
    t("a browser with no SpeechSynthesis is still 'supported' via ElevenLabs",
      voice.supported === true);
    t("listVoices() is empty rather than throwing without SpeechSynthesis",
      Array.isArray(sandbox.listVoices()) && sandbox.listVoices().length === 0);
  }

  // ── the speaking indicator ───────────────────────────────────────────
  // A persistent rig: useState/useRef slots are keyed by call index and
  // survive across invocations, so calling useVoice() twice models ONE
  // component re-rendering rather than two unrelated mounts. That matters
  // because the hook's gesture gate lives in a useRef — with a fresh ref per
  // call, prime() could never unblock the next render's auto-speak effect.
  function persistentRig({ eleven }) {
    const writes = { speaking: [], blocked: [], status: [] };
    const audioEvents = {};
    const stateOrder = ["speaking", "blocked", "status"];
    const refs = [];
    let stateN = 0, refN = 0;
    const sandbox = {};
    sandbox.window = sandbox;
    sandbox.React = {
      useState: (init) => {
        const slot = stateOrder[stateN++ % stateOrder.length];
        return [typeof init === "function" ? init() : init, (v) => { writes[slot].push(v); }];
      },
      useRef: (init) => {
        const i = refN++;
        if (!refs[i]) refs[i] = { current: init };
        return refs[i];
      },
      useEffect: (fn) => fn(),
      useCallback: (fn) => fn,
    };
    sandbox.render = () => { stateN = 0; refN = 0; };
    sandbox.speechSynthesis = {
      cancel: () => {}, speak: () => {}, pause: () => {}, resume: () => {},
      getVoices: () => [], onvoiceschanged: null,
    };
    sandbox.SpeechSynthesisUtterance = function (txt) { this.text = txt; };
    sandbox.Audio = function () {
      return {
        src: "",
        play: () => Promise.resolve(),
        pause: () => {},
        addEventListener: (ev, fn) => { audioEvents[ev] = fn; },
        removeEventListener: (ev) => { delete audioEvents[ev]; },
        currentTime: 0,
      };
    };
    sandbox.Blob = function () {};
    sandbox.URL = { createObjectURL: () => "blob:x", revokeObjectURL: () => {} };
    sandbox.ElevenLabs = eleven({ synthesize: [] });
    vm.createContext(sandbox);
    vm.runInContext(voiceSrc, sandbox, { filename: "voice.jsx" });
    const props = { text: "A reading.", enabled: true, style: "jedi", provider: "elevenlabs", playing: true };
    return {
      writes,
      audioEvents,
      render: () => { sandbox.render(); return sandbox.useVoice(props); },
    };
  }

  // useVoice's three useState calls are, in order: speaking, blocked,
  // status. Tagging the setters by call index lets the rig record what the
  // hook actually did to each piece of state — which is the only way to see
  // the bug this pins: speakEleven pauses the shared <audio> element before
  // loading the next clip, so a `pause` listener cleared `speaking` a moment
  // BEFORE playback started, and the indicator read "not speaking" through
  // the entire reading.
  {
    const rig = persistentRig({ eleven: workingEleven });
    // First render: the gesture gate is closed, so the auto-speak effect
    // reports `blocked` rather than speaking.
    const first = rig.render();
    t("an unprimed first render blocks instead of speaking",
      rig.writes.blocked.includes(true), JSON.stringify(rig.writes.blocked));
    first.prime();
    rig.writes.speaking.length = 0;
    rig.writes.status.length = 0;
    rig.render();
    await tick(); await tick(); await tick();
    t("the ElevenLabs path ends with the speaking indicator ON",
      rig.writes.speaking.length > 0 && rig.writes.speaking[rig.writes.speaking.length - 1] === true,
      JSON.stringify(rig.writes.speaking));
    t("a 'speaking' status is what raises it, not the request being issued",
      rig.writes.status.some(x => x && x.state === "speaking"),
      JSON.stringify(rig.writes.status.map(x => x && x.state)));
    // The bug this pins: speakEleven pauses the shared element before
    // loading the next clip, so a `pause` listener fired on OUR OWN pause
    // and cleared `speaking` a moment before playback began.
    t("the shared element's own pause is not listened for",
      rig.audioEvents.pause === undefined && typeof rig.audioEvents.ended === "function",
      Object.keys(rig.audioEvents).join(",") || "(no listeners)");
  }
  {
    const failing = (c) => ({ ...workingEleven(c), synthesize: async () => { throw new Error("Quota exceeded."); } });
    const rig = persistentRig({ eleven: failing });
    rig.render().prime();
    rig.writes.speaking.length = 0;
    rig.writes.status.length = 0;
    rig.render();
    await tick(); await tick(); await tick();
    t("a failed ElevenLabs request leaves the speaking indicator OFF",
      rig.writes.speaking.every(v => v === false), JSON.stringify(rig.writes.speaking));
    t("and the fallback reason is recorded as status",
      rig.writes.status.some(x => x && x.state === "fallback"),
      JSON.stringify(rig.writes.status.map(x => x && x.state)));
  }

  // ── the browser voice picker ─────────────────────────────────────────
  {
    // The configured voice name is an ElevenLabs voice, so on the fallback
    // path the lookup MISSES. It must land on the best-ranked system voice
    // rather than on null (which would hand the utterance to whatever the
    // browser's default happens to be).
    const voices = [
      { name: "Albert", lang: "en-US", localService: true },
      { name: "Samantha", lang: "en-US", localService: true },
    ];
    const { sandbox, calls } = makeSandbox({ voices });
    sandbox.speakNow("Fallback speech.", { style: "jedi", voiceName: "Nerissa", provider: "browser" });
    t("an unmatched voice name falls back to the best-ranked system voice",
      calls.speak.length > 0 && calls.speak[0].voice && calls.speak[0].voice.name === "Samantha",
      calls.speak[0] && calls.speak[0].voice && calls.speak[0].voice.name);
  }
  {
    const voices = [
      { name: "Albert", lang: "en-US", localService: true },
      { name: "Samantha", lang: "en-US", localService: true },
    ];
    const { sandbox, calls } = makeSandbox({ voices });
    sandbox.speakNow("Fallback speech.", { style: "jedi", voiceName: "Albert", provider: "browser" });
    t("an explicitly chosen system voice is honored",
      calls.speak[0].voice.name === "Albert", calls.speak[0].voice.name);
  }

  return rows;
}
