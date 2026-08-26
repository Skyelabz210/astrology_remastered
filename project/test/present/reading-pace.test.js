// test/present/reading-pace.test.js — the reader sets the pace. (P27)
//
// A diagnostic pass on the reading session found the experience working
// against the person holding the phone, five ways:
//
//   1. the text TYPED itself out word by word (a per-word interval and a
//      blinking caret), forcing reading at the machine's speed;
//   2. a dwell timer AUTO-ADVANCED to the next card ~1.8s after the last
//      word landed — the card left exactly when reading it became possible;
//   3. a play/pause button tried to govern that timer, and on iOS did not
//      even hold the voice (speechSynthesis.pause() is a no-op there);
//   4. interpretations were fetched one card at a time (current + one
//      pre-warm), so every step forward opened on loading dots;
//   5. the browser voice sat mute on iOS: prime() never gesture-registered
//      SpeechSynthesis, and utterances were bulk-queued, which iOS drops.
//
// The fixes: text is PRESENTED whole (one CSS fade, no timers); nothing
// advances on a timer and there is no pause button; every card's
// interpretation is requested in parallel the moment the deck is up; and
// the voice path gesture-unlocks both engines and feeds SpeechSynthesis
// one utterance at a time. This suite pins each of those so a future
// "polish" cannot quietly reintroduce the typewriter or the timer.

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..");
const read = (f) => readFileSync(join(ROOT, f), "utf8");

export async function run() {
  const rows = [];
  const t = (name, ok, detail = "") => rows.push({ name, ok, detail });

  const session = read("session.jsx");
  const voice = read("voice.jsx");
  const css = read("styles.css");

  // ── 1 · no typewriter ─────────────────────────────────────────────────
  t("WordReveal presents the text whole — no per-word interval",
    /function WordReveal\([\s\S]{0,600}?\}/.test(session)
    && !/WordReveal[\s\S]{0,900}?setInterval/.test(session),
    "the reveal component must not run a timer");
  t("no typing caret in the markup", !/cs-cursor/.test(session));
  t("no per-word spans in the markup", !/cs-word/.test(session));
  t("the whole-piece fade exists in CSS",
    /\.cs-text-in\s*\{/.test(css) && /@keyframes cs-text-in/.test(css));
  t("the per-word reveal rules are gone from CSS",
    !/^\.cs-word\s*\{/m.test(css) && !/^\.cs-cursor\s*\{/m.test(css)
    && !/@keyframes word-in/.test(css));

  // ── 2 · no auto-advance ───────────────────────────────────────────────
  t("dwellFor is gone", !/dwellFor/.test(session));
  t("no timer ever advances the deck",
    !/setTimeout\([\s\S]{0,120}?setPos/.test(session),
    "setPos may only run from a click handler or the narration's onSegment");

  // ── 3 · no pause button ───────────────────────────────────────────────
  t("the play/pause control is gone from SessionControls",
    // onPlayWholeChart is the NARRATION control and stays; what must not
    // return is the deck-timer play/pause pair.
    !/rs-ctrl-play/.test(session) && !/onPlay(?!WholeChart)/.test(session)
    && !/setPlaying/.test(session));
  t("prev/next stepping remains",
    /aria-label="Previous card"/.test(session) && /aria-label="Next card"/.test(session));
  t("a running narration still has its explicit stop",
    /stop the reading/.test(session));

  // ── 4 · parallel interpretation ───────────────────────────────────────
  t("every card's interpretation is requested at once",
    /cards\.forEach\(\(c\) => interpretCard\(c, chart\)/.test(session),
    "the whole spread prefetches in parallel; agent.jsx dedupes and caches");
  t("the sequential pre-warm-one scheme is gone",
    !/nextCard/.test(session));

  // ── 5 · the voice path is iOS-safe ────────────────────────────────────
  t("prime() gesture-unlocks SpeechSynthesis too",
    /const prime = React\.useCallback[\s\S]{0,400}?primeBrowserSpeech\(\)/.test(voice),
    "priming only the audio element left the browser voice mute on iOS");
  t("narration feeds utterances one at a time",
    /function speakNarrativeBrowser[\s\S]{0,1400}?speakChain\(/.test(voice),
    "a bulk-queued backlog is dropped by iOS");
  t("per-card speech chains too",
    /function speakBrowser[\s\S]{0,1200}?speakChain\(/.test(voice));

  // speakChain behavior, executed for real: one utterance in the engine at
  // a time; onerror advances; onDone fires after the last.
  {
    const calls = { speak: [] };
    const sandbox = {};
    sandbox.window = sandbox;
    sandbox.speechSynthesis = {
      speak: (u) => { calls.speak.push(u); },
      cancel: () => {}, pause: () => {}, resume: () => {},
      getVoices: () => [], onvoiceschanged: null,
    };
    sandbox.React = {
      useState: (init) => [init, () => {}],
      useRef: (init) => ({ current: init }),
      useEffect: (fn) => fn(),
      useCallback: (fn) => fn,
    };
    sandbox.SpeechSynthesisUtterance = function (text) { this.text = text; };
    vm.createContext(sandbox);
    vm.runInContext(voice, sandbox, { filename: "voice.jsx" });

    const mk = (text) => new sandbox.SpeechSynthesisUtterance(text);
    const u1 = mk("one"), u2 = mk("two"), u3 = mk("three");
    let done = 0;
    sandbox.speakChain([u1, u2, u3], { onDone: () => { done++; } });
    t("speakChain hands the engine ONE utterance up front",
      calls.speak.length === 1 && calls.speak[0] === u1,
      `${calls.speak.length} queued before any onend`);
    u1.onend();
    t("…and the next only from the previous one's onend",
      calls.speak.length === 2 && calls.speak[1] === u2);
    u2.onerror(new Error("refused"));
    t("a refused utterance advances instead of ending the reading",
      calls.speak.length === 3 && calls.speak[2] === u3);
    t("onDone has not fired mid-chain", done === 0);
    u3.onend();
    t("onDone fires after the last utterance", done === 1);

    // cancellation: a stopped chain must go quiet, not keep feeding.
    const v1 = mk("a"), v2 = mk("b");
    let cancelled = false, before = calls.speak.length;
    sandbox.speakChain([v1, v2], { isCancelled: () => cancelled });
    cancelled = true;
    v1.onend();
    t("a cancelled chain stops feeding the engine",
      calls.speak.length === before + 1);
  }

  // ── 6 · the reading fits a phone ──────────────────────────────────────
  const mobile = css.match(/@media \(max-width: 720px\) \{[\s\S]*?\n\}/);
  t("a ≤720px block exists for the reading stage", !!mobile);
  if (mobile) {
    const m = mobile[0];
    t("mobile: the stage sheds its 48px side padding", /\.cs \{[^}]*padding: 18px 2px/.test(m));
    t("mobile: the text column is sized for the width it has", /\.cs-text \{[^}]*font-size: 19px/.test(m));
    t("mobile: the glyph scales with the viewport instead of flooring at 320px",
      /\.cs-glyph \{[^}]*clamp\(150px, 78vw, 320px\)/.test(m));
    t("mobile: the header folds to two rows", /grid-template-areas: "l r" "m m"/.test(m));
    t("mobile: the deck dots wrap instead of overflowing", /\.rs-dots \{[^}]*flex-wrap: wrap/.test(m));
  }

  return rows;
}
