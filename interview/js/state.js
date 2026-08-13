// SessionState — interview build (simplified: one survey question, no
// screener, no planted opportunities; coach judges live).

window.PACE_STATE = (function () {

  function newSession(cfg) {
    return {
      session_id: 'pace-iv-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7),
      created_at: new Date().toISOString(),
      build: 'interview',
      stage: 'education',
      problem_text: null,
      scenario: null,          // premise, clinician_knows/does_not_know, opening_turn
      persona: null,
      transcript: [],          // {ts, role, text, turn?, retracted?, repeat_of?}
      coach_events: [],        // {turn, type: praise|improve, skill, message, retry_offered, retry_taken}
      yield_events: [],        // when the patient earned smoother communication
      turn_annotations: null,
      resolution_state: null,  // closed_natural | closed_at_cap | exited
      report_card: null,
      visit: {
        started_at: null, ended_at: null,
        participant_turns: 0,
        in_wrapup: false, in_grace: false, grace_turns_used: 0,
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

  return { newSession, logTransition };
})();
