// PACE interview build — configuration. Researcher-editable.
window.PACE_CONFIG = {
  PROXY_URL: 'https://pace-proxy.pace-formative.workers.dev',

  // Visit clock + soft close
  MAX_TURNS: 12,
  VISIT_MINUTES: 10,
  WARN_MINUTES_LEFT: 2,
  WRAPUP_TURNS_LEFT: 3,
  GRACE_EXTRA_TURNS: 2,

  // Coach (live, natural judgment each turn; see prompts/coach.js)
  COACH_PRAISE_PER_SKILL: 1,   // positive feedback at most once per skill
  COACH_IMPROVE_MAX: 4,        // soft cap on improvement interventions per session

  // Report card volume cap
  MAX_LEVEL3: 4,
};
