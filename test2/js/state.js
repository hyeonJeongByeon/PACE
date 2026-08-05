// SessionState (HANDOVER_SPEC_V2.md §10) + §3.4 scoring (screener-driven,
// preferred_focus tie-break ONLY) + §7.7 intensity + transition logging.

window.PACE_STATE = (function () {

  function newSession(cfg) {
    return {
      session_id: 'pace2-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
      created_at: new Date().toISOString(),
      spec_version: 'handover-v2',
      session_mode: cfg.SESSION_MODE,       // facilitated | self_serve (§5.1)
      stage: 'education',
      survey_responses: null,               // includes current_treatments
      screener_scores: null,                // per-component vector
      screener_total: null,                 // 0–16 (§3.4)
      preferred_focus: null,
      assigned_component: null,             // from §3.4 scoring — AUDIT: screener-driven
      feedback_intensity: null,             // light | standard (§7.7)
      scenario: null,                       // incl. clinician_knows / does_not_know
      persona: null,                        // incl. yield_conditions (§4.5)
      embedded_opportunities: [],
      transcript: [],
      yield_events: [],                     // [{behavior, turn, met_by}] (§10)
      live_tips_sent: [],                   // [{turn, opportunity_id}] (§8)
      turn_annotations: null,               // incl. linked_opportunity (§7.2)
      dropped_annotations: [],              // negatives removed by §7.5 anchoring
      resolution_state: null,               // resolved_early | resolved_at_cap | unresolved
      report_card: null,
      visit: {
        started_at: null, ended_at: null,
        participant_turns: 0,
        in_wrapup: false, in_grace: false, grace_turns_used: 0,
        must_ask_asked: false,
        exited_early: false,
      },
      transitions: [],
    };
  }

  function logTransition(S, from, to, note) {
    S.transitions.push({ ts: new Date().toISOString(), from, to, note: note || null });
    S.stage = to;
    console.log('[PACE transition]', from, '→', to, note || '');
  }

  // §3.4 — audit-critical: assigned_component comes from the SCREENER.
  // preferred_focus is tie-breaker + research variable only (pilot F8).
  // CONFIRM(§9.3): cluster taxonomy may replace this; swap this function only.
  function assignComponent(survey) {
    const weights = { Never: 0, Sometimes: 1, Often: 2 };
    const scores = { P: 0, A: 0, C: 0, E: 0 };
    let total = 0;
    window.PACE_SURVEY.screener.forEach(item => {
      const w = weights[survey[item.key]] || 0;
      scores[item.component] += w;
      total += w;
    });
    const max = Math.max(...Object.values(scores));
    const tied = Object.keys(scores).filter(k => scores[k] === max);
    let assigned;
    if (tied.length === 1) assigned = tied[0];
    else if (tied.includes(survey.preferred_focus)) assigned = survey.preferred_focus; // tie-break 1
    else assigned = survey.preferred_focus;                                            // tie-break 2
    return { scores, total, assigned };
  }

  // §7.7 — thresholds live in config, not code.
  function feedbackIntensity(screenerTotal, cfg) {
    return screenerTotal <= cfg.LIGHT_MAX ? 'light' : 'standard';
  }

  return { newSession, logTransition, assignComponent, feedbackIntensity };
})();
