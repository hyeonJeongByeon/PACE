// PACE v2 configuration. Researcher-editable.
// LLM backend: single swappable client config (HANDOVER_SPEC.md §7 CONFIRM —
// currently the Anthropic-via-proxy path; a Vertex adapter would replace this
// object plus callModel() in app.js).
window.PACE_CONFIG = {
  PROXY_URL: 'https://pace-proxy.pace-formative.workers.dev',

  // Visit clock (replaces the 12-turn cap — Advisor 2: turns are the wrong
  // unit). The planner steers like a clinician managing the clock.
  VISIT_MINUTES: 10,        // nominal visit length the clinician manages toward
  HARD_STOP_MINUTES: 12,    // absolute failsafe; clinician closes gracefully

  // Clock phases handed to the planner (fractions of VISIT_MINUTES)
  PHASE_EXPLORE_UNTIL: 0.4,   // open + gather
  PHASE_ADDRESS_UNTIL: 0.7,   // explain + plan
  PHASE_WRAP_UNTIL: 0.9,      // steer toward resolution

  // In-session coach (researcher-authorized deviation from handover §6.8;
  // budget guardrails follow the CARE demoralization finding)
  COACH_NUDGE_BUDGET: 3,
  COACH_PRAISE_BUDGET: 1,

  // Report card volume cap (handover §6.7) — enforced in code
  MAX_LEVEL3_ITEMS: 4,        // absolute ceiling, one per component

  // Stage-2 instantiation
  MIN_OPPORTUNITIES: 3,
  MAX_OPPORTUNITIES: 5,
};
