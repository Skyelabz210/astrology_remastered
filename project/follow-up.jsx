// follow-up.jsx — chart-scoped questions for the agent interpreter.
//
// A question never travels alone. Natal questions carry the exact natal
// source block; synastry questions carry two separately labeled charts and
// the computed cross-chart contacts. agent.jsx verifies the returned prose
// against that same source before this component is allowed to display it.

const { useState: $fuUseState, useEffect: $fuUseEffect, useMemo: $fuUseMemo } = React;

function FollowUpQuestions({ mode = "natal", chart = null, syn = null, agentOn = false }) {
  const [question, setQuestion] = $fuUseState("");
  const [turns, setTurns] = $fuUseState([]);
  const [loading, setLoading] = $fuUseState(false);
  const [error, setError] = $fuUseState(null);

  const isSynastry = mode === "synastry";
  const scopeKey = $fuUseMemo(() => {
    if (isSynastry && syn) {
      return `synastry:${chartIdentityKey(syn.chartA)}::${chartIdentityKey(syn.chartB)}`;
    }
    return chart ? `natal:${chartIdentityKey(chart)}` : "no-chart";
  }, [isSynastry, chart, syn]);

  $fuUseEffect(() => {
    setQuestion("");
    setTurns([]);
    setLoading(false);
    setError(null);
  }, [scopeKey]);

  const scopeLabel = isSynastry && syn
    ? `${chartSubject(syn.chartA, "you")} + ${chartSubject(syn.chartB, "your partner")}`
    : `${ownerPossessive(chartSubject(chart, "you"))} natal chart`;
  const available = typeof agentAvailable === "function" && agentAvailable();
  const canAsk = agentOn && available && !loading && question.trim().length > 0;

  const submit = async (event) => {
    event.preventDefault();
    const nextQuestion = question.replace(/\s+/g, " ").trim();
    if (!nextQuestion || !agentOn || !available || loading) return;
    setLoading(true);
    setError(null);
    try {
      const answer = isSynastry
        ? await answerSynastryFollowUp(nextQuestion, syn, turns)
        : await answerNatalFollowUp(nextQuestion, chart, turns);
      setTurns((prior) => [...prior, { question: nextQuestion, answer }]);
      setQuestion("");
    } catch (err) {
      setError(String(err && err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className={`follow-up ${isSynastry ? "follow-up-synastry" : ""}`} aria-labelledby={`follow-up-title-${mode}`}>
      <div className="follow-up-head">
        <div>
          <div className="follow-up-kicker">agent follow-up</div>
          <h3 id={`follow-up-title-${mode}`} className="follow-up-title">Ask about this {isSynastry ? "synastry" : "chart"}</h3>
        </div>
        <div className="follow-up-scope" title="Every answer is checked against this chart scope">
          <span className="follow-up-scope-dot" aria-hidden="true" />
          {scopeLabel}
        </div>
      </div>

      {turns.length > 0 && (
        <div className="follow-up-turns" aria-live="polite">
          {turns.map((turn, index) => (
            <div className="follow-up-turn" key={`${scopeKey}:${index}`}>
              <div className="follow-up-question"><span>You asked</span>{turn.question}</div>
              <div className="follow-up-answer"><span>Chart-linked answer</span>{turn.answer}</div>
            </div>
          ))}
        </div>
      )}

      <form className="follow-up-form" onSubmit={submit}>
        <label className="follow-up-label" htmlFor={`follow-up-input-${mode}`}>
          {isSynastry
            ? "Ask about a contact, placement, house direction, or the relationship pattern"
            : "Ask about a placement, aspect, house, or pattern in this chart"}
        </label>
        <div className="follow-up-compose">
          <textarea
            id={`follow-up-input-${mode}`}
            value={question}
            rows="2"
            maxLength="600"
            disabled={!agentOn || !available || loading}
            placeholder={isSynastry
              ? "How do our Moon placements interact?"
              : "What makes this chart's relationship pattern stand out?"}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                if (canAsk) submit(event);
              }
            }}
          />
          <button type="submit" disabled={!canAsk}>{loading ? "checking…" : "ask"}</button>
        </div>
      </form>

      {!agentOn && <div className="follow-up-note">Turn on the agent to ask a chart-linked question.</div>}
      {agentOn && !available && <div className="follow-up-note">The agent connection is unavailable in this session.</div>}
      {loading && <div className="follow-up-note" aria-live="polite">Reading the question against {scopeLabel}…</div>}
      {error && <div className="follow-up-error" role="alert">{error}</div>}
    </section>
  );
}

Object.assign(window, { FollowUpQuestions });
