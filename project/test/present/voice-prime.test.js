// test/present/voice-prime.test.js — a real crash, not a lint nitpick.
//
// Enabling eslint on the project's *.jsx layer for the first time (see
// eslint.config.mjs's new project/*.jsx block, and
// docs/COMPLETION_AUDIT.md's completion follow-up) surfaced a genuine
// no-undef: session.jsx called a bare `primeSpeech()` at three call sites
// (the voice on/off toggle, the "tap to unblock" control, and "speak now"),
// and no `primeSpeech` was ever defined anywhere in the repo. Every one of
// those three interactions would throw `ReferenceError: primeSpeech is not
// defined` the instant a user actually clicked them — this was never
// exercised by any test, and voiceOn defaults to false, so a real user
// enabling voice narration would have been the first to hit it.
//
// voice.jsx's useVoice() already exported `retrigger(text)` — "call this
// INSIDE a click/tap handler to speak the current text. This satisfies the
// gesture requirement and primes the engine" — but retrigger() ALSO speaks
// immediately, which is wrong for a handler (like the on/off toggle) that
// decides separately whether to speak right now. The fix adds `prime()`:
// the same gesture-unlock, without forcing an utterance.
//
// React hooks need a renderer to test in the usual sense, and this repo has
// no React-render test infrastructure (its browser-script tests all run
// plain functions through node:vm — see astro-chart.test.js's own header).
// So this suite runs useVoice() against a minimal hook rig: useState/useRef
// behave for real (a single render's worth), useEffect runs its callback
// once synchronously (order/timing isn't what's under test), useCallback
// just returns its function unmemoized. That is enough to call the real
// useVoice() function body and assert on what it returns and does.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const voiceSrc = readFileSync(join(ROOT, "voice.jsx"), "utf8");
const sessionSrc = readFileSync(join(ROOT, "session.jsx"), "utf8");

function makeHookRig() {
  const calls = { speak: [], cancel: 0 };
  const React = {
    useState: (init) => [init, () => {}],
    useRef: (init) => ({ current: init }),
    useEffect: (fn) => { const cleanup = fn(); return cleanup; },
    useCallback: (fn) => fn,
  };
  const speechSynthesis = {
    cancel: () => { calls.cancel++; },
    speak: (u) => { calls.speak.push(u); },
    pause: () => {},
    resume: () => {},
    getVoices: () => [],
    onvoiceschanged: null,
  };
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.speechSynthesis = speechSynthesis;
  sandbox.React = React;
  sandbox.SpeechSynthesisUtterance = function (text) { this.text = text; };
  vm.createContext(sandbox);
  vm.runInContext(voiceSrc, sandbox, { filename: "voice.jsx" });
  return { sandbox, calls };
}

export async function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok, detail });

  // ── the crash itself: primeSpeech must be gone from session.jsx ───────
  t("session.jsx no longer calls the undefined primeSpeech()",
    !/\bprimeSpeech\s*\(/.test(sessionSrc));
  // The three original crash sites — the voice on/off toggle, the
  // "tap to unblock" control, and "speak now" — plus any gesture handler
  // added since that also has to unlock the audio engines before an async
  // speak (the whole-chart narration's start handler is one). The check is
  // "at least the three, and every one of them calls the real function",
  // not an exact count: pinning the count would fail the next time a
  // legitimate new click handler primes, which is the behavior we WANT.
  // What must never come back is a call to a `primeSpeech` that does not
  // exist — asserted separately above.
  const primeCallSites = [...sessionSrc.matchAll(/voice\.prime\s*&&\s*voice\.prime\s*\(\)/g)];
  t("session.jsx's former primeSpeech() call sites all call the real voice.prime()",
    primeCallSites.length >= 3, `found ${primeCallSites.length} occurrences`);
  t("every gesture handler that starts an async speak primes first",
    /startNarration\s*=\s*React\.useCallback\([\s\S]{0,400}?voice\.prime/.test(sessionSrc));

  // ── voice.jsx: useVoice() actually exports prime() ────────────────────
  {
    const { sandbox } = makeHookRig();
    const voice = sandbox.useVoice({ text: "hello", enabled: true, style: "jedi", voiceName: "", playing: true });
    t("useVoice() returns a prime function", typeof voice.prime === "function");
    t("useVoice() still returns retrigger (unchanged)", typeof voice.retrigger === "function");
    t("useVoice() still returns supported/speaking/blocked (unchanged shape)",
      "supported" in voice && "speaking" in voice && "blocked" in voice);
  }

  // ── behavioral difference: prime() must not speak AUDIBLY ─────────────
  //
  // REFINED (was: "prime() does not call speechSynthesis.speak at all").
  // iOS Safari only honours later asynchronous speak() calls once some
  // utterance has been spoken inside a real gesture, so prime() now speaks
  // exactly one MUTED, blank unlock utterance — that is the fix for the
  // browser voice sitting silent on iOS, and it is not "speaking" in any
  // sense a listener can hear. The contract this row protects is the
  // original one: prime() must never narrate the reading text. So: every
  // utterance prime() queues must be muted (volume 0) and content-free,
  // and none may carry the reading text.
  {
    const { sandbox, calls } = makeHookRig();
    const voice = sandbox.useVoice({ text: "the reading text", enabled: true, style: "jedi", voiceName: "", playing: true });
    voice.prime();
    const audible = calls.speak.filter((u) => u.volume !== 0 || (u.text || "").trim().length > 0);
    t("prime() speaks nothing audible — unlock utterances are muted and blank",
      audible.length === 0,
      `${calls.speak.length} utterance(s) queued, ${audible.length} audible`);
    t("prime() never speaks the reading text",
      calls.speak.every((u) => !(u.text || "").includes("the reading text")));
  }
  {
    const { sandbox, calls } = makeHookRig();
    const voice = sandbox.useVoice({ text: "the reading text", enabled: true, style: "jedi", voiceName: "", playing: true });
    voice.retrigger("the reading text");
    t("retrigger() DOES call speechSynthesis.speak (unchanged behavior)",
      calls.speak.length > 0, `speak() called ${calls.speak.length} times`);
  }

  // ── prime() does not throw when speechSynthesis is unsupported ────────
  {
    const sandbox = {};
    sandbox.window = sandbox; // no speechSynthesis on window -> supported = false
    sandbox.React = {
      useState: (init) => [init, () => {}],
      useRef: (init) => ({ current: init }),
      useEffect: (fn) => fn(),
      useCallback: (fn) => fn,
    };
    vm.createContext(sandbox);
    vm.runInContext(voiceSrc, sandbox, { filename: "voice.jsx" });
    let threw = null;
    try {
      const voice = sandbox.useVoice({ text: "x", enabled: true, style: "jedi", voiceName: "", playing: true });
      voice.prime();
    } catch (e) { threw = e; }
    t("prime() is a safe no-op when speechSynthesis is unsupported", threw === null,
      threw ? `${threw.name}: ${threw.message}` : "");
  }

  return rows;
}
