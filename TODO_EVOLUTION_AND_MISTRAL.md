# Roadmap & TODO: Astrology Remastered Evolution & Mistral AI Architecture

**Target Release:** Astrology Remastered v2.0 (Resonance Unified)  
**Primary Integration Focus:** Mistral AI Intelligence Layer, Resonance Reading Theatre, Exact Substrate Modernization, Life Chapters, and Souvenir Artifact Generation.

**Implementation:** The v1.1.0 avatar integration and roadmap delivery are mapped, with source files and remaining limits, in [EVOLUTION_IMPLEMENTATION.md](project/docs/EVOLUTION_IMPLEMENTATION.md). OpenRouter remains the default free-model route; Mistral is an explicit alternative. Three geometry/depth views are adapted from the located Prime Resonance repository; a pixel-identical screen port and Celestial Registry integration remain open.

---

## Executive Overview

This roadmap defines the next architectural evolution of **Astrology Remastered**, unifying the mathematically rigorous BigInt substrate from `Skyelabz210/astrology_remastered` with the interactive presentation systems of `Prime Resonance` and the formal residue manifolds of `Celestial Registry`.

Central to this release is the adoption of **Mistral AI** as the unified artificial intelligence layer, powering chart synthesis, spoken narrative generation, interactive astrological consultation, and bespoke "Souvenir" commemorative keepsake generation.

---

## 1. Mistral AI Integration Layer

- [x] **1.1 Provider Client & Authentication Architecture**
  - [x] Implement `src/ai/mistral.js` (and TypeScript definitions) supporting `mistral-large-latest`, `codestral-latest`, and `pixtral-large-latest`.
  - [x] Support dual auth paths: Client-side BYOK (memory-only by default; explicit browser-storage opt-in, excluded from shared settings and exports) and optional Edge proxy endpoint.
  - [x] Graceful fallback: when no API key is provided, system falls back smoothly to deterministic local algorithmic interpretation without UI disruption.

- [x] **1.2 Grounded Chart Interpretation Pipeline**
  - [x] Build strict prompt templates that inject admitted integer ledger entries (`admitForCore()` output) and exact integer aspect matrices in the consultant/keepsake source pack; derived traditional rules stay explicitly labeled.
  - [x] Structured Outputs: Enforce JSON schemas for planetary dignities, sect analysis, aspectual tensions, and elemental balances.
  - [x] Rigor & Falsifiability Verification: Every interpretation statement links to a specific mathematical trace badge (e.g., exact residue, orb, or harmonic).

- [x] **1.3 Spoken Narrative & Voice Script Generation**
  - [x] Implement Mistral narrative synthesis engineered specifically for audio delivery:
    - Cadence, rhythm, and acoustic pacing optimized for text-to-speech.
    - Three-movement structure: *The Nativity Opening* -> *The Twelve Houses / Signs in Deck Order* -> *The Convergent Synthesis*.
  - [x] Segment boundary formatting: Output structured chunks with explicit character boundaries to interface directly with ElevenLabs character-timestamp alignment.

- [x] **1.4 "The Celestial Souvenir" Generation Engine**
  - [x] Develop the Mistral-powered Souvenir synthesis module:
    - Deep personal retrospective keepsake blending exact natal geometry with biographical reflection.
    - Generates poetic dedications, natal archetypal essays, and life-transit milestones.
  - [x] Multi-format rendering:
    - Interactive Standalone HTML Souvenir (self-contained with embedded CSS/SVG).
    - Print-ready Markdown / Typography layout for personal printing.
    - Exportable commemorative JSON certificate.

- [x] **1.5 Interactive Astrological Agent (Consultant Mode)**
  - [x] Opt-in conversational interface allowing users to interrogate their chart, transits, and synastry.
  - [x] System prompt guardrails preventing generic horoscopic fluff; all responses must cite specific chart degrees, dignities, and harmonic properties.

---

## 2. Core Substrate & Exact Arithmetic (Mandate A1)

- [x] **2.1 Strict 21-Module Preservation & TypeScript Modernization**
  - [x] Maintain zero-float integrity across all 21 core modules (`basis`, `shell-kelim`, `cram`, `ring`, `variants`, `rho`, `shadow-spine`, `carry`, `operators`, etc.).
  - [x] Provide TypeScript typings (`d.ts` or native `.ts` ports) for seamless integration with TanStack Router and modern UI frameworks.
  - [x] Preserve full test harness: 6,838+ assertions over the 1,296,000-point ring sweep in continuous integration.

- [x] **2.2 Admission Ledger Hardening**
  - [x] Enforce `admitForCore()` at the public astronomical register API and presentation consumers entering the exact core.
  - [x] Explicit error throwing for synthetic or unquantized float inputs across both CLI and browser environments.

---

## 3. Resonance Reading Theatre & Karaoke Audio Engine

- [ ] **3.1 Unified Audiovisual Reading Theatre**
  - [x] Adapt Prime Resonance's aspect geometry, house-depth arc and depth-phase views to this app's admitted integer data and current Session/card stage (`prime-theatre.jsx`, source commit recorded in the implementation report).
  - [ ] Port the interactive Theatre Screen from `Prime Resonance` (`ResonanceTheatreScreen`, `ResonanceCard`, `AspectGeometryView`, `HouseDepthArc`, `DepthPhaseIndicator`).
  - [x] Reconcile visual state with exact BigInt residue data rather than approximate floats.

- [ ] **3.2 Audio & Karaoke Synchronization Pipeline**
  - [x] ElevenLabs integration: voice selection (Nerissa default) with dynamic account voice resolution.
  - [x] Real-time character-level timestamp synchronization: active card in the theatre advances precisely with spoken words.
  - [ ] Resilient Fallback: instant, uninterrupted fallback to browser `window.speechSynthesis` on API limits, network loss, or absent keys.
  - [ ] Scrubbing & Playback Controls: seamless pause, resume, and seek with zero audio-visual desynchronization.

---

## 4. Life Chapters & Relocation Chronology

- [x] **4.1 Residence History State Model**
  - [x] Versioned, allowlisted `localStorage` schema storing chronological residence history (location, dates, timezone).
  - [x] Privacy guarantees: local device retention only with explicit "Forget Profile" controls.

- [x] **4.2 Relocation Computational Engine**
  - [x] Natal longitudes remain fixed while horizon-dependent angles (ASC, MC, Vertex, House Cusps) dynamically recompute per residence chapter.
  - [x] Support Placidus, Koch, Regiomontanus, Campanus, and Whole Sign systems with polar latitude fallbacks.
  - [x] Solar and Lunar Returns cast for the active residence on each exact astronomical return instant.

---

## 5. Geophysical Eclipses & Spatial Tracking

- [x] **5.1 Complete Eclipse Database (1970–2030)**
  - [x] Prenatal eclipse pairs (solar and lunar preceding birth).
  - [x] Lifetime natal activations: conjunctions and oppositions to natal points within configurable orbs.

- [x] **5.2 Ground-Track vs. Zenith Geodesics**
  - [x] Total / Annular solar eclipses: compute point of Greatest Eclipse along the shadow axis.
  - [x] Partial solar and lunar eclipses: compute subsolar and sublunar zenith coordinates.
  - [x] Great-circle distance, azimuth bearing, and horizon visibility calculation from birthplace and active residence.

---

## 6. Multi-Tradition Astrological Breadth

- [x] **6.1 Vedic / Jyotisha Substrate**
  - [x] Vimshottari Dasha and Antardasha timeline generators.
  - [x] Nakshatra positions, padas, and rulerships computed after integer ayanamsha quantization (Lahiri, Krishnamurti, Raman, Fagan-Bradley J2000 offsets with disclosed approximate general-precession evolution; official school-specific models remain future work).

- [x] **6.2 Mesoamerican / Mayan Cycles**
  - [x] Tzolk'in 260-day Sacred Round mapping (13 numbers x 20 day signs).
  - [x] Haab' 365-day solar calendar correlation.

- [x] **6.3 Western Traditional Apparatus**
  - [x] Essential and accidental dignities (rulership, exaltation, triplicity, terms, faces).
  - [x] Hellenistic Lots (Fortune, Spirit, Eros, Necessity) with day/night sect branching.
  - [x] Antiscia and Contra-antiscia reflection points across solstice axes.

---

## 7. Data Sovereignty, Exports & Offline Portability

- [x] **7.1 Comprehensive ZIP Archive Export**
  - [x] Bundler generating a standalone, offline-accessible archive:
    - `report.html`: Self-contained interactive report with embedded CSS, zero external runtime scripts required.
    - `souvenir.html`: The Mistral-generated personal commemorative keepsake.
    - `chart.svg`: Scalable vector graphics of the natal wheel and aspect grid.
    - `calculations.json`: Raw calculation ledger, residue trays, and audit logs.
  - [x] No telemetry. Archives are built locally with integrity checksums. AI and cloud voice services receive personal data only when separately enabled; private avatar notes require additional sharing consent.
