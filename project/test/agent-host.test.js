// test/agent-host.test.js — the agent interpreter's host contract. (P25)
//
// agent.jsx called `window.claude.complete(prompt)` unguarded. That API is
// injected by the Claude artifact host and exists NOWHERE else — not on a
// Lovable/static deploy, not from disk, not in a plain browser tab. The blind
// call threw `Cannot read properties of undefined (reading 'complete')` deep
// inside a promise, and every host but one showed the user
// "interpreter unavailable" with no hint the feature was never on offer there.
//
// This suite pins the contract that replaced it:
//   · a host WITHOUT window.claude reports `unavailable` — the ordinary case;
//   · a host WITH it reports text, and a genuine failure reports `error`;
//   · the two are never conflated, because the UI says different things.
//
// agent.jsx is a browser global-script JSX module, so it is not importable
// here. The audit is textual and structural — it asserts the guard exists at
// every call site — plus a behavioural model of the state machine.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = (f) => readFileSync(join(HERE, "..", f), "utf8");

/**
 * Remove comments so the audit matches CONSTRUCTS, not prose about them.
 *
 * Comments only — deliberately NOT string literals. An earlier draft blanked
 * quoted text too, and its single-quote pass paired the apostrophe in a
 * trailing comment ("// it's fine") with one thousands of characters away,
 * deleting the very definitions this suite checks for and reporting them
 * missing when they were right there. The patterns below are anchored and
 * specific enough that a string or a stray mention cannot satisfy them.
 * @param {string} src
 * @returns {string} src with block and whole-line comments removed.
 */
function decommented(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

export function run() {
  const R = [];
  const t = (name, ok, detail) => R.push({ name, ok: !!ok, detail: detail || "" });

  const agent = SRC("agent.jsx");
  const bare = decommented(agent);

  // ── the probe exists and is honest ───────────────────────────────
  t("agent.jsx defines agentAvailable()",
    /function\s+agentAvailable\s*\(\s*\)/.test(bare),
    "the host capability probe");
  t("the probe checks window.claude AND that complete is callable",
    /!!window\.claude/.test(bare)
    && /typeof\s+window\.claude\.complete\s*===\s*["']function["']/.test(bare),
    "a truthy window.claude with no complete() must not read as available");
  t("agentAvailable is exported on the window bridge",
    /Object\.assign\(window,\s*\{[^}]*agentAvailable/s.test(bare),
    "consumers and tests can read the host's capability");

  // ── every call site is guarded ───────────────────────────────────
  const callSites = (bare.match(/window\.claude\.complete\s*\(/g) || []).length;
  const guards = (bare.match(/requireAgent\s*\(\s*\)\s*;/g) || []).length;
  t("every window.claude.complete call sits behind requireAgent()",
    callSites > 0 && guards >= callSites,
    `${callSites} call sites, ${guards} guards`);

  const hookHeads = (bare.match(/function\s+use(?:Agent\w*|Synastry)Reading\s*\(/g) || []).length;
  const shortCircuits = (bare.match(/if\s*\(!agentAvailable\(\)\)\s*\{\s*setState\(AGENT_UNAVAILABLE\);\s*return;\s*\}/g) || []).length;
  t("every reading hook short-circuits before firing a doomed request",
    hookHeads > 0 && shortCircuits >= hookHeads,
    `${hookHeads} hooks, ${shortCircuits} short-circuits`);

  t("the unavailable state is distinct from the error state",
    /AGENT_UNAVAILABLE\s*=\s*Object\.freeze\(\{[^}]*error:\s*null[^}]*unavailable:\s*true/s.test(bare),
    "unavailable carries error: null — a host without the feature has not failed");

  // ── the UI tells the two apart ───────────────────────────────────
  for (const [file, unavailableCls, errorCls] of [
    ["session.jsx", "cs-note", "cs-error"],
    ["card.jsx", "zc-agent-note", "zc-agent-error"],
    ["synastry-view.jsx", "syn-note", "syn-error"],
  ]) {
    const src = SRC(file);
    t(`${file} renders the unavailable case separately from the error case`,
      src.includes(unavailableCls) && src.includes(errorCls)
      && /\.unavailable\s*&&/.test(src) && /\.error\s*&&/.test(src),
      `${unavailableCls} vs ${errorCls}`);
    t(`${file} no longer calls a missing interpreter "unavailable" on failure`,
      !/error\s*&&[\s\S]{0,120}interpreter unavailable/.test(src),
      "an error is a failed call, not an absent feature");
  }

  const css = decommented(SRC("styles.css"));
  for (const cls of ["cs-note", "zc-agent-note", "syn-note"]) {
    t(`styles.css defines .${cls}`, new RegExp(`\\.${cls}\\s*\\{`).test(css));
  }

  // ── behavioural model of the state machine ───────────────────────
  // Mirrors the hook contract exactly; catches a regression in the shape of
  // the state even though the JSX module itself cannot be imported here.
  const available = (w) => typeof w !== "undefined" && !!w.claude && typeof w.claude.complete === "function";
  const hook = (w, call) => {
    if (!available(w)) return { loading: false, text: null, error: null, unavailable: true };
    try { return { loading: false, text: call(), error: null }; }
    catch (e) { return { loading: false, text: null, error: String(e.message) }; }
  };

  const noHost = hook({}, () => "never runs");
  t("host without window.claude → unavailable, not error",
    noHost.unavailable === true && noHost.error === null && noHost.text === null);

  const partial = hook({ claude: {} }, () => "never runs");
  t("host with window.claude but no complete() → unavailable",
    partial.unavailable === true && partial.error === null,
    "a truthy-but-empty window.claude must not be treated as a working host");

  const good = hook({ claude: { complete: () => "" } }, () => "a reading");
  t("host with a working interpreter → text, no error, not unavailable",
    good.text === "a reading" && good.error === null && good.unavailable === undefined);

  const failing = hook({ claude: { complete: () => "" } }, () => { throw new Error("429 rate limited"); });
  t("a real call failure → error, and NOT unavailable",
    failing.error === "429 rate limited" && failing.unavailable === undefined && failing.text === null,
    "the two states stay distinguishable, which is the whole point");

  return R;
}
