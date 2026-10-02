// profile.jsx — opt-in local profile and Life Chapters UI.
//
// Birth data and residence history stay in this browser. The editor only
// emits canonical city keys from cities.jsx, and chapters are normalized by
// chapters.jsx before any relocation calculation uses them.

function LifeChaptersEditor({
  chapters = [], birthPlaceKey, onChange, onSave, onClear, profileState,
}) {
  const [confirmClear, setConfirmClear] = React.useState(false);
  const rows = Array.isArray(chapters) ? chapters : [];
  const cityOptions = CITIES.map((city) => ({
    value: cityKey(city),
    label: `${city.name} · ${city.region}`,
    searchKey: `${city.name} ${city.region}`,
    sub: city.tz || `UTC${city.off >= 0 ? "+" : ""}${city.off}`,
  }));

  const update = (index, field, value) => {
    onChange(rows.map((row, i) => i === index ? { ...row, [field]: value } : row));
  };
  const add = () => {
    const city = CITIES.find((candidate) => cityKey(candidate) !== birthPlaceKey) || CITIES[0];
    onChange([...rows, {
      id: `chapter-${Date.now()}-${rows.length}`,
      placeKey: cityKey(city),
      startISO: "",
      endISO: "",
      open: true,
    }]);
  };
  const remove = (index) => onChange(rows.filter((_, i) => i !== index));
  const invalidRows = rows.reduce((out, row, index) => {
    if (row.startISO && row.endISO && row.endISO <= row.startISO) out.push(index);
    return out;
  }, []);
  const hasSavedProfile = !!(profileState && profileState.savedAt);

  return (
    <section className="profile-card" aria-labelledby="profile-title">
      <div className="profile-head">
        <div>
          <div className="profile-kicker">private local profile</div>
          <h2 id="profile-title">Make the reading follow your life</h2>
        </div>
        <span className="profile-local">this device only</span>
      </div>
      <p className="profile-copy">
        Add the places you have lived. Your natal planets stay fixed; the app recalculates
        the angles and houses for each place, and return charts use the place active on that date.
      </p>

      <div className="profile-chapters">
        {rows.length === 0 && (
          <p className="profile-empty">No life chapters yet. Your birthplace remains the location for every chart.</p>
        )}
        {rows.map((row, index) => {
          const invalid = invalidRows.includes(index);
          return (
            <div className="profile-chapter" key={row.id || index}>
              <div className="profile-chapter-title">
                <span>Chapter {index + 1}</span>
                <button type="button" onClick={() => remove(index)} aria-label={`Remove life chapter ${index + 1}`}>remove</button>
              </div>
              <SearchablePicker
                label="Place lived"
                value={row.placeKey}
                options={cityOptions}
                onChange={(value) => update(index, "placeKey", value)}
                placeholder="type a city or military base…"
              />
              <div className="profile-date-row">
                <label>
                  <span>From</span>
                  <input type="date" value={row.startISO || ""} onChange={(event) => update(index, "startISO", event.target.value)} />
                </label>
                <label>
                  <span>Until</span>
                  <input type="date" value={row.endISO || ""} min={row.startISO || undefined} onChange={(event) => update(index, "endISO", event.target.value)} />
                </label>
              </div>
              <p className={`profile-row-note ${invalid ? "is-error" : ""}`}>
                {invalid
                  ? "The end date must be later than the start date."
                  : row.endISO ? "The next chapter can begin after this date." : "Leave Until blank if this is your current place."}
              </p>
            </div>
          );
        })}
      </div>

      <div className="profile-actions">
        <button type="button" className="profile-add" onClick={add}>+ add a life chapter</button>
        <button type="button" className="profile-save" disabled={invalidRows.length > 0} onClick={onSave}>save profile locally</button>
        {hasSavedProfile && (
          <button
            type="button"
            className={`profile-clear ${confirmClear ? "is-confirming" : ""}`}
            onClick={() => {
              if (!confirmClear) { setConfirmClear(true); return; }
              onClear();
              setConfirmClear(false);
            }}
            onBlur={() => setConfirmClear(false)}
          >{confirmClear ? "confirm remove saved copy" : "forget saved profile"}</button>
        )}
      </div>
      {profileState && profileState.message && (
        <p className={`profile-status ${profileState.error ? "is-error" : ""}`} role={profileState.error ? "alert" : "status"}>
          {profileState.message}
        </p>
      )}
    </section>
  );
}

function LifeChapterSummary({ chart, chapters = [] }) {
  const data = React.useMemo(() => {
    if (!chart || typeof window.normalizeChapters !== "function") return null;
    const normalized = window.normalizeChapters(chapters, chart);
    if (!normalized.chapters.length) return null;
    const nowJd = typeof dateToJD === "function" ? dateToJD(new Date()) : null;
    const active = !chart.timeUnknown && Number.isFinite(nowJd)
      ? window.activeChapter(normalized.chapters, chart, nowJd)
      : null;
    return {
      ...normalized,
      active,
      digest: window.chapterDigest(chart, normalized.chapters),
    };
  }, [chart, chapters]);

  if (!data) return null;
  return (
    <section className="chapter-summary" aria-labelledby="chapter-summary-title">
      <div>
        <div className="profile-kicker">life chapters · relocated chart</div>
        <h2 id="chapter-summary-title">
          {data.active ? `Current place: ${data.active.place.label}` : "Residence history saved"}
        </h2>
      </div>
      <div className="chapter-summary-lines">
        {data.digest.map((line, index) => <p key={index}>{line}</p>)}
      </div>
      {data.dropped > 0 && <p className="profile-status is-error">{data.dropped} chapter {data.dropped === 1 ? "entry was" : "entries were"} skipped because the place or dates were invalid.</p>}
    </section>
  );
}

Object.assign(window, { LifeChaptersEditor, LifeChapterSummary });
