// src/demo/SYNTHETIC_DEMO.js — demotion banner for the synthetic ephemeris. (P5)
//
// astro.jsx derives longitudes from synthetic orbital periods and Date math
// with floating point. That output is PRESENTATION ONLY. It must never be
// labelled exact, verified, or evidence-grade, and must never be admitted to
// src/core. This module makes the boundary loud and machine-checkable.

export const SYNTHETIC_DEMO = Object.freeze({
  status: "SYNTHETIC_DEMO",
  admissibleForCore: false,
  admissibleForEvidence: false,
  admissibleFor: ["ui", "layout", "presentation", "narrative"],
  reason:
    "Longitudes are produced by synthetic orbital periods + floating-point Date " +
    "arithmetic for visual demonstration. They are not exact integer ephemeris " +
    "facts and carry no certificate.",
});

// Wrap any synthetic chart result so its provenance travels with it.
export function tagSynthetic(chartResult) {
  return {
    __provenance: SYNTHETIC_DEMO,
    __warning: "SYNTHETIC_DEMO — presentation only; not admissible to HCRM core or evidence.",
    value: chartResult,
  };
}

// Console banner — call once when a demo surface boots.
export function emitSyntheticBanner(label) {
  const msg =
    `%c SYNTHETIC_DEMO %c ${label || "chart"} — presentation only. ` +
    `Longitudes are synthetic (floating point); not exact, not evidence-grade.`;
  try {
    console.warn(msg,
      "background:#b07a2a;color:#000;font-weight:bold;padding:2px 4px;border-radius:3px",
      "color:#b8b0a0");
  } catch { /* no console */ }
}

// Guard: throws if synthetic data is handed to a core/evidence sink.
export function refuseSyntheticForCore(provenanceTag) {
  if (provenanceTag && provenanceTag.status === "SYNTHETIC_DEMO")
    throw new Error("SYNTHETIC_DEMO is not admissible to the HCRM core or evidence path");
}
