# Roadmap & TODO: Astrology Remastered Evolution & Mistral AI Architecture

**Target Release:** Astrology Remastered v2.0 (Resonance Unified)  
**Primary Integration Focus:** Mistral AI Intelligence Layer, Resonance Reading Theatre, Exact Substrate Modernization, Life Chapters, and Souvenir Artifact Generation.

---

## Executive Overview

This roadmap defines the next architectural evolution of **Astrology Remastered**, unifying the mathematically rigorous BigInt substrate from `Skyelabz210/astrology_remastered` with the interactive presentation systems of `Prime Resonance` and the formal residue manifolds of `Celestial Registry`.

Central to this release is the adoption of **Mistral AI** as the unified artificial intelligence layer, powering chart synthesis, spoken narrative generation, interactive astrological consultation, and bespoke "Souvenir" commemorative keepsake generation.

---

## 1. Mistral AI Integration Layer

- [ ] **1.1 Provider Client & Authentication Architecture**
  - [ ] Implement `src/ai/mistral.js` (and TypeScript definitions) supporting `mistral-large-latest`, `codestral-latest`, and `pixtral-large-latest`.
  - [ ] Support dual auth paths: Client-side BYOK (stored securely in `localStorage`, excluded from shared settings objects) and optional Edge proxy endpoint.
  - [ ] Graceful fallback: when no API key is provided, system falls back smoothly to deterministic local algorithmic interpretation without UI disruption.

- [ ] **1.2 Grounded Chart Interpretation Pipeline**
  - [ ] Build strict prompt templates that inject **only** certified ledger entries (`admitForCore()` output) and exact integer aspect matrices.
  - [ ] Structured Outputs: Enforce JSON schemas for planetary dignities, sect analysis, aspectual tensions, and elemental balances.
  - [ ] Rigor & Falsifiability Verification: Every interpretation statement links to a specific mathematical trace badge (e.g., exact residue, orb, or harmonic).

- [ ] **1.3 Spoken Narrative & Voice Script Generation**
  - [ ] Implement Mistral narrative synthesis engineered specifically for audio delivery:
    - Cadence, rhythm, and acoustic pacing optimized for text-to-speech.
    - Three-movement structure: *The Nativity Opening* -> *The Twelve Houses / Signs in Deck Order* -> *The Convergent Synthesis*.
  - [ ] Segment boundary formatting: Output structured chunks with explicit character boundaries to interface directly with ElevenLabs character-timestamp alignment.

- [ ] **1.4 "The Celestial Souvenir" Generation Engine**
  - [ ] Develop the Mistral-powered Souvenir synthesis module:
    - Deep personal retrospective keepsake blending exact natal geometry with biographical reflection.
    - Generates poetic dedications, natal archetypal essays, and life-transit milestones.
  - [ ] Multi-format rendering:
    - Interactive Standalone HTML Souvenir (self-contained with embedded CSS/SVG).
    - Print-ready Markdown / Typography layout for personal printing.
    - Exportable commemorative JSON certificate.

- [ ] **1.5 Interactive Astrological Agent (Consultant Mode)**
  - [ ] Opt-in conversational interface allowing users to interrogate their chart, transits, and synastry.
  - [ ] System prompt guardrails preventing generic horoscopic fluff; all responses must cite specific chart degrees, dignities, and harmonic properties.

---

## 2. Core Substrate & Exact Arithmetic (Mandate A1)

- [ ] **2.1 Strict 21-Module Preservation & TypeScript Modernization**
  - [ ] Maintain zero-float integrity across all 21 core modules (`basis`, `shell-kelim`, `cram`, `ring`, `variants`, `rho`, `shadow-spine`, `carry`, `operators`, etc.).
  - [ ] Provide TypeScript typings (`d.ts` or native `.ts` ports) for seamless integration with TanStack Router and modern UI frameworks.
  - [ ] Preserve full test harness: 6,838+ assertions over the 1,296,000-point ring sweep in continuous integration.

- [ ] **2.2 Admission Ledger Hardening**
  - [ ] Enforce `admitForCore()` as the exclusive gateway for all astronomical positions.
  - [ ] Explicit error throwing for synthetic or unquantized float inputs across both CLI and browser environments.

---

## 3. Resonance Reading Theatre & Karaoke Audio Engine

- [ ] **3.1 Unified Audiovisual Reading Theatre**
  - [ ] Port the interactive Theatre Screen from `Prime Resonance` (`ResonanceTheatreScreen`, `ResonanceCard`, `AspectGeometryView`, `HouseDepthArc`, `DepthPhaseIndicator`).
  - [ ] Reconcile visual state with exact BigInt residue data rather than approximate floats.

- [ ] **3.2 Audio & Karaoke Synchronization Pipeline**
  - [ ] ElevenLabs integration: voice selection (Nerissa default) with dynamic account voice resolution.
  - [ ] Real-time character-level timestamp synchronization: active card in the theatre advances precisely with spoken words.
  - [ ] Resilient Fallback: instant, uninterrupted fallback to browser `window.speechSynthesis` on API limits, network loss, or absent keys.
  - [ ] Scrubbing & Playback Controls: seamless pause, resume, and seek with zero audio-visual desynchronization.

---

## 4. Life Chapters & Relocation Chronology

- [ ] **4.1 Residence History State Model**
  - [ ] Versioned, allowlisted `localStorage` schema storing chronological residence history (location, dates, timezone).
  - [ ] Privacy guarantees: local device retention only with explicit "Forget Profile" controls.

- [ ] **4.2 Relocation Computational Engine**
  - [ ] Natal longitudes remain fixed while horizon-dependent angles (ASC, MC, Vertex, House Cusps) dynamically recompute per residence chapter.
  - [ ] Support Placidus, Koch, Regiomontanus, Campanus, and Whole Sign systems with polar latitude fallbacks.
  - [ ] Solar and Lunar Returns cast for the active residence on each exact astronomical return instant.

---

## 5. Geophysical Eclipses & Spatial Tracking

- [ ] **5.1 Complete Eclipse Database (1970–2030)**
  - [ ] Prenatal eclipse pairs (solar and lunar preceding birth).
  - [ ] Lifetime natal activations: conjunctions and oppositions to natal points within configurable orbs.

- [ ] **5.2 Ground-Track vs. Zenith Geodesics**
  - [ ] Total / Annular solar eclipses: compute point of Greatest Eclipse along the shadow axis.
  - [ ] Partial solar and lunar eclipses: compute subsolar and sublunar zenith coordinates.
  - [ ] Great-circle distance, azimuth bearing, and horizon visibility calculation from birthplace and active residence.

---

## 6. Multi-Tradition Astrological Breadth

- [ ] **6.1 Vedic / Jyotisha Substrate**
  - [ ] Vimshottari Dasha and Antardasha timeline generators.
  - [ ] Nakshatra positions, padas, and rulerships computed from exact integer ayanamshas (Lahiri, Krishnamurti, Raman, Fagan-Bradley).

- [ ] **6.2 Mesoamerican / Mayan Cycles**
  - [ ] Tzolk'in 260-day Sacred Round mapping (13 numbers x 20 day signs).
  - [ ] Haab' 365-day solar calendar correlation.

- [ ] **6.3 Western Traditional Apparatus**
  - [ ] Essential and accidental dignities (rulership, exaltation, triplicity, terms, faces).
  - [ ] Hellenistic Lots (Fortune, Spirit, Eros, Necessity) with day/night sect branching.
  - [ ] Antiscia and Contra-antiscia reflection points across solstice axes.

---

## 7. Data Sovereignty, Exports & Offline Portability

- [ ] **7.1 Comprehensive ZIP Archive Export**
  - [ ] Bundler generating a standalone, offline-accessible archive:
    - `report.html`: Self-contained interactive report with embedded CSS, zero external runtime scripts required.
    - `souvenir.html`: The Mistral-generated personal commemorative keepsake.
    - `chart.svg`: Scalable vector graphics of the natal wheel and aspect grid.
    - `calculations.json`: Raw calculation ledger, residue trays, and audit logs.
  - [ ] Zero telemetry or cloud upload; user retains complete cryptographic and data sovereignty.
