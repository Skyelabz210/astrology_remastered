function BirthWheel({ label, value, options, onChange, disabled }) {
  const ref = React.useRef(null);
  const drag = React.useRef(null);
  const index = options.findIndex(o => String(o.value) === String(value));
  const indexRef = React.useRef(index); indexRef.current = index;
  function step(delta) {
    const next = Math.max(0, Math.min(options.length - 1, indexRef.current + delta));
    if (next !== indexRef.current) { indexRef.current = next; onChange(options[next].value); }
  }
  React.useEffect(() => {
    const node = ref.current;
    const wheel = e => { if (!disabled) { e.preventDefault(); step(e.deltaY > 0 ? 1 : -1); } };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  });
  return <div ref={ref} className="birth-wheel" role="spinbutton" tabIndex={disabled ? -1 : 0}
    aria-label={'Spin ' + label} aria-valuemin={0} aria-valuemax={options.length - 1}
    aria-valuenow={Math.max(0, index)} aria-valuetext={String(value)} aria-disabled={!!disabled}
    onKeyDown={e => { if (disabled) return; if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); step(e.key === 'ArrowDown' ? 1 : -1); } }}
    onPointerDown={e => { if (!disabled) { drag.current = e.clientY; e.currentTarget.setPointerCapture(e.pointerId); } }}
    onPointerMove={e => { if (drag.current === null || disabled) return; const delta = Math.trunc((drag.current - e.clientY) / 22); if (delta) { step(delta); drag.current = e.clientY; } }}
    onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
    {[-1, 0, 1].map(offset => { const option = options[index + offset]; return <div key={offset} className={offset === 0 ? 'wheel-current' : 'wheel-neighbor'} aria-hidden="true">{option ? option.label : '·'}</div>; })}
  </div>;
}

// landing.jsx — Astrology Remastered landing screen.
// Strict pickers (native selects, no free text). Default: San Antonio · TX.

function Picker({ label, value, options, onChange, wide, disabled }) {
  return (
    <label className={`pk ${wide ? "pk-wide" : ""}`}>
      <span className="pk-lbl">{label}</span>
      <BirthWheel label={label} value={value} options={options} onChange={onChange} disabled={disabled} />
      <span className="pk-wrap">
        <select
          className="pk-sel"
          aria-label={label}
          disabled={disabled}
          value={String(value)}
          onChange={(e) => {
            const v = e.target.value;
            const n = Number(v);
            onChange(Number.isFinite(n) && String(n) === v ? n : v);
          }}
        >
          {options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>{o.label}</option>
          ))}
        </select>
        <span className="pk-chev" aria-hidden="true">▾</span>
      </span>
    </label>
  );
}

// SearchablePicker — typeahead constrained to canonical options. The text
// input filters; only an option click commits. Cannot accept free text.
function SearchablePicker({ label, value, options, onChange, placeholder }) {
  const [query, setQuery] = React.useState("");
  const [open, setOpen]   = React.useState(false);
  const [focusIdx, setFocusIdx] = React.useState(0);
  const wrapRef = React.useRef(null);
  const inputRef = React.useRef(null);
  const listRef = React.useRef(null);

  const selected = options.find((o) => o.value === value);

  const q = query.trim().toLowerCase();
  // Expand common abbreviations: ft → fort, st → saint, mt → mount.
  // We do it bidirectionally on the haystack so either spelling matches.
  const expandAbbrev = (s) => s
    .replace(/\bft\.?\b/g, "fort")
    .replace(/\bst\.?\b/g, "saint")
    .replace(/\bmt\.?\b/g, "mount");
  const qExp = expandAbbrev(q);
  const filtered = !q ? options : options.filter((o) => {
    const hay = (o.label + " " + (o.searchKey || "")).toLowerCase();
    return window.PlaceSearch ? window.PlaceSearch.matchesPlace(q, hay) : hay.includes(q) || hay.includes(qExp) || expandAbbrev(hay).includes(qExp);
  });

  // close on outside click
  React.useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // scroll active option into view
  React.useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector(".pk-opt.is-focus");
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [focusIdx, open]);

  const commit = (o) => {
    if (!o) return;
    onChange(o.value);
    setQuery("");
    setOpen(false);
  };

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setFocusIdx((i) => Math.min(filtered.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setFocusIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); commit(filtered[focusIdx]); }
    else if (e.key === "Escape") { setOpen(false); setQuery(""); }
  };

  // WP-20: full keyboard operability was already present — ArrowUp/Down
  // move focusIdx, Enter commits filtered[focusIdx], Escape closes — this
  // just adds the ARIA combobox/listbox roles so a screen reader announces
  // the same state a sighted keyboard user already relies on (expanded
  // state, option count, which option is active).
  const listboxId = React.useId ? React.useId() : "pk-list";
  return (
    <label className="pk pk-wide pk-search" ref={wrapRef}>
      <span className="pk-lbl">{label}</span>
      <div className="pk-wrap pk-wrap-search">
        <input
          ref={inputRef}
          className="pk-sel pk-input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={open && filtered[focusIdx] ? `${listboxId}-opt-${focusIdx}` : undefined}
          value={open ? query : (selected ? selected.label : "")}
          placeholder={placeholder || "type to search…"}
          onFocus={() => { setOpen(true); setQuery(""); setFocusIdx(0); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setFocusIdx(0); }}
          onKeyDown={onKey}
          autoComplete="off"
          spellCheck="false"
        />
        <span className="pk-chev" aria-hidden="true">▾</span>
        {open && (
          <div className="pk-list" ref={listRef} role="listbox" id={listboxId} aria-label={`${label} results`}>
            {filtered.length === 0 && (
              <div className="pk-empty">no match. only listed places can be selected.</div>
            )}
            {filtered.slice(0, 80).map((o, i) => (
              <div
                key={String(o.value)}
                id={`${listboxId}-opt-${i}`}
                role="option"
                aria-selected={o.value === value}
                className={`pk-opt ${i === focusIdx ? "is-focus" : ""} ${o.value === value ? "is-sel" : ""}`}
                onMouseEnter={() => setFocusIdx(i)}
                onMouseDown={(e) => { e.preventDefault(); commit(o); }}
              >
                <span className="pk-opt-label">{o.label}</span>
                {o.sub && <span className="pk-opt-sub">{o.sub}</span>}
              </div>
            ))}
            {filtered.length > 80 && (
              <div className="pk-more">+{filtered.length - 80} more — refine search</div>
            )}
          </div>
        )}
      </div>
    </label>
  );
}

function Landing({
  initial, onCast, mode, onBack, agentOn, onToggleAgent,
  chapters, chaptersForBirth, onChaptersChange, profileState, onSaveProfile, onClearProfile,
}) {
  const isPartner = mode === "partner";
  const isHcrm = mode === "hcrm";
  const pad = (n) => String(n).padStart(2, "0");
  const currentYear = new Date().getFullYear();

  // Owner's default nativity — 21 October 1980, 5:31 PM, Fort Liberty
  // (Bragg), NC. The same instant app.jsx's DEFAULT_SETTINGS and
  // hcrm-app.jsx's HCRM_DEFAULTS carry as an ISO string with the −04:00
  // (EDT) offset that tzresolve.js derives from the city's IANA zone for
  // that date; DEFAULT_CITY_KEY (cities.jsx) is the matching place.
  // test/present/defaults.test.js asserts these four agree, including that
  // the pickers below round-trip through tzresolve to the same instant.
  //
  // A PARTNER chart is a different person, so it deliberately does NOT
  // inherit the owner's birth data — the partner form opens on a neutral
  // noon date the reader is expected to replace.
  const [year,     setYear]     = React.useState(initial?.year     ?? (isPartner ? 1990 : 1980));
  const [month,    setMonth]    = React.useState(initial?.month    ?? (isPartner ? 3 : 10));
  const [day,      setDay]      = React.useState(initial?.day      ?? 21);
  const [hour12,   setHour12]   = React.useState(initial?.hour12   ?? (isPartner ? 12 : 5));
  const [minute,   setMinute]   = React.useState(initial?.minute   ?? (isPartner ? 30 : 31));
  const [meridiem, setMeridiem] = React.useState(initial?.meridiem ?? "PM");
  const [place,    setPlace]    = React.useState(() => { const key = initial?.place ?? (isPartner ? "San Antonio · TX" : DEFAULT_CITY_KEY); const city = findCity(key); return city ? cityKey(city) : key; });
  const [subjectName, setSubjectName] = React.useState(initial?.subjectName ?? (isPartner ? "" : "You"));
  const [timeUnknown, setTimeUnknown] = React.useState(initial?.timeUnknown ?? false);
  const [hoverKey, setHoverKey] = React.useState(null);
  const [formError, setFormError] = React.useState(null);

  // Whether the ElevenLabs narration path is actually live right now — the
  // privacy note below is conditioned on this rather than on the voice
  // toggle, because with no stored key voice.jsx narrates through the
  // browser's own offline engine and nothing leaves the page.
  const voiceEgress = typeof window !== "undefined" && !!window.ElevenLabs
    && (() => { try { return window.ElevenLabs.isConfigured(); } catch { return false; } })();

  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  // days valid for the picked month/year (handles leap years)
  const daysInMonth = new Date(year, month, 0).getDate();
  React.useEffect(() => {
    if (day > daysInMonth) setDay(daysInMonth);
  }, [year, month, daysInMonth, day]);

  const years   = [];
  for (let y = 1800; y <= currentYear; y++) years.push(y);
  const hours   = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const buildPayload = (reportError = true) => {
    if (reportError) setFormError(null);
    // WP-19: real-calendar date validation (leap years etc.). The
    // Month/Day/Year pickers above are already constrained to real dates
    // by construction — `daysInMonth` is leap-year aware and the Day
    // picker's option list never exceeds it — so this should be
    // unreachable through ordinary interaction with this form; it is a
    // defensive re-check (not dead code: `initial` can hand this
    // component a stale day for a different month/year on first mount,
    // before the daysInMonth effect below has a chance to correct it) that
    // also gives requirement 3 an inline, user-visible message instead of
    // trusting the picker silently.
    if (typeof window !== "undefined" && window.Validate && !window.Validate.isValidCalendarDate({ year, month, day })) {
      if (reportError) setFormError(`${months[month - 1]} ${day}, ${year} is not a real calendar date.`);
      return null;
    }
    const city = findCity(place);
    if (!city) { if (reportError) setFormError("Choose a listed birthplace before casting. Unknown names cannot supply verified coordinates or a time zone."); return null; }
    const h24 = meridiem === "AM"
      ? (hour12 === 12 ? 0  : hour12)
      : (hour12 === 12 ? 12 : hour12 + 12);

    // WP-18: unknown birth time still computes planetary positions using
    // local noon (12:00), same as the pre-WP-18 "use 12:00 PM if unknown"
    // hint below — but now that fact is carried on the payload as
    // `timeUnknown` so the resulting chart can flag itself
    // (`chart.timeUnknown`) for downstream ASC/MC/house-precision
    // suppression (WP-19/WP-29 own the actual suppression UI).
    const effHour   = timeUnknown ? 12 : h24;
    const effMinute = timeUnknown ? 0  : minute;

    // WP-18: resolve the actual UTC instant via tzresolve.js's DST-aware
    // offset search (city.tz), falling back to the legacy fixed `off`
    // offset only if tzresolve.js didn't load (offline / not yet wired
    // into this page's <script> tags) or a city is missing `tz`.
    const resolver = (typeof window !== "undefined" && window.TzResolve)
      ? window.TzResolve.resolveUtcInstant
      : null;
    let dateISO, dstNote = null;
    if (resolver && city.tz) {
      const r = resolver({ year, month, day, hour: effHour, minute: effMinute }, city.tz);
      if (r.kind === "ok") {
        dateISO = r.instant;
      } else if (r.kind === "nonexistent") {
        // Spring-forward gap: the entered wall-clock time never occurred
        // that day. Defensible default (documented in tzresolve.js's
        // JSDoc): fall back to the first valid instant AFTER the gap —
        // the conventional "spring forward" resolution — and leave a
        // note; WP-19 owns actually surfacing this to the user instead
        // of silently swallowing it.
        dateISO = r.nearestValid[1];
        dstNote = `${pad(effHour)}:${pad(effMinute)} did not exist that day at ${city.name} (spring-forward) — used the nearest valid time after the jump.`;
      } else { // r.kind === "ambiguous"
        // Fall-back repeat: two valid UTC instants, exactly 1h apart.
        // Deterministic default: the earlier (pre-transition) one.
        dateISO = r.instants[0];
        dstNote = `${pad(effHour)}:${pad(effMinute)} occurred twice that day at ${city.name} (fall-back) — used the earlier of the two.`;
      }
    } else {
      dateISO = buildBirthISO({ year, month, day, hour: effHour, minute: effMinute, off: city.off });
    }

    return {
      dateISO,
      lat: city.lat,
      lng: city.lng,
      // Birth city's IANA zone, so headers can echo the birth instant in the
      // BIRTH PLACE's own clock rather than whatever zone the viewing device
      // happens to be in. null when the city carries only a legacy fixed
      // offset — displays then fall back to the device zone, the pre-fix
      // behavior.
      tz: city.tz || null,
      placeLabel: `${city.name} · ${city.region}`,
      placeKey: cityKey(city),
      subjectName: (subjectName || "").trim() || (isPartner ? "Them" : "You"),
      timeUnknown,
      dstNote,
      formState: { year, month, day, hour12, minute, meridiem, place, subjectName, timeUnknown },
    };
  };

  // Resolve the form's owner without setting validation state during render.
  // Read its chapter collection immediately, rather than waiting until Cast.
  const chapterBirth = React.useMemo(() => {
    if (!chaptersForBirth) return null;
    try { return buildPayload(false); } catch { return null; }
  }, [year, month, day, hour12, minute, meridiem, place, subjectName, timeUnknown]);
  const formChapters = chaptersForBirth ? chaptersForBirth(chapterBirth) : chapters;

  const submit = (e) => {
    if (e) e.preventDefault();
    const payload = buildPayload();
    if (!payload) return;
    // Prime SpeechSynthesis inside the user-gesture so the first
    // narration isn't silently blocked by autoplay policy.
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        window.speechSynthesis.speak(u);
      }
    } catch {}
    onCast(payload);
  };

  return (
    <div className="landing">
      <div className="landing-grid">
        <section className="landing-left">
          {isPartner && <div className="landing-brand">
            {isPartner && <button type="button" className="hdr-back landing-back" onClick={onBack} aria-label="Back to your chart">←</button>}


          </div>}

          <h1 className="landing-title">
            {isPartner ? <>Who are you <em>meeting?</em></>
              : isHcrm ? <>The <em>register map.</em></>
              : <>Astrology, <em>remastered.</em></>}
          </h1>
          <p className="landing-tagline">
            {isPartner
              ? "Enter the second chart. The engine compares the two across every cross-aspect, house overlay, and — uniquely — the phase between your two birth points on the time-cylinder."
              : isHcrm
              ? "Enter a birth event. Every body is projected to exact integer arcseconds and reduced through the full prime basis 2·3·5·7·11·13·17·19 — the chart becomes a residue map of the human, with the shadow-prime witness lanes exposed."
              : "Explore your natal chart with astronomical planetary positions, traditional techniques, and exact integer residue calculations. The prime lanes offer a mathematical lens for symbolic interpretation."}
          </p>

          <form className="landing-form" onSubmit={submit}>
            {!isHcrm && <window.InterpreterSettings onConnected={() => onToggleAgent && onToggleAgent(false)} />}
            <fieldset className="lf-set">
                <legend className="lf-leg">{isPartner ? "Their name" : "Name for the reading"}</legend>
                <TweakLikeText value={subjectName} onChange={setSubjectName} placeholder={isPartner ? "a name or initial" : "your name or initial"} />
            </fieldset>
            <fieldset className="lf-set">
              <legend className="lf-leg">Date of birth</legend>
              <label className="calendar-label">Calendar<input aria-label="Birth calendar" type="date" min="1800-01-01" max={`${currentYear}-12-31`} value={`${year}-${pad(month)}-${pad(day)}`} onChange={e => {
                const parts = e.target.value.split('-').map(Number);
                if (parts.length === 3 && parts.every(Number.isFinite) && parts[0] >= 1800 && parts[0] <= currentYear) { setYear(parts[0]); setMonth(parts[1]); setDay(parts[2]); }
              }} /></label>
              <div className="lf-row">
                <Picker
                  label="Month" value={month}
                  options={months.map((m, i) => ({ value: i + 1, label: m }))}
                  onChange={setMonth}
                />
                <Picker
                  label="Day" value={day}
                  options={Array.from({ length: daysInMonth }, (_, i) => ({ value: i + 1, label: String(i + 1) }))}
                  onChange={setDay}
                />
                <Picker
                  label="Year" value={year}
                  options={years.map((y) => ({ value: y, label: String(y) }))}
                  onChange={setYear}
                />
              </div>
              {formError && <p className="lf-err" role="alert">{formError}</p>}
            </fieldset>

            <fieldset className="lf-set">
              <legend className="lf-leg">Time of birth</legend>
              {/* WP-20: `disabled` (not just the dimmed/pointerEvents-none
                  styling) so a keyboard user tabbing through the form skips
                  these three selects while time is marked unknown, instead
                  of landing on controls that look inert but still accept
                  focus and Enter/Arrow input. */}
              <div className="lf-row" style={timeUnknown ? { opacity: 0.45, pointerEvents: "none" } : undefined}>
                <Picker
                  label="Hour" value={hour12} disabled={timeUnknown}
                  options={hours.map((h) => ({ value: h, label: String(h) }))}
                  onChange={setHour12}
                />
                <Picker
                  label="Minute" value={minute} disabled={timeUnknown}
                  options={minutes.map((m) => ({ value: m, label: pad(m) }))}
                  onChange={setMinute}
                />
                <Picker
                  label="AM/PM" value={meridiem} disabled={timeUnknown}
                  options={[{ value: "AM", label: "AM" }, { value: "PM", label: "PM" }]}
                  onChange={setMeridiem}
                />
              </div>
              <label className="lf-check">
                <input
                  type="checkbox"
                  checked={timeUnknown}
                  onChange={(e) => setTimeUnknown(e.target.checked)}
                />
                <span>Time unknown — compute at 12:00 PM local, flag chart as time-unknown</span>
              </label>
              <p className="lf-hint">
                {timeUnknown
                  ? "ASC, MC, houses, and Moon-degree precision will be marked unreliable on an unknown-time chart."
                  : "Local time at place of birth, DST-corrected for the exact date."}
              </p>
            </fieldset>

            <fieldset className="lf-set">
              <legend className="lf-leg">Place of birth</legend>
              <SearchablePicker
                label="City"
                value={place}
                options={CITIES.map((c) => ({
                  value: cityKey(c),
                  label: `${c.name} · ${c.region}`,
                  searchKey: `${c.name} ${c.region} ${(c.aliases || []).join(" ")}`,
                  sub: `UTC${c.off >= 0 ? "+" : ""}${c.off}`,
                }))}
                onChange={setPlace}
                placeholder="type a city or military base…"
              />
              <p className="lf-hint">…or hold and drag the globe in any direction, then choose a city pin. Only a listed location is committed.</p>
            </fieldset>

            <button type="submit" className="lf-submit" aria-label={isPartner ? "Read the relationship" : isHcrm ? "Build the register map" : "Cast the spread"}>
              <span>{isPartner ? "Read the relationship" : isHcrm ? "Build the register map" : "Cast the spread"}</span>
              <span className="lf-arrow">→</span>
            </button>

            {!isHcrm && (
              <label className="lf-check">
                <input
                  type="checkbox"
                  checked={agentOn === true}
                  onChange={(e) => onToggleAgent && onToggleAgent(e.target.checked)}
                />
                <span>
                  Send my birth data, computed chart, and reading context to the AI "Agent interpreter" for a spoken-style reading
                  (leaving this unchecked uses the local, non-AI reading — no birth data is sent to AI providers)
                </span>
              </label>
            )}
            <p className="lf-privacy">
              {isHcrm
                ? "Every register value on this console — positions, residues, houses — is computed entirely in your browser; nothing about your birth data is sent anywhere. The register map does not use the AI \"Agent interpreter\" feature at all."
                : "Chart math — positions, houses, aspects, dignities, eclipses — is computed entirely in your browser; none of it is sent anywhere. " + (voiceEgress
                    ? "Voice narration is set to ElevenLabs and a key is stored, so the text of each reading (and that key) is sent to ElevenLabs to be spoken aloud. Reading text can contain your personal chart details; switch the voice engine to \"Browser\" in the tweaks panel to keep narration offline. "
                    : "") + (agentOn === true
                    ? "Because you ticked the checkbox above, right after you submit this form this page automatically sends " + (isPartner ? "the name you enter above and both charts' computed placements" : "the name you enter above and your birth date, time, and location") + " to the selected AI provider to generate the spoken-style \"Agent interpreter\" reading — untick it to keep everything local."
                    : "The checkbox above is off by default, so nothing is sent to an AI provider — every reading uses the local, non-AI text instead.")}
            </p>

            {!isPartner && !isHcrm && <p className="lf-hint">Your first chart run creates and saves your birth profile and living avatar on this device. Add goals and check-ins from the behavioral profile.</p>}
            {!isPartner && !isHcrm && typeof window !== "undefined" && window.LifeChaptersEditor && (
              <window.LifeChaptersEditor
                chapters={formChapters}
                birthPlaceKey={place}
                onChange={(rows) => onChaptersChange(rows, chapterBirth)}
                onApplyAlpha={Number(year) === 1980 && Number(month) === 10 && Number(day) === 21 && Number(hour12) === 5 && Number(minute) === 31 && meridiem === "PM" && !timeUnknown && findCity(place)?.lat === 35.1408 ? () => {
                  const payload = buildPayload();
                  if (payload) onChaptersChange(window.alphaLifeChapters(payload), payload);
                } : null}
                profileState={profileState}
                onSave={() => {
                  const payload = buildPayload();
                  if (payload && onSaveProfile) onSaveProfile(payload);
                }}
                onClear={onClearProfile}
              />
            )}
          </form>
        </section>

        <section className="landing-right">
          <MoonPhaseGlobe
            size={500}
            selectedKey={place}
            onSelect={setPlace}
            hoverKey={hoverKey}
            onHoverKey={setHoverKey}
          />

        </section>
      </div>
    </div>
  );
}

function TweakLikeText({ value, onChange, placeholder }) {
  return (
    <input
      className="pk-sel pk-input"
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      maxLength={24}
      autoComplete="off"
    />
  );
}

Object.assign(window, { Landing, Picker, SearchablePicker, TweakLikeText });
