// SessionState (HANDOVER_SPEC.md §2) + component scoring (§3.4) + structured
// transition logging (§7).

window.PACE_STATE = (function () {

  function newSession() {
    return {
      session_id: 'pace-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
      created_at: new Date().toISOString(),
      stage: 'education',
      survey_responses: null,
      component_scores: null,      // score vector, kept for researcher inspection
      assigned_component: null,    // P | A | C | E
      chosen_seed: null,           // scenario seed id (researcher-authorized menu)
      scenario: null,              // from stage 2
      persona: null,               // from stage 2
      embedded_opportunities: [],  // from stage 2; statuses updated live
      transcript: [],              // {ts, role: participant|clinician|coach, text, turn, opp_id?, opp_status?}
      turn_annotations: null,      // from stage 4 annotator
      report_card: null,           // from stage 4 aggregation
      resolution_state: null,      // resolved_early | resolved_at_cap | unresolved
      visit: {
        started_at: null, ended_at: null,
        participant_turns: 0,
        yield_met: false, yield_met_at_ms: null,
        nudges_used: 0, praise_used: 0,
        exited_early: false,
      },
      transitions: [],             // structured log of stage transitions
    };
  }

  function logTransition(S, from, to, note) {
    S.transitions.push({ ts: new Date().toISOString(), from, to, note: note || null });
    S.stage = to;
    console.log('[PACE transition]', from, '→', to, note || '');
  }

  // ── assigned_component — §3.4, single pluggable function ────────────────
  // CONFIRM(HANDOVER §3.4): the Prolific/ITHS challenge-cluster taxonomy may
  // replace this scoring. Swap this function only; nothing downstream changes.
  function assignComponent(survey) {
    const weights = { Never: 0, Sometimes: 1, Often: 2 };
    const scores = { P: 0, A: 0, C: 0, E: 0 };
    window.PACE_SURVEY.screener.forEach(item => {
      scores[item.component] += weights[survey[item.key]] || 0;
    });
    const max = Math.max(...Object.values(scores));
    const tied = Object.keys(scores).filter(k => scores[k] === max);
    let assigned;
    if (tied.length === 1) assigned = tied[0];
    else if (tied.includes(survey.preferred_focus)) assigned = survey.preferred_focus; // tie-break 1
    else assigned = survey.preferred_focus;                                            // tie-break 2
    return { scores, assigned };
  }

  return { newSession, logTransition, assignComponent };
})();
