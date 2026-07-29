// landing.jsx — Astrology Remastered landing screen.
// Strict pickers (native selects, no free text). Default: San Antonio · TX.

function Picker({ label, value, options, onChange, wide }) {
  return (
    <label className={`pk ${wide ? "pk-wide" : ""}`}>
      <span className="pk-lbl">{label}</span>
      <span className="pk-wrap">
        <select
          className="pk-sel"
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
        <span className="pk-chev">▾</span>
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
    return hay.includes(q) || hay.includes(qExp) || expandAbbrev(hay).includes(qExp);
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

  return (
    <label className="pk pk-wide pk-search" ref={wrapRef}>
      <span className="pk-lbl">{label}</span>
      <div className="pk-wrap pk-wrap-search">
        <input
          ref={inputRef}
          className="pk-sel pk-input"
          type="text"
          value={open ? query : (selected ? selected.label : "")}
          placeholder={placeholder || "type to search…"}
          onFocus={() => { setOpen(true); setQuery(""); setFocusIdx(0); }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); setFocusIdx(0); }}
          onKeyDown={onKey}
          autoComplete="off"
          spellCheck="false"
        />
        <span className="pk-chev">▾</span>
        {open && (
          <div className="pk-list" ref={listRef}>
            {filtered.length === 0 && (
              <div className="pk-empty">no match. only listed places can be selected.</div>
            )}
            {filtered.slice(0, 80).map((o, i) => (
              <div
                key={String(o.value)}
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

function Landing({ initial, onCast, mode, onBack }) {
  const isPartner = mode === "partner";
  const isHcrm = mode === "hcrm";
  const pad = (n) => String(n).padStart(2, "0");
  const currentYear = new Date().getFullYear();

  const [year,     setYear]     = React.useState(initial?.year     ?? 1990);
  const [month,    setMonth]    = React.useState(initial?.month    ?? 3);
  const [day,      setDay]      = React.useState(initial?.day      ?? 21);
  const [hour12,   setHour12]   = React.useState(initial?.hour12   ?? 12);
  const [minute,   setMinute]   = React.useState(initial?.minute   ?? 30);
  const [meridiem, setMeridiem] = React.useState(initial?.meridiem ?? "PM");
  const [place,    setPlace]    = React.useState(initial?.place    ?? DEFAULT_CITY_KEY);
  const [subjectName, setSubjectName] = React.useState(initial?.subjectName ?? (isPartner ? "" : "You"));
  const [hoverKey, setHoverKey] = React.useState(null);

  const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  // days valid for the picked month/year (handles leap years)
  const daysInMonth = new Date(year, month, 0).getDate();
  React.useEffect(() => {
    if (day > daysInMonth) setDay(daysInMonth);
  }, [year, month, daysInMonth, day]);

  const years   = [];
  for (let y = 1950; y <= currentYear; y++) years.push(y);
  const hours   = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  const submit = (e) => {
    if (e) e.preventDefault();
    // Prime SpeechSynthesis inside the user-gesture so the first
    // narration isn't silently blocked by autoplay policy.
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        window.speechSynthesis.speak(u);
      }
    } catch {}
    const city = findCity(place);
    const h24 = meridiem === "AM"
      ? (hour12 === 12 ? 0  : hour12)
      : (hour12 === 12 ? 12 : hour12 + 12);
    const dateISO = buildBirthISO({ year, month, day, hour: h24, minute, off: city.off });
    onCast({
      dateISO,
      lat: city.lat,
      lng: city.lng,
      placeLabel: `${city.name} · ${city.region}`,
      subjectName: (subjectName || "").trim() || (isPartner ? "Them" : "You"),
      formState: { year, month, day, hour12, minute, meridiem, place, subjectName },
    });
  };

  return (
    <div className="landing">
      <div className="landing-grid">
        <section className="landing-left">
          <div className="landing-brand">
            {isPartner && <button type="button" className="hdr-back landing-back" onClick={onBack}>←</button>}
            <span className="landing-mark">✦</span>
            <span className="landing-brand-text">Resonance{isPartner ? " · Synastry" : isHcrm ? " · HCRM" : ""}</span>
          </div>

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
              : "Every chart runs through the Mayan CRT substrate beneath classical astrology. The eleven lanes of the Shadow Prime — always there, never legible — are finally lit."}
          </p>

          <form className="landing-form" onSubmit={submit}>
            {isPartner && (
              <fieldset className="lf-set">
                <legend className="lf-leg">Their name</legend>
                <TweakLikeText value={subjectName} onChange={setSubjectName} placeholder="a name or initial" />
              </fieldset>
            )}
            <fieldset className="lf-set">
              <legend className="lf-leg">Date of birth</legend>
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
            </fieldset>

            <fieldset className="lf-set">
              <legend className="lf-leg">Time of birth</legend>
              <div className="lf-row">
                <Picker
                  label="Hour" value={hour12}
                  options={hours.map((h) => ({ value: h, label: String(h) }))}
                  onChange={setHour12}
                />
                <Picker
                  label="Minute" value={minute}
                  options={minutes.map((m) => ({ value: m, label: pad(m) }))}
                  onChange={setMinute}
                />
                <Picker
                  label="AM/PM" value={meridiem}
                  options={[{ value: "AM", label: "AM" }, { value: "PM", label: "PM" }]}
                  onChange={setMeridiem}
                />
              </div>
              <p className="lf-hint">Local time at place of birth. Use 12:00 PM if unknown.</p>
            </fieldset>

            <fieldset className="lf-set">
              <legend className="lf-leg">Place of birth</legend>
              <SearchablePicker
                label="City"
                value={place}
                options={CITIES.map((c) => ({
                  value: cityKey(c),
                  label: `${c.name} · ${c.region}`,
                  searchKey: `${c.name} ${c.region}`,
                  sub: `UTC${c.off >= 0 ? "+" : ""}${c.off}`,
                }))}
                onChange={setPlace}
                placeholder="type a city or military base…"
              />
              <p className="lf-hint">…or tap any pin on the globe.</p>
            </fieldset>

            <button type="submit" className="lf-submit">
              <span>{isPartner ? "Read the relationship" : isHcrm ? "Build the register map" : "Cast the spread"}</span>
              <span className="lf-arrow">→</span>
            </button>
          </form>
        </section>

        <section className="landing-right">
          <DotmatrixGlobe
            size={500}
            selectedKey={place}
            onSelect={setPlace}
            hoverKey={hoverKey}
            onHoverKey={setHoverKey}
          />
          <div className="landing-cred">
            <span>{isPartner ? "Synastry · cross-aspects · phase syndrome" : isHcrm ? "HCRM · integer arcsec · basis 2·3·5·7·11·13·17·19" : "Mayan CRT · Safe Basis 2·3·5·7·11·13 · M = 30,030"}</span>
          </div>
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
