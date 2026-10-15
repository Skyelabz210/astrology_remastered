// hcrm-app.jsx — standalone shell for the HCRM Console.
// Reuses the landing entry (date/time/place pickers + globe) to produce a
// chart, then mounts the register console.

const { useState: $haState, useMemo: $haMemo } = React;

const HCRM_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dateISO":     "1980-10-21T17:31:00-04:00",
  "lat":         35.1408,
  "lng":         -79.0058,
  "tz":          "America/New_York",
  "placeLabel":  "Fort Liberty (Bragg) · NC",
  "timeUnknown": false,
  "houseSystem": "whole",
  "sect":        "auto"
}/*EDITMODE-END*/;

// WP-19: render-time error boundary — thin wrapper over errors.jsx's
// ErrorBoundary (same component app.jsx uses), replacing the ad-hoc local
// class this file used to define. Preserves this console's own title
// wording; ErrorBoundary already surfaces the caught error's message.
function HBoundary({ children }) {
  return (
    <ErrorBoundary title="the register map couldn't be drawn" resetLabel="reset">
      {children}
    </ErrorBoundary>
  );
}

// WP-19: status banners (SYNTHETIC ephemeris badge, polar-latitude
// house-system fallback, DST ambiguous/nonexistent note, unknown-time
// reminder, plus any pushed chart-build error) — same logic app.jsx's
// ChartStatusBanners applies, duplicated here rather than shared since
// this console does not load app.jsx (see hcrm-app.jsx's own <script>
// tags in HCRM Console.html / HCRM Console-print.html).
function HcrmStatusBanners({ chart, birth, banners, onDismiss }) {
  const notes = [];

  if (typeof window !== "undefined" && window.EPHEMERIS_MODE === "SYNTHETIC") {
    notes.push({
      id: "synthetic-mode",
      kind: "info",
      text: "Synthetic demo positions — illustrative mean motion without a validated angular error bound. Use the loaded ephemeris for astronomical readings.",
    });
  }

  if (chart && chart.positionWarnings) {
    chart.positionWarnings.forEach((text, i) => notes.push({ id: `position-source-${i}`, kind: "info", text }));
  }

  if (chart && birth && typeof window !== "undefined" && window.Validate && window.HousesPolicy) {
    const warning = window.Validate.polarHouseWarning(
      birth.lat, birth.houseSystem, window.HousesPolicy.POLAR_FALLBACK_POLICY
    );
    if (warning) notes.push({ id: "polar-house", kind: "warn", text: warning.message });
  }

  if (birth && birth.dstNote) {
    notes.push({ id: "dst-note", kind: "warn", text: birth.dstNote });
  }

  if (chart && chart.timeUnknown) {
    notes.push({
      id: "time-unknown",
      kind: "info",
      text: "Birth time unknown — positions computed for 12:00 local. Ascendant, Midheaven, houses, and the Moon's exact degree are not reliable on this register map.",
    });
  }

  return (
    <>
      {notes.length > 0 && (
        <div className="chart-notes">
          {notes.map((n) => (
            <div key={n.id} className={`chart-note ${n.kind === "warn" ? "chart-note-warn" : ""}`}>
              <span className="chart-note-icon" aria-hidden="true">{n.kind === "warn" ? "⚠" : "ⓘ"}</span>
              <span>{n.text}</span>
            </div>
          ))}
        </div>
      )}
      {typeof ErrorBanner !== "undefined" && <ErrorBanner banners={banners} onDismiss={onDismiss} />}
    </>
  );
}

// The register console is another view of the same local profile. When
// older profiles have no picker draft, reconstruct it in the birth zone
// instead of opening the repository's alpha birth on the next Back action.
function hcrmBirthForm(birth) {
  const date = new Date(birth.dateISO);
  if (!Number.isFinite(date.getTime())) return null;
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-GB', { timeZone: birth.tz || 'UTC',
      year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
      hourCycle: 'h23' }).formatToParts(date);
  } catch { return null; }
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const hour = Number(values.hour);
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day),
    hour12: hour % 12 || 12, minute: Number(values.minute), meridiem: hour < 12 ? 'AM' : 'PM',
    place: birth.placeKey || birth.placeLabel, subjectName: birth.subjectName || 'You',
    timeUnknown: !!birth.timeUnknown };
}

function HCRMApp() {
  const [storedProfile] = $haState(() => window.ProfileStore ? window.ProfileStore.load() : null);
  const [screen, setScreen] = $haState("console");
  const [birth, setBirth] = $haState(() => ({ ...HCRM_DEFAULTS,
    ...(storedProfile && storedProfile.settings || {}) }));
  const [formState, setFormState] = $haState(() => storedProfile && storedProfile.birthForm || hcrmBirthForm(birth));
  const [chapterDrafts, setChapterDrafts] = $haState(() => ({
    [window.chapterBirthKey(birth)]: storedProfile && Array.isArray(storedProfile.chapters)
      ? storedProfile.chapters : window.alphaLifeChapters(birth),
  }));
  const chaptersFor = person => window.chapterRowsFor(chapterDrafts, person);
  const chapters = chaptersFor(birth);
  const onChaptersChange = (rows, person = birth) => {
    const owner = window.chapterBirthKey(person);
    if (owner) setChapterDrafts(prior => ({ ...prior, [owner]: rows }));
  };
  const [profileState, setProfileState] = $haState({
    savedAt: storedProfile && storedProfile.savedAt || null,
    message: storedProfile ? 'Your local profile is loaded.' : 'Alpha chart example; enter your own birth details to use another profile.',
    error: false,
  });
  const { banners, pushError, dismiss } = useErrorBanner();

  const birthForPayload = payload => ({ ...birth,
      dateISO: payload.dateISO, lat: payload.lat, lng: payload.lng,
      tz: payload.tz || null,
      placeLabel: payload.placeLabel, placeKey: payload.placeKey || payload.placeLabel, subjectName: payload.subjectName || "You", houseSystem: birth.houseSystem, sect: birth.sect,
      timeUnknown: !!payload.timeUnknown,
      dstNote: payload.dstNote || null,
  });
  const onCast = (payload) => {
    onChaptersChange(chaptersFor(payload), payload);
    setBirth(birthForPayload(payload));
    setFormState(payload.formState);
    setScreen("console");
  };
  const onSaveProfile = payload => {
    const nextBirth = birthForPayload(payload), rows = chaptersFor(payload);
    if (!window.ProfileStore || !window.ProfileStore.save(nextBirth, rows, payload.formState)) {
      setProfileState({ savedAt: null, message: 'This browser blocked local profile storage.', error: true });
      return;
    }
    onChaptersChange(rows, payload); setBirth(nextBirth); setFormState(payload.formState);
    setProfileState({ savedAt: new Date().toISOString(), message: 'Saved on this device. Nothing was uploaded.', error: false });
  };
  const onClearProfile = () => {
    if (window.ProfileStore) window.ProfileStore.clear();
    setProfileState({ savedAt: null, message: 'Saved copy removed. The current form is unchanged.', error: false });
  };

  const chart = $haMemo(() => {
    if (screen !== "console") return null;
    try {
      return computeNatal({
        dateISO: birth.dateISO, lat: birth.lat, lng: birth.lng,
        tz: birth.tz || null,
        houseSystem: birth.houseSystem, sect: birth.sect, placeLabel: birth.placeLabel, placeKey: birth.placeKey, subjectName: birth.subjectName || "You",
        timeUnknown: !!birth.timeUnknown, orbScale: birth.orbScale || 1,
      });
    } catch (e) { pushError(e, "register map"); return null; }
  }, [screen, birth, pushError]);
  const personal = window.usePersonalReading(chart, chapters, { ...birth, agentOn: false });

  if (screen === "landing") {
    return (
      <HBoundary>
        <Landing initial={formState} onCast={onCast} mode="hcrm"
          chapters={chapters} chaptersForBirth={chaptersFor} onChaptersChange={onChaptersChange}
          profileState={profileState} onSaveProfile={onSaveProfile} onClearProfile={onClearProfile} />
      </HBoundary>
    );
  }
  if (!chart) {
    return (
      <div className="boundary">
        <HcrmStatusBanners chart={null} birth={birth} banners={banners} onDismiss={dismiss} />
        <div className="boundary-title">the chart wouldn’t cast</div>
        <div className="boundary-sub">those birth details didn’t resolve into a chart — the note above says what stopped it.</div>
        <button onClick={() => setScreen("landing")}>back</button>
      </div>
    );
  }
  // Birth-place clock, not device clock — see AstroCore.birthClockParts.
  const label = `${AstroCore.birthClockParts(birth.dateISO, birth.tz).dateStr} · ${birth.placeLabel}`;
  return (
    <HBoundary>
      <HcrmStatusBanners chart={chart} birth={birth} banners={banners} onDismiss={dismiss} />
      <p role="note">{storedProfile ? 'Register view of your saved local birth profile.' : 'Alpha chart example — use Back to enter your own birth profile.'}</p>
      <window.PersonalArchiveButton chart={personal.chart || chart} context={personal.context} />
      <HCRMConsole chart={chart} birthLabel={label} onBack={() => setScreen("landing")} />
    </HBoundary>
  );
}

Object.assign(window, { hcrmBirthForm });
ReactDOM.createRoot(document.getElementById('root')).render(<HCRMApp />);
